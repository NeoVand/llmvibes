// Locks src/lib/llm/bpe.ts (browser) to scripts/data/bpe.mjs (corpus builder).
// The fixture was written BY the Node implementation; if the browser tokenizer
// ever encodes differently, live prompts and corpus tokens silently diverge —
// this test makes that loud instead.
import { describe, expect, it } from 'vitest';
import { BpeTokenizer } from './bpe';
import fixture from './fixtures/bpe-fixture.json';

describe('byte-BPE browser/builder parity', () => {
	const tok = new BpeTokenizer(fixture.vocab as ConstructorParameters<typeof BpeTokenizer>[0]);

	it('encodes the fixture text to the exact ids the corpus builder produced', () => {
		expect(tok.encode(fixture.text)).toEqual(fixture.ids);
	});

	it('decode inverts encode', () => {
		expect(tok.decode(tok.encode(fixture.text))).toBe(fixture.text);
	});

	it('byte fallback: arbitrary unicode round-trips', () => {
		const s = 'héllo 🌍 — tokens⏎ and\nnewlines';
		expect(tok.decode(tok.encode(s))).toBe(s);
	});
});
