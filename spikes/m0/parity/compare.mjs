// LLMVibes M0 parity: jax-js (Node, wasm/cpu backend) vs PyTorch fixture.
// Rebuilds the params tree from fixture.json (written by ref.py), runs the SAME
// lossFn logic as spikes/m0/src/main.ts (flat=true variant), and reports
// max-abs / max-rel diffs for logits, loss, and every grad tensor.
// Run from inside spikes/m0/parity so Node resolves @jax-js/jax from
// spikes/m0/node_modules:  node compare.mjs
// Exits nonzero if any max-rel > 1e-3.

import { readFileSync } from 'node:fs';
import { init, defaultDevice, numpy as np, nn, valueAndGrad, tree } from '@jax-js/jax';

const REL_THRESHOLD = 1e-3;

const fx = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
const cfg = fx.config;
const { vocab: V, nEmbd: D, blockSize: S, nLayer: L, batch: B } = cfg;

const devices = await init();
const backend = process.env.JAX_BACKEND ?? (devices.includes('wasm') ? 'wasm' : 'cpu');
defaultDevice(backend);
console.log(`jax-js devices: ${devices.join(', ')} — using '${backend}'`);
console.log(`config: L${L} d${D} h${cfg.nHead} S${S} V${V} B${B} (seed ${cfg.seed})`);

// ---------- params tree from fixture ----------
function tensor(name, shape) {
	return np.array(Float32Array.from(fx.weights[name])).reshape(shape);
}
const params = {
	wte: tensor('wte', [V, D]),
	wpe: tensor('wpe', [S, D]),
	lmHead: tensor('lmHead', [D, V]),
	layers: []
};
for (let i = 0; i < L; i++) {
	params.layers.push({
		wq: tensor(`layers.${i}.wq`, [D, D]),
		wk: tensor(`layers.${i}.wk`, [D, D]),
		wv: tensor(`layers.${i}.wv`, [D, D]),
		wo: tensor(`layers.${i}.wo`, [D, D]),
		mlpFc1: tensor(`layers.${i}.mlpFc1`, [D, 4 * D]),
		mlpFc2: tensor(`layers.${i}.mlpFc2`, [4 * D, D])
	});
}

// ---------- batch (same construction as main.ts makeBatch, ids from fixture) ----------
const inputIds = np.array(Int32Array.from(fx.inputIds), { dtype: np.int32 }).reshape([B, S]);
const posIds = np.tile(np.arange(S).astype(np.int32), [B, 1]);
const targetIds = np.array(Int32Array.from(fx.targetIds), { dtype: np.int32 }).reshape([B, S]);
const tokenOH = nn.oneHot(inputIds, V);
const posOH = nn.oneHot(posIds, S);
const targetOH = nn.oneHot(targetIds, V);

// ---------- lossFn port (main.ts, flat=true) ----------
function rmsnorm(x) {
	const ms = np.mean(np.square(x.ref), -1, { keepdims: true });
	return x.div(np.sqrt(ms.add(1e-5)));
}

// Consumes params leaves and tokenOH/posOH exactly once. Returns logits [B*S, V].
function forwardLogits(p, tokOH, posOH_) {
	const headDim = D / cfg.nHead;
	const tokFlat = tokOH.reshape([-1, V]);
	const posFlat = posOH_.reshape([-1, S]);
	let x = np.dot(tokFlat, p.wte);
	const posEmb = np.dot(posFlat, p.wpe);
	x = rmsnorm(x.add(posEmb));
	for (let li = 0; li < L; li++) {
		const layer = p.layers[li];
		const xRes = x.ref;
		x = rmsnorm(x);
		const q = np.dot(x.ref, layer.wq);
		const k = np.dot(x.ref, layer.wk);
		const v = np.dot(x, layer.wv);
		const qH = q.reshape([-1, S, cfg.nHead, headDim]);
		const kH = k.reshape([-1, S, cfg.nHead, headDim]);
		const vH = v.reshape([-1, S, cfg.nHead, headDim]);
		const attnOut = nn.dotProductAttention(qH, kH, vH, { isCausal: true });
		const attnFlat = attnOut.reshape([-1, D]);
		x = np.dot(attnFlat, layer.wo).add(xRes);
		const mlpRes = x.ref;
		x = rmsnorm(x);
		x = nn.relu(np.dot(x, layer.mlpFc1));
		x = np.dot(x, layer.mlpFc2).add(mlpRes);
	}
	return np.dot(x, p.lmHead);
}

function lossFn(p, tokOH, posOH_, tgtOH) {
	const logits = forwardLogits(p, tokOH, posOH_);
	const logprobs = nn.logSoftmax(logits, -1);
	const tgtFlat = tgtOH.reshape([-1, V]);
	return np.mean(np.sum(logprobs.mul(tgtFlat), -1).neg());
}

// ---------- comparison ----------
let anyFail = false;
function compare(name, actual, expected) {
	if (actual.length !== expected.length) {
		console.log(`  ${name}: LENGTH MISMATCH ${actual.length} vs ${expected.length}`);
		anyFail = true;
		return;
	}
	let maxAbsRef = 0;
	for (const v of expected) maxAbsRef = Math.max(maxAbsRef, Math.abs(v));
	// rel denominator floored at 1e-3*maxAbs(ref): tiny elements are judged on
	// abs error relative to the tensor's scale (avoids 0/0 noise).
	const floor = Math.max(1e-3 * maxAbsRef, 1e-12);
	let maxAbs = 0;
	let maxRel = 0;
	for (let i = 0; i < expected.length; i++) {
		const d = Math.abs(actual[i] - expected[i]);
		if (d > maxAbs) maxAbs = d;
		const rel = d / Math.max(Math.abs(expected[i]), floor);
		if (rel > maxRel) maxRel = rel;
	}
	const ok = maxRel <= REL_THRESHOLD;
	if (!ok) anyFail = true;
	console.log(
		`  ${name.padEnd(18)} max-abs ${maxAbs.toExponential(3)}  max-rel ${maxRel.toExponential(3)}  ${ok ? 'ok' : 'FAIL'}`
	);
}

// ---------- run ----------
// Pass 1 (eager): logits. Pass 2: valueAndGrad for loss + grads.
// tokenOH/posOH/targetOH and params are .ref'd per pass, disposed at the end.
const logits = forwardLogits(tree.ref(params), tokenOH.ref, posOH.ref);
const logitsData = await logits.data(); // .data() consumes logits

const [lossVal, grads] = valueAndGrad((p) => lossFn(p, tokenOH.ref, posOH.ref, targetOH.ref))(
	tree.ref(params)
);
const loss = lossVal.item(); // .item() consumes lossVal
tokenOH.dispose();
posOH.dispose();
targetOH.dispose();

console.log('\nlogits / loss:');
compare('logits', logitsData, fx.logits);
const lossAbs = Math.abs(loss - fx.loss);
const lossRel = lossAbs / Math.abs(fx.loss);
const lossOk = lossRel <= REL_THRESHOLD;
if (!lossOk) anyFail = true;
console.log(
	`  ${'loss'.padEnd(18)} max-abs ${lossAbs.toExponential(3)}  max-rel ${lossRel.toExponential(3)}  ${lossOk ? 'ok' : 'FAIL'}` +
		`   (jax-js ${loss.toFixed(6)}, torch ${fx.loss.toFixed(6)})`
);

console.log('\ngrads:');
const gradLeaves = { wte: grads.wte, wpe: grads.wpe, lmHead: grads.lmHead };
for (let i = 0; i < L; i++) {
	for (const n of ['wq', 'wk', 'wv', 'wo', 'mlpFc1', 'mlpFc2']) {
		gradLeaves[`layers.${i}.${n}`] = grads.layers[i][n];
	}
}
for (const [name, g] of Object.entries(gradLeaves)) {
	compare(name, await g.data(), fx.grads[name]); // .data() consumes g
}
for (const l of tree.leaves(params)) l.dispose();

console.log(anyFail ? `\nPARITY FAIL (max-rel > ${REL_THRESHOLD})` : '\nPARITY OK');
process.exit(anyFail ? 1 : 0);
