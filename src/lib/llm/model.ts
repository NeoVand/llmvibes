// The Quill/Rook model definition shared by the training worker (and, later,
// the offline trainer via the parity harness). Idioms proven in spikes/m0:
// everything jitted, every projection a 2-D matmul on [B·S, ...] (jax-js's
// eager/naive backward materializes [M,K,N] otherwise — issue #150), oneHot
// embeddings until gather backward lands upstream (#79), and output
// projections initialized SMALL-RANDOM, not zero (zero-init wo/mlpFc2 blocks
// all gradient into attention/MLP interiors at step 0 — see RESULTS.md).

import { numpy as np, nn, random, tree } from '@jax-js/jax';
import type { ModelConfig } from './engine';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ModelParams {
	wte: any;
	wpe: any;
	lmHead: any;
	layers: Array<{ wq: any; wk: any; wv: any; wo: any; mlpFc1: any; mlpFc2: any }>;
}

export function initParams(cfg: ModelConfig, seed: number): ModelParams {
	const s = Math.sqrt(3 / cfg.nEmbd);
	const n = 3 + cfg.nLayer * 8;
	const keys = random.split(random.key(seed), n);
	let ki = 0;
	const nk = () => {
		ki++;
		return ki < n ? keys.ref.slice(ki - 1) : keys.slice(ki - 1);
	};
	const params: ModelParams = {
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
			wo: random.uniform(nk(), [cfg.nEmbd, cfg.nEmbd], { minval: -0.2 * s, maxval: 0.2 * s }),
			mlpFc1: random.uniform(nk(), [cfg.nEmbd, 4 * cfg.nEmbd], { minval: -0.4 * s, maxval: 0.4 * s }),
			mlpFc2: random.uniform(nk(), [4 * cfg.nEmbd, cfg.nEmbd], {
				minval: -0.2 * s,
				maxval: 0.2 * s
			})
		});
	}
	return params;
}

function rmsnorm(x: any) {
	const ms = np.mean(np.square(x.ref), -1, { keepdims: true });
	return x.div(np.sqrt(ms.add(1e-5)));
}

/**
 * Forward to log-probs over the whole sequence. seqLen is the CURRENT length
 * (≤ cfg.blockSize) — generation calls this with growing prompts.
 * Consumes tokenOH/posOH; params leaves are each consumed exactly once.
 */
export function forwardLogprobs(params: any, cfg: ModelConfig, seqLen: number, tokenOH: any, posOH: any) {
	const headDim = cfg.nEmbd / cfg.nHead;
	let x = np.dot(tokenOH.reshape([-1, cfg.vocab]), params.wte);
	const posEmb = np.dot(posOH.reshape([-1, cfg.blockSize]), params.wpe);
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
		x = np.dot(attnOut.reshape([-1, cfg.nEmbd]), layer.wo).add(xRes);
		const mlpRes = x.ref;
		x = rmsnorm(x);
		x = nn.relu(np.dot(x, layer.mlpFc1));
		x = np.dot(x, layer.mlpFc2).add(mlpRes);
	}
	const logits = np.dot(x, params.lmHead);
	return nn.logSoftmax(logits, -1); // [B·seqLen, vocab]
}

/** Training loss: mean NLL over the batch. Consumes all three oneHot args. */
export function lossFn(params: any, cfg: ModelConfig, tokenOH: any, posOH: any, targetOH: any) {
	const logprobs = forwardLogprobs(params, cfg, cfg.blockSize, tokenOH, posOH);
	return np.mean(np.sum(logprobs.mul(targetOH.reshape([-1, cfg.vocab])), -1).neg());
}

export function paramCount(params: ModelParams): number {
	const leaves = tree.leaves(tree.ref(params)) as any[];
	const total = leaves.reduce((s: number, l: any) => s + l.size, 0);
	for (const l of leaves) l.dispose();
	return total;
}

export function disposeTree(t: any): void {
	for (const l of tree.leaves(t)) l.dispose();
}

/** Flatten params to one Float32Array (checkpoint export). */
export function flattenParams(params: ModelParams): Float32Array {
	const leaves = tree.leaves(tree.ref(params)) as any[];
	const total = leaves.reduce((s: number, l: any) => s + l.size, 0);
	const out = new Float32Array(total);
	let offset = 0;
	for (const leaf of leaves) {
		out.set(leaf.dataSync(), offset);
		offset += leaf.size;
	}
	return out;
}

/** Rebuild a params tree from a flat buffer, using cfg for shapes. */
export function loadParams(cfg: ModelConfig, flat: Float32Array): ModelParams {
	const template = initParams(cfg, 0);
	let offset = 0;
	return tree.map((leaf: any) => {
		const chunk = flat.slice(offset, offset + leaf.size);
		offset += leaf.size;
		const next = np.array(chunk).reshape(leaf.shape);
		leaf.dispose();
		return next;
	}, template) as unknown as ModelParams;
}
