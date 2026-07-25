// Flagship Quill corpus: a bigger pile of TinyStories so a bigger model can be
// pushed into the regime where induction heads (in-context copying) actually
// form — the Part 5.4 "induction bump". Reuses the LIVE Quill's byte-BPE vocab
// (static/data/quill-vocab.json, 512 merges) so the flagship is a true bigger
// sibling of the live pair on the identical tokenizer — no BPE retraining.
//
// Writes to spikes/flagship/ (offline assets, gitignored like the Rook flagship):
//   quill-flagship-tokens.bin   Uint16 token stream (stories joined by \n\n)
//   quill-flagship-meta.json    { stories, tokens, vocabSize }
//
// Usage: node scripts/data/build-quill-flagship-data.mjs [stories=30000]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode } from './bpe.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'spikes', 'flagship');
mkdirSync(OUT, { recursive: true });
const N_STORIES = Number(process.argv[2] ?? 30000);

const API =
	'https://datasets-server.huggingface.co/rows?dataset=roneneldan%2FTinyStories&config=default&split=train';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchStories(n) {
	const stories = [];
	const pageSize = 100;
	for (let offset = 0; stories.length < n; offset += pageSize) {
		let json;
		for (let attempt = 0; ; attempt++) {
			try {
				const res = await fetch(`${API}&offset=${offset}&length=${pageSize}`);
				if (res.status === 429) {
					// rate limited — back off patiently and keep trying (don't give up)
					process.stdout.write(`\r  rate limited at ${stories.length}, waiting 15s…        `);
					await sleep(15000);
					continue;
				}
				if (!res.ok) throw new Error(`datasets-server ${res.status}`);
				json = await res.json();
				break;
			} catch (e) {
				if (attempt >= 8) throw e;
				await sleep(2000 * (attempt + 1));
			}
		}
		for (const row of json.rows) {
			const text = String(row.row.text ?? '').trim();
			if (text) stories.push(text);
			if (stories.length >= n) break;
		}
		process.stdout.write(`\rfetched ${stories.length}/${n} stories            `);
		await sleep(350); // gentler on the datasets-server
	}
	console.log();
	return stories;
}

const t0 = Date.now();
const CORPUS_FILE = join(OUT, 'quill-flagship-corpus.txt');
let corpus, nStories;
if (existsSync(CORPUS_FILE)) {
	// fetch_tinystories.py already wrote the corpus (HF datasets stream, unthrottled)
	corpus = readFileSync(CORPUS_FILE, 'utf8');
	nStories = corpus.split('\n\n').length;
	console.log(
		`corpus from ${CORPUS_FILE}: ${(corpus.length / 1e6).toFixed(2)} MB, ~${nStories} stories`
	);
} else {
	const stories = await fetchStories(N_STORIES);
	corpus = stories.join('\n\n');
	nStories = stories.length;
	console.log(`corpus: ${(corpus.length / 1e6).toFixed(2)} MB of text in ${nStories} stories`);
}

const vocab = JSON.parse(readFileSync(join(ROOT, 'static', 'data', 'quill-vocab.json'), 'utf8'));
console.log(
	`encoding with the live Quill vocab (${vocab.vocabSize} tokens, ${vocab.merges.length} merges)…`
);
const ids = encode(corpus, vocab.merges);
const tokens = new Uint16Array(ids);
writeFileSync(join(OUT, 'quill-flagship-tokens.bin'), Buffer.from(tokens.buffer));
writeFileSync(
	join(OUT, 'quill-flagship-meta.json'),
	JSON.stringify({ stories: nStories, tokens: ids.length, vocabSize: vocab.vocabSize })
);
console.log(
	`wrote ${ids.length.toLocaleString()} tokens (${(corpus.length / ids.length).toFixed(2)} chars/token) ` +
		`to spikes/flagship/quill-flagship-tokens.bin · ${((Date.now() - t0) / 1000).toFixed(0)}s`
);
