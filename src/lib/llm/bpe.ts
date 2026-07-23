// Byte-level BPE, browser side. The SAME algorithm lives in
// scripts/data/bpe.mjs (which trains the merges and pretokenizes the corpus);
// a fixture test (bpe.test.ts) locks the two implementations together — if
// they ever disagree, corpus tokens and live-encoded prompts would diverge
// silently. Encode = per-rank sweep (for each merge in rank order, one
// left-to-right pass replaces every pair); byte fallback means nothing is
// ever out-of-vocabulary.

export interface BpeVocab {
	/** merges[i] = [leftId, rightId] creating token id 256+i. */
	merges: Array<[number, number]>;
	vocabSize: number;
}

export class BpeTokenizer {
	private merges: Array<[number, number]>;
	private tokenBytes: Uint8Array[] = [];
	readonly vocabSize: number;

	constructor(vocab: BpeVocab) {
		this.vocabSize = vocab.vocabSize;
		this.merges = vocab.merges;
		for (let i = 0; i < 256; i++) this.tokenBytes.push(new Uint8Array([i]));
		for (const [a, b] of vocab.merges) {
			const left = this.tokenBytes[a];
			const right = this.tokenBytes[b];
			const joined = new Uint8Array(left.length + right.length);
			joined.set(left);
			joined.set(right, left.length);
			this.tokenBytes.push(joined);
		}
	}

	encode(text: string): number[] {
		let ids: number[] = Array.from(new TextEncoder().encode(text));
		for (let r = 0; r < this.merges.length; r++) {
			const [a, b] = this.merges[r];
			const newId = 256 + r;
			const next: number[] = [];
			for (let i = 0; i < ids.length; i++) {
				if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) {
					next.push(newId);
					i++;
				} else {
					next.push(ids[i]);
				}
			}
			ids = next;
		}
		return ids;
	}

	decode(ids: number[]): string {
		let total = 0;
		for (const id of ids) total += this.tokenBytes[id]?.length ?? 0;
		const bytes = new Uint8Array(total);
		let off = 0;
		for (const id of ids) {
			const b = this.tokenBytes[id];
			if (!b) continue;
			bytes.set(b, off);
			off += b.length;
		}
		return new TextDecoder().decode(bytes);
	}

	/** Printable form of one token (inspector labels): ␣ for space, ⏎ for \n. */
	decodeOne(id: number): string {
		return this.decode([id]).replaceAll(' ', '␣').replaceAll('\n', '⏎');
	}
}

export async function loadBpe(url: string): Promise<BpeTokenizer> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`vocab fetch failed: ${res.status}`);
	return new BpeTokenizer((await res.json()) as BpeVocab);
}
