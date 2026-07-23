<script lang="ts">
	import { TrendingDown, Sigma, Undo2, Settings, Scale, Sparkles } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-4" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={TrendingDown}
			partLabel="Part 4"
			title="Learning"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			A transformer with random weights is an elaborate way to produce noise. This chapter is about
			the loop that turns noise into skill: a loss that scores every prediction, gradients that
			assign blame, an optimizer that acts on it — and the strange things that happen when a model
			learns too well, or keeps learning long after it should have stopped.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-4-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Sigma}
				title="4.1 Softmax, Cross-Entropy, Perplexity"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Softmax turns raw scores into probabilities, cross-entropy measures how surprised the model
				was by the truth, and perplexity turns that surprise into a number you can read at a glance.
				This is the quantity the entire rest of the course is trying to push down.
			</p>
		</div>

		<div id="section-4-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Undo2}
				title="4.2 Backpropagation"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				One number — the loss — has to become an instruction for millions of weights, and
				backpropagation is the bookkeeping trick that makes it cheap: blame flowing backward through
				the same graph the prediction flowed forward through.
			</p>
		</div>

		<div id="section-4-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={Settings}
				title="4.3 AdamW & Schedules"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Raw gradients are too jumpy to follow directly. AdamW smooths them with running averages,
				warmup and cosine schedules shape the learning rate over a run, and gradient clipping
				catches the occasional spike before it wrecks the weights.
			</p>
		</div>

		<div id="section-4-4" class="mb-14">
			<SectionHeader
				level="section"
				icon={Scale}
				title="4.4 Train/Val, Overfitting, Memorization"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				A falling training loss can mean the model is learning — or just memorizing. Held-out
				validation data tells the two apart, and a hatchling that recites a story word-for-word
				shows why Part 1's deduplication was never optional.
			</p>
		</div>

		<div id="section-4-5" class="mb-8">
			<SectionHeader
				level="section"
				icon={Sparkles}
				title="4.5 The Grokking Interlude"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Sometimes a model memorizes its training set, plateaus for thousands of steps — and then,
				long after any reasonable person would have stopped training, suddenly generalizes. You'll
				scrub through a recorded run of this phenomenon and watch understanding arrive late.
			</p>
		</div>
	</div>
</section>
