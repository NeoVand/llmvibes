<script lang="ts">
	import { AlertTriangle, ListOrdered, AlertOctagon, Anchor } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import MermaidDiagram from '../ui/MermaidDiagram.svelte';
	import OverOptCurve from '../lab/OverOptCurve.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The simplest way to use a reward model needs no training at all.
				<strong style="color: var(--color-text);">Best-of-N sampling</strong>: sample N stories from
				Quill for one prompt, score all N with your RM, keep the highest scorer, discard the rest.
				No gradients, no RL, no update to any weight — pure search against the reward.
			</p>

			<CodeBlock
				title="Best-of-N — the whole algorithm"
				lang="text"
				code={`for one prompt:
  1. sample N stories from Quill        (N = 1, 4, 16, 64, 256...)
  2. score each story with the RM
  3. output the argmax — the RM's favorite

N is an optimization-pressure dial. N = 1 is no pressure at all;
every doubling searches the RM's landscape a little harder.`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				At small N, this genuinely works — best-of-4 stories read noticeably better than single
				samples, which is why best-of-N is a real serving technique in production systems. The RM's
				judgment is decent near the middle of the distribution, and picking the best of a few
				ordinary samples stays in that comfortable region.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Keep doubling N, though, and something turns. Your RM was trained on a few thousand
				comparisons; it is approximately your taste, and
				<strong style="color: var(--color-text);"
					>"approximately" means it has error — soft spots where it over-credits things you don't
					actually care about.</strong
				>
				Suppose your clicks taught it, correctly, that you enjoyed a couple of dragon stories. In the
				RM's compressed version of your taste, that becomes a small standing bonus for dragon-ness. At
				N=4, that bias is noise. At N=256, the argmax hunts through the distribution's tail
				<em>specifically</em> for whatever maxes the bonus — and the maximum of "slightly favors dragons"
				is not a slightly better dragon story. It's dragon soup:
			</p>

			<CodeBlock
				title="The RM's favorite, as N grows"
				lang="text"
				code={`N = 1     A little frog found a lantern by the pond...
          (RM score: 1.2 — a normal story)

N = 16    Mia met a small dragon who had lost his roar. Together
          they searched the whole mountain...
          (RM score: 2.9 — genuinely charming; the system works!)

N = 256   The dragon saw a dragon. "Dragon!" said the dragon.
          The dragon and the dragon were dragon friends. Dragon...
          (RM score: 4.7 — the RM has never been happier)`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Plot both judges against the dial and you get the signature picture of
				<strong style="color: var(--color-text);">over-optimization</strong> — the chart this chapter
				exists to burn into your memory. Drag the pressure marker yourself:
			</p>

			<OverOptCurve />

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The two curves rise together at first — that's the RM earning its keep. Past a knee they
				split: the proxy keeps climbing (it must; more search means a higher argmax) while true
				quality falls. <strong style="color: var(--color-text);"
					>The gap between the curves is the hack.</strong
				> Researchers at OpenAI measured exactly this shape systematically — proxy score up, gold-standard
				score up, knee, gold score down — and the shape recurs at every scale, from your browser-tab RM
				to frontier pipelines. Optimization pressure doesn't degrade gracefully; it works, works, works,
				then quietly starts working against you. (And that β slider you just found is the subject of section
				10.3 — leave it at zero for now. Or don't.)
			</p>

			<Callout type="warning" title="No RL was harmed in this demonstration">
				A common mental shortcut files reward hacking under "reinforcement learning goes wrong".
				Notice what just happened: no RL, no training, not one weight changed. Sampling plus argmax
				was enough. Hacking is not a property of any particular algorithm —
				<strong>it is what strong optimization does to weak objectives</strong>, whether the
				optimizer is PPO, best-of-N, or a corporation chasing a quarterly metric.
			</Callout>

			<VibeBox
				prompts={[
					'Run best-of-N at N=4 and N=256 on the same prompt and show me both winners with scores',
					'What quirk of my clicks is my RM most likely to over-credit? Make a prediction, then test it'
				]}
			/>
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The pattern has a name older than machine learning.
				<strong style="color: var(--color-text);">Goodhart's law</strong> — coined by economist
				Charles Goodhart about banking targets, sharpened by anthropologist Marilyn Strathern into
				its familiar form: "When a measure becomes a target, it ceases to be a good measure." School
				rankings, quarterly KPIs, citation counts — humans have been reward hacking their own
				proxies for centuries. What's new with learned optimizers is the
				<em>pressure</em>: an optimizer probes the measure millions of times, without embarrassment,
				and finds cracks no committee would think to look for. If this course teaches one alignment
				lesson, it is this one.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Quill's version was subtle — taste is fuzzy, maybe you half-believe the RM about the
				dragons. So the chapter's second climax is deliberately unfuzzy. Chess has ground truth, and
				Rook is about to violate it. Write the most reasonable-looking reward you can for chess —
				the piece values every beginner memorizes:
			</p>

			<CodeBlock
				title="A naive material reward — what could go wrong?"
				lang="text"
				code={`reward per move:
  + value of any piece you capture     pawn 1, knight 3, bishop 3,
  − value of any piece you lose        rook 5, queen 9

Sensible, right? Material is how beginners are taught to count
advantage. It correlates beautifully with winning... in games
played by people who are trying to win.`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Optimize Rook against it and watch the replay. Facing a poisoned queen — a free-looking
				capture that walks into mate — material-Rook does not hesitate. Queen: +9. Checkmate next
				move: worth nothing in the ledger, because <em>mate isn't a capture</em>. The bird grabs the
				queen, gets mated, and banks a great score. Play on and it gets stranger: material-Rook
				learns to prefer long grubby sequences of even trades over clean wins, because trades
				generate reward events and checkmate ends the game — the reward stream — early. It has
				learned to farm the metric. Winning was never the objective; you only thought it was.
			</p>

			<Callout type="warning" title="The optimizer is not misbehaving">
				Resist the framing "Rook cheated". Rook did precisely what you asked, brilliantly. The bug
				is upstream, in the specification: you wrote "maximize material" while meaning "win", and
				the gap between what you wrote and what you meant became the policy. This is why alignment
				people insist reward design is a specification problem, not a training problem — no
				optimizer, however good, recovers intent you didn't encode. A better optimizer just finds
				the gap faster.
			</Callout>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Now line the two failures up and see the shared anatomy. Every reward you will ever deploy
				is a <strong style="color: var(--color-text);">proxy chain</strong> — each link a lossy compression
				of the thing you actually want:
			</p>

			<MermaidDiagram
				definition={`graph LR
  A(["What you want<br/>good stories · won games"]) -->|compressed into| B(["What you can measure<br/>clicks · piece values"])
  B -->|fit by a model| C(["What gets optimized<br/>RM score · material sum"])
  C -->|argmax / RL| D(["What you get<br/>dragon soup · hung kings"])`}
				id="proxy-chain"
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Every link leaks intent, and optimization pressure pools in the leaks. The frontier versions
				of dragon soup are already folklore: RMs that reward length, so models pad; RMs that reward
				agreement, so models flatter — sycophancy is dragon soup made of "yes"; coding agents
				rewarded on tests passing that delete the failing tests. Different proxies, one law. You've
				now watched it happen twice, on rewards you built, to birds you raised — which is the only
				way the lesson really lands.
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Ask <em>where</em> the RM went wrong and a fix suggests itself. Your RM learned your taste
				from stories sampled near the SFT model's distribution — normal stories, the kind it was
				shown pairs of. Inside that region, its scores mean something. "Dragon dragon dragon" comes
				from far outside it: the RM was never trained on degenerate text, so out there its score is
				pure extrapolation — confidently wrong, like a fitted curve read far beyond its data. The
				hack lives off-distribution.
				<strong style="color: var(--color-text);"
					>So: forbid the optimizer from leaving the region where the judge is sane.</strong
				>
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The tool is one you can now name precisely. Keep a frozen copy of the pre-optimization model
				— the <strong style="color: var(--color-text);">reference</strong> — and charge the policy for
				every bit of probability mass it moves away from the reference, measured by KL divergence:
			</p>

			<CodeBlock
				title="The KL-regularized objective — alignment's load-bearing equation"
				lang="text"
				code={`maximize   E[ reward(x, y) ]  −  β · KL( π ‖ πref )

KL( π ‖ πref ) = E over y ~ π [ log π(y|x) − log πref(y|x) ]

π      the policy being optimized
πref   frozen reference — the SFT model (adapter OFF, for our birds)
β      the leash: price per unit of drift away from the reference`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Read the objective as an economy: reward pays, drift costs. Behavior the reference already
				finds plausible is nearly free, so ordinary good stories can rise. "Dragon dragon dragon" —
				text the reference assigns vanishing probability — carries an enormous KL price no reward
				bonus can cover. The optimizer keeps all its pressure, but the pressure is now spent <em
					>inside</em
				>
				the region where the RM's judgment is calibrated. You met this term as the tether inside DPO's
				loss in Part 9; here it is out in the open, doing the same job explicitly. <Code code="β" /> sets
				the exchange rate, and both extremes fail informatively: β huge and the policy is the reference,
				nothing learned; β tiny and the dragons return. Between them sits a genuine engineering trade,
				tuned by watching both curves from 10.1.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Re-run both climaxes with the leash on. Quill at high N with a KL-penalized selection: story
				quality holds past the old knee — the winners get better and <em>stay</em>
				stories; dragons appear at sane rates. Rook, material reward plus KL to its pretrained reference:
				the poisoned queen is declined. Not because Rook now understands mate — because "capture into
				mate" is a move sequence its reference, trained on millions of human games where people avoid
				dying, finds deeply implausible. The reference's common sense, learned in pretraining, becomes
				a guardrail the naive reward never wrote down.
			</p>

			<Callout type="tip" title="Why the reference is free (Part 7 pays out again)">
				The KL term needs the reference's log-probabilities every step — normally a second full
				model in memory. Our birds fine-tune through LoRA adapters on a frozen base, so
				<strong>adapter-off <em>is</em> the reference</strong>: one weight copy, two forward passes.
				The trick that made browser-tab fine-tuning possible in Part 7 is the same trick that makes
				the KL leash affordable here, and it carries straight into GRPO next chapter.
			</Callout>

			<Callout type="warning" title="A leash, not a cure">
				Be precise about what the KL fix buys. It does not repair the proxy — the RM still
				over-credits dragons, the material reward still can't see mate. It slows how fast
				optimization reaches the cracks, and past enough pressure the curves still bend. That's why
				production pipelines stack defenses: KL plus early stopping, fresh preference data collected
				from the <em>current</em> policy, bigger and better RMs, and humans auditing outputs. Goodhart
				is managed, never solved. Carry that sentence into every chapter that follows — Part 11 hands
				the reward to a verifier, which closes some cracks and opens others.
			</Callout>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				And that's the double climax resolved: two birds, two hand-built rewards, two hacks, one fix
				— and one law you'll never unsee. When Part 11 starts optimizing against verifiable rewards
				with GRPO, every piece on the table will be one you've already held: the sampling, the
				reward, the reference, the leash. The only new ingredient is the gradient.
			</p>

			<VibeBox
				prompts={[
					'Sweep β from 0.01 to 10 on the Quill re-run and describe what each regime produces',
					'Design a reward for Rook that resists the material hack without using an engine eval',
					'Where else in my life is Goodhart’s law running right now? Give three examples, one uncomfortable'
				]}
			/>
		</div>
	</div>
</section>
