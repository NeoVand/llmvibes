<script lang="ts">
	import { Microscope, Crosshair, Wrench, Brain } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-6" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={Microscope}
			partLabel="Part 6"
			title="World Models"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			Rook has only ever seen move tokens — never a board. So does it secretly have one? This
			chapter opens the model up and looks: the course's interpretability interlude, and the reason
			a chess model earned a place beside a storyteller.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-6-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Crosshair}
				title="6.1 Linear Probes"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Train a tiny classifier on Rook's residual stream and it can read off the full board state —
				every square, at every move — from activations that were never told the rules. A linear
				probe is the simplest possible microscope, and what it finds here is remarkable.
			</p>
		</div>

		<div id="section-6-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Wrench}
				title="6.2 Activation Patching"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Reading is one thing; editing is proof. Reach into a forward pass, flip the model's belief
				about a single square, and watch its chosen move change to match the board it now believes
				in — causal evidence that the internal board is doing real work.
			</p>
		</div>

		<div id="section-6-3" class="mb-8">
			<SectionHeader
				level="section"
				icon={Brain}
				title="6.3 Board or Bag of Heuristics?"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Not everyone agrees the probe results mean "world model" — maybe it's a thousand shallow
				tricks that add up to one. The critique gets presented honestly, because how much models
				really understand is exactly the open question at the frontier.
			</p>
		</div>
	</div>
</section>
