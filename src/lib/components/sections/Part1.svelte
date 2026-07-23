<script lang="ts">
	import { Egg, Bird, Database, Filter } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-1" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader icon={Egg} partLabel="Part 1" title="Hatch" color="var(--color-primary)" />

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			The course opens with the two models already alive: prompt Quill for a story, play a game
			against Rook — then scrub them both back to random weights and watch every trace of skill
			drain away. Everything that follows is about putting it back, and it starts where every model
			starts: with the data.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-1-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Bird}
				title="1.1 Meet Quill & Rook"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Two birds, one architecture: Quill writes children's stories, Rook plays chess, and both are
				nothing but next-token predictors over different streams. You'll meet the live pair you'll
				train yourself, their larger flagship siblings, and the scrubber that rewinds either one to
				the moment before it knew anything.
			</p>
		</div>

		<div id="section-1-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Database}
				title="1.2 The Corpora"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				What do the birds eat? Millions of tiny tales from TinyStories for Quill, millions of
				recorded games from Lichess for Rook. An explorer over real slices of both corpora shows
				what "training data" actually looks like before any model touches it.
			</p>
		</div>

		<div id="section-1-3" class="mb-8">
			<SectionHeader
				level="section"
				icon={Filter}
				title="1.3 Cleaning & Dedup"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Raw corpora arrive full of junk, and duplicates quietly teach a model to recite instead of
				generalize. Cleaning and deduplication get treated as first-class ideas here — and the favor
				gets repaid in Part 4, when you watch a model memorize a story it saw too many times.
			</p>
		</div>
	</div>
</section>
