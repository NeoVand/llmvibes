// The training worker: owns jax-js, the model params, the optimizer state and
// the token data. The main thread drives it via a tiny RPC protocol (see
// worker-engine.ts). Training was measured FASTER in a Worker than on the main
// thread (spikes/m0/RESULTS.md), with the UI staying at 60fps.

import {
	init,
	defaultDevice,
	numpy as np,
	nn,
	jit,
	valueAndGrad,
	tree,
	blockUntilReady
} from '@jax-js/jax';
import { adam, applyUpdates } from '@jax-js/optax';
import type { ModelConfig, PerTokenInfo, TrainStepMetrics } from './engine';
import {
	initParams,
	lossFn,
	forwardLogprobs,
	paramCount,
	flattenParams,
	loadParams,
	disposeTree
} from './model';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RpcRequest {
	id: number;
	op: string;
	[key: string]: unknown;
}

const post = (msg: unknown, transfer?: Transferable[]) =>
	(self as unknown as Worker).postMessage(msg, { transfer: transfer ?? [] });

// ── worker state ─────────────────────────────────────────────────────────────
let cfg: ModelConfig | null = null;
let params: any = null;
let optState: any = null;
let solver: ReturnType<typeof adam> | null = null;
let tokenData: Uint16Array | null = null;
let jitStep: any = null;
let jitForward: any = null;
let stepCounter = 0;
let stopRequested = false;
let device = 'none';

function mulberry32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
let rng = mulberry32(1234);

const BATCH = 8;

function makeBatchOH(c: ModelConfig, data: Uint16Array) {
	const S = c.blockSize;
	const nTok = BATCH * S;
	const inputBuf = new Int32Array(nTok);
	const targetBuf = new Int32Array(nTok);
	const maxStart = data.length - S - 1;
	for (let b = 0; b < BATCH; b++) {
		const start = Math.floor(rng() * maxStart);
		for (let i = 0; i < S; i++) {
			inputBuf[b * S + i] = data[start + i];
			targetBuf[b * S + i] = data[start + i + 1];
		}
	}
	const inputIds = np.array(inputBuf, { dtype: np.int32 }).reshape([BATCH, S]);
	const posIds = np.tile(np.arange(S).astype(np.int32), [BATCH, 1]);
	const targetIds = np.array(targetBuf, { dtype: np.int32 }).reshape([BATCH, S]);
	return {
		tokenOH: nn.oneHot(inputIds, c.vocab),
		posOH: nn.oneHot(posIds, c.blockSize),
		targetOH: nn.oneHot(targetIds, c.vocab)
	};
}

/** One optimizer step; returns the loss (synced — per-step sync is currently
 * FASTER than pipelining in jax-js, see upstream issue #151). */
function trainStep(): number {
	const c = cfg!;
	const { tokenOH, posOH, targetOH } = makeBatchOH(c, tokenData!);
	const [lossVal, grads] = jitStep(tree.ref(params), tokenOH.ref, posOH.ref, targetOH.ref);
	const [updates, newOptState] = solver!.update(grads, optState, tree.ref(params));
	params = applyUpdates(params, updates);
	optState = newOptState;
	tokenOH.dispose();
	posOH.dispose();
	targetOH.dispose();
	return lossVal.item();
}

/** Fixed-shape single-sequence forward: tokens right-padded to blockSize.
 * Causal attention makes padding after the last real position irrelevant, so
 * ONE jit signature serves every prompt length (no per-length recompiles). */
function forwardSeq(tokens: number[]): Float32Array {
	const c = cfg!;
	const S = c.blockSize;
	const buf = new Int32Array(S);
	for (let i = 0; i < Math.min(tokens.length, S); i++) buf[i] = tokens[i];
	const inputIds = np.array(buf, { dtype: np.int32 }).reshape([1, S]);
	const posIds = np.arange(S).astype(np.int32).reshape([1, S]);
	const tokenOH = nn.oneHot(inputIds, c.vocab);
	const posOH = nn.oneHot(posIds, c.blockSize);
	const logprobs = jitForward(tree.ref(params), tokenOH, posOH); // [S, vocab]
	return logprobs.dataSync() as Float32Array;
}

function sampleFromRow(row: Float32Array, temperature: number, topK: number): number {
	const V = row.length;
	// logprobs → scaled logits → topK → renormalized categorical draw
	const idx = Array.from({ length: V }, (_, i) => i);
	if (topK > 0 && topK < V) {
		idx.sort((a, b) => row[b] - row[a]);
		idx.length = topK;
	}
	const t = Math.max(temperature, 1e-4);
	let maxv = -Infinity;
	for (const i of idx) maxv = Math.max(maxv, row[i] / t);
	let sum = 0;
	const ps = idx.map((i) => {
		const p = Math.exp(row[i] / t - maxv);
		sum += p;
		return p;
	});
	let r = rng() * sum;
	for (let j = 0; j < idx.length; j++) {
		r -= ps[j];
		if (r <= 0) return idx[j];
	}
	return idx[idx.length - 1];
}

// ── op handlers ──────────────────────────────────────────────────────────────
async function handleInit(req: RpcRequest) {
	const devices = await init();
	if (!devices.includes('webgpu')) throw new Error('WebGPU unavailable in worker');
	defaultDevice('webgpu');
	device = 'webgpu';
	cfg = req.config as ModelConfig;
	tokenData = new Uint16Array(req.tokenData as ArrayBuffer);
	rng = mulberry32((req.seed as number) ?? 1234);
	stepCounter = 0;
	if (params) disposeTree(params);
	if (optState) disposeTree(optState);
	params = req.checkpoint
		? loadParams(cfg, new Float32Array(req.checkpoint as ArrayBuffer))
		: initParams(cfg, (req.seed as number) ?? 42);
	await blockUntilReady(params);
	solver = adam((req.lr as number) ?? 3e-4, { b1: 0.9, b2: 0.99 });
	optState = solver.init(tree.ref(params));
	const c = cfg;
	jitStep = jit((p: any, a: any, b: any, t: any) =>
		valueAndGrad((pp: any) => lossFn(pp, c, a, b, t))(p)
	);
	jitForward = jit((p: any, a: any, b: any) => forwardLogprobs(p, c, c.blockSize, a, b));
	return { device, paramCount: paramCount(params), tokens: tokenData.length };
}

async function handleTrain(req: RpcRequest) {
	const steps = (req.steps as number) ?? 50;
	stopRequested = false;
	let done = 0;
	for (let i = 0; i < steps; i++) {
		if (stopRequested) break;
		const t0 = performance.now();
		const loss = trainStep();
		const stepMs = performance.now() - t0;
		stepCounter++;
		done++;
		const m: TrainStepMetrics = {
			step: stepCounter,
			loss,
			stepMs,
			tokensPerSec: Math.round((BATCH * cfg!.blockSize * 1000) / stepMs)
		};
		post({ id: req.id, event: 'metrics', m });
		// Yield to the worker's own event loop so 'stop' messages get through.
		if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
	}
	return { completed: done, step: stepCounter };
}

/** Full log-prob distribution over the next token given a context — powers
 * widgets that need to see (and mask) the whole distribution, like the chess
 * board's legal-move masking. ~vocab×4 bytes, transferred. */
function handleNextDist(req: RpcRequest) {
	const c = cfg!;
	const tokens = ((req.tokens as number[]) ?? []).slice(-c.blockSize);
	const lp = forwardSeq(tokens);
	const pos = Math.min(tokens.length, c.blockSize) - 1;
	const row = lp.slice(pos * c.vocab, (pos + 1) * c.vocab);
	return { row: row.buffer, __transfer: [row.buffer] };
}

function handleSample(req: RpcRequest) {
	const c = cfg!;
	const prompt = (req.promptTokens as number[]) ?? [];
	const temperature = (req.temperature as number) ?? 0.8;
	const topK = (req.topK as number) ?? 40;
	const maxTokens = Math.min((req.maxTokens as number) ?? 120, c.blockSize - 1);
	const stopAt = req.stopToken as number | undefined;
	let tokens = prompt.slice(-Math.floor(c.blockSize / 2));
	const generated: number[] = [];
	for (let i = 0; i < maxTokens; i++) {
		const lp = forwardSeq(tokens);
		const pos = Math.min(tokens.length, c.blockSize) - 1;
		const row = lp.subarray(pos * c.vocab, (pos + 1) * c.vocab) as Float32Array;
		const next = sampleFromRow(row, temperature, topK);
		if (stopAt !== undefined && next === stopAt) break;
		generated.push(next);
		tokens.push(next);
		if (tokens.length >= c.blockSize) tokens = tokens.slice(-Math.floor(c.blockSize / 2));
	}
	return { tokens: generated };
}

function handleInspect(req: RpcRequest) {
	const c = cfg!;
	const tokens = (req.tokens as number[]).slice(0, c.blockSize);
	const lp = forwardSeq(tokens);
	const out: PerTokenInfo[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const info: PerTokenInfo = { id: tokens[i], text: '' };
		if (i > 0) {
			// loss of THIS token under the model's prediction from position i-1
			const row = lp.subarray((i - 1) * c.vocab, i * c.vocab);
			info.loss = -row[tokens[i]];
			let entropy = 0;
			const pairs: Array<[number, number]> = [];
			for (let v = 0; v < c.vocab; v++) {
				const p = Math.exp(row[v]);
				if (p > 1e-9) entropy -= p * row[v];
				pairs.push([v, p]);
			}
			info.entropy = entropy;
			pairs.sort((a, b) => b[1] - a[1]);
			info.topk = pairs.slice(0, 5);
		}
		out.push(info);
	}
	return { perToken: out };
}

async function handleExport() {
	const flat = flattenParams(params);
	return { checkpoint: flat.buffer, __transfer: [flat.buffer] };
}

// ── dispatch ─────────────────────────────────────────────────────────────────
const handlers: Record<string, (req: RpcRequest) => unknown | Promise<unknown>> = {
	init: handleInit,
	train: handleTrain,
	stop: () => {
		stopRequested = true;
		return {};
	},
	sample: handleSample,
	nextdist: handleNextDist,
	inspect: handleInspect,
	export: handleExport,
	dispose: () => {
		if (params) disposeTree(params);
		if (optState) disposeTree(optState);
		params = null;
		optState = null;
		return {};
	}
};

self.onmessage = async (e: MessageEvent<RpcRequest>) => {
	const req = e.data;
	// 'stop' must preempt: handle it synchronously even mid-train.
	try {
		const handler = handlers[req.op];
		if (!handler) throw new Error(`unknown op: ${req.op}`);
		const result = (await handler(req)) as Record<string, unknown> & {
			__transfer?: Transferable[];
		};
		const transfer = result?.__transfer;
		if (transfer) delete result.__transfer;
		post({ id: req.id, ok: true, result }, transfer);
	} catch (err) {
		post({
			id: req.id,
			ok: false,
			error: err instanceof Error ? `${err.name}: ${err.message}` : String(err)
		});
	}
};
