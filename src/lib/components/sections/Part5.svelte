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
	import ChessLab from '../lab/ChessLab.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
</script>

<section id="part-5" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={Activity}
			partLabel="Part 5"
			title="Pretraining"
			color="var(--color-primary)"
		/>

		<blockquote
			class="my-8 border-l-4 py-1 pl-5 text-lg italic"
			style="color: var(--color-text-secondary); border-color: var(--color-primary); font-family: var(--font-heading);"
		>
			"One loop, two worlds: the same falling curve teaches one bird to speak and the other to see a
			board."
		</blockquote>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			Everything so far was preparation; this is the payoff. Both birds train side by side on your
			GPU, and over a coffee break Quill's output climbs from gibberish to words to grammar while
			Rook's moves go from random to legal to dangerous. This is the chapter the whole course is
			built around.
		</p>

		<Callout type="note" title="Hands-on">
			The two live training labs in section 5.3 are real: real tokens, real gradients, your GPU.
			They need WebGPU (current Chrome and Edge have it; Safari and Firefox are getting there). No
			WebGPU on this machine? Read on anyway — every number in this chapter is quoted from the same
			runs you'd be doing.
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

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Look at what's actually identical between the two labs you're about to run. The
				architecture: the same 4-layer, 128-wide, 4-head transformer from Part 3, weight for weight
				in structure. The objective: cross-entropy on the next token, straight from Part 4. The
				optimizer: AdamW, warmup, clipping — same constants. The loop: the exact five lines from
				section 4.2. Nothing in the machine knows whether it's learning bedtime stories or chess.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The <em>only</em> difference is the stream of token IDs flowing in. Quill eats TinyStories through
				its 512-token byte-BPE vocab; Rook eats random-legal chess games through its 1931-token UCI move
				vocab. You'll even see the difference before training starts: Quill's loss begins at ln(512) =
				6.24 and Rook's at ln(1931) = 7.57 — two different starting heights for no deeper reason than
				vocabulary size, exactly as Part 4 predicted.
			</p>

			<Callout type="important" title="The thesis, one more time">
				"It's all next-token prediction over token streams." Not a slogan — a falsifiable claim, and
				this chapter is the experiment. If one architecture with one objective produces a
				storyteller from story tokens and a chess player from move tokens, the intelligence isn't in
				the wiring. It's in what the data demands the model become in order to predict it.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Each dashboard pairs the loss curve with the thing loss can't show you: what the model
				actually produces. For Quill, sampled text. For Rook, sampled move sequences and how many of
				those moves are legal. Keep your eye on both halves — the curve tells you learning is
				happening, the samples tell you what kind.
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

			<Callout type="note">
				<strong>The Problem:</strong> In a minute you'll press "sample" and get a story. But a trained
				model doesn't emit text — it emits, at every step, 512 probabilities. Turning that distribution
				into one concrete token is a genuine decision, made once per token, and the policy you choose
				changes the output's whole character.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The obvious policy — always take the most probable token (<strong
					style="color: var(--color-text);">greedy decoding</strong
				>) — fails in a characteristic way: it's deterministic and it loops. Once a small model
				finds a comfortable phrase, the most likely continuation of "the little girl and the little
				girl" is more little girl. The fix is to actually <em>sample</em>: draw the next token at
				random, in proportion to its probability. Now likely tokens come up often, unlikely ones
				occasionally, and the output has texture.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Temperature: Reshaping the Distribution Before You Draw
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Between the logits and the softmax sits one dial. Divide every logit by a
				<strong style="color: var(--color-text);">temperature</strong> T before exponentiating:
			</p>

			<CodeBlock
				title="Temperature — one division, applied before softmax"
				lang="text"
				code={`p = softmax(logits / T)

T < 1  →  gaps between logits widen  →  sharper, safer, more repetitive
T = 1  →  the distribution exactly as the model learned it
T > 1  →  gaps shrink toward zero    →  flatter, wilder, less coherent`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Concretely, three tokens with logits 2, 1, 0:
			</p>

			<CodeBlock
				title="The same three logits at three temperatures"
				lang="text"
				code={`T = 0.5   →   0.87  0.12  0.02    nearly greedy — the favorite dominates
T = 1.0   →   0.67  0.24  0.09    the model's honest opinion
T = 2.0   →   0.51  0.31  0.19    flattened — underdogs get real chances`}
			/>

			<div class="mb-6 grid gap-3 sm:grid-cols-3">
				<div class="rounded-lg p-4" style="background: var(--color-bg-secondary);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-note);">T → 0</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">
						Collapses to greedy. Deterministic, cautious, prone to loops. Sample twice, get the
						identical output twice.
					</p>
				</div>
				<div class="rounded-lg p-4" style="background: var(--color-bg-secondary);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-tip);">T ≈ 0.7–1.0</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">
						The useful zone: enough randomness for variety, enough sharpness for coherence. Most
						chat models you've used live here.
					</p>
				</div>
				<div class="rounded-lg p-4" style="background: var(--color-bg-secondary);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-caution);">T high</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">
						Approaches uniform sampling over the vocab — which for an untrained model it literally
						is. Chaos, by construction.
					</p>
				</div>
			</div>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Top-k: Cutting the Tail
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				One refinement worth knowing now: even a good distribution has a long tail of hundreds of
				tokens at a fraction of a percent each. Individually negligible — collectively they hold
				real probability mass, so pure sampling occasionally lands on genuine junk mid-sentence.
				<strong style="color: var(--color-text);">Top-k sampling</strong> keeps only the k most probable
				tokens (say, 40), renormalizes, and samples from those. The tail's collective weight gets redistributed
				to plausible candidates. Its cousin top-p, plus tricks like repetition penalties, wait for Part
				13 — temperature and top-k are all you need to drive the labs.
			</p>

			<Callout type="tip" title="Why teach this before the first sample?">
				Because the first thing you'll see from an untrained model is uniform garbage, and you
				should know that's the <em>distribution's</em> fault, not the sampler's. And because when you
				crank the temperature later and watch a trained Quill dissolve back into byte soup, you'll recognize
				what you're seeing: yourself, manually undoing the sharpening that training bought.
			</Callout>
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

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Set your expectations honestly before you press anything. Measured on an Apple M4, Quill
				trains at roughly 13,000 tokens per second, so the 200-step run below takes about twenty
				seconds. In those seconds, loss falls from 6.24 to around 4.0 — perplexity from 512 down to
				about 55. That buys you <em>proto-words</em>, not prose. A real sample from this exact lab
				at step 200:
			</p>

			<CodeBlock
				title="Quill at step 200 — a real sample"
				lang="text"
				code={`She wanted to sper the found she her the was so he he was
to the pigs. She scared it and did lack. It was hip.`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Look at what twenty seconds bought: spaces in the right places, real short words ("she",
				"wanted", "the", "was"), capital letters starting sentences, periods ending them — and
				earnest almost-words like "sper" where the byte-level statistics are right but the
				dictionary isn't. That's what loss 4.0 <em>looks like</em>. Sample before training and
				compare: at loss 6.24 you get uniform byte soup, no spaces, no structure at all.
			</p>

			<TrainingLab
				bird="quill"
				title="Quill — pretraining live"
				steps={200}
				config={{ nLayer: 4, nEmbd: 128, nHead: 4, blockSize: 128 }}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Now Rook — same architecture, same loop, and the corpus is the only thing that changes. Its
				loss starts higher (ln of 1931) and its progress reads differently: samples go from random
				move tokens toward <em>chess-shaped</em> sequences — openings that look like openings, moves that
				a board would mostly accept. Watch the legal-move gauge rather than the raw text; legality is
				Rook's version of spelling.
			</p>

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

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Sit Across the Board From It
			</h4>
			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Reading Rook's samples is one thing; being its opponent is another. The board below trains a
				fresh Rook and lets you play it — and the side panel shows something no chess app shows: the
				model's <em>raw</em> next-move distribution, illegal wishes included. We sample only from the
				legal slice (masking), but the gauge tells you how much probability Rook has learned to put on
				legal moves by itself. Pretrain-grade chess is chaotic-but-increasingly-legal; strategy comes
				later, from Parts 7 and 11.
			</p>
			<ChessLab trainSteps={300} />

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Now Actually Play With It
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				One 200-step run is a taste. The weights persist between runs, so press train again — and
				again. Each round of 200 steps sharpens the samples: "sper the found" gives way to real
				words, then to short grammatical clauses, then to sentences that almost track a thought. The
				gibberish→words→grammar arc takes minutes of accumulated steps, not seconds; this is the
				coffee-break run the course is named for. Sample between rounds so you can feel the model
				move.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Three experiments worth running right now: sample at temperature 0 twice (identical output,
				and probably a loop — section 5.2 said so). Crank the temperature high on your best-trained
				Quill and watch it dissolve back toward byte soup. And peek at the per-token coloring in the
				sample stream: the token-level loss heatmap from Part 2's inspector, now showing you <em
					>which</em
				> predictions are still expensive — surprise retreating from easy tokens first.
			</p>

			<VibeBox
				prompts={[
					'My Quill loss is stuck around 4.2 after three runs — is that a bug? What should I check, and what should I expect next?',
					'Why does Rook start at a higher loss than Quill when they are the same architecture?',
					'I sampled at temperature 0 and got the same looping sentence twice. Explain exactly why, step by step.'
				]}
			/>
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

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Your live pair tops out around five million parameters — the price of training in a browser
				tab. The course's <strong style="color: var(--color-text);">flagship</strong> Quill and Rook
				are 15–25M-parameter versions of the same architecture, trained offline for days on the full
				corpora. You don't get to train them live. You get something arguably better: their entire
				<em>history</em>, saved as checkpoints you can scrub through like video.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The idea this teaches: a training run isn't a before and an after — it's a trajectory, and
				abilities arrive along it in a fairly stable order. Early checkpoints of flagship Quill make
				your live bird's mistakes (character statistics, word-shaped noise); mid-run checkpoints
				write clean sentences that forget the character's name; late ones hold a plot. Rook's
				trajectory runs opening moves → mostly-legal middlegames → moves that win material. Same
				slider, same left-to-right arrow of competence.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Induction Bump
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				One landmark on that trajectory deserves its own name. Fairly early in training, loss curves
				for transformers show a sudden extra drop — a visible bend — that interpretability work has
				traced to the formation of
				<strong style="color: var(--color-text);">induction heads</strong>: pairs of attention heads
				implementing a copy rule —
				<em
					>find the last time the current token appeared, look at what followed it, and predict that
					again</em
				>. It's the moment in-context copying clicks. Before it, flagship Quill treats a character's
				name as a rare token and fumbles it; after it, a name introduced once is reused correctly —
				the model has learned to consult its own context instead of relying on global statistics.
				This bend is marked on the flagship's logged training curve; catching it live in your own
				runs is a bonus, not a promise.
			</p>

			<Callout type="note" title="Arrives with a later milestone">
				The time machine — checkpoint scrubbers for both flagships, with the induction bump
				annotated on the real logged curve — ships once the flagship training pipeline lands. The
				concept is here now because 5.5 and 5.6 build on it: checkpoints are how you measure
				<em>when</em> an ability arrived, not just whether it did.
			</Callout>
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

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The mini-lab is simple: three hatchlings — small, medium, large — same corpus, same steps,
				same recipe. Every run lands at a different final loss, and when you plot final loss against
				parameter count with both axes logarithmic, the three points sit close to a straight line.
				Three points prove nothing alone; what they demonstrate is the shape of one of the most
				consequential empirical facts in the field:
				<strong style="color: var(--color-text);">loss falls predictably with scale</strong> — smoothly,
				as a power law, across many orders of magnitude of parameters, data, and compute.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Sit with how strange that is. Almost nothing else about these models is predictable — not
				what they'll say, not when an ability like induction will switch on. But the loss of a
				not-yet-trained 10&times;-bigger model can be forecast from a fit like this before anyone
				pays for the run. That predictability is why scaling became a strategy rather than a gamble
				— the "bitter lesson" in action: general methods plus more compute keep beating clever
				handcrafted structure.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Chinchilla Intuition
			</h4>

			<CodeBlock
				title="The fitted form (Chinchilla, 2022) — read it, don't memorize it"
				lang="text"
				code={`L(N, D) ≈ E + A / N^0.34 + B / D^0.28

N = parameters, D = training tokens, E = irreducible loss.
Two shrinking penalty terms: one for too few parameters,
one for too few tokens. Grow only one and the other's term
takes over — so grow them TOGETHER (rule of thumb: ~20
tokens per parameter for a compute-optimal run).`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				That balance was the Chinchilla paper's headline: the era's giant models were badly
				undertrained — too many parameters, too few tokens — and a smaller model fed more data beat
				them at the same compute. Check the balance on your own birds: live Quill has a few million
				parameters and a corpus slice of a few million tokens, so it sits near-ish the
				compute-optimal ratio, if far below it in scale — and the E term is why no amount of
				training makes a 5M-parameter model write like a frontier one. Some loss you buy off with
				scale; some is the noise floor of language itself.
			</p>

			<Callout type="warning" title="What scaling laws don't promise">
				They predict <em>loss</em>, not abilities. Section 5.4 showed abilities arriving as jumps; a
				smooth loss forecast tells you nothing about which jumps happen when. Predictable curve,
				surprising contents — both true at once, and much of the field's ongoing argument lives in
				that gap.
			</Callout>
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

			<Callout type="note">
				<strong>The Problem:</strong> Val loss measures surprise at held-out text. But "rarely
				surprised by TinyStories" and "writes a good story" are different claims — a model can ace
				the first while its stories wander, contradict themselves, and bore children. Loss is the
				training signal; an <strong>eval</strong> is a measurement of the thing you actually wanted. The
				gap between them is where all the trouble lives.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Rook: the Luxury of Ground Truth
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Chess is the easy case, which is exactly why this course has a chess bird. Rules are
				checkable: run every sampled move through a chess engine's rulebook and get a hard
				<strong style="color: var(--color-text);">legal-move rate</strong> — the gauge you watched in
				5.3, no judgment calls involved. Strength is measurable: play flagship Rook against Stockfish
				at fixed skill levels and estimate an Elo from the results. Numbers with external meaning, cheap
				to compute, impossible to argue with.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				One subtlety even here: legal on <em>which</em> positions? Openings repeat endlessly in the
				corpus, so a model could score well by memorizing them — section 4.4 in a new costume. The
				fix is an
				<strong style="color: var(--color-text);">out-of-distribution position set</strong>:
				weird-but-legal midgame positions that appear nowhere in training. High legality there can't
				come from recall; it has to come from something that models the board. That distinction —
				memorized surface vs internal model — is precisely Part 6's question, and this eval is its
				first piece of evidence.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Quill: When There's No Answer Key
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				No rulebook decides whether a story is good. The TinyStories paper met this head-on and
				pioneered the now-standard move: use a stronger LLM as the grader. Give the model a story
				opening, have it complete the ending, then hand the completion to a judge model with a
				rubric — grammar, creativity, consistency with the beginning — scored like a teacher marking
				homework. Judged evals scale to thousands of stories and correlate well with human ratings,
				at a price: the judge has taste, and taste has bugs. Judges favor longer answers, favor
				confident phrasing, and can be gamed — a fact that returns with teeth in Part 10, because a
				judge is a reward model wearing a different hat. Later in the course, the judge grading <em
					>your</em
				> Quill is the course's tutor model, rubric on screen.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Benchmarks: Saturation and Contamination
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Scale this up and you get the frontier's eval problem. Public benchmarks saturate: once
				every leading model scores 89-vs-91%, the test stops discriminating. And they leak:
				benchmarks are published text, pretraining corpora are scraped text, so test questions —
				often with answers — end up <em>inside training sets</em>, and a model "aces" questions it
				has effectively already seen. This is section 4.4's contaminated-val-set failure at
				civilizational scale, and the defenses are the same machinery as Part 1's dedup (n-gram
				overlap checks against test sets, i.e. decontamination) plus held-out private test sets and
				fresh questions written after the training cutoff. When you read a leaderboard, the first
				question is never "what's the score?" — it's "could the model have seen the test?"
			</p>

			<Callout type="tip" title="The eval mindset">
				Every training stage for the rest of this course ends with the same discipline: a
				before/after story test for Quill, a before/after play test for Rook, against fixed eval
				sets neither bird trains on. Optimize a number long enough and the number detaches from the
				goal — you'll watch that failure happen on purpose in Part 10.
			</Callout>

			<VibeBox
				prompts={[
					'Design an eval for Quill that a judge model could score unfairly — then fix the rubric',
					'Rook has a 98% legal-move rate on openings but 71% on the OOD position set. What does that gap tell me?'
				]}
			/>
		</div>
	</div>
</section>
