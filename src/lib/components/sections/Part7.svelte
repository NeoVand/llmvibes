<script lang="ts">
	import {
		GraduationCap,
		FileText,
		MessageSquare,
		Feather,
		SlidersHorizontal,
		ArrowLeftRight
	} from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import LoraBypass from '../diagrams/LoraBypass.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
	import PromptLab from '../lab/PromptLab.svelte';
	import LoraLab from '../lab/LoraLab.svelte';
</script>

<section id="part-7" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={GraduationCap}
			partLabel="Part 7"
			title="SFT + LoRA"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			Pretrained Quill continues stories; it doesn't follow instructions. Act III opens with the
			technique that turns a text-completer into an assistant — supervised fine-tuning — and the
			low-rank trick that makes fine-tuning big models affordable enough to run in a browser tab.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter is already partly live: the prompt lab in 7.1 puts you in front of base Quill —
			type at it and watch it continue instead of answer. The SFT playground itself arrives with a
			later milestone.
		</Callout>

		<div id="section-7-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={FileText}
				title="7.1 Instruction Data"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The only difference between a completer and an assistant is what it was fine-tuned on: pairs
				of instructions and responses. TinyStories-Instruct gives Quill exactly that — write a story
				about a brave fox, and a story about a brave fox follows.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				First, be honest about what you have. Five chapters of pretraining produced a model that
				answers one question, superbly: <em>what token comes next in text like my corpus?</em> Nobody
				asked it to be useful. Type an instruction at base Quill and it does the only thing it knows how
				to do — treat your instruction as the opening of a story and keep going:
			</p>

			<CodeBlock
				title="Base Quill, given an instruction"
				lang="text"
				code={`prompt:      Write a story with the words "lantern" and "hop",
             with a happy ending.

base Quill:  and a sad ending too. Lily liked to make up stories.
             One day she found a big red ball in the garden and
             she said, "I will play with my ball all day!" ...`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				It didn't refuse. It didn't fail. It <em>continued</em> — your instruction was just more text,
				and text like that is usually followed by more text like that. The requested words never appear,
				the ending is whatever falls out, and it never stops. This isn't a small model being dumb; a raw
				pretrained frontier model does exactly the same thing, just more eloquently.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Don't take the transcript's word for it. The lab below is base Quill, live — pretrained for
				a couple hundred steps on your GPU, zero instruction tuning. Ask it a question. Give it an
				order. Watch what it does with your words instead:
			</p>

			<PromptLab />

			<Callout type="note" title="The Problem">
				Pretraining optimizes "what comes next in the corpus", not "what does this human want".
				Those objectives overlap just enough to be confusing — a completer often
				<em>looks</em> like it's obeying, because almost any prompt has plausible continuations that resemble
				compliance. The gap shows up the moment you add a constraint it must actually track.
			</Callout>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				<strong style="color: var(--color-text);">Supervised fine-tuning (SFT)</strong> closes the
				gap with almost insulting simplicity: keep training, same loss, same optimizer, same
				next-token prediction — but on a corpus of (instruction → response) pairs. Nothing about the
				machinery from Part 4 changes. Only the data changes, and the data is the message: text
				where instructions are <em>followed by their answers</em> makes a model that follows instructions.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Quill's instruction corpus exists off the shelf:
				<strong style="color: var(--color-text);">TinyStories-Instruct</strong>, the
				instruction-conditioned variant of the corpus Quill grew up on. Each entry prefixes a story
				with the recipe for that story — which words it must contain, which features it should have
				(dialogue, a moral, a twist), sometimes a one-line summary to expand:
			</p>

			<CodeBlock
				title="One TinyStories-Instruct training example"
				lang="text"
				code={`Features: Dialogue, MoralValue
Words: lantern, hop, brave
Summary: A brave frog finds a lost lantern and hops through the
  dark woods to return it.
Story: Once upon a time, there was a brave little frog named Fin.
  One night, Fin found a lantern by the pond. "Someone lost this,"
  he said. He picked it up and began to hop through the dark
  woods...`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The first block is the instruction; the story is the response. Fine-tune on a few hundred
				thousand of these and Quill learns the conditional distribution: <em>given</em> this recipe, produce
				a story satisfying it. In this course the live birds get a full fine-tune — every parameter updated,
				coffee-break sized — while the flagships get the LoRA treatment from section 7.3.
			</p>

			<Callout type="tip" title="Quality beats quantity">
				SFT is not where models learn facts or grammar — that happened in pretraining. It's where
				they learn <em>format and behavior</em>: answer the question, use the constraint, stop at
				the end. Because the capability is already in the base model, a few thousand clean,
				consistent pairs routinely beat millions of sloppy ones. Frontier labs learned this the
				expensive way; you get to learn it in a browser tab.
			</Callout>
		</div>

		<div id="section-7-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={MessageSquare}
				title="7.2 Chat Templates & Loss Masking"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Under every chat interface is a rigid token format: special tokens fencing off who said
				what, a loss mask so the model learns to write answers rather than questions, and an EOS
				token so it knows when to stop. The inspector makes all three visible.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				When you chat with a frontier model, you see a conversation. The model sees one long token
				stream, formatted by a <strong style="color: var(--color-text);">chat template</strong>. The
				template is not documentation, not a UI convention — it is literal tokens in the sequence,
				and the model was trained on millions of sequences shaped exactly like it. Quill's is
				deliberately tiny:
			</p>

			<CodeBlock
				title="Quill's chat template — what the model actually sees"
				lang="text"
				code={`<|user|>
Write a story with the words "lantern" and "hop",
with a happy ending.
<|assistant|>
Once upon a time, a brave little frog found a lantern by the
pond. He picked it up and hopped all the way home. His family
cheered. The end.
<|eos|>`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The fences — <Code code="<|user|>" />, <Code code="<|assistant|>" />,
				<Code code="<|eos|>" /> — are
				<strong style="color: var(--color-text);">special tokens</strong>: single reserved IDs
				appended to the vocabulary, exactly like Rook's Elo-bucket tokens from Part 2. They are
				never produced by BPE merges, so ordinary text a user types can't accidentally (or
				deliberately) tokenize into one — the byte-level tokenizer will spell an impostor
				"&lt;|user|&gt;" out as plain characters. The fence tokens are the model's only ground truth
				about who is speaking.
			</p>

			<Callout type="warning" title="The single most-missed detail: mask the prompt loss">
				Naively, you'd compute the training loss over the whole sequence. Do that and the model
				spends a large fraction of its gradient learning to <em>generate instructions</em> — it gets
				great at writing "Words: lantern, hop" and mediocre at writing stories. Every practical SFT
				stack masks the prompt:
				<strong>loss is computed only on the response tokens</strong> (and the EOS). The prompt tokens
				still flow through the forward pass — the model conditions on them — they just contribute nothing
				to the loss.
			</Callout>

			<CodeBlock
				title="Prompt-loss masking, token by token"
				lang="text"
				code={`tokens:  <|user|> Write a story ... <|assistant|> Once upon a ... <|eos|>
mask:       0       0    0   0    0        0          1    1    1  1     1

loss = −(1/N_response) · sum over tokens where mask = 1 of
         log p(token_t | all tokens before t)

mask = 0  →  model reads it, conditions on it, learns nothing from it
mask = 1  →  this is the behavior we are paying gradient for`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Notice what's inside the mask: the <Code code="<|eos|>" /> token. That one masked-in token is
				how the model learns to <em>stop</em>. Base Quill rambles until you cut it off, because
				nothing in a pretraining stream ever says "done". After SFT, the model has been trained to
				emit <Code code="<|eos|>" /> when the story completes, and the sampler halts when it sees it.
				Stopping is learned behavior, and it's learned from exactly one token per example.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				When this chapter's lab lands, the token-stream inspector — the same one that showed you
				per-token loss in Part 4 — gains a mask overlay: prompt tokens greyed out, response tokens
				lit, so you can <em>see</em> where the gradient flows in a real training batch.
			</p>

			<Callout type="tip" title="Template mismatch is a real production bug">
				The template used at inference must match the one used in training, byte for byte. A missing
				newline after <Code code="<|assistant|>" /> puts every inference query slightly off the training
				distribution — the model still answers, just measurably worse, and nothing errors. Whole GitHub
				issues full of "fine-tune seems dumb" trace back to this. When something feels off, diff the token
				streams, not the strings.
			</Callout>

			<VibeBox
				prompts={[
					'Show me the exact token IDs of Quill’s chat template, fences included',
					'What would go wrong if we also computed loss on the prompt tokens? Be concrete'
				]}
			/>
		</div>

		<div id="section-7-3" class="mb-14">
			<SectionHeader level="section" icon={Feather} title="7.3 LoRA" color="var(--color-primary)" />
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Instead of updating millions of weights, freeze them and train two thin matrices per layer.
				LoRA is how the flagship birds get fine-tuned inside your browser — and toggling the adapter
				off instantly recovers the original model, a trick later chapters lean on hard.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Full fine-tuning is expensive in a way that has little to do with the forward pass. Every
				trainable parameter drags company along: a gradient, plus two Adam moment estimates —
				roughly three extra floats per weight. For the live 5M birds, fine. For a 25M flagship
				inside a browser tab's memory budget, that overhead is the difference between "runs" and
				"doesn't".
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				<strong style="color: var(--color-text);">LoRA — Low-Rank Adaptation</strong> — starts from
				an empirical observation: the <em>change</em> a fine-tune makes to a weight matrix is approximately
				low-rank. So don't learn the change as a full matrix; parametrize it as a product of two thin
				ones and learn those:
			</p>

			<LoraBypass />

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Now make it physical. Drag the rank and watch the adapter blocks — and the parameter bill —
				shrink against the frozen slab; then flip to the merged view to see why serving a LoRA costs
				nothing extra:
			</p>

			<LoraLab />

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Concretely: a <Code code="512×512" /> attention projection holds 262,144 weights. A rank-8 adapter
				beside it holds <Code code="512·8 + 8·512 = 8,192" /> — about 3% of that layer, and since adapters
				typically attach only to the attention projections, the trainable total lands around
				<strong style="color: var(--color-text);">0.1–1% of the model</strong>. Optimizer state
				shrinks by the same factor. That's what makes flagship fine-tuning fit in a tab.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The zero-initialization of <Code code="B" /> is the elegant part. At step 0 the bypass contributes
				<Code code="B(A·x) = 0" />, so the adapted model <em>is</em> the pretrained model, exactly — training
				starts from known-good behavior instead of a random perturbation of it. But zero-init has a sneaky
				consequence that bites real engineers:
			</p>

			<CodeBlock
				title="The zero-init consequence, via the chain rule"
				lang="text"
				code={`at step 0:  B = 0

forward:    h = W·x + (α/r)·B(A·x) = W·x          ← pretrained, exactly
backward:   grad(B) ∝ (A·x)                        ← nonzero: B learns
            grad(A) ∝ Bᵀ·(…) = 0                   ← EXACTLY zero

A's gradient flows through B. While B is zero, A cannot move.
After one optimizer step B is nonzero, and A wakes up at step 1.`}
			/>

			<Callout type="warning" title="Field report: the zero-gradient scare">
				While benchmarking this course's own training engine, a LoRA probe showed exactly-zero
				adapter gradients — for a bad hour it looked like a broken WebGPU autodiff. It wasn't. One
				cause was precisely the math above (zero-init output projections make upstream grads
				mathematically zero at step 0); the others were a frozen zero-init base and a degenerate
				test input that zeroed the softmax backward. The autodiff was correct the whole time. When
				you see zero gradients, check your <em>initialization story</em> before you blame the framework
				— "exactly zero" is a structural clue, "small and noisy" is a numerical one.
			</Callout>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Because the base stays frozen, adapters
				<strong style="color: var(--color-text);">swap like cartridges</strong>. Each post-training
				stage of the flagships ships as a small adapter file — under a megabyte — against one shared
				base: slot in the instruct adapter, the preference adapter from Part 9, or nothing at all.
				And "nothing at all" is itself load-bearing:
				<strong style="color: var(--color-text);">adapter-off is the frozen reference model</strong
				>. Parts 9 and 10 need a pristine copy of the pre-alignment model to compare against and to
				anchor a KL penalty to — with LoRA, that copy costs zero extra memory. Flip the adapter off
				and you're looking at the reference.
			</p>

			<Callout type="note" title="What LoRA does not save">
				LoRA shrinks <em>trainable parameters and optimizer state</em> — not compute. The forward and
				backward passes still traverse the full frozen model, and activation memory still scales with
				sequence length and batch size. That's why the in-browser flagship fine-tune runs at short sequence
				lengths with small batches. "Cheap to train" here means cheap in memory and state, not cheap in
				FLOPs.
			</Callout>
		</div>

		<div id="section-7-4" class="mb-14">
			<SectionHeader
				level="section"
				icon={SlidersHorizontal}
				title="7.4 Conditioning vs Fine-Tuning"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Two ways to make Rook play stronger: fine-tune it on elite games, or just prepend a high-Elo
				token and ask. Comparing them side by side makes a deep distinction visceral — changing the
				weights versus changing the prompt.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Rook's cameo this chapter is a controlled experiment you rarely get to run this cleanly.
				Recall from Part 2 that every game in Rook's corpus begins with an
				<strong style="color: var(--color-text);">Elo-bucket token</strong> — the rating band of the players.
				Pretraining on labeled games taught Rook a family of conditional distributions: how 1200s play,
				how 2200s play, selected by one token:
			</p>

			<CodeBlock
				title="One model, two openings — the only difference is token #1"
				lang="text"
				code={`<|elo:1200|> e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 ...   club-player chess
<|elo:2200|> e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f4d4 ...   expert chess

Same weights. Same forward pass. The conditioning token steers which
part of the learned distribution generates the game.`}
			/>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The alternative is what this chapter is about: take pretrained Rook and
				<strong style="color: var(--color-text);">fine-tune it on elite games only</strong>. Both
				produce a stronger player. But they are doing fundamentally different things, and the
				side-by-side makes it visible:
			</p>

			<ul
				class="mb-4 list-inside list-disc space-y-1.5 text-[14px]"
				style="color: var(--color-text-secondary);"
			>
				<li>
					<strong style="color: var(--color-text);">Conditioning selects.</strong> The 2200-token points
					at behavior the corpus already contains. Flip the token back to 1200 and weak play returns intact
					— nothing was lost, because nothing was changed. But conditioning has a hard ceiling: it cannot
					summon play stronger than the strongest games the corpus showed at that label.
				</li>
				<li>
					<strong style="color: var(--color-text);">Fine-tuning moves.</strong> After elite-only
					SFT, expert play is the <em>default</em> — no token needed. But the distribution shifted: the
					model's grip on weak, weird, human chess fades. You gained a specialist and quietly paid for
					it with range.
				</li>
			</ul>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				This is the distinction hiding inside every "prompt engineering vs fine-tuning" debate. A
				system prompt — "you are an expert programmer" — is an Elo token with more words: it steers
				the model toward a region of behavior pretraining already covered. SFT moves the whole
				distribution to live in that region. Prompting is reversible, cheap, and bounded by what's
				already in there; fine-tuning is powerful, persistent, and pays a tax you'll measure in the
				next section.
			</p>

			<Callout type="tip" title="Why base models seemed to follow instructions in 2020">
				Before instruct-tuning existed, people prompted raw GPT-3 with a few examples of a task and
				it "just worked". Now you can name what that was: conditioning. The few-shot examples were a
				soft Elo token — they selected task-shaped behavior already present in a corpus that
				contains Q&amp;A pages, exams, and tutorials. SFT didn't create instruction following so
				much as make it the default, no conditioning required.
			</Callout>
		</div>

		<div id="section-7-5" class="mb-8">
			<SectionHeader
				level="section"
				icon={ArrowLeftRight}
				title="7.5 Before & After"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Every stage boundary in this course ends the same way: the same prompts, the same positions,
				before and after. Here it's the first one — base Quill versus instruct Quill — plus an
				honest look at what fine-tuning quietly made worse.
			</p>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				The ritual is fixed for the rest of the course: a frozen set of prompts for Quill, a frozen
				set of positions for Rook, run through the model before the stage and after it. Not cherry
				picks — the <em>same</em> set every time, chosen before you saw the results. For this first boundary,
				three things should jump out:
			</p>

			<ul
				class="mb-4 list-inside list-disc space-y-1.5 text-[14px]"
				style="color: var(--color-text-secondary);"
			>
				<li>
					<strong style="color: var(--color-text);">Constraints bind now.</strong> Ask for "lantern" and
					"hop" and both words appear. Ask for a moral and one shows up at the end, in TinyStories' earnest
					house style.
				</li>
				<li>
					<strong style="color: var(--color-text);">It stops.</strong> Instruct Quill ends its story
					and emits <Code code="<|eos|>" />. Base Quill runs until the token budget cuts it off
					mid-sentence. One masked-in token, visible behavior change.
				</li>
				<li>
					<strong style="color: var(--color-text);">It answers instead of continues.</strong> The instruction
					is treated as a request, not as the opening line of a story about someone named Write.
				</li>
			</ul>

			<p class="mb-4 text-[14px] leading-relaxed" style="color: var(--color-text-secondary);">
				Now the honest column. Evaluate instruct Quill on a held-out slice of the
				<em>pretraining</em> mix — plain stories, no instruction scaffolding — and its loss is higher
				than base Quill's. Not catastrophically; measurably. The distribution moved toward instruction-shaped
				text, and raw story-continuation, the thing pretraining perfected, drifted slightly out of focus.
				Sampled stories also get a touch more uniform: the fine-tune's house style smooths over some of
				the base model's variety.
			</p>

			<Callout type="note" title="The alignment tax, in miniature">
				This trade has a name at frontier scale: the alignment tax. Every post-training stage buys a
				behavior — instruction following now, preference alignment in Part 9 — and pays for it
				somewhere in the base distribution. Labs measure the tax on benchmark suites; you just
				measured it on a held-out loss. The pattern repeats at every stage boundary from here on,
				which is exactly why the before/after ritual exists: never let a stage tell you only what it
				improved.
			</Callout>

			<VibeBox
				prompts={[
					'Run the before/after prompt set and highlight which constraints each model satisfied',
					'Why did instruct-Quill’s loss on plain stories go up if SFT is just more training?'
				]}
			/>
		</div>
	</div>
</section>
