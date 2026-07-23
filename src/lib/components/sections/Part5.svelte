<script lang="ts">
	import {
		Activity,
		LayoutDashboard,
		Thermometer,
		Play,
		History,
		TrendingUp,
		ClipboardCheck
	} from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import TrainingLab from '../lab/TrainingLab.svelte';
</script>

<section id="part-5" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={Activity}
			partLabel="Part 5"
			title="Pretraining"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			Everything so far was preparation; this is the payoff. Both birds train side by side on your
			GPU, and over a coffee break Quill's output climbs from gibberish to words to grammar while
			Rook's moves go from random to legal to dangerous. This is the chapter the whole course is
			built around.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-5-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={LayoutDashboard}
				title="5.1 Twin Dashboards"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Two dashboards, one lesson: loss falling beside sampled stories for Quill, loss falling
				beside a legal-move gauge for Rook. Watching the same curve produce two different kinds of
				competence is the twin-spine thesis made visible.
			</p>
		</div>

		<div id="section-5-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Thermometer}
				title="5.2 Temperature & Sampling"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The model outputs a probability distribution; something still has to pick the next token.
				Temperature is the dial between playing it safe and getting weird — taught here, at the
				moment the first sampled output appears on screen.
			</p>
		</div>

		<div id="section-5-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={Play}
				title="5.3 Your First Real Run"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Press start and pretrain the live pair for real — real tokens through real parameters, on
				your GPU, in this tab. Watch the loss fall from ln(V) — the uniform-guess ceiling — and
				sample as you go: Quill's output climbs from byte soup toward words, and Rook's moves from
				noise toward legal chess. Train longer and sample again; the difference is the lesson.
			</p>
			<TrainingLab
				bird="quill"
				title="Quill — pretraining live"
				steps={200}
				config={{ nLayer: 4, nEmbd: 128, nHead: 4, blockSize: 128 }}
			/>
			<TrainingLab
				bird="rook"
				title="Rook — pretraining live"
				steps={200}
				config={{ nLayer: 4, nEmbd: 128, nHead: 4, blockSize: 128 }}
			/>
			<Callout type="tip" title="What to look for">
				Both labs share one architecture — only the corpus differs. Quill's loss starts near ln(512)
				≈ 6.2, Rook's near ln(1931) ≈ 7.6, and both fall the same way: the transformer doesn't know
				which world it's learning. That's the thesis of this course, live on your screen.
			</Callout>
		</div>

		<div id="section-5-4" class="mb-14">
			<SectionHeader
				level="section"
				icon={History}
				title="5.4 The Training Time Machine"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The flagship models trained for days offline, and their history ships with the course: drag
				a slider through their checkpoints and watch ability assemble itself — including the sudden
				step where in-context copying clicks into place.
			</p>
		</div>

		<div id="section-5-5" class="mb-14">
			<SectionHeader
				level="section"
				icon={TrendingUp}
				title="5.5 A Tiny Scaling Law"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Train three hatchlings of three sizes on the same data and plot their losses: even at toy
				scale, the points fall on a line. The straight line on that log-log plot is the same one
				frontier labs bet billions on.
			</p>
		</div>

		<div id="section-5-6" class="mb-8">
			<SectionHeader
				level="section"
				icon={ClipboardCheck}
				title="5.6 How Do We Know It's Working?"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Loss went down — but is the model good? Evals as a first-class topic: Rook's clean Elo and a
				set of never-seen positions that separate memorized openings from a modeled board; Quill
				scored by a judge model; and why public benchmarks saturate and leak.
			</p>
		</div>
	</div>
</section>
