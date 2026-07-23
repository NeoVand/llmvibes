<script lang="ts">
	import { Telescope, Mountain, HelpCircle, Heart } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-14" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={Telescope}
			partLabel="Part 14"
			title="Epilogue"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			You raised two birds from random weights to aligned, tool-using models. The epilogue asks the
			only question left: how much of what you did is what the frontier labs do — and how much
			changes on the way up?
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-14-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Mountain}
				title="14.1 The Scale Map"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				A guided walk from Quill and Rook to trillion-parameter systems: the surprising list of
				things that are literally identical — the loss, the block, the recipes — and the honest list
				of things that only exist at scale, from emergent abilities to entire data centers.
			</p>
		</div>

		<div id="section-14-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={HelpCircle}
				title="14.2 What Nobody Knows"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Why does grokking happen? What do models really represent? Why does the scaling line stay
				straight? The open problems of the field, stated plainly — along with a sober note on
				safety, and on what toy models can and cannot teach about it.
			</p>
		</div>

		<div id="section-14-3" class="mb-8">
			<SectionHeader
				level="section"
				icon={Heart}
				title="14.3 Two Birds, Fully Grown"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				A last look at the stat sheets: every stage badge earned, every eval score, every token seen
				since the moment you scrubbed both birds back to nothing. They're yours now — and so is the
				understanding of how they came to be.
			</p>
		</div>
	</div>
</section>
