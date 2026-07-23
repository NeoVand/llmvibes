export interface SearchEntry {
	/** Unique key for list rendering */
	id: string;
	/** DOM id to scroll to when selected */
	sectionId: string;
	/** Primary command, when this entry is command-focused (unused so far) */
	command?: string;
	title: string;
	part: string;
	description: string;
	keywords: string[];
	kind: 'command' | 'topic';
}

/**
 * The search index is topic-only for now: the git command entries are gone,
 * and LLMVibes' own command/formula entries arrive with the cheat sheet in a
 * later milestone. These topics cover the concepts a learner is most likely
 * to reach for mid-course, each pointing at the section that teaches it.
 */
const topicEntries: SearchEntry[] = [
	{
		id: 'topic-quill-rook',
		sectionId: 'section-1-1',
		title: 'Quill & Rook — the two models',
		part: 'Hatch',
		description:
			'The two tiny models you raise: Quill writes stories, Rook plays chess — same architecture, two corpora.',
		keywords: ['quill', 'rook', 'birds', 'models', 'storyteller', 'chess', 'tinystories'],
		kind: 'topic'
	},
	{
		id: 'topic-tokenization',
		sectionId: 'section-2-2',
		title: 'Tokenization & BPE',
		part: 'Tokens',
		description: 'Byte-pair encoding trained live: how raw bytes merge into a learned vocabulary.',
		keywords: ['bpe', 'byte pair encoding', 'tokenizer', 'tokenization', 'vocabulary', 'merges'],
		kind: 'topic'
	},
	{
		id: 'topic-attention',
		sectionId: 'section-3-2',
		title: 'Attention',
		part: 'The Transformer',
		description:
			'The attention mechanism, seen two ways: text-span maps for Quill, move arrows for Rook.',
		keywords: ['attention', 'heads', 'query', 'key', 'value', 'transformer'],
		kind: 'topic'
	},
	{
		id: 'topic-perplexity',
		sectionId: 'section-4-1',
		title: 'Cross-entropy & perplexity',
		part: 'Learning',
		description: 'The loss the whole course minimizes, and the number that makes it readable.',
		keywords: ['loss', 'cross-entropy', 'cross entropy', 'perplexity', 'softmax', 'logits'],
		kind: 'topic'
	},
	{
		id: 'topic-sampling',
		sectionId: 'section-5-2',
		title: 'Temperature & sampling',
		part: 'Pretraining',
		description:
			'How a probability distribution becomes the next token, and what temperature does.',
		keywords: ['temperature', 'sampling', 'greedy', 'randomness', 'generation'],
		kind: 'topic'
	},
	{
		id: 'topic-lora',
		sectionId: 'section-7-3',
		title: 'LoRA',
		part: 'SFT + LoRA',
		description:
			'Low-rank adapters: fine-tune a frozen model by training two small matrices per layer.',
		keywords: ['lora', 'low-rank', 'adapter', 'fine-tune', 'finetune', 'peft'],
		kind: 'topic'
	},
	{
		id: 'topic-dpo',
		sectionId: 'section-9-3',
		title: 'DPO',
		part: 'Preferences',
		description: 'Direct preference optimization — alignment from preference pairs, no RL loop.',
		keywords: ['dpo', 'direct preference optimization', 'preference', 'alignment', 'rlhf'],
		kind: 'topic'
	},
	{
		id: 'topic-grpo',
		sectionId: 'section-11-3',
		title: 'GRPO',
		part: 'RLVR & GRPO',
		description:
			'Group-relative policy optimization: sample a group, score it, upweight the winners.',
		keywords: ['grpo', 'rlvr', 'reinforcement learning', 'policy gradient', 'verifiable rewards'],
		kind: 'topic'
	},
	{
		id: 'topic-kv-cache',
		sectionId: 'section-13-3',
		title: 'KV cache',
		part: 'Frontier & Inference',
		description: 'Why generation gets faster when the model stops recomputing its own past.',
		keywords: ['kv cache', 'inference', 'speed', 'top-k', 'top-p', 'decoding'],
		kind: 'topic'
	}
];

export const searchIndex: SearchEntry[] = [...topicEntries];

export function scoreSearchEntry(entry: SearchEntry, rawQuery: string): number {
	const query = rawQuery.toLowerCase().trim();
	if (!query) return 0;

	const tokens = query.split(/\s+/).filter(Boolean);
	const command = entry.command?.toLowerCase() ?? '';
	const title = entry.title.toLowerCase();
	const description = entry.description.toLowerCase();
	const keywordBlob = entry.keywords.join(' ').toLowerCase();

	if (entry.kind === 'command' && command) {
		if (command === query) return 1000;
		if (command.startsWith(query)) return 900;
		if (command.includes(query)) return 750;

		const commandPrefix = tokens.join(' ');
		if (command.startsWith(commandPrefix)) return 850;
		if (tokens.length > 1 && tokens.every((token) => command.includes(token))) {
			return 700 + tokens.length * 20;
		}
	}

	for (const keyword of entry.keywords) {
		const lower = keyword.toLowerCase();
		if (lower === query) return entry.kind === 'command' ? 650 : 500;
		if (lower.startsWith(query)) return entry.kind === 'command' ? 600 : 450;
	}

	if (title === query) return entry.kind === 'command' ? 550 : 300;
	if (title.startsWith(query)) return entry.kind === 'command' ? 500 : 250;
	if (description.includes(query)) return entry.kind === 'command' ? 400 : 200;

	if (tokens.every((token) => keywordBlob.includes(token) || title.includes(token))) {
		return entry.kind === 'command' ? 350 + tokens.length * 15 : 120;
	}

	if (title.includes(query)) return entry.kind === 'command' ? 180 : 80;

	return 0;
}

export function searchEntries(rawQuery: string, limit = 8): SearchEntry[] {
	const query = rawQuery.trim();
	if (!query) return [];

	return searchIndex
		.map((entry) => ({ entry, score: scoreSearchEntry(entry, query) }))
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
		.slice(0, limit)
		.map(({ entry }) => entry);
}
