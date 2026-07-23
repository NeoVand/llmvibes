// LLMVibes M0 spike — jax-js go/no-go benchmarks.
// Measures on this machine: (1) WebGPU env, (2) matmul GFLOP/s, (3) op coverage
// for ops the course needs (embedding gather grad, RoPE building blocks, f16),
// (4) training tokens/sec on a ~5M-param GPT (eager and jit).
// API idioms follow quectoGPT (minusxai/quectoGPT), the known-working jax-js GPT:
// params as JS trees, tree.ref before consuming calls, each tensor consumed
// exactly once unless .ref'd, per-step tensors disposed after use.

import {
	init,
	defaultDevice,
	getWebGPUDevice,
	makeJaxpr,
	numpy as np,
	nn,
	grad,
	jit,
	valueAndGrad,
	random,
	tree,
	blockUntilReady
} from '@jax-js/jax';
import { adam, applyUpdates } from '@jax-js/optax';

const logEl = document.getElementById('log')!;
function log(msg: string, cls = '') {
	const line = document.createElement('div');
	if (cls) line.className = cls;
	line.textContent = msg;
	logEl.appendChild(line);
	console.log(msg);
}
function result(section: string, data: unknown) {
	const payload = JSON.stringify({ section, ...(data as object) });
	console.log('M0RESULT ' + payload);
	log('▸ ' + payload, 'ok');
}
function fail(section: string, err: unknown) {
	const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
	console.log('M0FAIL ' + JSON.stringify({ section, error: msg }));
	log(`✗ ${section}: ${msg}`, 'bad');
}

let devices: string[] = [];
let gpuErrors = 0;
let lastGpuError = '';
let ready: Promise<void> | null = null;
function ensureInit(): Promise<void> {
	ready ??= (async () => {
		devices = await init();
		if (devices.includes('webgpu')) defaultDevice('webgpu');
		log(
			`jax-js devices: ${devices.join(', ')} (default: ${devices.includes('webgpu') ? 'webgpu' : devices[0]})`
		);
		try {
			const dev = await getWebGPUDevice();
			dev.addEventListener('uncapturederror', (e: Event) => {
				gpuErrors++;
				lastGpuError = String((e as GPUUncapturedErrorEvent).error?.message ?? e).slice(0, 200);
			});
		} catch {
			log('(no getWebGPUDevice — uncaptured-error hook unavailable)');
		}
	})();
	return ready;
}
function drainGpuErrors(): { gpuErrors: number; lastGpuError?: string } {
	const out = gpuErrors ? { gpuErrors, lastGpuError } : { gpuErrors: 0 };
	gpuErrors = 0;
	lastGpuError = '';
	return out;
}

// ---------- 1. Environment ----------
async function benchEnv() {
	log('— env —', 'hdr');
	try {
		await ensureInit();
		const info: Record<string, unknown> = { jaxDevices: devices, ua: navigator.userAgent };
		if (navigator.gpu) {
			const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
			if (adapter) {
				info.f16 = adapter.features.has('shader-f16');
				info.subgroups = adapter.features.has('subgroups' as GPUFeatureName);
				info.maxBufferMB = Math.round(adapter.limits.maxBufferSize / 1e6);
				info.maxBindingMB = Math.round(adapter.limits.maxStorageBufferBindingSize / 1e6);
				const ai = (adapter as { info?: { vendor?: string; architecture?: string } }).info;
				if (ai) info.gpu = `${ai.vendor ?? '?'} ${ai.architecture ?? ''}`.trim();
			} else {
				info.adapter = 'none';
			}
		} else {
			info.webgpu = 'unavailable';
		}
		result('env', info);
	} catch (e) {
		fail('env', e);
	}
}

// ---------- 2. Matmul throughput ----------
// Chained square matmuls (serial dependency, one live buffer) — sustained matmul
// throughput is the quantity that bounds transformer training.
async function matmulOnce(n: number, iters: number, dtype: unknown): Promise<number> {
	const keys = random.split(random.key(7), 2);
	let a = random.normal(keys.ref.slice(0), [n, n]).mul(0.01);
	let b = random.normal(keys.slice(1), [n, n]).mul(0.01);
	if (dtype) {
		a = a.astype(dtype);
		b = b.astype(dtype);
	}
	// warmup (compile + first dispatches)
	let c = np.dot(a.ref, b.ref);
	for (let i = 0; i < 2; i++) c = np.dot(c, b.ref);
	await blockUntilReady(c);
	c.dispose();
	// timed
	const t0 = performance.now();
	let acc = np.dot(a.ref, b.ref);
	for (let i = 1; i < iters; i++) acc = np.dot(acc, b.ref);
	await blockUntilReady(acc);
	const dt = (performance.now() - t0) / 1000;
	acc.dispose();
	a.dispose();
	b.dispose();
	return Math.round((iters * 2 * n ** 3) / dt / 1e9);
}

async function benchMatmul() {
	log('— matmul —', 'hdr');
	await ensureInit();
	for (const [n, iters] of [
		[512, 100],
		[1024, 50],
		[2048, 20],
		[4096, 10]
	] as const) {
		try {
			const gflops = await matmulOnce(n, iters, null);
			result('matmul_f32', { n, iters, gflops });
		} catch (e) {
			fail(`matmul_f32 n=${n}`, e);
		}
	}
	// f16 (course needs it for flagship memory; README claims support)
	for (const [n, iters] of [
		[1024, 50],
		[2048, 20]
	] as const) {
		try {
			const f16 = (np as Record<string, unknown>).float16;
			if (!f16) throw new Error('np.float16 not exported');
			const gflops = await matmulOnce(n, iters, f16);
			result('matmul_f16', { n, iters, gflops });
		} catch (e) {
			fail(`matmul_f16 n=${n}`, e);
		}
	}
}

// ---------- 3. Op coverage ----------
async function benchOps() {
	log('— op coverage —', 'hdr');
	await ensureInit();

	// (a) Embedding via gather (np.take) under grad — the WebGPU scatter-add question.
	try {
		const w = random.normal(random.key(1), [64, 8]);
		const ids = np.array(new Int32Array([3, 9, 3, 41]), { dtype: np.int32 });
		const g = grad((p: any) => np.sum(np.take(p, ids, 0)))(w);
		await blockUntilReady(g);
		const total = np.sum(g).item(); // 4 gathered rows × 8 cols of ones = 32
		result('op_take_grad', { works: true, gradSum: total, expected: 32 });
	} catch (e) {
		fail('op_take_grad', e);
	}

	// (b) Range slicing under grad (RoPE building block). Slice API: [] = keep
	// axis, [lo, hi] = range (null turned out to mean newaxis).
	try {
		const x = random.normal(random.key(2), [4, 8]);
		const g = grad((p: any) => {
			const a = p.ref.slice([], [0, 4]);
			const b = p.slice([], [4, 8]);
			return np.sum(np.square(np.concatenate([b.neg(), a], -1)));
		})(x);
		await blockUntilReady(g);
		g.dispose();
		result('op_range_slice_grad', { works: true });
	} catch (e) {
		fail('op_range_slice_grad', e);
	}

	// (c) Rotate-half via reshape + take(inner axis) + broadcast mul, under grad —
	// an alternate RoPE formulation that avoids range slicing.
	try {
		const x = random.normal(random.key(3), [4, 8]);
		const swap = np.array(new Int32Array([1, 0]), { dtype: np.int32 });
		const sign = np.array(new Float32Array([-1, 1]));
		const g = grad((p: any) => {
			const pairs = p.reshape([4, 4, 2]);
			const rot = np.take(pairs, swap, 2).mul(sign);
			return np.sum(np.square(rot.reshape([4, 8])));
		})(x);
		await blockUntilReady(g);
		g.dispose();
		result('op_rotate_pairs_grad', { works: true });
	} catch (e) {
		fail('op_rotate_pairs_grad', e);
	}

	// (d) Trig under grad (RoPE tables).
	try {
		const x = random.normal(random.key(4), [16]);
		const g = grad((p: any) => np.sum(np.sin(p.ref).mul(np.cos(p))))(x);
		await blockUntilReady(g);
		g.dispose();
		result('op_trig_grad', { works: true });
	} catch (e) {
		fail('op_trig_grad', e);
	}
}

// ---------- 3.5 Dot-grad probe: does d(X@W)/dW lower to a matmul? ----------
// Suspicion: the transpose rule materializes the full [M,K,N] product before
// reducing (the 8 GiB CreateBuffer failures at the live config trace to the two
// vocab matmuls, where M·K·N = 2^31). This probes it directly.
async function benchDotGrad() {
	log('— dot-grad probe —', 'hdr');
	await ensureInit();

	// (a) Print the backward jaxpr of sum(X@W) — the definitive answer.
	try {
		const x0 = random.normal(random.key(11), [4, 3]);
		const w0 = random.normal(random.key(12), [3, 5]);
		const expr = makeJaxpr((w: any) => grad((ww: any) => np.sum(np.dot(x0.ref, ww)))(w))(w0.ref);
		const text = String(expr);
		x0.dispose();
		w0.dispose();
		log('grad-of-dot jaxpr:\n' + text);
		console.log('M0JAXPR ' + JSON.stringify({ jaxpr: text }));
	} catch (e) {
		fail('dotgrad_jaxpr', e);
	}

	// (b) Timed dW at growing M·K·N; materializing backward shows memory-traffic
	// scaling and dies at 2^31 elements (>4 GiB).
	for (const [M, K, N] of [
		[2048, 256, 512],
		[2048, 256, 1024],
		[2048, 256, 4096]
	] as const) {
		try {
			const x = random.normal(random.key(21), [M, K]);
			const w = random.normal(random.key(22), [K, N]);
			const f = (ww: any) => np.sum(np.dot(x.ref, ww));
			// warmup
			let g = grad(f)(w.ref);
			await blockUntilReady(g);
			g.dispose();
			const t0 = performance.now();
			const iters = 5;
			for (let i = 0; i < iters; i++) {
				g = grad(f)(w.ref);
				await blockUntilReady(g);
				g.dispose();
			}
			const ms = (performance.now() - t0) / iters;
			x.dispose();
			w.dispose();
			const gflopsIfMatmul = (2 * M * K * N) / (ms / 1000) / 1e9;
			result('dotgrad_time', {
				M,
				K,
				N,
				mknElems: M * K * N,
				ms: Math.round(ms * 10) / 10,
				gflopsIfMatmul: Math.round(gflopsIfMatmul),
				...drainGpuErrors()
			});
		} catch (e) {
			fail(`dotgrad ${M}x${K}x${N}`, e);
		}
	}
}

// ---------- 4. Training step benchmark (~5M-param GPT) ----------
// Architecture follows quectoGPT (known-working idioms): oneHot embeddings,
// RMSNorm, causal dotProductAttention, relu MLP. RoPE/SwiGLU come later; this
// measures the throughput class.
interface Cfg {
	nLayer: number;
	nEmbd: number;
	nHead: number;
	blockSize: number;
	vocab: number;
	batch: number;
}

// NOTE on zero-init: quectoGPT (and GPT convention) zero-inits the output
// projections wo/mlpFc2. Consequence probed the hard way: at step 0 the grads
// of wq/wk/wv/mlpFc1 are EXACTLY ZERO (dPre = dOut @ 0ᵀ) — correct math, not a
// backend bug. It also means a LoRA bench on a frozen zero-init base can never
// learn (wo stays 0, blocking the attention block forever). randomOut=true
// initializes wo/mlpFc2 small-random instead, standing in for a pretrained base.
function initParams(cfg: Cfg, key: any, randomOut = false) {
	const s = Math.sqrt(3 / cfg.nEmbd);
	const n = 3 + cfg.nLayer * 8;
	const keys = random.split(key, n);
	let ki = 0;
	const nk = () => {
		ki++;
		return ki < n ? keys.ref.slice(ki - 1) : keys.slice(ki - 1);
	};
	const outInit = (shape: number[]) =>
		randomOut
			? random.uniform(nk(), shape, { minval: -0.2 * s, maxval: 0.2 * s })
			: (nk().dispose(), np.zeros(shape));
	const params: any = {
		wte: random.normal(nk(), [cfg.vocab, cfg.nEmbd]).mul(0.02),
		wpe: random.normal(nk(), [cfg.blockSize, cfg.nEmbd]).mul(0.02),
		lmHead: random.normal(nk(), [cfg.nEmbd, cfg.vocab]).mul(0.001),
		layers: []
	};
	for (let i = 0; i < cfg.nLayer; i++) {
		params.layers.push({
			wq: random.uniform(nk(), [cfg.nEmbd, cfg.nEmbd], { minval: -s, maxval: s }),
			wk: random.uniform(nk(), [cfg.nEmbd, cfg.nEmbd], { minval: -s, maxval: s }),
			wv: random.uniform(nk(), [cfg.nEmbd, cfg.nEmbd], { minval: -s, maxval: s }),
			wo: outInit([cfg.nEmbd, cfg.nEmbd]),
			mlpFc1: random.uniform(nk(), [cfg.nEmbd, 4 * cfg.nEmbd], {
				minval: -0.4 * s,
				maxval: 0.4 * s
			}),
			mlpFc2: outInit([4 * cfg.nEmbd, cfg.nEmbd])
		});
	}
	return params;
}

function rmsnorm(x: any) {
	const ms = np.mean(np.square(x.ref), -1, { keepdims: true });
	return x.div(np.sqrt(ms.add(1e-5)));
}

// Each data arg (tokenOH/posOH/targetOH) is consumed exactly once; params leaves
// are each consumed exactly once. Callers pass owned refs.
//
// CRITICAL SHAPE DISCIPLINE ("2d" variant): every projection runs as a 2-D
// matmul on [B·S, ...]. jax-js's backward for a batched 3-D×2-D dot materializes
// the full outer product (e.g. dWte from [B,S,V]@[V,D] allocates [B,S,V,D] —
// 8 GiB at the live config, which is what killed the first run). Flattening to
// [B·S,V]@[V,D] makes every weight gradient a plain matmul. Only attention sees
// [B,S,H,hd]. The "3d" variant keeps quectoGPT's original shapes for comparison.
function lossFn(params: any, cfg: Cfg, tokenOH: any, posOH: any, targetOH: any, flat: boolean) {
	const headDim = cfg.nEmbd / cfg.nHead;
	const seqLen = cfg.blockSize;
	const tokFlat = flat ? tokenOH.reshape([-1, cfg.vocab]) : tokenOH;
	const posFlat = flat ? posOH.reshape([-1, cfg.blockSize]) : posOH;
	let x = np.dot(tokFlat, params.wte);
	const posEmb = np.dot(posFlat, params.wpe);
	x = rmsnorm(x.add(posEmb));
	for (let li = 0; li < cfg.nLayer; li++) {
		const layer = params.layers[li];
		const xRes = x.ref;
		x = rmsnorm(x);
		const q = np.dot(x.ref, layer.wq);
		const k = np.dot(x.ref, layer.wk);
		const v = np.dot(x, layer.wv);
		const qH = q.reshape([-1, seqLen, cfg.nHead, headDim]);
		const kH = k.reshape([-1, seqLen, cfg.nHead, headDim]);
		const vH = v.reshape([-1, seqLen, cfg.nHead, headDim]);
		const attnOut = nn.dotProductAttention(qH, kH, vH, { isCausal: true });
		const attnFlat = flat
			? attnOut.reshape([-1, cfg.nEmbd])
			: attnOut.reshape([-1, seqLen, cfg.nEmbd]);
		x = np.dot(attnFlat, layer.wo).add(xRes);
		const mlpRes = x.ref;
		x = rmsnorm(x);
		x = nn.relu(np.dot(x, layer.mlpFc1));
		x = np.dot(x, layer.mlpFc2).add(mlpRes);
	}
	const logits = np.dot(x, params.lmHead);
	const logprobs = nn.logSoftmax(logits, -1);
	const tgtFlat = flat ? targetOH.reshape([-1, cfg.vocab]) : targetOH;
	return np.mean(np.sum(logprobs.mul(tgtFlat), -1).neg());
}

function makeBatch(cfg: Cfg, step: number) {
	// Deterministic fake data — throughput only cares about shapes.
	const nTok = cfg.batch * cfg.blockSize;
	const inputBuf = new Int32Array(nTok);
	const targetBuf = new Int32Array(nTok);
	for (let i = 0; i < nTok; i++) {
		inputBuf[i] = (i * 2654435761 + step * 40503) % cfg.vocab;
		targetBuf[i] = (inputBuf[i] + 1) % cfg.vocab;
	}
	const inputIds = np.array(inputBuf, { dtype: np.int32 }).reshape([cfg.batch, cfg.blockSize]);
	const posIds = np.tile(np.arange(cfg.blockSize).astype(np.int32), [cfg.batch, 1]);
	const targetIds = np.array(targetBuf, { dtype: np.int32 }).reshape([cfg.batch, cfg.blockSize]);
	return {
		tokenOH: nn.oneHot(inputIds, cfg.vocab),
		posOH: nn.oneHot(posIds, cfg.blockSize),
		targetOH: nn.oneHot(targetIds, cfg.vocab)
	};
}

async function trainBench(
	label: string,
	cfg: Cfg,
	useJit: boolean,
	flat: boolean,
	timedSteps = 10
) {
	await ensureInit();
	let params = initParams(cfg, random.key(42));
	await blockUntilReady(params);
	const countLeaves = tree.leaves(tree.ref(params));
	const paramCount = countLeaves.reduce((s: number, l: any) => s + l.size, 0);
	for (const l of countLeaves) l.dispose();

	const solver = adam(3e-4, { b1: 0.9, b2: 0.99 });
	let optState = solver.init(tree.ref(params));

	// jit path passes batch tensors as traced args (fresh closure per step would
	// defeat the compile cache); eager path closes over them quectoGPT-style.
	const jitStep = useJit
		? jit((p: any, a: any, b: any, c: any) =>
				valueAndGrad((pp: any) => lossFn(pp, cfg, a, b, c, flat))(p)
			)
		: null;

	const runStep = (stepIdx: number, sync: boolean): number => {
		const { tokenOH, posOH, targetOH } = makeBatch(cfg, stepIdx);
		const [lossVal, grads] = jitStep
			? jitStep(tree.ref(params), tokenOH.ref, posOH.ref, targetOH.ref)
			: valueAndGrad((pp: any) => lossFn(pp, cfg, tokenOH.ref, posOH.ref, targetOH.ref, flat))(
					tree.ref(params)
				);
		const [updates, newOptState] = solver.update(grads, optState, tree.ref(params));
		params = applyUpdates(params, updates);
		optState = newOptState;
		tokenOH.dispose();
		posOH.dispose();
		targetOH.dispose();
		if (sync) return lossVal.item();
		lossVal.dispose();
		return NaN;
	};

	// Warmup (includes jit compile if any)
	const tw0 = performance.now();
	const firstLoss = runStep(0, true);
	const firstStepMs = Math.round(performance.now() - tw0);
	runStep(1, true);

	// Timed, pipelined (sync once at the end — how a real training loop runs)
	const t0 = performance.now();
	for (let i = 0; i < timedSteps; i++) runStep(2 + i, false);
	await blockUntilReady(params);
	const msPerStep = (performance.now() - t0) / timedSteps;

	// Timed, synced every step (worst case: UI reads the loss every step)
	const t1 = performance.now();
	let lastLoss = NaN;
	for (let i = 0; i < 3; i++) lastLoss = runStep(100 + i, true);
	const msPerStepSynced = (performance.now() - t1) / 3;

	const tokensPerStep = cfg.batch * cfg.blockSize;
	for (const l of tree.leaves(params)) l.dispose();
	for (const l of tree.leaves(optState)) l.dispose();

	result('train', {
		label,
		jit: useJit,
		shapes: flat ? '2d' : '3d',
		...drainGpuErrors(),
		paramCount,
		tokensPerStep,
		firstStepMs,
		msPerStep: Math.round(msPerStep),
		msPerStepSynced: Math.round(msPerStepSynced),
		tokPerSec: Math.round((tokensPerStep / msPerStep) * 1000),
		firstLoss: Number(firstLoss.toFixed(3)),
		lastLoss: Number(lastLoss.toFixed(3)),
		lnVocab: Number(Math.log(cfg.vocab).toFixed(3))
	});
}

async function benchTrain() {
	log('— train step —', 'hdr');
	// Small sanity config first (catches API errors cheaply), then the live-tier
	// course config: ~6.9M params (L6 d256 h8 seq256 V4096 B8).
	const tiny: Cfg = { nLayer: 2, nEmbd: 64, nHead: 4, blockSize: 64, vocab: 512, batch: 8 };
	// ~5.3M params with V=1024: dW of the vocab matmuls stays under the 4 GiB
	// buffer cap even with a materializing dot-backward (M·K·N = 537M elems).
	const liveV1k: Cfg = { nLayer: 6, nEmbd: 256, nHead: 8, blockSize: 256, vocab: 1024, batch: 8 };
	// The intended course config (V=4096): blocked today by the 2^31-element dW
	// intermediate; run it last so its device errors can't pollute other results.
	const liveV4k: Cfg = { nLayer: 6, nEmbd: 256, nHead: 8, blockSize: 256, vocab: 4096, batch: 8 };
	for (const [label, cfg, uj] of [
		['tiny-sanity', tiny, true],
		['live-V1024', liveV1k, true],
		['live-V4096', liveV4k, true]
	] as const) {
		try {
			await trainBench(label, cfg, uj, true);
		} catch (e) {
			fail(`train ${label}`, e);
		}
	}
}

// ---------- 4.5 Dot-chain grad VALUE checks ----------
// The LoRA probe found |grad B|₁ = 0 for q = x@Wq + (x@A)@B — analytically
// impossible. These cases have hand-computable gradients; each reports its L1
// against the expected value to pinpoint which structure drops the gradient.
// x = ones([2,3]); A = 0.5·ones([3,4]); B = 0.25·ones([4,5]); W = 0.5·ones([3,4])
// sum(x@W):    dW = xᵀ@1 → all-2, L1 = 24
// sum(x@A@B):  dB = (x@A)ᵀ@1 → all-3, L1 = 60 ; dA = xᵀ@(1@Bᵀ) → all-2.5, L1 = 30
async function benchChain() {
	log('— dot-chain grad values —', 'hdr');
	await ensureInit();
	const consts = () => ({
		x: np.ones([2, 3]),
		A: np.ones([3, 4]).mul(0.5),
		B: np.ones([4, 5]).mul(0.25)
	});
	const l1 = async (g: any) => {
		const v = np.sum(np.abs(g)).item();
		return Math.round(v * 1000) / 1000;
	};

	// 1. eager, single dot, grad wrt rhs
	try {
		const { x, A } = consts();
		const g = grad((w: any) => np.sum(np.dot(x, w)))(A);
		result('chain_eager_single_rhs', { l1: await l1(g), expected: 24 });
	} catch (e) {
		fail('chain_eager_single_rhs', e);
	}
	// 2. jit (train-loop pattern: batch tensor captured by inner closure), single dot, grad wrt rhs
	try {
		const { x, A } = consts();
		const f = jit((w: any, xx: any) => valueAndGrad((ww: any) => np.sum(np.dot(xx, ww)))(w));
		const [lv, g] = f(A, x);
		lv.dispose();
		result('chain_jit_single_rhs', { l1: await l1(g), expected: 24 });
	} catch (e) {
		fail('chain_jit_single_rhs', e);
	}
	// 3. eager, chain x@A@B, grad wrt B
	try {
		const { x, A, B } = consts();
		const g = grad((b: any) => np.sum(np.dot(np.dot(x, A), b)))(B);
		result('chain_eager_dB', { l1: await l1(g), expected: 60 });
	} catch (e) {
		fail('chain_eager_dB', e);
	}
	// 4. jit, chain, grad wrt B (the LoRA pattern)
	try {
		const { x, A, B } = consts();
		const f = jit((b: any, xx: any, aa: any) =>
			valueAndGrad((bb: any) => np.sum(np.dot(np.dot(xx, aa), bb)))(b)
		);
		const [lv, g] = f(B, x, A);
		lv.dispose();
		result('chain_jit_dB', { l1: await l1(g), expected: 60 });
	} catch (e) {
		fail('chain_jit_dB', e);
	}
	// 5. jit, chain, grad wrt BOTH {A,B} as a tree (exactly the LoRA adapter tree)
	try {
		const { x, A, B } = consts();
		const f = jit((t: any, xx: any) =>
			valueAndGrad((tt: any) => np.sum(np.dot(np.dot(xx, tt.A), tt.B)))(t)
		);
		const [lv, g] = f({ A, B }, x);
		lv.dispose();
		const la = await l1(g.A.ref);
		const lb = await l1(g.B.ref);
		for (const l of tree.leaves(g)) l.dispose();
		result('chain_jit_tree_dAdB', { dA_l1: la, dA_expected: 30, dB_l1: lb, dB_expected: 60 });
	} catch (e) {
		fail('chain_jit_tree_dAdB', e);
	}
	// 7. grad THROUGH nn.dotProductAttention: dW of sum(attn(x@W, k, v)).
	// v MUST vary across the source axis: with constant v the softmax backward is
	// analytically exactly zero (dProbs constant ⇒ probs⊙(c − c) = 0) — the first
	// version of this test was degenerate and "found" a bug that wasn't there.
	try {
		const x = np.ones([1, 4, 8]);
		const W = np.ones([8, 8]).mul(0.1);
		const k = np.arange(32).astype(np.float32).mul(0.02).reshape([1, 4, 2, 4]);
		const v = np.arange(32).astype(np.float32).mul(0.05).reshape([1, 4, 2, 4]);
		const f = jit((w: any, xx: any, kk: any, vv: any) =>
			valueAndGrad((ww: any) => {
				const q = np.dot(xx.reshape([-1, 8]), ww).reshape([1, 4, 2, 4]);
				return np.sum(nn.dotProductAttention(q, kk, vv, { isCausal: true }));
			})(w)
		);
		const [lv, g] = f(W, x, k, v);
		lv.dispose();
		result('chain_jit_attn_dW', { l1: await l1(g), nonzeroExpected: true });
	} catch (e) {
		fail('chain_jit_attn_dW', e);
	}
	// 8. Per-leaf grad L1s inside the REAL model at a micro config — which
	// weights actually receive gradient?
	try {
		const cfg: Cfg = { nLayer: 1, nEmbd: 16, nHead: 2, blockSize: 8, vocab: 32, batch: 2 };
		const params = initParams(cfg, random.key(5), true);
		const { tokenOH, posOH, targetOH } = makeBatch(cfg, 0);
		const f = jit((p: any, a: any, b: any, c: any) =>
			valueAndGrad((pp: any) => lossFn(pp, cfg, a, b, c, true))(p)
		);
		const [lv, g] = f(params, tokenOH, posOH, targetOH);
		lv.dispose();
		const leaf = async (t: any) => Number((await l1(t)).toFixed(4));
		const out = {
			wte: await leaf(g.wte.ref),
			wpe: await leaf(g.wpe.ref),
			lmHead: await leaf(g.lmHead.ref),
			wq: await leaf(g.layers[0].wq.ref),
			wk: await leaf(g.layers[0].wk.ref),
			wv: await leaf(g.layers[0].wv.ref),
			wo: await leaf(g.layers[0].wo.ref),
			mlpFc1: await leaf(g.layers[0].mlpFc1.ref),
			mlpFc2: await leaf(g.layers[0].mlpFc2.ref)
		};
		for (const l of tree.leaves(g)) l.dispose();
		result('chain_model_leaf_grads', out);
	} catch (e) {
		fail('chain_model_leaf_grads', e);
	}
	// 9-12. Isolate the broken backward: relu vs maximum vs attention, eager vs jit.
	// x=ones([2,3]), W=0.5·ones([3,4]) → pre-activation all 4.5 > 0, so relu is
	// pass-through and dW = xᵀ@1 = all-2, L1 = 24. Zero ⇒ that op's VJP drops grad.
	const reluCase = async (name: string, useJit: boolean, act: (t: any) => any) => {
		try {
			const x = np.ones([2, 3]);
			const W = np.ones([3, 4]).mul(0.5);
			const inner = (ww: any, xx: any) => np.sum(act(np.dot(xx, ww)));
			let g: any;
			if (useJit) {
				const f = jit((w: any, xx: any) => valueAndGrad((ww: any) => inner(ww, xx))(w));
				const [lv, gg] = f(W, x);
				lv.dispose();
				g = gg;
			} else {
				g = grad((ww: any) => inner(ww, x))(W);
			}
			result(name, { l1: await l1(g), expected: 24 });
		} catch (e) {
			fail(name, e);
		}
	};
	await reluCase('chain_eager_relu_dW', false, (t) => nn.relu(t));
	await reluCase('chain_jit_relu_dW', true, (t) => nn.relu(t));
	await reluCase('chain_jit_maximum_dW', true, (t) => np.maximum(t, 0));
	await reluCase('chain_jit_sigmoid_dW', true, (t) => nn.sigmoid(t));
	// 12b. attention backward, eager (case 7 was jit) — non-degenerate k/v
	try {
		const x = np.ones([1, 4, 8]);
		const W = np.ones([8, 8]).mul(0.1);
		const k = np.arange(32).astype(np.float32).mul(0.02).reshape([1, 4, 2, 4]);
		const v = np.arange(32).astype(np.float32).mul(0.05).reshape([1, 4, 2, 4]);
		const g = grad((ww: any) => {
			const q = np.dot(x.ref.reshape([-1, 8]), ww).reshape([1, 4, 2, 4]);
			return np.sum(nn.dotProductAttention(q, k.ref, v.ref, { isCausal: true }));
		})(W);
		x.dispose();
		k.dispose();
		v.dispose();
		result('chain_eager_attn_dW', { l1: await l1(g), nonzeroExpected: true });
	} catch (e) {
		fail('chain_eager_attn_dW', e);
	}
	// 12c. per-leaf grads in the real model, EAGER (case 8 was jit) — micro config
	try {
		const cfg: Cfg = { nLayer: 1, nEmbd: 16, nHead: 2, blockSize: 8, vocab: 32, batch: 2 };
		const params = initParams(cfg, random.key(5), true);
		const { tokenOH, posOH, targetOH } = makeBatch(cfg, 0);
		const [lv, g] = valueAndGrad((pp: any) =>
			lossFn(pp, cfg, tokenOH.ref, posOH.ref, targetOH.ref, true)
		)(params);
		lv.dispose();
		tokenOH.dispose();
		posOH.dispose();
		targetOH.dispose();
		const out = {
			wq: await l1(g.layers[0].wq.ref),
			mlpFc1: await l1(g.layers[0].mlpFc1.ref),
			lmHead: await l1(g.lmHead.ref)
		};
		for (const l of tree.leaves(g)) l.dispose();
		result('chain_model_leaf_grads_eager', out);
	} catch (e) {
		fail('chain_model_leaf_grads_eager', e);
	}
	// 6. jit, merged form q = x@(W + A@B) — candidate workaround if the chain fails
	try {
		const { x, A, B } = consts();
		const W = np.ones([3, 5]).mul(0.1);
		const f = jit((t: any, xx: any, ww: any) =>
			valueAndGrad((tt: any) => np.sum(np.dot(xx, ww.add(np.dot(tt.A, tt.B)))))(t)
		);
		const [lv, g] = f({ A, B }, x, W);
		lv.dispose();
		const la = await l1(g.A.ref);
		const lb = await l1(g.B.ref);
		for (const l of tree.leaves(g)) l.dispose();
		result('chain_jit_merged_dAdB', { dA_l1: la, dA_expected: 30, dB_l1: lb, dB_expected: 60 });
	} catch (e) {
		fail('chain_jit_merged_dAdB', e);
	}
}

// ---------- 5. Flagship LoRA probe (M0c) ----------
// Frozen ~29M base (L8 d512 V4096), LoRA r=8 on wq/wv. Only adapters get grads
// and Adam state; the base rides through the jit as a non-differentiated arg.
function initAdapters(cfg: Cfg, r: number, key: any) {
	const n = cfg.nLayer * 2;
	const keys = random.split(key, n);
	let ki = 0;
	const nk = () => {
		ki++;
		return ki < n ? keys.ref.slice(ki - 1) : keys.slice(ki - 1);
	};
	const layers: any[] = [];
	for (let i = 0; i < cfg.nLayer; i++) {
		layers.push({
			aq: random.normal(nk(), [cfg.nEmbd, r]).mul(0.01),
			bq: np.zeros([r, cfg.nEmbd]),
			av: random.normal(nk(), [cfg.nEmbd, r]).mul(0.01),
			bv: np.zeros([r, cfg.nEmbd])
		});
	}
	return { layers };
}

function lossFnLora(
	ad: any,
	base: any,
	cfg: Cfg,
	tokenOH: any,
	posOH: any,
	targetOH: any,
	scale: number
) {
	const headDim = cfg.nEmbd / cfg.nHead;
	const seqLen = cfg.blockSize;
	let x = np.dot(tokenOH.reshape([-1, cfg.vocab]), base.wte);
	const posEmb = np.dot(posOH.reshape([-1, cfg.blockSize]), base.wpe);
	x = rmsnorm(x.add(posEmb));
	for (let li = 0; li < cfg.nLayer; li++) {
		const layer = base.layers[li];
		const adl = ad.layers[li];
		const xRes = x.ref;
		x = rmsnorm(x);
		const q = np.dot(x.ref, layer.wq).add(np.dot(np.dot(x.ref, adl.aq), adl.bq).mul(scale));
		const k = np.dot(x.ref, layer.wk);
		const v = np.dot(x.ref, layer.wv).add(np.dot(np.dot(x, adl.av), adl.bv).mul(scale));
		const qH = q.reshape([-1, seqLen, cfg.nHead, headDim]);
		const kH = k.reshape([-1, seqLen, cfg.nHead, headDim]);
		const vH = v.reshape([-1, seqLen, cfg.nHead, headDim]);
		const attnOut = nn.dotProductAttention(qH, kH, vH, { isCausal: true });
		x = np.dot(attnOut.reshape([-1, cfg.nEmbd]), layer.wo).add(xRes);
		const mlpRes = x.ref;
		x = rmsnorm(x);
		x = nn.relu(np.dot(x, layer.mlpFc1));
		x = np.dot(x, layer.mlpFc2).add(mlpRes);
	}
	const logits = np.dot(x, base.lmHead);
	const logprobs = nn.logSoftmax(logits, -1);
	return np.mean(np.sum(logprobs.mul(targetOH.reshape([-1, cfg.vocab])), -1).neg());
}

async function loraBench(label: string, cfg: Cfg, r: number, timedSteps = 20) {
	await ensureInit();
	// randomOut: a frozen zero-init base blocks all gradient into the attention
	// block (wo = 0 forever), silently no-op'ing the adapters. Stands in for a
	// pretrained base until we have real checkpoints.
	let base = initParams(cfg, random.key(42), true);
	let adapters = initAdapters(cfg, r, random.key(77));
	await blockUntilReady(base);
	const baseLeaves = tree.leaves(tree.ref(base));
	const baseCount = baseLeaves.reduce((s: number, l: any) => s + l.size, 0);
	for (const l of baseLeaves) l.dispose();
	const adLeaves = tree.leaves(tree.ref(adapters));
	const adCount = adLeaves.reduce((s: number, l: any) => s + l.size, 0);
	for (const l of adLeaves) l.dispose();

	// Hot LR on purpose: over ~20 fake-data steps we need loss movement to be
	// visible at 4 decimals, to distinguish "LoRA learns" from a silent no-op
	// (B starts at zero, so the adapter path wakes up gradually).
	const solver = adam(5e-3, { b1: 0.9, b2: 0.99 });
	let optState = solver.init(tree.ref(adapters));
	const jitStep = jit((adp: any, bs: any, a: any, b: any, c: any) =>
		valueAndGrad((aa: any) => lossFnLora(aa, bs, cfg, a, b, c, 2.0))(adp)
	);

	// One-off gradient-flow check: |grad bq|₁ must be > 0 on the very first step
	// (B=0 makes |grad aq|₁ = 0 at init — that is CORRECT, not a bug).
	{
		const { tokenOH, posOH, targetOH } = makeBatch(cfg, 999);
		const [lv, gr] = jitStep(
			tree.ref(adapters),
			tree.ref(base),
			tokenOH.ref,
			posOH.ref,
			targetOH.ref
		);
		lv.dispose();
		const gbq = np.sum(np.abs(gr.layers[0].bq.ref)).item();
		const gaq = np.sum(np.abs(gr.layers[0].aq.ref)).item();
		for (const l of tree.leaves(gr)) l.dispose();
		tokenOH.dispose();
		posOH.dispose();
		targetOH.dispose();
		result('lora_gradcheck', { gradBqL1: gbq, gradAqL1: gaq, note: 'aq≈0 expected at init' });
	}

	const runStep = (stepIdx: number, sync: boolean): number => {
		const { tokenOH, posOH, targetOH } = makeBatch(cfg, stepIdx);
		const [lossVal, grads] = jitStep(
			tree.ref(adapters),
			tree.ref(base),
			tokenOH.ref,
			posOH.ref,
			targetOH.ref
		);
		const [updates, newOptState] = solver.update(grads, optState, tree.ref(adapters));
		adapters = applyUpdates(adapters, updates);
		optState = newOptState;
		tokenOH.dispose();
		posOH.dispose();
		targetOH.dispose();
		if (sync) return lossVal.item();
		lossVal.dispose();
		return NaN;
	};

	const tw0 = performance.now();
	const firstLoss = runStep(0, true);
	const firstStepMs = Math.round(performance.now() - tw0);
	const t0 = performance.now();
	let lastLoss = NaN;
	for (let i = 0; i < timedSteps; i++) lastLoss = runStep(1 + i, true);
	const msPerStep = (performance.now() - t0) / timedSteps;

	const tokensPerStep = cfg.batch * cfg.blockSize;
	for (const l of tree.leaves(base)) l.dispose();
	for (const l of tree.leaves(adapters)) l.dispose();
	for (const l of tree.leaves(optState)) l.dispose();

	result('lora', {
		label,
		r,
		baseParams: baseCount,
		adapterParams: adCount,
		...drainGpuErrors(),
		tokensPerStep,
		firstStepMs,
		msPerStep: Math.round(msPerStep),
		tokPerSec: Math.round((tokensPerStep / msPerStep) * 1000),
		firstLoss: Number(firstLoss.toFixed(4)),
		lastLoss: Number(lastLoss.toFixed(4))
	});
}

async function benchLora() {
	log('— flagship LoRA probe —', 'hdr');
	const flagship: Cfg = { nLayer: 8, nEmbd: 512, nHead: 8, blockSize: 256, vocab: 4096, batch: 8 };
	// Full-param baseline captured 2026-07-22: 758 ms/step synced, ~2.7k tok/s,
	// loss 8.32→7.92, zero device errors. Re-enable to re-measure:
	// await trainBench('flagship-29M-full', flagship, true, true, 5);
	try {
		await loraBench('flagship-29M-lora-r8', flagship, 8);
	} catch (e) {
		fail('flagship lora', e);
	}
}

// ---------- 6. Web Worker probe (M0e) ----------
async function benchWorker() {
	log('— worker probe —', 'hdr');
	return new Promise<void>((resolve) => {
		const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
		const t0 = performance.now();
		let ticks = 0;
		const iv = setInterval(() => ticks++, 50);
		const done = () => {
			clearInterval(iv);
			w.terminate();
			resolve();
		};
		w.onmessage = (e: MessageEvent) => {
			const d = e.data;
			if (d.type === 'log') log('[worker] ' + d.msg);
			else if (d.type === 'result') {
				const wallMs = Math.round(performance.now() - t0);
				// ticks ≈ wallMs/50 means the main thread stayed responsive throughout
				result('worker', {
					...d.payload,
					wallMs,
					mainThreadTicks: ticks,
					expectedTicks: Math.round(wallMs / 50)
				});
				done();
			} else {
				fail('worker', d.error ?? 'unknown worker message');
				done();
			}
		};
		w.onerror = (e) => {
			fail('worker', e.message ?? 'worker error');
			done();
		};
		w.postMessage({ go: true });
	});
}

// ---------- wiring ----------
const SECTIONS: Record<string, () => Promise<void>> = {
	env: benchEnv,
	matmul: benchMatmul,
	ops: benchOps,
	dotgrad: benchDotGrad,
	train: benchTrain,
	chain: benchChain,
	lora: benchLora,
	worker: benchWorker
};

let running = false;
async function runSelected() {
	if (running) return;
	running = true;
	try {
		const sel = new URLSearchParams(location.search).get('run');
		const keys = sel ? sel.split(',').filter((k) => SECTIONS[k]) : ['env', 'dotgrad', 'train'];
		for (const k of keys) await SECTIONS[k]();
		log('— all done —', 'hdr');
		console.log('M0DONE');
	} finally {
		running = false;
	}
}

for (const [key, fn] of Object.entries(SECTIONS)) {
	document.getElementById(`run-${key}`)?.addEventListener('click', fn);
}
document.getElementById('run-all')?.addEventListener('click', runSelected);

log('ready — auto-running in 1s (?run=section,section to select; buttons rerun)');
setTimeout(runSelected, 1000);
