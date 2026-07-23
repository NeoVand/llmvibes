<script lang="ts">
	import { Target, Link2, Swords, Boxes, Pencil, Repeat } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-11" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={Target}
			partLabel="Part 11"
			title="RLVR & GRPO"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			What if the reward can't be hacked because it's simply true? Checkmate is checkmate; a rhyme
			either lands or it doesn't. Reinforcement learning on verifiable rewards is the recipe behind
			the current generation of reasoning models, and this chapter runs it — GRPO and all — on your
			own hardware.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-11-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Link2}
				title="11.1 From Labels to Rewards"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The bridge from everything you've done to policy gradients is one sentence: sample from the
				model, then upweight every token of the samples that scored well. It's Part 4's training
				loop with the model writing its own data — no mystique required.
			</p>
		</div>

		<div id="section-11-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Swords}
				title="11.2 Three Arenas"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Three verifiable playgrounds: Rook rewarded for legality and wins (the sure thing), Quill
				rewarded for satisfying story constraints like must-include words, and a little Countdown
				arithmetic solver — the honest gamble, scoped as such.
			</p>
		</div>

		<div id="section-11-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={Boxes}
				title="11.3 GRPO Mechanics"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				GRPO's trick is comparing a group of attempts at the same prompt against each other — no
				value network, just relative advantage within the group, plus the KL leash from Part 10.
				Watch group scores, advantages, and reward curves move as training runs.
			</p>
		</div>

		<div id="section-11-4" class="mb-14">
			<SectionHeader
				level="section"
				icon={Pencil}
				title="11.4 Edit the Reward Function"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The reward function is a text box, and it's yours: reweight terms, add bonuses, invent a new
				objective, and rerun to see what your incentive actually teaches. The fastest way to respect
				reward design is to write a bad one and watch it get obeyed.
			</p>
		</div>

		<div id="section-11-5" class="mb-8">
			<SectionHeader
				level="section"
				icon={Repeat}
				title="11.5 The Full R1 Recipe"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Zoom out and the pieces you've built snap into the published recipe for reasoning models:
				cold-start SFT, RL on verifiable rewards, rejection sampling, RL again. Plus a conceptual
				look at how DAPO and GSPO patch GRPO's cracks at real scale.
			</p>
		</div>
	</div>
</section>
