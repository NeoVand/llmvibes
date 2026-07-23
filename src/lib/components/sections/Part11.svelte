<script lang="ts">
	import { Target, Link2, Swords, Boxes, Pencil, Repeat } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import MermaidDiagram from '../ui/MermaidDiagram.svelte';
	import PseudoCode from '../ui/PseudoCode.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import Math from '../ui/Math.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
	import GroupRewardLab from '../lab/GroupRewardLab.svelte';
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
			What if the reward can't be hacked because it's simply true? Checkmate is checkmate; a
			five-sentence story has five sentences or it doesn't. Reinforcement learning on verifiable
			rewards — RLVR — is the recipe behind the current generation of reasoning models, and this
			chapter runs it, GRPO and all, on your own hardware.
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

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Rewind to Part 4. Cross-entropy looks at the correct next token and pushes its probability
				up. In Part 7 you ran SFT: exactly the same loss, applied to curated instruction data.
				Either way, somebody else supplies the tokens worth upweighting — the corpus, or an
				annotator.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Now delete the labels. Let the model write: sample a handful of completions for a prompt,
				score each one with some reward, and treat the well-scored samples as if they were training
				data. The whole conceptual move fits in two lines:
			</p>

			<CodeBlock
				title="The entire bridge, two losses"
				lang="text"
				code={`SFT         loss = -log p(token)          every token of someone else's good sample
REINFORCE   loss = -r * log p(token)      every token of the model's OWN sample`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Read the second line slowly. If a sample earns <Code code="r = 1" />, that line is literally
				the SFT loss applied to the model's own output — upweight every token of it. If it earns
				<Code code="r = 0" />, the sample contributes nothing. Scores in between scale the push.
				This idea has a name — REINFORCE, published in 1992 — and it is the entire conceptual core
				of "policy gradient methods." You understood it before you knew the acronym.
			</p>

			<Callout type="note" title="That's really all of it">
				Every modern RL-for-LLMs pipeline is this weighted loss plus two patches: something to
				reduce the variance of <Code code="r" /> (so the updates aren't wild), and something to stop the
				model drifting too far from where it started (Part 10's KL leash). GRPO, in section 11.3, is exactly
				those two patches and nothing more.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The remaining question is where <Code code="r" /> comes from. Part 9's answer was a reward model
				trained on your clicks — a learned proxy — and Part 10 showed you exactly what optimization pressure
				does to learned proxies. This chapter's answer is different: compute the reward with a program.
				<Code code="chess.js" /> declares a move legal or it doesn't. A string search finds the required
				word or it doesn't. Stockfish confirms the checkmate or it doesn't. Rewards you
				<em>verify</em>
				rather than <em>predict</em>: that's the VR in RLVR.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				One honest caveat before the arenas. Verifiable does not mean your <em>intent</em> is safe. A
				verifier rewards exactly what it checks and nothing else — "include the word lantern" is perfectly
				satisfied by a graceless, bolted-on lantern. What disappears is the reward model's exploitable
				noise; what remains is the gap between what you meant and what you wrote down. Section 11.4 hands
				you the pen so you can feel that gap yourself.
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

			<div class="my-4 overflow-x-auto rounded-lg" style="background: var(--color-bg-secondary);">
				<table class="w-full text-[13px]">
					<thead>
						<tr style="background: var(--color-bg-tertiary);">
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Arena</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Model</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Verifier</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Honest expectation</th
							>
						</tr>
					</thead>
					<tbody style="color: var(--color-text-secondary);">
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Chess</td>
							<td class="px-4 py-2">Rook</td>
							<td class="px-4 py-2">chess.js rules + shallow Stockfish</td>
							<td class="px-4 py-2">The clean anchor — reward climbs, visibly</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Story constraints</td>
							<td class="px-4 py-2">Quill</td>
							<td class="px-4 py-2">Word search + sentence counter</td>
							<td class="px-4 py-2">Works for simple constraints; the Tülu 3 pattern</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Countdown</td>
							<td class="px-4 py-2">A hatchling</td>
							<td class="px-4 py-2">Arithmetic checker</td>
							<td class="px-4 py-2">Reward curves climb — epiphanies not promised</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Arena 1: Rook — the clean anchor
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Rook's rewards come in two stages. Legality first: the fraction of sampled moves that
				<Code code="chess.js" /> accepts. After pretraining that gauge already sits high (you watched
				it climb in Part 5), so the real training signal is outcomes: play full games against a deliberately
				weak opponent — Stockfish throttled to shallow search — and score
				<Code code="win = 1, draw = 0.5, loss = 0" />. Checkmate is checkmate. No judge, no partial
				credit, no argument about whether the reward is right.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				That certainty is why chess anchors the chapter. When the other arenas confuse you — a flat
				curve, a weird constraint interaction — come back here. If GRPO is implemented correctly,
				Rook's win rate rises. It's the arena where the only moving part is the algorithm.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Arena 2: Quill under constraints
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Quill's prompts carry conditions: "write a story that includes the word <em>lantern</em>
				and is exactly five sentences long." The verifier is unglamorous — a string search and a sentence
				splitter from Part 8's verifier stack — and that's the point. This isn't a toy pattern, either:
				AI2's Tülu 3 used RLVR on exactly this class of instruction-following constraints (the IFEval
				style — length limits, required keywords, forbidden words) in a real open-weights release, right
				alongside math problems. You are running a production recipe on a pocket-sized model.
			</p>

			<Callout type="warning" title="The all-zero group">
				A preview of a failure mode you'll meet formally in 11.3: GRPO learns from differences
				<em>within</em> a group of attempts. If every attempt at a prompt fails — reward zero across the
				board — there is no difference, no advantage, no gradient. Nothing happens, forever. This is why
				rhyming constraints got demoted from this chapter: TinyStories contains no verse, so base Quill
				essentially never rhymes, so every group scores all-zero. The quiet lesson generalizes: RL sharpens
				abilities the base model already shows occasionally. It does not conjure them from nothing.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Arena 3: the Countdown hatchling
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Countdown is the numbers game: given, say, <Code code="3, 7, 25, 50" />, reach
				<Code code="94" /> using each number at most once with the four arithmetic operations. It's beloved
				by RL researchers because it is perfectly verifiable — parse the expression, check the arithmetic,
				check the numbers used — and because solving it rewards search: try a path, notice it fails, back
				up.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Its fame comes from TinyZero, the Berkeley reproduction of DeepSeek-R1's "aha moment" —
				spontaneous re-checking and backtracking emerging from pure RL — on Countdown, using 1.5B to
				3B-parameter base models and about thirty dollars of compute. Our hatchling is roughly a
				thousand times smaller than that, so here is the honest contract: we warm-start it with SFT
				on synthetic solution traces (Part 8's pipeline), then run GRPO, and the promised payoff is <em
					>reward rises and outputs lengthen</em
				>. Not promised: epiphanies. If you ever catch your hatchling writing "wait, that's wrong,
				let me try again" unprompted — screenshot it. That would be above spec.
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
			<Math
				tex={String.raw`\hat{A}_i = \frac{r_i - \operatorname{mean}(r_1,\dots,r_G)}{\operatorname{std}(r_1,\dots,r_G)} \qquad \mathcal{L} = -\hat{A}_i \log \pi_\theta(y_i \mid x) + \beta\, \mathrm{KL}\big(\pi_\theta \,\|\, \pi_{\text{ref}}\big)`}
				display
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Group Relative Policy Optimization, exactly. For each prompt in a batch: sample a
				<em>group</em> of <Code code="G" /> completions (say <Code code="G = 8" />) from the current
				model. Score every one with the verifier. Then convert raw rewards into advantages by
				standardizing within the group — subtract the group's mean, divide by its standard
				deviation:
			</p>

			<PseudoCode
				number={1}
				title="GRPO, the whole algorithm"
				code={String.raw`for each prompt $x$ in the batch do
  sample a group $y_1, \dots, y_G \sim \pi_\theta(\cdot \mid x)$ // G completions, say G = 8
  $r_i \leftarrow \mathrm{verifier}(y_i)$ for $i = 1, \dots, G$ // score every one
  $\hat{A}_i \leftarrow \bigl(r_i - \mathrm{mean}(r)\bigr) / \mathrm{std}(r)$ // the group is the baseline: no critic network
  for each token $t$ of each completion $y_i$ do
    $\rho_{i,t} \leftarrow \pi_\theta(y_{i,t}) \,/\, \pi_{\theta_{\mathrm{old}}}(y_{i,t})$ // new probability over old
    $L_{i,t} \leftarrow -\min\bigl(\rho_{i,t}\, \hat{A}_i,\ \mathrm{clip}(\rho_{i,t},\, 1 - \epsilon,\, 1 + \epsilon)\, \hat{A}_i\bigr)$ // clipped step
  end for
end for
$\mathcal{L} \leftarrow \mathrm{mean}_{i,t}\bigl[L_{i,t}\bigr] + \beta \, \mathrm{KL}\bigl(\pi_\theta \,\|\, \pi_{\mathrm{ref}}\bigr)$ // mean over all tokens + the KL leash`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Then run 11.1's update with <Code code="A_i" /> as the weight on every token of sample
				<Code code="i" />: tokens of above-average samples get pushed up, tokens of below-average
				samples get pushed down. That's the entire algorithm — and its scoring half runs live below:
				prepare Quill, pick a constraint, and watch a real group of eight get its rewards and
				advantages.
			</p>

			<GroupRewardLab />

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The group is the baseline
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Why subtract the mean at all? Because raw rewards are noisy and offset. If every sample at
				some prompt scores around <Code code="0.7" />, plain REINFORCE upweights all of them — you
				burn your gradient budget teaching the model what it already does. The useful signal is
				<em>which attempts were better than the others</em>. Classic policy-gradient methods call
				the thing you subtract a baseline, and PPO — the previous standard — estimates it with a
				<em>critic</em>: a second neural network, as large as the policy itself, trained alongside
				it to predict expected reward.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				GRPO's insight is that you already paid for a baseline estimate: the other
				<Code code="G - 1" /> samples in the group. Their mean <em>is</em> the expected reward at this
				prompt, measured rather than predicted. So delete the critic. That deletion is the headline memory
				win over PPO — half the networks, half the optimizer state — and it is, concretely, the reason
				this chapter fits inside a browser tab.
			</p>

			<Callout type="tip" title="One model, two roles">
				The KL term needs a frozen reference copy of the policy — normally a second full set of
				weights in memory. The flagships dodge this: their post-training is LoRA, so switching the
				adapter <em>off</em> reproduces the frozen reference exactly. Same weights, two policies, zero
				extra memory.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Clipping and the leash
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Two stabilizers ride along. The <em>clipped surrogate</em> (inherited from PPO): by the time
				you apply the update, the policy has shifted since the samples were drawn, so the loss uses
				the ratio of new to old token probability — and clips it to
				<Code code="1 ± eps" /> so no single batch can yank a token's probability by more than a few percent.
				And the <em>KL to reference</em>: Part 10's anchor, still attached, charging the model for
				drifting too far from the SFT policy no matter how much reward the drift earns.
			</p>

			<MermaidDiagram
				definition={`graph TD
  A(["Batch of prompts"]) --> B(["Sample a group of G completions per prompt"])
  B --> C(["Verifier scores every completion"])
  C --> D(["Advantage = score minus group mean, over group std"])
  D --> E(["Clipped update: upweight winners, downweight losers"])
  E --> F(["KL leash keeps the policy near the reference"])
  F --> A`}
				id="grpo-loop"
			/>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				At real scale: DAPO and GSPO
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Push GRPO to frontier scale and cracks show, and the fixes have names you'll meet in papers.
				DAPO raises the upper clip bound so rare tokens can still be encouraged, drops
				all-zero-variance groups and resamples fresh prompts instead (the same trap you met in 11.2,
				patched at industrial scale), and averages the loss per token rather than per sample so long
				reasoning chains aren't diluted. GSPO computes the importance ratio per
				<em>sequence</em> instead of per token, which stabilizes RL on mixture-of-experts models. Both
				are refinements of the exact skeleton above — worth recognizing, not worth re-deriving here.
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

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The editor arrives with this chapter's playground, but the idea is worth previewing now,
				because it's the punchline of Parts 9 through 11: the reward function is the specification,
				and the model is a specification-satisfier with no loyalty to what you meant. Here's the
				default reward for Quill's constraint arena:
			</p>

			<CodeBlock
				title="The default constraint reward — soon to be yours"
				lang="js"
				code={`function reward(story, constraint) {
  let r = 0;
  if (story.includes(constraint.word)) r += 1;
  if (sentenceCount(story) === constraint.sentences) r += 1;
  return r; // 0, 1, or 2 — sparse, but honest
}`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Three edits to try, each with a prediction to make first. Pay per <em>occurrence</em> of the word
				instead of a one-time bonus, and you've re-invented Part 10's "dragon dragon dragon" — except
				now there's a gradient behind it, so it arrives faster and harder. Reward story length and you
				get padding: repeated clauses, weather reports, anything that emits tokens. Drop the word term
				entirely and watch the constraint be serenely ignored — the model optimizes what's scored, not
				what's written in the prompt.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The subtler craft is <em>shaping</em>. A binary reward is honest but sparse: hard prompts
				produce all-zero groups (11.2's trap) and contribute nothing. Partial credit — say
				<Code code="+0.2" /> for a sentence count within one of the target — manufactures variance inside
				groups, and variance is what gradients are made of. At this scale, reward design is mostly variance
				engineering.
			</p>

			<Callout type="tip" title="Predict, then run">
				Before every rerun, write down the exploit you expect. If the model surprises you, you just
				learned something about your own specification — which is the actual skill this section
				teaches. Frontier labs employ people whose entire job is this loop.
			</Callout>
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

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				DeepSeek-R1 is the paper that made this chapter's material famous, and it actually shipped
				two models. R1-Zero came first: pure GRPO on the base model — no SFT at all — with rewards
				for answer correctness and output format only. Reasoning behaviors emerged anyway: long
				chains of thought, re-checking, backtracking. But the prose was a mess — languages mixed
				mid-thought, formatting drifted — a model that reasoned before it could speak.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				R1 proper fixed that with a loop, and the loop is the recipe worth memorizing:
			</p>

			<MermaidDiagram
				definition={`graph LR
  A(["Base model"]) --> B(["Cold-start SFT on a small, readable CoT set"])
  B --> C(["RL on verifiable rewards"])
  C --> D(["Rejection-sample the RL model into a better SFT set"])
  D --> E(["SFT again"])
  E --> F(["RL again: reasoning + preferences"])
  F --> G(["R1"])`}
				id="r1-recipe"
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Cold-start SFT: a small, curated set of long, readable reasoning traces gives the model a
				format to think in. RL: GRPO on verifiable rewards — math answers, code that passes tests,
				checkmate-class signals. Then the clever step: <em>rejection sampling</em>. Sample the RL
				checkpoint many times per prompt, keep only completions the verifier certifies, blend in
				general instruction data, and you've manufactured a bigger, better SFT set than the one you
				started with — written by the model, vouched for by the verifier. Retrain on it, then run RL
				once more with preference rewards folded in for general polish.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Notice the structure: the RL model becomes a data factory for its own successor. Best-of-N,
				which Part 10 showed you as an attack on a learned reward, turns into a pipeline when the
				scorer is a verifier — keep-the-winners is exactly Part 8's filtering with a stronger
				generator. Alignment and synthetic data stop being separate chapters and start being one
				loop.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				And the emergence story is quantitative, not mystical: as reward rises during RL,
				completions get longer. The model is buying accuracy with tokens — more steps, more checking
				— because thinking longer wins reward. At frontier scale that pressure produces mid-chain
				self-correction, the paper's "aha moment." At hatchling scale you'll see the honest
				miniature from 11.2: the reward curve climbs and the outputs stretch.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Now count what you own. Cold-start SFT: Part 7. Verifiable-reward RL: this chapter.
				Rejection sampling: Part 8's verifier filtering pointed at Part 10's best-of-N machinery.
				Preference polish: Part 9. The frontier recipe for reasoning models is a composition of
				chapters you have already run, on birds you raised yourself. Different exponents — Part 14
				will be precise about how different — but the same loop.
			</p>

			<VibeBox
				prompts={[
					"Explain GRPO's advantage formula to me like I'm reviewing the code",
					'My reward curve went flat — walk me through the all-zero-group failure and how to check for it',
					'Design a reward function for limerick writing and predict exactly how Quill would hack it'
				]}
			/>
		</div>
	</div>
</section>
