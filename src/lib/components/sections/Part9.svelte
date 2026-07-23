<script lang="ts">
	import {
		ThumbsUp,
		MousePointerClick,
		Award,
		GitCompare,
		Users,
		EyeOff,
		Ban
	} from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-9" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={ThumbsUp}
			partLabel="Part 9"
			title="Preferences"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			"Better" isn't in the training data — someone has to click it. In this chapter that someone is
			you: your judgments become a reward model, the reward model becomes training signal, and at
			the end a blind test reveals whether the alignment stack actually made a model you prefer.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-9-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={MousePointerClick}
				title="9.1 You Are the Annotator"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Two stories, one prompt, one click: which is better? The job data-labeling contractors do
				for frontier labs, you'll do for Quill — and about a hundred honest clicks is all the next
				section needs.
			</p>
		</div>

		<div id="section-9-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Award}
				title="9.2 A Reward Model From Your Clicks"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Your votes — blended with a few thousand shipped ones — train a model that predicts which
				story you'd prefer. A learned, differentiable stand-in for your taste: the load-bearing idea
				of RLHF, and the thing Part 10 will gleefully break.
			</p>
		</div>

		<div id="section-9-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={GitCompare}
				title="9.3 DPO"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Direct preference optimization skips the RL loop entirely: a loss applied straight to the
				preference pairs nudges the chosen response up and the rejected one down. Both birds get the
				treatment, and the math turns out to be one clean equation.
			</p>
		</div>

		<div id="section-9-4" class="mb-14">
			<SectionHeader
				level="section"
				icon={Users}
				title="9.4 RLHF vs RLAIF"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Quill's annotator is a human — you. Rook's is Stockfish, an engine that never sleeps and
				never gets bored. Human feedback versus AI feedback, taught by the twin contrast rather than
				by acronym definitions.
			</p>
		</div>

		<div id="section-9-5" class="mb-14">
			<SectionHeader
				level="section"
				icon={EyeOff}
				title="9.5 The Blind Taste Test"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Did any of it work? Aligned Quill and SFT Quill answer the same prompts with the labels
				hidden, and you pick winners without knowing which is which. The score at the end is the
				chapter's verdict on itself.
			</p>
		</div>

		<div id="section-9-6" class="mb-8">
			<SectionHeader
				level="section"
				icon={Ban}
				title="9.6 A Toy Refusal"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The same DPO machinery, pointed at safety: teach Quill to gently decline requests for scary
				stories. A toy refusal, honestly labeled as such — and a working glimpse of why preference
				training was invented in the first place.
			</p>
		</div>
	</div>
</section>
