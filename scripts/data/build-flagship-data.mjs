// Flagship Rook dataset: a large pile of random-legal games so a bigger model
// can be pushed toward the regime where board-tracking is forced (and a linear
// probe can read the board out — the Othello-GPT / Karvonen result).
//
// Parallelized across worker threads (chess.js legal-move generation is the
// bottleneck). Writes to spikes/flagship/ (offline assets, not shipped):
//   rook-flagship-tokens.bin   Uint16 stream: <game>=0 m1 m2 … <game> …
//   rook-flagship-vocab.json   { moves: string[], vocabSize }
//   rook-flagship-probe.json   held-out games with per-position board labels
//
// Usage: node scripts/data/build-flagship-data.mjs [games=100000] [probe=400] [maxPlies=80]

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { Chess } from 'chess.js';

function mulberry(seed) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ── worker: generate a chunk of games as arrays of UCI strings ──
if (!isMainThread) {
	const { count, seed, maxPlies } = workerData;
	const rand = mulberry(seed);
	const games = [];
	for (let g = 0; g < count; g++) {
		const chess = new Chess();
		const moves = [];
		for (let ply = 0; ply < maxPlies; ply++) {
			const legal = chess.moves({ verbose: true });
			if (legal.length === 0) break;
			const m = legal[Math.floor(rand() * legal.length)];
			moves.push(m.from + m.to + (m.promotion ?? ''));
			chess.move(m);
		}
		games.push(moves);
	}
	parentPort.postMessage(games);
	process.exit(0);
}

// ── main ──
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'spikes', 'flagship');
mkdirSync(OUT, { recursive: true });
const N_GAMES = Number(process.argv[2] ?? 100000);
const N_PROBE = Number(process.argv[3] ?? 400);
const MAX_PLIES = Number(process.argv[4] ?? 80);
const SELF = fileURLToPath(import.meta.url);
const NW = Math.max(1, Math.min(9, os.cpus().length - 1));
const per = Math.ceil(N_GAMES / NW);
const t0 = Date.now();
console.log(`generating ${N_GAMES} games on ${NW} workers (${per}/worker)…`);

const chunks = await Promise.all(
	Array.from(
		{ length: NW },
		(_, i) =>
			new Promise((resolve, reject) => {
				const w = new Worker(SELF, {
					workerData: { count: per, seed: 1000 + i * 7919, maxPlies: MAX_PLIES }
				});
				w.once('message', resolve);
				w.once('error', reject);
			})
	)
);
const games = chunks.flat().slice(0, N_GAMES);
console.log(`  ${games.length} games in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// ── vocab (sorted UCI) + tokenize ──
const moveSet = new Set();
let totalTokens = 0;
for (const g of games) {
	for (const m of g) moveSet.add(m);
	totalTokens += g.length + 1;
}
const sorted = [...moveSet].sort();
const id = new Map(sorted.map((m, i) => [m, i + 1])); // 0 = <game>
const tokens = new Uint16Array(totalTokens);
let w = 0;
for (const g of games) {
	tokens[w++] = 0;
	for (const m of g) tokens[w++] = id.get(m);
}
writeFileSync(join(OUT, 'rook-flagship-tokens.bin'), Buffer.from(tokens.buffer));
writeFileSync(
	join(OUT, 'rook-flagship-vocab.json'),
	JSON.stringify({ moves: sorted, vocabSize: sorted.length + 1 })
);
console.log(`wrote ${totalTokens.toLocaleString()} tokens, vocab ${sorted.length + 1}`);

// ── probe set: fresh held-out games with per-position board labels ──
function labelsFor(chess) {
	const turn = chess.turn();
	const b = chess.board();
	const lab = new Array(64).fill(0);
	for (let r = 0; r < 8; r++) {
		for (let f = 0; f < 8; f++) {
			const piece = b[r][f];
			const rankIdx = 7 - r;
			const oi = turn === 'w' ? rankIdx * 8 + f : (7 - rankIdx) * 8 + (7 - f);
			lab[oi] = piece ? (piece.color === turn ? 1 : 2) : 0;
		}
	}
	return lab;
}
const prand = mulberry(999983);
const probe = [];
for (let g = 0; g < N_PROBE; g++) {
	const chess = new Chess();
	const tokIds = [0];
	const labels = [labelsFor(chess)];
	for (let ply = 0; ply < MAX_PLIES; ply++) {
		const legal = chess.moves({ verbose: true });
		if (legal.length === 0) break;
		const m = legal[Math.floor(prand() * legal.length)];
		const uci = m.from + m.to + (m.promotion ?? '');
		const mid = id.get(uci);
		if (mid === undefined) break;
		chess.move(m);
		tokIds.push(mid);
		labels.push(labelsFor(chess));
	}
	if (tokIds.length > 6) probe.push({ tokens: tokIds, labels });
}
writeFileSync(join(OUT, 'rook-flagship-probe.json'), JSON.stringify(probe));
console.log(
	`wrote ${probe.length} probe games with labels · done in ${((Date.now() - t0) / 1000).toFixed(0)}s`
);
