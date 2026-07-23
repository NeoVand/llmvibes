import {
	Activity,
	AlertOctagon,
	AlertTriangle,
	Anchor,
	Archive,
	ArrowLeftRight,
	Award,
	Ban,
	Binary,
	Bird,
	Bot,
	Box,
	Boxes,
	Brain,
	ClipboardCheck,
	Combine,
	Crosshair,
	Database,
	Egg,
	Eye,
	EyeOff,
	FastForward,
	Feather,
	FileText,
	Filter,
	FlaskConical,
	GitCompare,
	GraduationCap,
	Hammer,
	Heart,
	HelpCircle,
	History,
	Layers,
	LayoutDashboard,
	LayoutGrid,
	Lightbulb,
	Link2,
	ListOrdered,
	MessageSquare,
	Microscope,
	Mountain,
	MousePointerClick,
	Network,
	Pencil,
	PenLine,
	Play,
	Repeat,
	Rocket,
	RotateCw,
	Scale,
	Search,
	Settings,
	ShieldCheck,
	Shrink,
	Sigma,
	SlidersHorizontal,
	Sparkles,
	Split,
	Star,
	StickyNote,
	Swords,
	Target,
	Telescope,
	Thermometer,
	ThumbsUp,
	TrendingDown,
	TrendingUp,
	Undo2,
	Users,
	Wand2,
	Workflow,
	Wrench,
	Zap
} from 'lucide-svelte';

export interface NavItem {
	id: string;
	label: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	icon: any;
	isPlayground?: boolean;
	/**
	 * The graded counterpart of a playground — one per Part, always the last
	 * child. Rendered in the challenge terracotta with `Puzzle`, and, like
	 * `isPlayground`, at the smaller activity row size.
	 */
	isChallenge?: boolean;
}

/** Both flags mean "an activity, not prose", which is what row styling keys on. */
export function isActivity(item: NavItem): boolean {
	return Boolean(item.isPlayground || item.isChallenge);
}

/**
 * The two kinds of hands-on activity. It lives here, next to the flags it
 * mirrors, so the sidebar row and the activity card name the same two things
 * from one definition rather than each declaring its own string union.
 */
export type ActivityKind = 'playground' | 'challenge';

/**
 * Challenge anchors are `ch-<part>-<slug>`. This is the fallback for callers
 * that render a card without saying which kind it is — the explicit `kind`
 * prop always wins. (No challenges exist yet in LLMVibes; the convention is
 * kept so the activity system can switch back on without a nav rewrite.)
 */
export function activityKindOf(id: string): ActivityKind {
	return /^ch-\d+-/.test(id) ? 'challenge' : 'playground';
}

export interface NavSection extends NavItem {
	children?: NavItem[];
}

/* The 14-part LLMVibes arc: raise Quill (a TinyStories-class storyteller) and
   Rook (a chess-move model) from raw data to aligned, reasoning models. Every
   id here must be an anchor in src/lib/data/sections.ts and be rendered by the
   matching Part component — keys.test.ts protects that pairing. Interactive
   playgrounds and challenges join these lists in later milestones. */

export const sidebarNav: NavSection[] = [
	{
		id: 'hero',
		label: 'Introduction',
		icon: Rocket,
		children: []
	},
	{
		id: 'part-1',
		label: 'Hatch',
		icon: Egg,
		children: [
			{ id: 'section-1-1', label: 'Meet Quill & Rook', icon: Bird },
			{ id: 'section-1-2', label: 'The Corpora', icon: Database },
			{ id: 'section-1-3', label: 'Cleaning & Dedup', icon: Filter }
		]
	},
	{
		id: 'part-2',
		label: 'Tokens',
		icon: Binary,
		children: [
			{ id: 'section-2-1', label: 'Why Tokens', icon: HelpCircle },
			{ id: 'section-2-2', label: 'Train a BPE Live', icon: Combine },
			{ id: 'section-2-3', label: "Rook's Designed Vocabulary", icon: LayoutGrid },
			{ id: 'section-2-4', label: 'The Token-Stream Inspector', icon: Search }
		]
	},
	{
		id: 'part-3',
		label: 'The Transformer',
		icon: Network,
		children: [
			{ id: 'section-3-1', label: 'Embeddings & the Residual Stream', icon: Layers },
			{ id: 'section-3-2', label: 'Attention, Two Ways', icon: Eye },
			{ id: 'section-3-3', label: 'RoPE & Context Windows', icon: RotateCw },
			{ id: 'section-3-4', label: 'SwiGLU, RMSNorm, the Block', icon: Box }
		]
	},
	{
		id: 'part-4',
		label: 'Learning',
		icon: TrendingDown,
		children: [
			{ id: 'section-4-1', label: 'Softmax, Cross-Entropy, Perplexity', icon: Sigma },
			{ id: 'section-4-2', label: 'Backpropagation', icon: Undo2 },
			{ id: 'section-4-3', label: 'AdamW & Schedules', icon: Settings },
			{ id: 'section-4-4', label: 'Train/Val, Overfitting, Memorization', icon: Scale },
			{ id: 'section-4-5', label: 'The Grokking Interlude', icon: Sparkles }
		]
	},
	{
		id: 'part-5',
		label: 'Pretraining',
		icon: Activity,
		children: [
			{ id: 'section-5-1', label: 'Twin Dashboards', icon: LayoutDashboard },
			{ id: 'section-5-2', label: 'Temperature & Sampling', icon: Thermometer },
			{ id: 'section-5-3', label: 'Your First Real Run', icon: Play },
			{ id: 'section-5-4', label: 'The Training Time Machine', icon: History },
			{ id: 'section-5-5', label: 'A Tiny Scaling Law', icon: TrendingUp },
			{ id: 'section-5-6', label: "How Do We Know It's Working?", icon: ClipboardCheck }
		]
	},
	{
		id: 'part-6',
		label: 'World Models',
		icon: Microscope,
		children: [
			{ id: 'section-6-1', label: 'Linear Probes', icon: Crosshair },
			{ id: 'section-6-2', label: 'Activation Patching', icon: Wrench },
			{ id: 'section-6-3', label: 'Board or Bag of Heuristics?', icon: Brain }
		]
	},
	{
		id: 'part-7',
		label: 'SFT + LoRA',
		icon: GraduationCap,
		children: [
			{ id: 'section-7-1', label: 'Instruction Data', icon: FileText },
			{ id: 'section-7-2', label: 'Chat Templates & Loss Masking', icon: MessageSquare },
			{ id: 'section-7-3', label: 'LoRA', icon: Feather },
			{ id: 'section-7-4', label: 'Conditioning vs Fine-Tuning', icon: SlidersHorizontal },
			{ id: 'section-7-5', label: 'Before & After', icon: ArrowLeftRight }
		]
	},
	{
		id: 'part-8',
		label: 'Synthetic Data',
		icon: FlaskConical,
		children: [
			{ id: 'section-8-1', label: 'TinyStories Was Synthetic All Along', icon: Lightbulb },
			{ id: 'section-8-2', label: 'Generation Pipelines', icon: Workflow },
			{ id: 'section-8-3', label: 'Verifier Filtering & Dedup', icon: Filter },
			{ id: 'section-8-4', label: 'Fine-Tune on Your Own Data', icon: PenLine }
		]
	},
	{
		id: 'part-9',
		label: 'Preferences',
		icon: ThumbsUp,
		children: [
			{ id: 'section-9-1', label: 'You Are the Annotator', icon: MousePointerClick },
			{ id: 'section-9-2', label: 'A Reward Model From Your Clicks', icon: Award },
			{ id: 'section-9-3', label: 'DPO', icon: GitCompare },
			{ id: 'section-9-4', label: 'RLHF vs RLAIF', icon: Users },
			{ id: 'section-9-5', label: 'The Blind Taste Test', icon: EyeOff },
			{ id: 'section-9-6', label: 'A Toy Refusal', icon: Ban }
		]
	},
	{
		id: 'part-10',
		label: 'Reward Hacking',
		icon: AlertTriangle,
		children: [
			{ id: 'section-10-1', label: 'Best-of-N Against Your RM', icon: ListOrdered },
			{ id: 'section-10-2', label: "Goodhart's Law, Live", icon: AlertOctagon },
			{ id: 'section-10-3', label: 'The KL Fix', icon: Anchor }
		]
	},
	{
		id: 'part-11',
		label: 'RLVR & GRPO',
		icon: Target,
		children: [
			{ id: 'section-11-1', label: 'From Labels to Rewards', icon: Link2 },
			{ id: 'section-11-2', label: 'Three Arenas', icon: Swords },
			{ id: 'section-11-3', label: 'GRPO Mechanics', icon: Boxes },
			{ id: 'section-11-4', label: 'Edit the Reward Function', icon: Pencil },
			{ id: 'section-11-5', label: 'The Full R1 Recipe', icon: Repeat }
		]
	},
	{
		id: 'part-12',
		label: 'Agents',
		icon: Bot,
		children: [
			{ id: 'section-12-1', label: 'Tools as Tokens', icon: Hammer },
			{ id: 'section-12-2', label: 'The Scratchpad', icon: StickyNote },
			{ id: 'section-12-3', label: 'The Story-World Database', icon: Database },
			{ id: 'section-12-4', label: 'Consistency Rewards', icon: ShieldCheck }
		]
	},
	{
		id: 'part-13',
		label: 'Frontier & Inference',
		icon: Zap,
		children: [
			{ id: 'section-13-1', label: 'Mixture of Experts', icon: Split },
			{ id: 'section-13-2', label: 'MTP, Muon, QK-Clip', icon: Wand2 },
			{ id: 'section-13-3', label: 'KV Cache & Sampling', icon: Archive },
			{ id: 'section-13-4', label: 'Quantization', icon: Shrink },
			{ id: 'section-13-5', label: 'Speculative Decoding', icon: FastForward },
			{ id: 'section-13-6', label: 'The SmolLM Cameo', icon: Star }
		]
	},
	{
		id: 'part-14',
		label: 'Epilogue',
		icon: Telescope,
		children: [
			{ id: 'section-14-1', label: 'The Scale Map', icon: Mountain },
			{ id: 'section-14-2', label: 'What Nobody Knows', icon: HelpCircle },
			{ id: 'section-14-3', label: 'Two Birds, Fully Grown', icon: Heart }
		]
	}
];

export interface NavEntry {
	label: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	icon: any;
}

const byId = new Map<string, NavEntry>();
for (const section of sidebarNav) {
	byId.set(section.id, { label: section.label, icon: section.icon });
	for (const child of section.children ?? []) {
		byId.set(child.id, { label: child.label, icon: child.icon });
	}
}

/**
 * Label + icon for any part or section anchor. Cross-references in the prose
 * resolve through this, so renaming a part in the sidebar renames it
 * everywhere it is mentioned — which is the whole reason references name a
 * part instead of numbering it. The predecessor curriculum was renumbered
 * once, and every hard-coded "Part 8" silently became wrong.
 */
export function courseEntry(id: string): NavEntry | null {
	return byId.get(id) ?? null;
}

const partOf = new Map<string, string>();
for (const section of sidebarNav) {
	partOf.set(section.id, section.id);
	for (const child of section.children ?? []) {
		partOf.set(child.id, section.id);
	}
}

/**
 * The `part-N` (or `hero`) section that owns an anchor. The standalone
 * /parts/<slug> pages use this to decide whether a cross-reference stays a
 * same-page hash or has to travel back to the full course page.
 */
export function partIdOf(id: string): string | null {
	return partOf.get(id) ?? null;
}
