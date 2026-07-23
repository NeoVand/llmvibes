// Grokking, recorded for the course: train a tiny 2-layer MLP on modular
// addition (a + b mod p) and log train/val accuracy+loss over training. With
// half the table held out and strong weight decay, the model first MEMORIZES
// (train acc 100%, val at chance) and only much later GROKS (val snaps to
// 100%). The quadratic-activation MLP (Gromov 2023) makes this fast enough
// to record in pure JS.
//
//   node scripts/data/run-grokking.mjs [--wd 3.0] [--steps 12000] [--out file]
//
// Output: static/data/grokking-run.json { meta, points: [{step, trainLoss,
// valLoss, trainAcc, valAcc}] }

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? Number(args[i + 1]) : dflt;
};
const strFlag = (name, dflt) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : dflt;
};

const P = flag('p', 97); // modulus
const D = flag('d', 192); // hidden width
const FRAC = flag('frac', 0.5); // train fraction of the p*p table
const LR = flag('lr', 1e-3);
const WD = flag('wd', 3.0); // the star of the show
const BETA1 = 0.9;
const BETA2 = 0.98;
const STEPS = flag('steps', 12000);
const BATCH = flag('batch', 1024);
const LOG_EVERY = flag('log', 50);
const SEED = flag('seed', 7);
const OUT = strFlag(
	'out',
	join(dirname(fileURLToPath(import.meta.url)), '../../static/data/grokking-run.json')
);

// ── data: the full addition table, split train/val ───────────────────────────
function mulberry32(seed) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const rng = mulberry32(SEED);

const all = [];
for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) all.push([a, b, (a + b) % P]);
// shuffle
for (let i = all.length - 1; i > 0; i--) {
	const j = Math.floor(rng() * (i + 1));
	[all[i], all[j]] = [all[j], all[i]];
}
const nTrain = Math.floor(all.length * FRAC);
const train = all.slice(0, nTrain);
const val = all.slice(nTrain);

// ── model: onehot(a)⊕onehot(b) → W1 → z² → W2 → logits ──────────────────────
const IN = 2 * P;
const W1 = new Float32Array(IN * D);
const W2 = new Float32Array(D * P);
{
	const s1 = 1 / Math.sqrt(IN);
	const s2 = 1 / Math.sqrt(D);
	for (let i = 0; i < W1.length; i++) W1[i] = (rng() * 2 - 1) * s1;
	for (let i = 0; i < W2.length; i++) W2[i] = (rng() * 2 - 1) * s2;
}
// Adam state
const m1 = new Float32Array(W1.length);
const v1 = new Float32Array(W1.length);
const m2 = new Float32Array(W2.length);
const v2 = new Float32Array(W2.length);

// scratch (max batch = eval chunk size)
const EVAL_CHUNK = 2048;
const MAXB = Math.max(BATCH, EVAL_CHUNK);
const z = new Float32Array(MAXB * D); // pre-activation
const h = new Float32Array(MAXB * D); // z^2
const logits = new Float32Array(MAXB * P);

/** forward for `n` examples; returns {loss, correct}; optionally backward. */
function pass(examples, offset, n, learn) {
	z.fill(0, 0, n * D);
	// one-hot input → z = W1[a,:] + W1[P+b,:]
	for (let i = 0; i < n; i++) {
		const [a, b] = examples[offset + i];
		const ra = a * D;
		const rb = (P + b) * D;
		const zi = i * D;
		for (let k = 0; k < D; k++) z[zi + k] = W1[ra + k] + W1[rb + k];
	}
	// h = z^2 ; logits = h @ W2
	logits.fill(0, 0, n * P);
	for (let i = 0; i < n; i++) {
		const zi = i * D;
		const li = i * P;
		for (let k = 0; k < D; k++) {
			const hk = z[zi + k] * z[zi + k];
			h[zi + k] = hk;
			if (hk !== 0) {
				const wk = k * P;
				for (let j = 0; j < P; j++) logits[li + j] += hk * W2[wk + j];
			}
		}
	}
	// softmax CE + accuracy (+ backward into gW via streaming updates)
	let loss = 0;
	let correct = 0;
	const gW1 = learn ? pass.gW1 : null;
	const gW2 = learn ? pass.gW2 : null;
	for (let i = 0; i < n; i++) {
		const [a, b, y] = examples[offset + i];
		const li = i * P;
		let mx = -Infinity;
		let argmax = 0;
		for (let j = 0; j < P; j++) {
			if (logits[li + j] > mx) {
				mx = logits[li + j];
				argmax = j;
			}
		}
		if (argmax === y) correct++;
		let sum = 0;
		for (let j = 0; j < P; j++) sum += Math.exp(logits[li + j] - mx);
		const logZ = mx + Math.log(sum);
		loss += logZ - logits[li + y];
		if (learn) {
			// dlogits = softmax - onehot(y), scaled 1/n
			const zi = i * D;
			for (let j = 0; j < P; j++) {
				const p = Math.exp(logits[li + j] - logZ);
				const dj = (p - (j === y ? 1 : 0)) / n;
				if (dj === 0) continue;
				// gW2[k,j] += h[k] * dj ; dh[k] += W2[k,j] * dj
				for (let k = 0; k < D; k++) {
					gW2[k * P + j] += h[zi + k] * dj;
					pass.dh[zi + k] += W2[k * P + j] * dj;
				}
			}
			// dz = 2z * dh → gW1 rows a and P+b
			const ra = a * D;
			const rb = (P + b) * D;
			for (let k = 0; k < D; k++) {
				const dz = 2 * z[zi + k] * pass.dh[zi + k];
				gW1[ra + k] += dz;
				gW1[rb + k] += dz;
				pass.dh[zi + k] = 0;
			}
		}
	}
	return { loss: loss / n, correct };
}
pass.gW1 = new Float32Array(W1.length);
pass.gW2 = new Float32Array(W2.length);
pass.dh = new Float32Array(MAXB * D);

function adamw(W, g, m, v, t) {
	const bc1 = 1 - Math.pow(BETA1, t);
	const bc2 = 1 - Math.pow(BETA2, t);
	for (let i = 0; i < W.length; i++) {
		const gi = g[i];
		m[i] = BETA1 * m[i] + (1 - BETA1) * gi;
		v[i] = BETA2 * v[i] + (1 - BETA2) * gi * gi;
		const mh = m[i] / bc1;
		const vh = v[i] / bc2;
		W[i] -= LR * (mh / (Math.sqrt(vh) + 1e-8) + WD * W[i]);
		g[i] = 0;
	}
}

function evalSplit(examples) {
	let loss = 0;
	let correct = 0;
	for (let off = 0; off < examples.length; off += EVAL_CHUNK) {
		const n = Math.min(EVAL_CHUNK, examples.length - off);
		const r = pass(examples, off, n, false);
		loss += r.loss * n;
		correct += r.correct;
	}
	return { loss: loss / examples.length, acc: correct / examples.length };
}

// ── train ────────────────────────────────────────────────────────────────────
const points = [];
let cursor = 0;
const t0 = Date.now();
for (let step = 1; step <= STEPS; step++) {
	if (cursor + BATCH > train.length) {
		cursor = 0;
		for (let i = train.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			[train[i], train[j]] = [train[j], train[i]];
		}
	}
	pass(train, cursor, BATCH, true);
	cursor += BATCH;
	adamw(W1, pass.gW1, m1, v1, step);
	adamw(W2, pass.gW2, m2, v2, step);

	if (step % LOG_EVERY === 0 || step === 1) {
		const tr = evalSplit(train);
		const va = evalSplit(val);
		points.push({
			step,
			trainLoss: +tr.loss.toFixed(4),
			valLoss: +va.loss.toFixed(4),
			trainAcc: +tr.acc.toFixed(4),
			valAcc: +va.acc.toFixed(4)
		});
		if (step % (LOG_EVERY * 10) === 0 || step === 1) {
			const secs = ((Date.now() - t0) / 1000).toFixed(0);
			console.log(
				`step ${step}/${STEPS} (${secs}s)  train ${tr.loss.toFixed(3)}/${(tr.acc * 100).toFixed(1)}%  val ${va.loss.toFixed(3)}/${(va.acc * 100).toFixed(1)}%`
			);
		}
	}
}

const meta = {
	task: `a + b mod ${P}`,
	model: `onehot(${2 * P}) → ${D} → x² → ${P}`,
	params: W1.length + W2.length,
	trainFrac: FRAC,
	optimizer: `AdamW lr=${LR} wd=${WD} β=(${BETA1},${BETA2})`,
	batch: BATCH,
	steps: STEPS,
	seed: SEED,
	recorded: new Date().toISOString()
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ meta, points }));
const last = points[points.length - 1];
console.log(
	`\nwrote ${OUT} (${points.length} points). Final: train ${(last.trainAcc * 100).toFixed(1)}% / val ${(last.valAcc * 100).toFixed(1)}%`
);
