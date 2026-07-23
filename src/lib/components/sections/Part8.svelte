<script lang="ts">
	import { FlaskConical, Lightbulb, Workflow, Filter, PenLine } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-8" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={FlaskConical}
			partLabel="Part 8"
			title="Synthetic Data"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			Time for a confession about the data Quill was raised on — and a chapter on the technique
			quietly powering most modern training sets: models generating data for other models, with
			verifiers standing between generation and training.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-8-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Lightbulb}
				title="8.1 TinyStories Was Synthetic All Along"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The corpus Quill grew up on was never written by humans — GPT wrote every one of those tiny
				tales, from templates and word lists, in 2023. Your bird is already a second-generation
				model, and that turns out to be the norm now, not the exception.
			</p>
		</div>

		<div id="section-8-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Workflow}
				title="8.2 Generation Pipelines"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Good synthetic data is engineered, not wished for: seed words to force diversity, templates
				to control format, self-instruct loops to bootstrap variety. The course's tutor model
				generates samples live so you can watch a pipeline produce — and occasionally embarrass —
				itself.
			</p>
		</div>

		<div id="section-8-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={Filter}
				title="8.3 Verifier Filtering & Dedup"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Generation is cheap; the value is in what you throw away. Verifiers score and reject, dedup
				catches the near-copies a generator loves to emit, and decontamination keeps the eval set
				out of the training set — the unglamorous steps that decide data quality.
			</p>
		</div>

		<div id="section-8-4" class="mb-8">
			<SectionHeader
				level="section"
				icon={PenLine}
				title="8.4 Fine-Tune on Your Own Data"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The act's capstone: filter a large pre-generated pool with the verifier stack, keep what
				survives your standards, and fine-tune Quill on the dataset you just curated. The bird
				learns what you chose to feed it — data work, made personal.
			</p>
		</div>
	</div>
</section>
