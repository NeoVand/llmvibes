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
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import RlhfVsDpo from '../diagrams/RlhfVsDpo.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import EquationAnatomy from '../ui/EquationAnatomy.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
	import PreferenceLab from '../lab/PreferenceLab.svelte';
	import RlLoopLab from '../lab/RlLoopLab.svelte';
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Start with why SFT can't finish the job. SFT teaches by demonstration: here is an
				instruction, here is <em>the</em> response, imitate it. That works when a right answer
				exists. But most of what you actually want from a storyteller has no right answer. Ask
				instruct-Quill for a story about a lost kitten and sample twice: both stories satisfy the
				instruction, both would have been valid SFT targets — and one of them is clearly better.
				More alive, better paced, an ending that lands. "Correct" can't see the difference.
				<strong style="color: var(--color-text);"
					>Better-versus-worse is a different kind of signal than right-versus-wrong</strong
				>, and no amount of demonstration data contains it.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				There's a subtler ceiling too: an SFT model imitates its demonstrations, so it can only be
				as good as its average demonstration. To push <em>past</em> the data, you need a signal that ranks
				the model's own outputs against each other. That signal has to come from a judge — and for Quill,
				the judge is you.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The annotation screen is exactly this — and a first working version is live below: one
				prompt, two sampled stories side by side, and a click. Which would you rather read? No
				rubric, no scoring guide — your honest preference is the ground truth being collected. This
				is, without simplification, the job thousands of contractors do to align frontier models.
				The interface they use looks like the one you'll use.
			</p>

			<PreferenceLab />

			<Callout type="tip" title="Why comparisons, not scores?">
				You could imagine rating each story 1–10 instead. Labs tried; it works badly. People drift —
				your 7 on Monday is your 5 on Friday — and two annotators' scales never line up. But show
				the same two stories to the same person twice and the <em>comparison</em> comes back stable. Pairwise
				preference is the low-noise interface to human judgment, which is why essentially all preference
				data is collected as comparisons.
			</Callout>

			<Callout type="warning" title="Honest math about your hundred clicks">
				A few hundred clicks alone is too noisy to train a good reward model — that's not modesty,
				it's statistics, and this course won't pretend otherwise. So the lab blends: your clicks
				train the reward model <em>together with</em> a shipped preference set, weighted so your taste
				tilts the result. On-screen it reads "your 100 votes + 5,000 others". Skip the clicking entirely
				and the default set carries the chapter, labeled as such. Your votes are seasoning with real flavor
				— they're just not the whole meal.
			</Callout>
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Clicks are precious and slow; training needs millions of judgments. The move that makes
				preference training scale is to
				<strong style="color: var(--color-text);">learn a model of the judge</strong>: a
				<strong style="color: var(--color-text);">reward model (RM)</strong> that reads a prompt and a
				response and outputs a single number — its estimate of how much you'd like it. Once trained, it
				can score a million stories a second and never gets tired of kittens.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				But your clicks are comparisons, not numbers. The bridge from "A beats B" to a scalar score
				is a 1952 result from ranking chess players, the
				<strong style="color: var(--color-text);">Bradley-Terry model</strong>: assume every
				response has a latent quality score, and the probability you prefer A over B depends only on
				the gap between scores:
			</p>

			<EquationAnatomy
				caption="Bradley-Terry: from comparisons to a score — each click's loss pushes r(chosen) above r(rejected) until the sigmoid saturates"
				tex={String.raw`P(A \succ B) = \textcolor{#b06a82}{\sigma}\big(\textcolor{#ef4444}{r(A)} \,\textcolor{#2563eb}{-}\, \textcolor{#ef4444}{r(B)}\big) \qquad \mathcal{L}_{\text{per click}} = -\log \textcolor{#b06a82}{\sigma}\big(\textcolor{#ef4444}{r(\text{chosen})} \,\textcolor{#2563eb}{-}\, \textcolor{#ef4444}{r(\text{rejected})}\big)`}
				terms={[
					{
						color: '#ef4444',
						label: String.raw`r(A),\; r(B)`,
						note: "each response's latent quality score — the single number the reward model outputs"
					},
					{
						color: '#2563eb',
						label: String.raw`r(A) - r(B)`,
						note: "only the gap matters; a 2-point gap means the model thinks you'd pick A ~88% of the time"
					},
					{
						color: '#b06a82',
						label: String.raw`\sigma(z) = \frac{1}{1+e^{-z}}`,
						note: 'the squash: any real gap becomes a probability between 0 and 1'
					}
				]}
				read="the chance you'd prefer A is a squashed version of how far A's score sits above B's."
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Note what the loss never asks: what the score <em>means</em>. Only gaps matter — the RM
				learns a taste <em>ordering</em>, calibrated in units of "how reliably you'd click this
				one". Architecturally, Quill's RM is barely a new thing: a transformer of the same breed
				you've trained five times, with the vocabulary-sized output head swapped for a single-number
				head. Same residual stream, same attention; instead of "what token comes next?" it answers
				"how much would the annotator like this?"
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Sit with how strange the object you've built is: a
				<strong style="color: var(--color-text);">differentiable model of your taste</strong>. It
				will score stories no human has ever read. It is also — and this is the load-bearing
				subtlety of the next three chapters — a <em>model</em> of your taste, trained on a few thousand
				points of it: approximately right where the data was dense, and quietly wrong everywhere else.
				Part 10 is entirely about what optimization pressure does to "quietly wrong everywhere else".
			</p>

			<VibeBox
				prompts={[
					'Score five fresh stories with my reward model and rank them — do I agree with it?',
					'Where would my RM disagree with me most? Generate a story that probes a blind spot'
				]}
			/>
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
			<EquationAnatomy
				caption="The DPO loss — the whole algorithm"
				tex={String.raw`\mathcal{L}_{\text{DPO}} = -\log \textcolor{#b06a82}{\sigma}\!\left(\textcolor{#f59e0b}{\beta} \left[\log\tfrac{\textcolor{#a855f7}{\pi_\theta}(\textcolor{#10b981}{y_w}\mid x)}{\textcolor{#94a3b8}{\pi_{\text{ref}}}(\textcolor{#10b981}{y_w}\mid x)} - \log\tfrac{\textcolor{#a855f7}{\pi_\theta}(\textcolor{#ef4444}{y_l}\mid x)}{\textcolor{#94a3b8}{\pi_{\text{ref}}}(\textcolor{#ef4444}{y_l}\mid x)}\right]\right)`}
				terms={[
					{
						color: '#10b981',
						label: String.raw`\log\tfrac{\pi_\theta(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)}`,
						note: 'the winner\'s log-ratio: how much more the tuned model likes the story you clicked ("w" for win) than the frozen reference does — training pushes it up'
					},
					{
						color: '#ef4444',
						label: String.raw`\log\tfrac{\pi_\theta(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)}`,
						note: 'the loser\'s log-ratio: the same measure for the story you passed on ("l" for lose) — training pushes it down'
					},
					{
						color: '#a855f7',
						label: String.raw`\pi_\theta`,
						note: 'the policy being trained — Quill, adapter ON'
					},
					{
						color: '#94a3b8',
						label: String.raw`\pi_{\text{ref}}`,
						note: 'a frozen reference — the SFT model, adapter OFF'
					},
					{
						color: '#f59e0b',
						label: String.raw`\beta`,
						note: 'leash tightness (≈ 0.1–0.5): how far from the reference the policy may stray'
					},
					{
						color: '#b06a82',
						label: String.raw`\sigma`,
						note: 'the Bradley-Terry sigmoid from 9.2, squashing the weighted gap into a probability that the winner wins'
					}
				]}
				read="push up the story you clicked and push down the one you rejected — both measured relative to the frozen reference, with β setting how tight the leash is."
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The classic RLHF pipeline uses the RM the obvious way: run reinforcement learning against
				it. Sample stories from Quill, score them with the RM, nudge the policy toward
				higher-scoring behavior, repeat — historically with an algorithm called PPO, plus a KL leash
				you'll meet properly in Part 10. It works; it aligned the models that made chatbots a
				household word. Watch the loop run — and try switching where the reward comes from:
			</p>

			<RlLoopLab />

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				That loop is a running system with several interacting parts — policy, reward model,
				reference model, RL algorithm — each of which can fail in its own way:
			</p>

			<RlhfVsDpo />

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				In 2023,
				<strong style="color: var(--color-text);">Direct Preference Optimization (DPO)</strong>
				showed that for this setup, the detour through an explicit RM and an RL loop can be skipped. The
				RLHF objective has a closed-form optimal policy, and rearranging it turns the whole pipeline into
				one supervised loss applied directly to your preference pairs — the equation this section opened
				with.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Look back at it with the pipeline in mind. If the policy drifts far from the SFT model, the
				log-ratios blow up and the gradient fades: the frozen reference tethers training to the
				distribution you started from, playing exactly the role the KL leash plays in the RL
				version. And notice the Bradley-Terry sigmoid is still right there — the RM didn't vanish,
				it became implicit: the log-ratio <em>is</em> the reward, β times over. The math of "learn a score,
				then chase it" collapsed into "chase the pairs directly".
			</p>

			<Callout type="tip" title="The adapter-off trick pays out">
				DPO needs <Code code="πref" /> and <Code code="πθ" /> in memory at once — normally two full copies
				of the model. For our LoRA-adapted birds, the reference is free:
				<strong>adapter off is <Code code="πref" />, adapter on is <Code code="πθ" /></strong>. One
				set of frozen base weights, two forward passes, no second copy. This is the payoff Part 7
				promised when it made zero-init adapters a big deal.
			</Callout>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Both birds get the treatment: Quill on your blended story preferences, Rook on move
				preferences — which brings up the question of where <em>Rook's</em> labels come from.
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				You will not be clicking through chess positions — evaluating moves takes expertise you may
				not have, and Rook needs far more labels than any human would sit through. Instead, Rook's
				preference pairs are labeled by
				<strong style="color: var(--color-text);">Stockfish</strong>: sample two candidate moves
				from Rook, ask the engine to evaluate both, and the better evaluation is the "chosen" move.
				Same Bradley-Terry loss, same DPO machinery, same everything —
				<strong style="color: var(--color-text);">only the judge changed</strong>.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				That substitution has a name. When the labels come from humans, the technique is
				<strong style="color: var(--color-text);">RLHF</strong> — reinforcement learning from human
				feedback. When they come from an automated judge, it's
				<strong style="color: var(--color-text);">RLAIF</strong> — from AI feedback. The twin setup
				makes the trade legible in a way definitions can't: your clicks are expensive, slow,
				inconsistent (you <em>will</em> contradict yourself around click forty) — and they are the only
				source of signal for "which story is better", because story-taste exists nowhere else. Stockfish's
				labels are free, instant, tireless, and effectively unlimited — where such a judge exists. For
				chess it does. For prose, nothing like Stockfish exists, which is why frontier labs use their
				best available substitute: another language model, prompted to judge.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The best-known industrial form is
				<strong style="color: var(--color-text);">Constitutional AI</strong>, and one honest
				paragraph covers it: instead of humans labeling every harmful-vs-harmless pair, a model
				critiques and revises its own outputs against a short written list of principles — a
				constitution — and preference labels are generated by a model applying those principles.
				Human oversight doesn't disappear; it moves up a level, from labeling every example to
				writing the principles and auditing the result. It scales, and it inherits the judge model's
				blind spots — an AI judge can be lazy, gameable, or systematically biased toward, say,
				longer answers. Hold that thought for one chapter.
			</p>

			<Callout type="note" title="One machinery, a spectrum of judges">
				Don't file RLHF and RLAIF as different algorithms — everything downstream of the click is
				identical. The design question is only ever: <em
					>who judges, at what cost, with what blind spots?</em
				> You (slow, sincere), Stockfish (fast, narrow, nearly perfect), an LLM with a constitution (fast,
				broad, imperfect). Every alignment pipeline in production is some blend of the three.
			</Callout>
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Here's an uncomfortable fact about preference training: the usual dashboards can't tell you
				if it worked. Loss went down — the <em>DPO</em> loss, which measures fit to the preference
				pairs, not whether stories got better. The RM's average score went up — but the RM is the
				thing being optimized against, hardly a neutral referee. When the training target is "what
				you like", there is exactly one honest evaluation:
				<strong style="color: var(--color-text);"
					>blind comparison by the judge whose taste was trained on.</strong
				>
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				So the chapter ends where it began, at the two-stories-one-click screen — with one change.
				Now one story comes from DPO-tuned Quill and the other from the SFT checkpoint, same prompt,
				sides shuffled,
				<strong style="color: var(--color-text);">labels hidden</strong>. You click through twenty
				pairs; the reveal shows which model won each one. Blind matters more than it sounds: knowing
				which story is "the aligned one" measurably tilts human judgment — the placebo effect
				doesn't spare machine learning researchers, which is why serious labs run exactly this
				protocol, at contractor scale, and report win rates.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				A win rate meaningfully above 50% is the chapter working: the stack turned a few thousand
				clicks into a model whose outputs you verifiably prefer. And if your score hovers
				<em>at</em> 50% — that's a real result too, honestly reported. At this scale, with this much preference
				data, a perceptible-but-modest effect is the truthful outcome; the effect gets dramatic at frontier
				scale, where the preference sets have millions of pairs. Either way, you've now run the only eval
				of preference training that means anything.
			</p>

			<Callout type="tip" title="Rook's taste test is a ladder match">
				The twin version needs no blindfold: DPO-tuned Rook plays its SFT predecessor in a short
				match, and the score is the score. When a domain has ground truth, use it — chess doesn't
				need a taste test. Prose does. Knowing which of those situations you're in is half of
				evaluation design.
			</Callout>
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

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				One more run of the machinery, with a different target. Build a small preference set where
				the prompt asks for a scary story; the <em>chosen</em> response politely declines and offers
				an alternative, the <em>rejected</em> response complies:
			</p>

			<CodeBlock
				title="A harmlessness preference pair"
				lang="text"
				code={`prompt:    Tell me a really scary story about the dark woods.

chosen:    I'd rather not tell scary stories — they can give you
           bad dreams! How about a story where the dark woods
           turn out to be friendly?

rejected:  The dark woods were full of eyes. Something followed
           Mia between the trees, closer and closer...`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				DPO on a few hundred such pairs, and Quill declines scary-story requests — while still
				writing every other kind of story. No new algorithm, no safety module: the identical loss
				from 9.3, pointed at pairs that encode "declining is preferred here".
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The transferable insight is <em>what kind of thing</em> the refusal is.
				<strong style="color: var(--color-text);">It is preference-shaped, not rule-shaped.</strong> There
				is no line of code checking for the word "scary", no blocklist, no if-statement anywhere in the
				bird — just a probability distribution nudged until declining outweighs complying in a region
				of prompt space. That one fact explains the texture of refusal behavior in every production model
				you've met: why refusals are probabilistic rather than crisp, why rephrasing a request sometimes
				slides past them (a jailbreak is a walk to a spot the preference data didn't cover), and why models
				sometimes over-refuse harmless requests near the boundary — the nudged region has soft edges in
				every direction.
			</p>

			<Callout type="warning" title="Toy means toy">
				Quill declining spooky campfire stories is not safety work — scary stories aren't harmful,
				and a 5M-parameter model has nothing dangerous to withhold. The exercise earns its place
				because the <em>mechanism</em> is the real one: production harmlessness training is preference
				pairs feeding the same losses you just ran, at vastly larger scale, over genuinely harmful content,
				with the stakes attached. This course shows you the machinery honestly; it doesn't claim the machinery
				plus a toy dataset equals safety.
			</Callout>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				And this closes a historical loop: preference training wasn't invented to make stories
				charming. It was invented because "helpful and harmless" has no answer key — no verifier, no
				gold label, only human judgment about which response is better. Everything this chapter
				built, from the click screen to DPO, exists because someone needed to train on exactly that
				kind of signal. The charming stories were the demo; this was the reason.
			</p>

			<VibeBox
				prompts={[
					'Probe the refusal boundary: find a prompt where Quill wrongly declines a gentle story',
					'Explain my blind test score — is my win rate above chance, statistically?',
					'Rephrase a scary-story request three ways and predict which one slips past the refusal'
				]}
			/>
		</div>
	</div>
</section>
