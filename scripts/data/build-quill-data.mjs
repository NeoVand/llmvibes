// Build Quill's corpus: fetch TinyStories rows from the HF datasets-server,
// train a byte-BPE on the slice, pretokenize, and write the static assets the
// course loads:
//   static/data/quill-corpus.txt   (raw slice — the ch. 1 corpus explorer reads it)
//   static/data/quill-vocab.json   ({merges, vocabSize})
//   static/data/quill-tokens.bin   (Uint16 token stream)
//   src/lib/llm/fixtures/bpe-fixture.json (locks bpe.mjs ⇄ bpe.ts together)
//
// TinyStories: Eldan & Li 2023, CDLA-Sharing-1.0 (attributed in the course).
// Usage: node scripts/data/build-quill-data.mjs [stories=3000] [vocab=512]

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trainBpe, encode } from './bpe.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const N_STORIES = Number(process.argv[2] ?? 3000);
const VOCAB = Number(process.argv[3] ?? 512);

const API = 'https://datasets-server.huggingface.co/rows?dataset=roneneldan%2FTinyStories&config=default&split=train';

async function fetchStories(n) {
	const stories = [];
	const pageSize = 100;
	for (let offset = 0; stories.length < n; offset += pageSize) {
		const res = await fetch(`${API}&offset=${offset}&length=${pageSize}`);
		if (!res.ok) throw new Error(`datasets-server ${res.status}: ${await res.text()}`);
		const json = await res.json();
		for (const row of json.rows) {
			const text = String(row.row.text ?? '').trim();
			if (text) stories.push(text);
			if (stories.length >= n) break;
		}
		process.stdout.write(`\rfetched ${stories.length}/${n} stories`);
		await new Promise((r) => setTimeout(r, 150)); // be polite
	}
	console.log();
	return stories;
}

const stories = await fetchStories(N_STORIES);
const corpus = stories.join('\n\n');
console.log(`corpus: ${(corpus.length / 1e6).toFixed(2)} MB of text`);

console.log(`training byte-BPE to vocab ${VOCAB}…`);
// Train on a slice for speed (BPE training is O(merges × corpus)); encode all.
const trainSlice = corpus.slice(0, 400_000);
const vocab = trainBpe(trainSlice, VOCAB);
console.log(`merges: ${vocab.merges.length} (vocab ${vocab.vocabSize})`);

console.log('encoding full corpus…');
const ids = encode(corpus, vocab.merges);
console.log(
	`tokens: ${ids.length.toLocaleString()} (${(corpus.length / ids.length).toFixed(2)} chars/token)`
);

const outDir = join(ROOT, 'static', 'data');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'quill-corpus.txt'), corpus);
writeFileSync(join(outDir, 'quill-vocab.json'), JSON.stringify(vocab));
writeFileSync(join(outDir, 'quill-tokens.bin'), Buffer.from(new Uint16Array(ids).buffer));

// Fixture: a paragraph encoded by THIS implementation; bpe.test.ts re-encodes
// it with src/lib/llm/bpe.ts and asserts identity.
const fixtureText = stories[0];
const fixtureDir = join(ROOT, 'src', 'lib', 'llm', 'fixtures');
mkdirSync(fixtureDir, { recursive: true });
writeFileSync(
	join(fixtureDir, 'bpe-fixture.json'),
	JSON.stringify({ text: fixtureText, ids: encode(fixtureText, vocab.merges), vocab })
);
console.log('wrote static/data/{quill-corpus.txt,quill-vocab.json,quill-tokens.bin} + bpe fixture');
