<script lang="ts">
	import { Telescope, Mountain, HelpCircle, Heart } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
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

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Lay the two pipelines side by side and the punchline isn't the size gap — it's the shape
				match. Same stages, in the same order, for the same reasons. Different exponents.
			</p>

			<div class="my-4 overflow-x-auto rounded-lg" style="background: var(--color-bg-secondary);">
				<table class="w-full text-[13px]">
					<thead>
						<tr style="background: var(--color-bg-tertiary);">
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Dimension</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Your birds</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>A frontier lab</th
							>
						</tr>
					</thead>
					<tbody style="color: var(--color-text-secondary);">
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Parameters</td>
							<td class="px-4 py-2">2–5M live pair; 15–25M flagships</td>
							<td class="px-4 py-2">Hundreds of billions; trillions with MoE</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Training tokens</td>
							<td class="px-4 py-2">Millions — a coffee break</td>
							<td class="px-4 py-2">Tens of trillions</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Vocabulary</td>
							<td class="px-4 py-2">~2k UCI moves; small byte-BPE</td>
							<td class="px-4 py-2">100k+ byte-BPE — same algorithm</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Context window</td>
							<td class="px-4 py-2">A few hundred tokens</td>
							<td class="px-4 py-2">Hundreds of thousands and up</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Hardware</td>
							<td class="px-4 py-2">One browser tab, one GPU</td>
							<td class="px-4 py-2">Tens of thousands of accelerators</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Pretraining wall-clock</td>
							<td class="px-4 py-2">~3 minutes</td>
							<td class="px-4 py-2">Months</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Data pipeline</td>
							<td class="px-4 py-2">Curated slices of TinyStories + Lichess</td>
							<td class="px-4 py-2">Web-scale crawls, petabyte dedup, curation teams</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Post-training labels</td>
							<td class="px-4 py-2">Your ~100 clicks + a shipped set</td>
							<td class="px-4 py-2">Thousands of annotator-hours, plus RLVR farms</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Evals</td>
							<td class="px-4 py-2">Legal-move gauge, judge scores, OOD positions</td>
							<td class="px-4 py-2">Sprawling benchmark suites, human evals, red teams</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Cost</td>
							<td class="px-4 py-2">Free</td>
							<td class="px-4 py-2">Nine figures and climbing</td>
						</tr>
					</tbody>
				</table>
			</div>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Now the list that should genuinely surprise you — what is <em>literally identical</em>, not
				analogous:
			</p>

			<ul
				class="mb-4 list-inside list-disc space-y-1.5 text-[14px]"
				style="color: var(--color-text-secondary);"
			>
				<li>The loss. Cross-entropy on next-token prediction, unchanged since Part 4.</li>
				<li>The block. Attention, RoPE, pre-norm, gated MLP — Part 3's anatomy, stacked higher.</li>
				<li>The tokenizer algorithm — Part 2's byte-BPE, with a bigger merge table.</li>
				<li>The train/val discipline, and the eval anxiety that comes with it (Parts 4–5).</li>
				<li>The post-training arc: SFT, then preferences, then verifiable rewards (Parts 7–11).</li>
				<li>
					The serving stack: temperature, top-p, KV cache, quantization, speculation (Part 13).
				</li>
			</ul>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				You did not run a simplified sketch of the pipeline. You ran the pipeline, small. What you
				never touched exists only at scale: capability jumps that arrive unannounced somewhere past
				a few billion parameters, in-context learning broad enough to feel general, and an entire
				engineering discipline — splitting one training step across thousands of chips (data,
				tensor, pipeline, and expert parallelism) — that a single browser tab never needs. Plus the
				parts that aren't math at all: data acquisition, safety review, eval institutes, teams.
			</p>

			<Callout type="note" title="The exponents are the moat">
				Nothing conceptual separates your birds from the frontier — that's the course's thesis, and
				by now it's your lived experience. What separates them is tokens, chips, and time. That
				should feel both comforting and sobering: comforting because you actually understand these
				systems now; sobering because understanding was never the bottleneck.
			</Callout>
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

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Why does grokking happen?
			</h4>
			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				You watched it in Part 4: a hatchling memorizes its training set, sits at chance on
				validation for thousands of steps, then abruptly generalizes. There are stories — weight
				decay slowly favoring simpler circuits over lookup tables, competing sub-networks trading
				places — but no theory that predicts <em>when</em> a given run will grok, or whether it will at
				all. A phenomenon you can replay on demand in a browser remains genuinely unexplained.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				What do probes actually show?
			</h4>
			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Part 6's linear probes read a board off Rook's residual stream, and patching flipped its
				move by editing its belief about one square. Convincing — and still contested. Does the
				model <em>use</em> a world model, or a bag of heuristics that happens to be linearly decodable?
				Where is the line between representing and correlating? Interpretability has sharp tools and no
				agreed success criterion, at 25M parameters or at a trillion.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Does alignment hold under pressure?
			</h4>
			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Parts 9 through 11 gave you the honest arc: learned rewards get hacked, KL is a leash and
				not a proof, and verifiable rewards close the gap only where a verifier exists. Most of what
				we actually want from models — honesty, judgment, care — has no checker. Whether oversight
				can scale to systems more capable than their overseers is arguably the field's most
				consequential open problem, and your reward-hacking scars are a miniature of why.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Are emergent abilities real?
			</h4>
			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Capabilities seem to appear suddenly at scale — arithmetic, translation, multi-step
				reasoning. But a sharp counter-argument says some of those jumps are artifacts of the
				measuring stick: underlying skill improves smoothly, while an all-or-nothing metric
				(exact-match answers, say) shows nothing until it shows everything. The debate is live,
				unresolved, and has real stakes: it decides whether the next order of magnitude holds
				surprises by default.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Why are the scaling laws straight?
			</h4>
			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Your Part 5 mini-lab plotted three hatchling sizes and saw the hint of a line. The full
				version — loss against compute, straight on log axes across many orders of magnitude — is
				the empirical bedrock the industry plans nine-figure training runs on. Nobody has a
				first-principles derivation of why it holds, how long it continues, or what it is really
				measuring. The field's most load-bearing fact is a mystery with error bars.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				None of these are homework the field forgot to finish. They are the frontier — and the point
				of listing them here is that you now know enough to read the papers arguing about every
				single one.
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

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Quill hatched as noise and babbled its way to grammar while you watched the loss fall. It
				learned to follow instructions, then learned your taste from a hundred clicks, then hacked
				that taste until the KL leash reined it in, then submitted to rewards that were simply true
				— five sentences, one lantern. Somewhere along the way it stopped being a curve on a chart
				and started being a storyteller with habits you recognize, because you put them there.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Rook went from random mover to legal player to something stranger: a model that holds a
				board in its activations, whose belief about one square you once flipped with your own
				cursor. It hung its king for a queen when you paid it to, and learned better when the reward
				was checkmate itself. Its Elo is on the stat sheet. Its opening habits are yours to blame.
			</p>

			<Callout type="warning" title="What tiny birds cannot teach">
				A sober note to carry out the door. Tiny models teach <em>mechanism</em>: you watched
				Goodhart's law fire, watched a KL term contain it, watched a verifier make reward honest.
				They do not teach <em>alignment at scale</em>. A 25M-parameter storyteller cannot deceive
				you in ways that matter, pursue goals across contexts, or surprise its overseers — and the
				failure modes that might do those things may simply not miniaturize. Take the mechanisms
				with you. Do not take the comfort.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The weights are yours — sitting in your browser's storage, scrubbable back to the moment
				they were noise. So is the recipe: every stage a frontier lab runs, you have run, small.
				When the next paper drops — a new optimizer, a routing trick, a post-training loop — it will
				land somewhere on a map you have personally walked. The field is young, its biggest
				questions are open, and the distance from your two birds to the frontier is exponents, not
				magic.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Go raise something.
			</p>

			<VibeBox
				prompts={[
					'Quiz me across all fourteen parts — hard mode, no mercy',
					'Which of the open problems in 14.2 could a hobbyist with models like Quill actually poke at?'
				]}
			/>
		</div>
	</div>
</section>
