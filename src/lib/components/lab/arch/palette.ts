// Shared visual language + deterministic demo data for the ArchExplorer stage
// vignettes. One color = one concept, everywhere (transformer-explainer
// convention, adapted to the house theme):
//
//   Query      steel-blue  #5a8fc0     attention weights  plum   #b06a82
//   Key        copper      #c87142     MLP hidden         amber  #ecc068
//   Value      verdigris   #56a884     residual / stream  gold   #d9a441
//
// All example values are precomputed constants from a seeded generator —
// plausible, stable across renders and across SSR/client, never Math.random.

export const CH = {
	q: '#5a8fc0', // Query — steel blue
	k: '#c87142', // Key — copper
	v: '#56a884', // Value — verdigris
	attn: '#b06a82', // attention weights — plum
	hidden: '#ecc068', // MLP hidden — amber (fills only; too light for text)
	gold: '#d9a441', // residual stream / carrier
	bronze: '#a8823c' // MLP output, back down to d
} as const;

/** Theme-adaptive ink: pulls a fill hue toward the current text color so
 *  labels stay readable on both light and dark surfaces. */
export function ink(hex: string, pct = 62): string {
	return `color-mix(in srgb, ${hex} ${pct}%, var(--color-text))`;
}

// ── the fixed illustrative prompt ────────────────────────────────────────────
export const TOKENS = ['Once', 'upon', 'a', 'time', ',', 'the'];
export const TOKEN_IDS = [290, 471, 97, 358, 44, 262];
export const FOCUS = 5; // every vignette zooms in on "the", the last token
export const D_SHOW = 16; // bars drawn when a vector stands in for d dims
export const H_SHOW = 32; // bars drawn for the 4d MLP hidden vector
export const HD_SHOW = 8; // cells drawn for a per-head (head_dim) vector

// ── seeded pseudo-values ─────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function vec(seed: number, n: number, spread = 1): number[] {
	const r = mulberry32(seed);
	return Array.from({ length: n }, () => (r() * 2 - 1) * spread);
}

export function rms(v: number[]): number {
	return Math.sqrt(v.reduce((a, x) => a + x * x, 0) / v.length);
}

export function softmax(xs: number[]): number[] {
	const m = Math.max(...xs);
	const es = xs.map((x) => Math.exp(x - m));
	const s = es.reduce((a, b) => a + b, 0);
	return es.map((e) => e / s);
}

// ── precomputed stage data ───────────────────────────────────────────────────
/** Token embedding rows (one per prompt token, D_SHOW dims shown). */
export const EMB: number[][] = TOKENS.map((_, i) => vec(101 + i * 7, D_SHOW, 0.9));

/** Positional vectors — smooth per-position waves, so the diverging cells read
 *  as structure rather than noise (the pocket model learns these). */
export const POS: number[][] = TOKENS.map((_, i) =>
	Array.from({ length: D_SHOW }, (_, j) => Math.sin((j + 1) * 0.55 + i * 1.1) * 0.75)
);

/** The residual stream entering block 1: token + position. */
export const X0: number[][] = EMB.map((row, i) => row.map((x, j) => x + POS[i][j] * 0.55));

// RMSNorm vignette: an intentionally uneven "before" vector.
export const NORM_IN: number[] = X0[FOCUS].map((x, j) => x * (j % 5 === 2 ? 1.9 : 1.1));
export const NORM_RMS: number = rms(NORM_IN);
export const NORM_OUT: number[] = NORM_IN.map((x) => x / NORM_RMS);
export const GAMMA: number[] = vec(500, D_SHOW, 0.28).map((x) => 1 + x);

// MLP vignette: d → 4d (pre-ReLU, so ~half the bars die) → d.
export const MLP_IN: number[] = NORM_OUT.map((x) => x * 0.9);
export const MLP_HID: number[] = vec(300, H_SHOW, 1.05);
export const MLP_OUT: number[] = vec(320, D_SHOW, 0.75);

// Residual vignettes: stream + branch = stream'.
export const RES_STREAM: number[] = X0[FOCUS];
export const RES_DELTA_ATTN: number[] = vec(410, D_SHOW, 0.45);
export const RES_DELTA_MLP: number[] = MLP_OUT.map((x) => x * 0.6);

// LM head vignette: top-8 candidates after "Once upon a time, the ___".
export const CANDS = ['little', 'big', 'old', 'small', 'kind', 'magic', 'sun', 'king'];
export const LOGITS = [4.1, 2.6, 2.2, 1.7, 1.1, 0.8, 0.4, -0.2];
export const PROBS: number[] = softmax(LOGITS);
export const HEAD_IN: number[] = X0[FOCUS].map((x) => x * 0.8);

// ── per-head Q/K/V and attention patterns ────────────────────────────────────
/** Deterministic per-head, per-token Q/K/V mini-vectors (HD_SHOW dims). */
export function qkvFor(head: number): { q: number[]; k: number[]; v: number[] }[] {
	return TOKENS.map((_, t) => ({
		q: vec(1000 + head * 97 + t * 11, HD_SHOW, 0.85),
		k: vec(2000 + head * 97 + t * 11, HD_SHOW, 0.85),
		v: vec(3000 + head * 97 + t * 11, HD_SHOW, 0.85)
	}));
}

/** Named attention patterns, cycled per head:
 *  0 previous-token head · 1 first-token sink · 2 recency decay · 3 mixed.
 *  Rows are lower-triangular and sum to 1 (a causal softmax would). */
export function attnPattern(head: number): number[][] {
	const kind = head % 4;
	const r = mulberry32(7777 + head * 131);
	const W: number[][] = [];
	for (let i = 0; i < TOKENS.length; i++) {
		const row = new Array(TOKENS.length).fill(0);
		for (let j = 0; j <= i; j++) {
			let s: number;
			if (kind === 0) s = j === i - 1 ? 3.1 : j === i ? 1.0 : 0.15;
			else if (kind === 1) s = j === 0 ? 2.7 : j === i ? 0.9 : 0.2;
			else if (kind === 2) s = 2.1 - (i - j) * 0.55;
			else s = 1 + Math.sin((i * 5 + j * 3 + head) * 1.7) * 0.7;
			row[j] = Math.exp(s + (r() - 0.5) * 0.3);
		}
		const sum = row.reduce((a, b) => a + b, 0);
		for (let j = 0; j <= i; j++) row[j] /= sum;
		W.push(row);
	}
	return W;
}

export const HEAD_KIND_LABEL = [
	'watches the previous token',
	'parks on the first token (a "sink")',
	'recency — nearer tokens weigh more',
	'mixed — a bit of everything'
] as const;
