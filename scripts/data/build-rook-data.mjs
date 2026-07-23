// Build Rook's corpus: random-legal chess games (the Othello-GPT recipe — pure
// rules, no strategy, which is exactly what makes the emergent-board-state
// story clean), tokenized as UCI move tokens, one token per ply.
//
// Vocab layout: id 0 = <game> separator; ids 1.. = every distinct UCI string
// observed (e2e4, e7e8q, …), sorted for determinism. Written assets:
//   static/data/rook-vocab.json  ({moves: string[], vocabSize})
//   static/data/rook-tokens.bin  (Uint16 stream: <game> m1 m2 … <game> …)
//
// Usage: node scripts/data/build-rook-data.mjs [games=6000] [maxPlies=60] [seed=7]

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const N_GAMES = Number(process.argv[2] ?? 6000);
const MAX_PLIES = Number(process.argv[3] ?? 60);
let seed = Number(process.argv[4] ?? 7);

function rand() {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const games = [];
const moveSet = new Set();
for (let g = 0; g < N_GAMES; g++) {
	const chess = new Chess();
	const moves = [];
	for (let ply = 0; ply < MAX_PLIES; ply++) {
		const legal = chess.moves({ verbose: true });
		if (legal.length === 0) break;
		const m = legal[Math.floor(rand() * legal.length)];
		const uci = m.from + m.to + (m.promotion ?? '');
		moves.push(uci);
		moveSet.add(uci);
		chess.move(m);
	}
	games.push(moves);
	if ((g + 1) % 1000 === 0) console.log(`generated ${g + 1}/${N_GAMES} games`);
}

const moves = [...moveSet].sort();
const idOf = new Map(moves.map((m, i) => [m, i + 1])); // 0 = <game>
const stream = [];
for (const game of games) {
	stream.push(0);
	for (const m of game) stream.push(idOf.get(m));
}

const outDir = join(ROOT, 'static', 'data');
mkdirSync(outDir, { recursive: true });
writeFileSync(
	join(outDir, 'rook-vocab.json'),
	JSON.stringify({ moves, vocabSize: moves.length + 1 })
);
writeFileSync(join(outDir, 'rook-tokens.bin'), Buffer.from(new Uint16Array(stream).buffer));
console.log(
	`games: ${games.length}, distinct moves: ${moves.length} (vocab ${moves.length + 1}), tokens: ${stream.length.toLocaleString()}`
);
