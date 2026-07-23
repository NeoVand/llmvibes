<script lang="ts">
	import { FlaskConical, Lightbulb, Workflow, Filter, PenLine } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import MermaidDiagram from '../ui/MermaidDiagram.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Back in Part 1 you scrolled the corpus explorer through thousands of small, warm,
				oddly-samey children's stories. Here's what wasn't said: no human wrote them. TinyStories
				was generated in 2023 by researchers at Microsoft prompting GPT-3.5 and GPT-4, as an
				experiment in how small a model can get and still produce coherent English. Every story
				Quill ever ate came out of another language model. Quill is a model trained on a model's
				output — and so, to varying degrees, is nearly every small open model you can download
				today.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The obvious question is why the corpus isn't just the same story five hundred thousand
				times. Ask a big model for "a children's story" half a million times and you will get
				endless minor variations on maybe a few dozen plots — sampling temperature wiggles the
				words, not the ideas. The TinyStories authors engineered their way around this, and the
				engineering is the actual lesson of this chapter. Two constraints, baked into every
				generation prompt:
			</p>

			<CodeBlock
				title="The shape of a TinyStories generation prompt (reconstructed)"
				lang="text"
				code={`Write a short story (3–5 paragraphs) using only very simple words
that a 3-year-old child would likely understand.

The story should use the verb "hop", the noun "lantern" and the
adjective "brave", and it should contain a dialogue and have a
moral value.

Remember: only simple words!`}
			/>

			<ul
				class="mb-4 list-inside list-disc space-y-1.5 text-[14px]"
				style="color: var(--color-text-secondary);"
			>
				<li>
					<strong style="color: var(--color-text);">A constrained vocabulary.</strong> Stories draw from
					roughly the words a young child knows. That's what makes a 5M-parameter model viable at all
					— Quill never had to learn "photosynthesis", so its capacity goes to grammar and narrative instead.
				</li>
				<li>
					<strong style="color: var(--color-text);">Randomized required features.</strong> Each
					prompt draws a random verb, noun, and adjective from word lists, plus a random subset of
					story features — dialogue, plot twist, bad ending, moral. Multiply the combinations and
					the <em>prompt space</em> is vastly larger than the dataset: diversity is forced structurally,
					before the model generates a single word.
				</li>
			</ul>

			<Callout type="tip" title="The actual lesson">
				Diversity in synthetic data comes from the <em>prompt distribution</em>, not from sampling
				temperature. Temperature adds noise within a mode; randomized constraints force the
				generator into different modes. Every serious synthetic pipeline since — instruction
				datasets, persona-driven corpora, code data — is a variation on this move: engineer a wide
				distribution of prompts, then let the model fill it in.
			</Callout>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				And notice what the randomized word lists bought beyond diversity: they became the
				instruction data. TinyStories-Instruct — the corpus from Part 7 — is just the generation
				recipe kept <em>with</em> the story instead of thrown away. The metadata you engineered for diversity
				is a free instruction-tuning corpus. Keep your pipeline's provenance; it's worth more than the
				samples.
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				TinyStories used fixed word lists because stories are one task. To synthesize data for
				<em>many</em> tasks — the "write me an email / explain this error / summarize this" spread
				an assistant needs — the field's workhorse is
				<strong style="color: var(--color-text);">self-instruct</strong>: use the model to expand a
				small human-written seed set into a large task distribution, filtering as you go.
			</p>

			<MermaidDiagram
				definition={`graph TD
  A(["Seed tasks — a few hundred, human-written"]) --> B(["Generator LLM writes new instructions,<br/>prompted with random seeds as examples"])
  B --> C(["Filter: drop near-duplicates of the pool,<br/>malformed or unanswerable tasks"])
  C --> D(["Generator LLM writes a response<br/>for each surviving instruction"])
  D --> E(["Verifier / quality filter"])
  E --> F(["Fine-tune the student model"])
  C -->|survivors join the seed pool| A`}
				id="self-instruct-pipeline"
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The loop matters more than any single pass: new instructions join the pool, so the next
				round's random examples are drawn from a wider distribution than the seeds. A few hundred
				hand-written tasks bootstrap into tens of thousands. The 2023 Alpaca recipe — which put
				fine-tuned open models on the map — was exactly this: seed tasks, a frontier model
				generating 52,000 instruction pairs, a small model trained on the output for a few hundred
				dollars.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The failure modes are as instructive as the successes. Left unfiltered, generators collapse
				toward their favorite phrasings; they invent tasks that reference attachments that don't
				exist; they answer their own questions wrong with total confidence. Modern variants attack
				the diversity problem with heavier machinery — sampling a random
				<em>persona</em> ("a lighthouse keeper", "a tax auditor") per generation is the same trick
				as TinyStories' random word triple, at industrial scale — but every pipeline is still the
				same skeleton:
				<strong style="color: var(--color-text);"
					>widen the prompt distribution, generate cheap, filter hard.</strong
				>
			</p>

			<Callout type="note" title="Scoped honestly: what runs live here">
				When this chapter's lab lands, the on-site tutor model generates around ten samples live —
				enough to watch a pipeline think, repeat itself, and get caught by a filter. Ten samples
				will not budge a 5M-parameter model, and this course won't pretend otherwise. The dataset
				you'll actually fine-tune on in 8.4 comes from a large shipped pool, pre-generated by the
				same pipeline; your job is the part that matters — the filtering.
			</Callout>

			<VibeBox
				prompts={[
					'Generate three story instructions with random word triples, then critique their diversity',
					'Show me a self-instruct round where the generator plagiarizes its own seed task'
				]}
			/>
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The deep asymmetry this whole chapter rests on:
				<strong style="color: var(--color-text);">checking is easier than creating.</strong>
				Writing a story that includes "lantern" is generation; checking whether "lantern" appears is one
				<Code code="includes(&quot;lantern&quot;)" /> call. Whenever a sample has
				<strong style="color: var(--color-text);">checkable properties</strong>, you can pass a
				generator's sloppy output through a strict verifier and keep only what survives — a weak
				generator plus a strong verifier yields strong data. The course's verifier stack makes this
				concrete for both birds:
			</p>

			<CodeBlock
				title="The verifier stack, per bird"
				lang="text"
				code={`Quill's stories                      Rook's games
--------------------------------     --------------------------------
required words present?              every move legal? (chess.js)
sentence count in range?             game ends in the claimed result?
vocabulary within the word list?     no move repeats a known blunder
requested feature present?             pattern? (shallow engine check)
not truncated mid-sentence?

Each check is cheap, mechanical, and unarguable. A sample passes
all of them or it never reaches training.`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Hold onto that asymmetry — it comes back twice. In Part 9, judgments replace verifiers where
				properties <em>aren't</em> checkable ("is this story better?"). In Part 11, RLVR turns verifiers
				directly into reward signal. The verifier stack you meet here as a data filter is the same module
				that will later grade reinforcement learning.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Filtering handles bad samples. Two quieter problems handle <em>good</em> ones:
			</p>

			<ul
				class="mb-4 list-inside list-disc space-y-1.5 text-[14px]"
				style="color: var(--color-text-secondary);"
			>
				<li>
					<strong style="color: var(--color-text);">Deduplication.</strong> Generators love near-copies
					— same plot, three words swapped. Near-duplicates waste training compute, and worse, they teach
					memorization: you watched a duplicated story get recited verbatim in Part 4's overfitting demo,
					which is why Part 1 made dedup a first-class idea. Exact matching misses near-copies, so real
					pipelines compare n-gram overlap or hash sketches of documents to catch "same story, different
					names".
				</li>
				<li>
					<strong style="color: var(--color-text);">Decontamination.</strong> Dedup's
					security-critical sibling: make sure no <em>eval</em> prompt appears in the training set. A
					generator that has seen your benchmark will happily emit its test cases back into your training
					data, and your benchmark score becomes a memory test. Part 5 called this benchmark contamination
					from the consumer side; here you're the producer, and it's your job to grep your own data for
					your own evals.
				</li>
			</ul>

			<Callout type="warning" title="Near-duplicates inflate benchmarks silently">
				A contaminated model doesn't look broken — it looks great. Loss goes down, benchmarks go up,
				and nothing on any dashboard tells you the improvement is recitation. That's what makes
				dedup and decontamination unglamorous <em>and</em> non-negotiable: the failure mode of skipping
				them is indistinguishable from success until someone tests out-of-distribution.
			</Callout>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Step back and name the overall shape:
				<strong style="color: var(--color-text);">distillation</strong>. A big model's outputs,
				curated by verifiers, become a small model's curriculum. The teacher paid the cost of
				learning from the messy human internet; the student learns from the teacher's cleaned-up
				summary of it. This is how most small open models are made — and TinyStories makes the chain
				visible at toy scale: human text taught GPT-4, GPT-4 wrote a curriculum, the curriculum
				raised Quill. The student's ceiling is the teacher's data distribution, but a careful
				curriculum can make a tiny student punch far above its weight <em>within</em>
				that distribution. Quill's coherent grammar at 5M parameters is the proof you've already trained.
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				When this chapter's lab arrives (it lands with a later milestone, alongside the tutor-model
				download), the whole chapter compresses into one live pipeline you drive end to end:
			</p>

			<CodeBlock
				title="The 8.4 pipeline, end to end"
				lang="text"
				code={`1. GENERATE   watch the tutor model produce ~10 samples live,
              from randomized instruction templates
2. FILTER     run the shipped pool (thousands of samples) through
              the verifier stack — with thresholds YOU set
3. INSPECT    read what survived; evict anything that offends you
4. FINE-TUNE  LoRA Quill on the survivors (Part 7 machinery)
5. COMPARE    before/after on the fixed prompt set (the ritual)`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Step 2 is where you stop being a spectator. Every threshold is a knob with a visible trade:
				demand all required words present and the pool shrinks by half; tolerate one missing word
				and it doubles, dirtier.
				<strong style="color: var(--color-text);"
					>Strictness buys quality and pays in quantity</strong
				> — the fundamental exchange rate of data work, and you'll feel it directly because the dataset
				that comes out the other side has your fingerprints on it. Two learners with different thresholds
				produce two measurably different Quills.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				That's the point of the exercise. "Data quality matters" is a poster slogan; watching your
				own lenient threshold produce a Quill that occasionally drops its required words — while
				your strict run nails them with a smaller, cleaner diet — is an experience. At frontier
				scale, the people doing this job are called data engineers, and entire model generations are
				won or lost on step 2.
			</p>

			<Callout type="tip" title="Curation is a model behavior lever">
				Notice what you never touched in this chapter: the architecture, the optimizer, the loss.
				Every behavioral difference between your Quill and your neighbor's traces back to what each
				of you let through the filter. When a model misbehaves, the reflex "what's wrong with the
				weights?" is usually the wrong question — start with "what was it fed?"
			</Callout>

			<VibeBox
				prompts={[
					'Set my verifier thresholds for maximum strictness and predict the pool survival rate',
					'Find the sneakiest near-duplicate pair that survived my filter settings',
					'What would my filtered dataset teach Quill that the raw pool would not?'
				]}
			/>
		</div>
	</div>
</section>
