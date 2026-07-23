// Byte-level BPE trainer + encoder (Node). MUST match src/lib/llm/bpe.ts's
// encode exactly (greedy lowest-rank pair); bpe.test.ts locks them together
// via the sample-encoding fixture this script writes.

export function trainBpe(text, vocabSize) {
	const bytes = new TextEncoder().encode(text);
	let ids = Array.from(bytes);
	const merges = [];
	while (256 + merges.length < vocabSize) {
		const counts = new Map();
		for (let i = 0; i < ids.length - 1; i++) {
			const key = ids[i] * 65536 + ids[i + 1];
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		let bestKey = -1;
		let bestCount = 1; // require an actual repeat
		for (const [key, count] of counts) {
			if (count > bestCount) {
				bestCount = count;
				bestKey = key;
			}
		}
		if (bestKey < 0) break;
		const a = Math.floor(bestKey / 65536);
		const b = bestKey % 65536;
		const newId = 256 + merges.length;
		merges.push([a, b]);
		const next = [];
		for (let i = 0; i < ids.length; i++) {
			if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) {
				next.push(newId);
				i++;
			} else {
				next.push(ids[i]);
			}
		}
		ids = next;
		if (merges.length % 50 === 0) {
			console.log(`  merge ${merges.length}: corpus now ${ids.length.toLocaleString()} tokens`);
		}
	}
	return { merges, vocabSize: 256 + merges.length };
}

/**
 * Per-rank sweep encode — mirror of BpeTokenizer.encode in bpe.ts. For each
 * merge in rank order, one left-to-right pass replaces every (a,b) pair.
 * O(merges × n): linear passes, no array spreads — encodes megabytes fine.
 * The two implementations MUST stay algorithm-identical (fixture-tested).
 */
export function encode(text, merges) {
	let ids = Array.from(new TextEncoder().encode(text));
	for (let r = 0; r < merges.length; r++) {
		const [a, b] = merges[r];
		const newId = 256 + r;
		const next = [];
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
