<script lang="ts">
	import { Binary, HelpCircle, Combine, LayoutGrid, Search } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-2" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader icon={Binary} partLabel="Part 2" title="Tokens" color="var(--color-primary)" />

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			A language model never sees letters, words, or chessboards — it sees a stream of integers.
			This chapter is about the machinery that turns the world into that stream: one vocabulary
			learned from data, one designed by hand, and the inspector you'll use to look at token streams
			for the rest of the course.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-2-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={HelpCircle}
				title="2.1 Why Tokens"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Characters make sequences too long, whole words can't cover everything a human might type —
				tokens are the compromise every modern model lives with. Here's why the choice matters more
				than it looks, and why your emoji is about to become four strange tokens.
			</p>
		</div>

		<div id="section-2-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Combine}
				title="2.2 Train a BPE Live"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Byte-pair encoding is simple enough to watch happen: start from raw bytes, repeatedly merge
				the most frequent pair, and a vocabulary grows in front of you — "th", then "the", then
				whole words. You'll train Quill's tokenizer yourself, live, on real story text.
			</p>
		</div>

		<div id="section-2-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={LayoutGrid}
				title="2.3 Rook's Designed Vocabulary"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Rook's vocabulary was never learned — it was designed: one token per chess move, 1,968
				geometric moves plus a handful of special tokens, including the Elo tags that will matter in
				Part 7. Learned versus designed vocabularies — and why not characters, why not FEN.
			</p>
		</div>

		<div id="section-2-4" class="mb-8">
			<SectionHeader
				level="section"
				icon={Search}
				title="2.4 The Token-Stream Inspector"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The course's universal instrument makes its debut: paste anything, see exactly what the
				model sees, token by token — including a per-token surprise heatmap. It will come back to
				teach perplexity, pretraining progress, and loss masking in later chapters.
			</p>
		</div>
	</div>
</section>
