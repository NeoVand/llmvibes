/**
 * The course as a graph rather than a list.
 *
 * Labels and icons are NOT duplicated here — they resolve from sidebarNav, so
 * a part renamed in the sidebar is renamed everywhere it's referenced. That
 * indirection is the point: cross-references in the prose name a part instead
 * of numbering it, which keeps them correct if the curriculum is ever
 * reordered.
 */

export interface CourseNode {
	/** Anchor id, e.g. 'part-8'. */
	id: string;
	/** What a learner can do after this part — one short clause. */
	gives: string;
	/** Parts whose skills this one genuinely builds on. */
	needs: string[];
	/**
	 * 'core'    — the spine; skipping one breaks what follows
	 * 'power'   — everyday power tools, each independently useful
	 * 'mastery' — synthesis and enrichment; rewarding, not load-bearing
	 */
	track: 'core' | 'power' | 'mastery';
}

/**
 * LLMVibes is deliberately a spine: each stage of raising Quill and Rook
 * builds on the one before it — data → tokens → architecture → training →
 * a real run — and the alignment act replays that chain on top of the
 * pretrained pair. So the graph is a linear chain in arc order, and the
 * track field marks where the spine ends and the frontier extras begin.
 */
export const courseGraph: CourseNode[] = [
	{ id: 'hero', gives: 'what you are raising, and the route ahead', needs: [], track: 'core' },
	{
		id: 'part-1',
		gives: 'two hatchling models and a clean corpus to feed them',
		needs: ['hero'],
		track: 'core'
	},
	{
		id: 'part-2',
		gives: 'stories and chess games turned into token streams',
		needs: ['part-1'],
		track: 'core'
	},
	{
		id: 'part-3',
		gives: 'the transformer, understood one sub-layer at a time',
		needs: ['part-2'],
		track: 'core'
	},
	{
		id: 'part-4',
		gives: 'how loss becomes learning — backprop, AdamW, grokking',
		needs: ['part-3'],
		track: 'core'
	},
	{
		id: 'part-5',
		gives: 'a real pretraining run you watched from gibberish to grammar',
		needs: ['part-4'],
		track: 'core'
	},
	{
		id: 'part-6',
		gives: 'probes and patches that find a chessboard in the weights',
		needs: ['part-5'],
		track: 'core'
	},
	{
		id: 'part-7',
		gives: 'instruction-following models, fine-tuned in full and via LoRA',
		needs: ['part-6'],
		track: 'core'
	},
	{
		id: 'part-8',
		gives: 'a synthetic-data pipeline you filtered and trained on',
		needs: ['part-7'],
		track: 'core'
	},
	{
		id: 'part-9',
		gives: 'a reward model from your own clicks, and DPO on both birds',
		needs: ['part-8'],
		track: 'core'
	},
	{
		id: 'part-10',
		gives: 'reward hacking seen live, and the KL fix that tames it',
		needs: ['part-9'],
		track: 'core'
	},
	{
		id: 'part-11',
		gives: 'GRPO on verifiable rewards, up to the full R1-style recipe',
		needs: ['part-10'],
		track: 'core'
	},
	{
		id: 'part-12',
		gives: 'a model that calls tools — memory and a story-world database',
		needs: ['part-11'],
		track: 'power'
	},
	{
		id: 'part-13',
		gives: 'frontier tricks and fast inference, with honest small-scale verdicts',
		needs: ['part-12'],
		track: 'power'
	},
	{
		id: 'part-14',
		gives: 'the scale map from your two birds to the frontier',
		needs: ['part-13'],
		track: 'mastery'
	}
];

export function nodeFor(id: string): CourseNode | undefined {
	return courseGraph.find((n) => n.id === id);
}

/** Course order, for laying the map out in reading sequence. */
export const courseOrder: string[] = courseGraph.map((n) => n.id);

/**
 * Everything you'd need before `id` makes sense, walked transitively and
 * returned in reading order — the "what do I have to read first?" answer.
 */
export function prerequisitesOf(id: string): string[] {
	const seen = new Set<string>();
	const walk = (current: string) => {
		for (const need of nodeFor(current)?.needs ?? []) {
			if (seen.has(need)) continue;
			seen.add(need);
			walk(need);
		}
	};
	walk(id);
	return courseOrder.filter((n) => seen.has(n));
}
