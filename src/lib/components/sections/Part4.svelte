<script lang="ts">
	import { TrendingDown, Sigma, Undo2, Settings, Scale, Sparkles } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import MermaidDiagram from '../ui/MermaidDiagram.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
</script>

<section id="part-4" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={TrendingDown}
			partLabel="Part 4"
			title="Learning"
			color="var(--color-primary)"
		/>

		<blockquote
			class="my-8 border-l-4 py-1 pl-5 text-lg italic"
			style="color: var(--color-text-secondary); border-color: var(--color-primary); font-family: var(--font-heading);"
		>
			"A model learns exactly one thing: to be less surprised by what comes next."
		</blockquote>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			A transformer with random weights is an elaborate way to produce noise. This chapter is about
			the loop that turns noise into skill: a loss that scores every prediction, gradients that
			assign blame, an optimizer that acts on it — and the strange things that happen when a model
			learns too well, or keeps learning long after it should have stopped.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone. But everything you learn
			here runs for real in Part 5 — the numbers in this chapter are the exact numbers you'll watch
			on your own screen.
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

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Where the Numbers Come From
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Part 3 left off at the transformer's final layer: for every position in the input, the model
				emits one raw score per vocabulary entry. These scores are called
				<strong style="color: var(--color-text);">logits</strong>. Quill emits 512 of them (its
				byte-BPE vocab), Rook emits 1931 (its UCI move vocab). Logits are just real numbers — they
				can be negative, they don't sum to anything, and you can't bet on them yet.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				<strong style="color: var(--color-text);">Softmax</strong> fixes that in one move: exponentiate
				every logit (now everything is positive), then divide by the total (now everything sums to 1).
			</p>

			<CodeBlock
				title="Softmax — logits in, probabilities out"
				lang="text"
				code={`p_i = exp(z_i) / ( exp(z_1) + exp(z_2) + ... + exp(z_V) )

z = logits (one per vocab token), V = vocab size
Properties: every p_i > 0, they sum to 1, and order is preserved —
the biggest logit becomes the biggest probability.`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The exponential does one more thing worth noticing: it exaggerates gaps. A logit that's 2
				points ahead doesn't get 2 more units of probability — it gets about 7&times; as much. That
				sharpening is a feature, and in Part 5 you'll meet the dial (temperature) that controls it.
			</p>

			<MermaidDiagram
				definition={`graph LR
  A(["Final layer output:<br/>one logit per vocab token"]) --> B(["Softmax"])
  B --> C(["Probability distribution<br/>over the whole vocab"])
  C --> D(["Look up p of the<br/>ACTUAL next token"])
  D --> E(["loss = -log p"])`}
				id="softmax-loss-pipeline"
			/>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Cross-Entropy: Scoring One Prediction
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Training data comes with the answer key: the corpus itself. The model predicts a
				distribution over the next token; the corpus knows which token actually came next. The loss
				for that one prediction is brutally simple:
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				<Code code="loss = -log p(actual next token)" /> — take whatever probability the model assigned
				to the truth, and take its negative log. Everything else it predicted is ignored.
			</p>

			<CodeBlock
				title="What the numbers feel like"
				lang="text"
				code={`p(truth) = 1.00    →  loss = 0.00   certain and right
p(truth) = 0.50    →  loss = 0.69   a coin flip
p(truth) = 0.10    →  loss = 2.30   one of ten plausible options
p(truth) = 1/512   →  loss = 6.24   uniform guessing (Quill's vocab)
p(truth) → 0       →  loss → ∞      confident and wrong — punished hard`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				That last line is why the log is there. A loss of <Code code="1 - p" /> would treat "gave the
				truth 1% chance" and "gave it 0.0001%" as nearly the same mistake. The log makes confident wrongness
				catastrophically expensive, so the model learns to hedge exactly as much as its actual uncertainty
				deserves. During training, this per-token loss is averaged over every position in every sequence
				of the batch — thousands of graded predictions per step.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Starting Line Is ln(V)
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Here's a prediction you can verify with your own eyes. An untrained model has random
				weights, so its logits are meaningless and roughly equal — softmax turns that into a uniform
				distribution: every token gets probability 1/V. The loss is therefore
				<Code code="-log(1/V) = ln(V)" />, before a single step of training.
			</p>

			<CodeBlock
				title="The two numbers to remember"
				lang="text"
				code={`Quill:  vocab = 512   →  starting loss = ln(512)  = 6.24
Rook:   vocab = 1931  →  starting loss = ln(1931) = 7.57`}
			/>

			<Callout type="tip" title="Check the math yourself in Part 5">
				When you press play on the labs in the next chapter, Quill's loss curve begins at 6.24 and
				Rook's at 7.57 — not approximately, not by coincidence. Watching ln(V) appear on your own
				screen is your proof that nothing here is staged: the theory and the pixels agree.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Perplexity: Loss You Can Read
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Loss is in nats — a logarithmic unit nobody has intuitions for. Undo the log and you get
				<strong style="color: var(--color-text);">perplexity</strong>:
				<Code code="perplexity = e^loss" />. Read it as:
				<em>the model is effectively choosing uniformly among this many tokens</em>.
			</p>

			<CodeBlock
				title="Perplexity along a training run (Quill)"
				lang="text"
				code={`loss = 6.24  →  perplexity = 512   choosing among the whole vocab
loss = 4.00  →  perplexity ≈ 55    it has ruled out 90% of the vocab
loss = 2.00  →  perplexity ≈ 7.4   about seven plausible next tokens
loss = 1.00  →  perplexity ≈ 2.7   nearly a two-way choice`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				This is the number the whole course pushes down. Pretraining (Part 5) attacks it directly;
				every later stage — instruction tuning, preference training, RL — reshapes <em>which</em>
				tokens the model bets on while trusting this machinery underneath. When frontier labs report a
				model's loss, this exact quantity, computed this exact way, is what they mean.
			</p>

			<VibeBox
				prompts={[
					'Walk me through softmax on the logits 2.0, 1.0, 0.0 by hand — show every number',
					'Why does cross-entropy use -log p instead of just 1 - p? What behavior does that change?'
				]}
			/>
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

			<Callout type="note">
				<strong>The Problem:</strong> The loss says "you were surprised by 4.7 nats." Quill has millions
				of weights, and every single one of them contributed something to that prediction. Which weights
				were at fault, and by how much? Guessing weight-by-weight would take millions of forward passes
				per update. Backprop does it in one.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Gradient: A Blame Number for Every Weight
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				For each weight, ask: <em
					>if I nudged this weight up a tiny bit, would the loss go up or down, and how steeply?</em
				>
				That per-weight answer is the
				<strong style="color: var(--color-text);">gradient</strong> — how much each weight moved the loss.
				A positive gradient means "this weight is making things worse; lower it." A gradient near zero
				means "this weight is innocent this round." Once you have it, the update rule is one line:
			</p>

			<CodeBlock
				title="Gradient descent — the whole idea"
				lang="text"
				code={`w  =  w  -  learning_rate * gradient(w)

Every weight steps a little way downhill on the loss surface.
The learning rate decides how big "a little way" is.`}
			/>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Chain Rule, Walked Backwards
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The trick that makes millions of gradients affordable: a transformer is nothing but a long
				composition of simple operations — multiply, add, softmax, RMSNorm — and each simple
				operation knows its own local derivative. The chain rule says the derivative of a
				composition is the product of the local derivatives along the way.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				So the forward pass builds a graph of everything it computed, and the backward pass walks
				that <em>same graph</em> in reverse: start at the loss with a gradient of 1, and at each operation,
				multiply by its local derivative and hand the result upstream. A weight deep in layer one influenced
				the loss through every path that passes through it — attention heads, MLPs, the residual stream
				— and the backward sweep sums the blame over all of those paths automatically, in a single pass
				that costs roughly two forward passes.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				That's credit assignment: the loss doesn't shout at the model as a whole, it whispers a
				precise, individual instruction to every weight. We won't derive the calculus here — what
				matters for everything downstream is the shape of the idea: <em
					>gradients flow backward through the exact structure that predictions flowed forward
					through, splitting and merging where the computation split and merged.</em
				>
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Loop You'll Run in Part 5
			</h4>

			<MermaidDiagram
				definition={`graph TD
  A(["Sample a batch of sequences<br/>from the corpus"]) --> B(["Forward pass:<br/>predict every next token"])
  B --> C(["Cross-entropy:<br/>average surprise → one loss"])
  C --> D(["Backward pass:<br/>one gradient per weight"])
  D --> E(["Optimizer step:<br/>nudge every weight downhill"])
  E --> A`}
				id="training-loop-cycle"
			/>

			<CodeBlock
				title="The training loop, in full"
				lang="text"
				code={`for step in 1..N:
    batch  = sample_sequences(corpus)            # tokens in
    logits = model.forward(batch)                # predictions out
    loss   = cross_entropy(logits, next_tokens)  # one number
    grads  = backward(loss)                      # blame for every weight
    optimizer.update(weights, grads)             # act on it`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				That's the entire loop. Not a sketch of it — the actual loop. When you press play in Part 5,
				a Web Worker runs exactly these five lines against your GPU, thousands of times. GPT-4-class
				training is this loop with more zeros attached.
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

			<Callout type="note">
				<strong>The Problem:</strong> Each gradient is computed from one small batch — a tiny, noisy sample
				of the corpus. Follow it literally and you zigzag. Worse, different weights need wildly different
				step sizes: the embedding row for a rare token gets a real gradient once in a thousand batches,
				while attention weights get hammered every step.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				<strong style="color: var(--color-text);">AdamW</strong> — the default optimizer of the entire
				LLM era — answers with three ingredients:
			</p>

			<div class="mb-6 grid gap-3 sm:grid-cols-3">
				<div class="rounded-lg p-4" style="background: var(--color-bg-secondary);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-primary);">
						Momentum
					</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">
						Keep a running average of recent gradients. Noise cancels out across batches; the
						direction that survives the averaging is the one worth following.
					</p>
				</div>
				<div class="rounded-lg p-4" style="background: var(--color-bg-secondary);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-primary);">
						Per-weight scaling
					</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">
						Also track each weight's average squared gradient, and divide by its square root.
						Weights with chronically large gradients get small careful steps; quiet, rarely-updated
						weights get bigger ones.
					</p>
				</div>
				<div class="rounded-lg p-4" style="background: var(--color-bg-secondary);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-primary);">
						Decoupled weight decay
					</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">
						Every step, shrink every weight slightly toward zero — applied separately from the
						gradient, which is the "W" that distinguishes AdamW from Adam. This gentle pressure
						against complexity stars in section 4.5.
					</p>
				</div>
			</div>

			<CodeBlock
				title="AdamW — one step, per weight"
				lang="text"
				code={`m = b1*m + (1-b1)*grad         # momentum: smoothed direction
v = b2*v + (1-b2)*grad^2       # scale: smoothed squared magnitude
w = w - lr * m / (sqrt(v) + eps)   # per-weight step size
w = w - lr * wd * w            # decoupled decay — the W in AdamW

(b1 ≈ 0.9, b2 ≈ 0.95-0.999; bias-correction terms omitted)`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Note the cost: <Code code="m" /> and <Code code="v" /> are two extra numbers
				<em>per weight</em> — the optimizer's memory is twice the model's. Harmless at Quill's size; at
				flagship size it's the reason LoRA exists, which is exactly how Part 7 will use it.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Schedules: the Learning Rate Is a Curve, Not a Constant
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				<strong style="color: var(--color-text);">Warmup:</strong> at step zero the weights are random,
				so the first gradients point somewhere confidently wrong. Taking full-size steps on them can distort
				the model before learning starts. The fix is to begin with a learning rate near zero and ramp
				it up over the first few hundred steps — let the model earn its step size.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				<strong style="color: var(--color-text);">Cosine decay:</strong> after warmup, glide the learning
				rate back down along a cosine curve. Big steps early, when everything is wrong and any direction
				helps; small steps late, so the model can settle into a minimum instead of orbiting it. (You'll
				also see warm-stable-decay schedules in modern runs — hold the rate flat, then decay at the end
				— handy when you don't know the run length in advance.)
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Gradient Clipping: the Seatbelt
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Once in a while a weird batch produces a giant gradient, and one giant step can undo hours
				of training — you'd see it as a vertical spike on the loss curve. Clipping measures the
				overall size (norm) of the full gradient and, if it exceeds a cap (typically 1.0), scales
				the whole thing down to fit. Same direction, sane size. It does nothing at all on normal
				steps — it's purely a seatbelt.
			</p>

			<Callout type="tip" title="This is not background material">
				AdamW with warmup, cosine decay, and clipping is <em>the</em> recipe — it's what trains Quill
				and Rook when you press play in Part 5, and, at different constants, what trained the frontier
				model you talked to this morning.
			</Callout>
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

			<Callout type="note">
				<strong>The Problem:</strong> A student who aces the exact problems from the homework might understand
				algebra — or might have memorized the answer key. You can't tell from the homework score. You
				need problems they've never seen.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The fix is old and unglamorous: before training, carve off a slice of the corpus — the
				<strong style="color: var(--color-text);">validation set</strong> — and never, ever train on it.
				Now you have two loss numbers:
			</p>

			<div class="mb-6 grid gap-3 sm:grid-cols-2">
				<div class="rounded-lg p-4" style="background: var(--color-bg-secondary);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-primary);">
						Train loss
					</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">
						Surprise on data the model trains on. Measures fit. Can be driven arbitrarily low by
						sheer memorization — it is flatterable.
					</p>
				</div>
				<div class="rounded-lg p-4" style="background: var(--color-bg-secondary);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-tip);">
						Validation loss
					</p>
					<p class="text-xs" style="color: var(--color-text-secondary);">
						Surprise on held-out data. Measures generalization — whether the model learned the
						<em>language</em> or just the <em>examples</em>. This is the honesty check.
					</p>
				</div>
			</div>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Read them together. Both falling: the model is learning things that transfer. Train falling
				while val flattens or rises: the model has started spending its capacity on memorizing
				specifics that don't transfer — <strong style="color: var(--color-text);"
					>overfitting</strong
				>. The gap between the two curves is memorization made visible.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Memorized-Story Demo
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Here's the cleanest way to see it, and a demo this course will ship as a hatchling: take a
				Quill-sized model and train it on just fifty stories, for thousands of steps. Train loss
				marches toward zero — the model becomes literally certain of every next token. Then prompt
				it with the opening words of one of those stories. It recites the rest <em>verbatim</em>.
				Every word, every comma. Meanwhile val loss, after an early dip, has been climbing the whole
				time: on stories it hasn't seen, this model is getting <em>worse</em>.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The general lesson: a model with enough parameters can always drive train loss to zero by
				becoming a lookup table. Train loss alone proves nothing. The val curve is the only witness
				that what fell was surprise about the world, not surprise about the flashcards.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Why Part 1's Dedup Was Never Optional
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				This is the payoff of the deduplication you did back in Part 1, and it lands twice. First: a
				story that appears a hundred times in the corpus is worth memorizing even for a model
				honestly minimizing loss — duplication turns memorization into the <em>correct</em>
				strategy, at the expense of everything else. Second, and sneakier: if a duplicate straddles the
				split — the same story in both train and val — then val loss on it is flattered by memorization,
				and your honesty check quietly lies to you.
			</p>

			<Callout type="warning" title="A contaminated val set fails silently">
				Nothing crashes. The curve just looks better than reality. This exact failure, scaled up, is
				benchmark contamination — a headline problem for frontier models that Part 5 returns to when
				we talk evals. Web-scale corpora are full of near-duplicates, which is why serious labs
				treat dedup and decontamination as core infrastructure, not cleanup.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The classical remedies: stop when val loss stops improving, get more data, or add
				regularization pressure like weight decay. Modern LLM pretraining mostly picks door number
				two — the corpus is so large the model sees most data about once, and overfitting recedes as
				a concern. But it never disappears: every fine-tune in Acts II and III runs on small data,
				where these curves become your primary instrument again.
			</p>

			<VibeBox
				prompts={[
					'My train loss is 1.2 and val loss is 3.8 and rising. What happened, and what are my options?',
					'Why does a duplicated document in the corpus hurt twice — once in training and once in evaluation?'
				]}
			/>
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

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Section 4.4 drew a tidy picture: memorization and generalization as rivals, val loss as the
				referee. In 2022, researchers at OpenAI (Power et al.) found a case where the story takes a
				turn nobody expected — a result so odd it got its own verb:
				<strong style="color: var(--color-text);">grokking</strong>.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The Setup
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Take a tiny transformer — hatchling-sized — and teach it modular arithmetic: problems like <Code
					code="a + b mod 97"
				/>, written as token sequences. There are only 97&times;97 possible problems, so you can
				enumerate the entire universe of them. Show the model a random slice — say half the table —
				as training data, and hold out the rest as validation. Then train with AdamW and weight
				decay, and just... don't stop.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				What Happens
			</h4>

			<CodeBlock
				title="A grokking run, schematically"
				lang="text"
				code={`steps      train accuracy    val accuracy
~300           100%              ~1%       memorized the table
1,000          100%              ~1%       flat.
5,000          100%              ~2%       still flat. anyone sane stops here.
10,000         100%             ~30%       ...wait
11,000         100%             ~100%      it groks — general algorithm found`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Phase one is exactly section 4.4's nightmare: the model memorizes its slice of the table in
				a few hundred steps. Train accuracy 100%, val accuracy at chance. Textbook overfitting —
				every rule says stop. Then, thousands of steps of apparently nothing. And then, abruptly,
				val accuracy snaps from chance to essentially perfect. The model stopped reciting the table
				and started <em>doing modular arithmetic</em>.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				What's Actually Going On
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Remember weight decay — AdamW's constant gentle pull toward zero? The memorization solution
				is a sprawling, expensive lookup table spread across large weights. The general algorithm is
				compact. Both drive train loss to zero, but under weight decay's pressure the lookup table
				keeps paying rent while the compact algorithm doesn't. Through the long plateau, gradient
				descent is quietly assembling the cheap general circuit, and once it works, the expensive
				table gets dismantled — which is the moment the val curve leaps.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Follow-up interpretability work found the algorithm itself, and it's beautiful: the model
				arranges the 97 number embeddings <em>into a circle</em> and does modular addition as rotation
				around it — trigonometry it was never taught, discovered as the cheapest way to be right. Structure
				like that, found by opening up a trained model, is exactly what Part 6 does to Rook.
			</p>

			<Callout type="note" title="The recorded run">
				Canonical grokking needs 10,000+ steps — beyond this course's coffee-break budget for live
				training. A recorded run with a scrubber (plus a patient live mode you can leave running in
				the background) arrives with a later milestone. The phenomenon is what matters here, and
				it's fully real: this exact experiment reproduces on a laptop.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Why end the chapter here? Because grokking is the honest asterisk on everything above. Loss
				curves are instruments, not oracles: a flat val curve tells you the model hasn't generalized
				<em>yet</em> — it cannot tell you what's assembling under the surface. Inside networks, understanding
				is sometimes a phase change, not a slope. Hold that thought through the next chapter, where you'll
				watch abilities switch on mid-training — and through Part 6, where we go looking for the circuits
				directly.
			</p>

			<VibeBox
				prompts={[
					'Explain grokking to me like I stopped the run at step 5,000 and published "transformers cannot do modular arithmetic"',
					'What role does weight decay play in grokking, and what happens without it?'
				]}
			/>
		</div>
	</div>
</section>
