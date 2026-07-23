<script lang="ts">
	import { AlertTriangle, ListOrdered, AlertOctagon, Anchor } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-10" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={AlertTriangle}
			partLabel="Part 10"
			title="Reward Hacking"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			You just built a reward model. Now watch both birds break it. This chapter is the course's
			double climax: optimization finding every crack in a proxy objective, live, on rewards you
			built yourself — and the fix that modern alignment leans on.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-10-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={ListOrdered}
				title="10.1 Best-of-N Against Your RM"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				No reinforcement learning needed to hack a reward — just sample many stories and keep the
				one your reward model scores highest. Crank N and watch the winners drift from charming to
				"dragon dragon dragon": your own taste, Goodharted.
			</p>
		</div>

		<div id="section-10-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={AlertOctagon}
				title="10.2 Goodhart's Law, Live"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Give Rook a reward for winning material and it learns something you didn't ask for: it will
				happily hang its king to grab a queen. When a measure becomes a target, it stops being a
				good measure — here that's not a proverb, it's a replay you can watch.
			</p>
		</div>

		<div id="section-10-3" class="mb-8">
			<SectionHeader
				level="section"
				icon={Anchor}
				title="10.3 The KL Fix"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The standard remedy: penalize the model for drifting too far from a frozen reference copy of
				itself. Add the KL term, re-run both failure cases, and watch the same optimization pressure
				produce sane behavior — the anchor every RLHF pipeline quietly depends on.
			</p>
		</div>
	</div>
</section>
