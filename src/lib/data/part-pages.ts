import manifest from './timeline-manifest.json';

/**
 * The standalone /parts/<slug> pages — one prerendered, crawlable URL per
 * part. The single-page course at / stays the canonical reading experience;
 * these exist so each part has a shareable link, its own title/description,
 * and its own social card. Slugs are semantic (they are the marketing
 * surface); ids are the same `part-N` anchors the rest of the app uses.
 */
export interface PartPage {
	/** Anchor id on the main page, e.g. `part-7` */
	id: string;
	/** URL slug under /parts/ */
	slug: string;
	/** Full display title, matching the part's SectionHeader */
	title: string;
	/** Meta/OG description, written for search results (~150 chars) */
	description: string;
}

export const SITE_URL = 'https://neovand.github.io/llmvibes';

export const partPages: PartPage[] = [
	{
		id: 'part-1',
		slug: 'hatch',
		title: 'Hatch',
		description:
			'Meet Quill the storyteller and Rook the chess player, scrub them back to random weights, and explore the corpora they eat — including why cleaning and dedup come first.'
	},
	{
		id: 'part-2',
		slug: 'tokens',
		title: 'Tokens',
		description:
			'Train a byte-level BPE tokenizer live and contrast it with Rook’s designed chess vocabulary — learned vs designed vocabularies, plus the token-stream inspector.'
	},
	{
		id: 'part-3',
		slug: 'transformer',
		title: 'The Transformer',
		description:
			'Embeddings, the residual stream, attention over text and chess moves, RoPE and context windows, SwiGLU and RMSNorm — the modern decoder block, one sub-layer at a time.'
	},
	{
		id: 'part-4',
		slug: 'learning',
		title: 'Learning',
		description:
			'Softmax, cross-entropy and perplexity; backpropagation; AdamW and schedules; train/val curves, overfitting and memorization — closing with the grokking interlude.'
	},
	{
		id: 'part-5',
		slug: 'pretraining',
		title: 'Pretraining',
		description:
			'Watch twin dashboards as Quill and Rook pretrain live in your browser: temperature and sampling, a training time machine, a tiny scaling law, and how evals really work.'
	},
	{
		id: 'part-6',
		slug: 'world-models',
		title: 'World Models',
		description:
			'Does a next-move predictor model the board? Linear probes read a chessboard out of the residual stream, and activation patching flips one belief to change the move.'
	},
	{
		id: 'part-7',
		slug: 'sft',
		title: 'SFT + LoRA',
		description:
			'Instruction data, chat templates and loss masking, then LoRA — and Rook’s Elo-token cameo that makes conditioning vs fine-tuning visceral, with before/after tests.'
	},
	{
		id: 'part-8',
		slug: 'synthetic-data',
		title: 'Synthetic Data',
		description:
			'The reveal that TinyStories was synthetic all along — then generation pipelines, verifier filtering and dedup, and fine-tuning Quill on data you curated yourself.'
	},
	{
		id: 'part-9',
		slug: 'preferences',
		title: 'Preferences',
		description:
			'Rate story pairs, train a reward model on your own clicks, run DPO on both birds, and meet RLHF vs RLAIF — sealed with a blind taste test and a toy refusal.'
	},
	{
		id: 'part-10',
		slug: 'reward-hacking',
		title: 'Reward Hacking',
		description:
			'Best-of-N against your own reward model produces “dragon dragon dragon,” and a naive material reward makes Rook hang its king — Goodhart’s law live, then the KL fix.'
	},
	{
		id: 'part-11',
		slug: 'rlvr',
		title: 'RLVR & GRPO',
		description:
			'From labels to rewards: GRPO across three arenas — chess legality and wins, story constraints, and a Countdown puzzle — with an editable reward function and the full R1 recipe.'
	},
	{
		id: 'part-12',
		slug: 'agents',
		title: 'Agents',
		description:
			'Tool calls as special tokens: a scratchpad memory for stories longer than the context window, a story-world database, and consistency rewards that keep the tale honest.'
	},
	{
		id: 'part-13',
		slug: 'frontier',
		title: 'Frontier & Inference',
		description:
			'Mixture of Experts, MTP, Muon and QK-clip with honest does-it-help-at-25M verdicts, plus KV caching, quantization, speculative decoding, and a SmolLM cameo.'
	},
	{
		id: 'part-14',
		slug: 'epilogue',
		title: 'Epilogue',
		description:
			'The scale map from Quill and Rook to frontier models: what is identical, what changes with scale, what nobody knows yet — and a goodbye to two birds, fully grown.'
	}
];

const bySlug = new Map(partPages.map((p) => [p.slug, p]));
const byId = new Map(partPages.map((p) => [p.id, p]));

export function partPageBySlug(slug: string): PartPage | undefined {
	return bySlug.get(slug);
}

export function partPageById(id: string): PartPage | undefined {
	return byId.get(id);
}

/**
 * The banner a part's social card should use. Read from the timeline manifest
 * rather than restated here: the manifest already resolves which anchors own a
 * banner and which inherit their part's first section, so a part whose own
 * header has no art still gets a card.
 */
export function partImage(id: string): string | null {
	const item = (manifest as { id: string; image?: string }[]).find((it) => it.id === id);
	return item?.image ?? null;
}
