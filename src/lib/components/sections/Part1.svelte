<script lang="ts">
	import { Egg, Bird, Database, Filter } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import MermaidDiagram from '../ui/MermaidDiagram.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
</script>

<section id="part-1" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader icon={Egg} partLabel="Part 1" title="Hatch" color="var(--color-primary)" />

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			The course opens with the two models already alive: prompt Quill for a story, play a game
			against Rook — then scrub them both back to random weights and watch every trace of skill
			drain away. Everything that follows is about putting it back, and it starts where every model
			starts: with the data.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-1-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Bird}
				title="1.1 Meet Quill & Rook"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Two birds, one architecture: Quill writes children's stories, Rook plays chess, and both are
				nothing but next-token predictors over different streams. You'll meet the live pair you'll
				train yourself, their larger flagship siblings, and the scrubber that rewinds either one to
				the moment before it knew anything.
			</p>

			<div class="mb-6 grid gap-3 sm:grid-cols-2">
				<div class="rounded-lg p-4" style="background: var(--color-note-bg);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-note);">
						Quill — the storyteller
					</p>
					<p class="text-xs leading-relaxed" style="color: var(--color-text-secondary);">
						A quill is a feather. Quill reads children's stories and learns to continue them, one
						token at a time. Give it "Once upon a time, there was a little robot" and it predicts
						what comes next — and then what comes after that, and after that, until a story exists
						that no one wrote.
					</p>
				</div>
				<div class="rounded-lg p-4" style="background: var(--color-tip-bg);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-tip);">
						Rook — the chess player
					</p>
					<p class="text-xs leading-relaxed" style="color: var(--color-text-secondary);">
						A rook is a corvid — a very clever bird. Rook reads chess games as sequences of moves
						and learns to continue them. Give it the moves so far and it predicts the next one.
						Nobody tells it the rules of chess. Whether it figures them out anyway is one of the
						best questions in this course (Part 6).
					</p>
				</div>
			</div>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Here is the thesis of the entire course, stated once and then demonstrated for thirteen
				chapters: <strong style="color: var(--color-text);"
					>a language model is a next-token predictor over a stream of tokens, and it does not care
					what the tokens mean.</strong
				> Feed the same architecture a stream of story text and it becomes a storyteller. Feed it a stream
				of chess moves and it becomes a chess player. Same code, same training loop, same loss function
				— different world. Every time a concept in this course feels abstract for one bird, the other
				bird makes it concrete. That's why there are two.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The road both birds travel
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Every modern LLM you've used — the chatbots, the coding assistants — was raised through
				roughly the same stages. You will walk Quill and Rook through all of them, and each stage
				gets its own act of the course:
			</p>

			<MermaidDiagram
				definition={`graph LR
  A(["Raw corpus"]) --> B(["Tokens"])
  B --> C(["Pretraining"])
  C --> D(["SFT"])
  D --> E(["Preference tuning"])
  E --> F(["RLVR"])
  F --> G(["Quill & Rook, raised"])`}
				id="course-lifecycle"
			/>

			<ul
				class="mt-4 mb-5 list-inside list-disc space-y-1.5 text-[13px]"
				style="color: var(--color-text-secondary);"
			>
				<li>
					<strong style="color: var(--color-text);">Pretraining</strong> (Parts 2–6) — the model reads
					the corpus and learns to predict the next token. This is where almost all of its ability comes
					from, and almost all of the compute goes.
				</li>
				<li>
					<strong style="color: var(--color-text);">Supervised fine-tuning</strong> (Part 7) — teach the
					pretrained predictor to follow instructions instead of just continuing text.
				</li>
				<li>
					<strong style="color: var(--color-text);">Preference tuning</strong> (Parts 9–10) — you personally
					rate its outputs, and your clicks become a training signal. Then you watch that signal get gamed.
				</li>
				<li>
					<strong style="color: var(--color-text);">Verifiable rewards</strong> (Part 11) — replace human
					taste with a checker that can't be argued with (did Rook's move win? did Quill's story include
					the required word?) and let reinforcement learning push against it.
				</li>
			</ul>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Three sizes of bird
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				You'll actually meet each bird at more than one size, because "train it live in a browser
				tab" and "impressive output" pull in opposite directions:
			</p>

			<div class="my-4 overflow-hidden rounded-lg" style="background: var(--color-bg-secondary);">
				<table class="w-full text-[13px]">
					<thead>
						<tr style="background: var(--color-bg-tertiary);">
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Tier</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Size</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Who trains it</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Role</th
							>
						</tr>
					</thead>
					<tbody style="color: var(--color-text-secondary);">
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2 font-medium" style="color: var(--color-text);">Hatchlings</td>
							<td class="px-4 py-2">under ~2M params</td>
							<td class="px-4 py-2">You, live, in seconds-to-minutes</td>
							<td class="px-4 py-2">Per-lesson minis for single ideas</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2 font-medium" style="color: var(--color-text);">The live pair</td>
							<td class="px-4 py-2">a few million params</td>
							<td class="px-4 py-2">You, live, over a coffee break</td>
							<td class="px-4 py-2">The Quill &amp; Rook you raise at every stage</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2 font-medium" style="color: var(--color-text);">Flagships</td>
							<td class="px-4 py-2">~15–25M params</td>
							<td class="px-4 py-2">Trained offline for days; you download them</td>
							<td class="px-4 py-2">The impressive pair, with scrubbable history</td>
						</tr>
					</tbody>
				</table>
			</div>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The flagships come with their whole training history saved as checkpoints, which powers the
				course's favorite instrument: the <strong style="color: var(--color-text);"
					>time machine</strong
				>. Drag a slider and the model rewinds — from fluent, back through broken grammar, back
				through word soup, back to the uniform static of random weights. Every scrap of skill a
				model has lives in its parameters, and the scrubber lets you watch those parameters mean
				less and less until they mean nothing.
			</p>

			<Callout type="tip" title="Why tiny models?">
				Frontier models have hundreds of billions of parameters; Quill and Rook have a few million.
				What makes them worth raising is that <em>nothing conceptual is missing</em>: tokenizer,
				transformer, pretraining, fine-tuning, preference learning, reinforcement learning — the
				full modern pipeline, small enough to run on your GPU, in your browser, with no account and
				no cloud. Where scale genuinely changes the story, the course says so out loud (Part 14 is
				entirely about that).
			</Callout>

			<VibeBox
				prompts={[
					'Why does the course train two models instead of one bigger one?',
					'What exactly is stored in a model’s weights before any training happens?'
				]}
			/>
		</div>

		<div id="section-1-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Database}
				title="1.2 The Corpora"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				A corpus is the complete diet of a model: every token it will ever learn from, gathered into
				one big pile before training starts. The model gets no dictionary, no grammar book, no rules
				of chess — only the stream. Whatever isn't in the corpus, the model will never know.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Quill's diet: 3,000 tiny stories
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Quill's corpus is a 3,000-story slice of <strong style="color: var(--color-text);"
					>TinyStories</strong
				>
				— a dataset of children's stories written to use only a small vocabulary, the words a young child
				would understand. That constraint is the whole trick: with a small world of words, a small model
				can actually master the language instead of drowning in it. The slice is about 2.6&nbsp;MB of
				plain text. Here is its very first story, exactly as Quill will see it:
			</p>

			<CodeBlock
				title="quill-corpus.txt — the first story in the slice"
				lang="text"
				code={`One day, a little girl named Lily found a needle in her room.
She knew it was difficult to play with it because it was sharp.
Lily wanted to share the needle with her mom, so she could sew
a button on her shirt.`}
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Read a few of these and you'll notice the pattern: simple sentences, concrete nouns, a small
				cast of Lilys and Toms and talking animals, a gentle lesson at the end. Three thousand of
				them add up to roughly a million tokens of training data — a rounding error by frontier
				standards, and exactly enough for a few-million-parameter bird.
			</p>

			<Callout type="note" title="Attribution">
				TinyStories was created by Ronen Eldan and Yuanzhi Li (2023) and is shared under the
				CDLA-Sharing-1.0 license. It's a small marvel of dataset design, and Part 8 has a secret to
				tell you about it.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Rook's diet: 6,000 games of legal nonsense
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Rook's corpus is 6,000 chess games, up to 60 half-moves each, recorded as sequences of moves
				in coordinate notation. And here's the twist: they are <strong
					style="color: var(--color-text);">random-legal games</strong
				>. Each move was chosen by a random number generator picking uniformly among the legal moves
				in the position. No grandmasters, no strategy, no plans — just the rules of chess, rolled
				like dice, sixty times per game. Here's the opening of the first game in the corpus:
			</p>

			<CodeBlock
				title="rook-tokens — the first game, decoded"
				lang="text"
				code={`<game> a2a3 b8a6 g1h3 g7g6 d2d4 c7c5 f2f4 f8h6 g2g3 g6g5 ...`}
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				White opens with the timid pawn push <Code code="a2a3" />; Black replies by developing a
				knight to the edge of the board, where knights famously don't belong. No chess teacher would
				approve of a single move here. Every move is legal; almost none of them are good.
			</p>

			<Callout type="important" title="The randomness is the point">
				Training on random-legal games is a deliberate experimental choice, borrowed from a famous
				interpretability study on the game Othello. Because the games contain <em>zero strategy</em
				>, anything Rook learns beyond noise must be about the <em>rules and the board itself</em> — which
				pieces exist, where they stand, what they may legally do. In Part 6 we'll open Rook's head and
				look for that board directly. If we'd trained on strong human games, we could never separate "understands
				the position" from "memorized what strong players do." Purity now, payoff later.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The two corpora, side by side
			</h4>

			<div class="mb-6 grid gap-3 sm:grid-cols-2">
				<div class="rounded-lg p-4" style="background: var(--color-note-bg);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-note);">
						Quill's corpus
					</p>
					<p class="text-xs leading-relaxed" style="color: var(--color-text-secondary);">
						3,000 stories · ~2.6 MB of text · ~1.1 million tokens once tokenized (Part 2 explains
						how). Natural language: ambiguous, redundant, full of structure at every distance.
					</p>
				</div>
				<div class="rounded-lg p-4" style="background: var(--color-tip-bg);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-tip);">
						Rook's corpus
					</p>
					<p class="text-xs leading-relaxed" style="color: var(--color-text-secondary);">
						6,000 games · ~60 moves each · ~364,000 tokens. A formal language: every "sentence" is
						machine-verified legal, and the grammar is the rules of chess.
					</p>
				</div>
			</div>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				For perspective: frontier models pretrain on <em>trillions</em> of tokens scraped from the
				web, books, and code — a pile roughly ten million times larger than Quill's. The pipeline
				you are about to walk through is the same one those teams run; only the exponents change.
				And at every scale, the first law of machine learning holds:
				<strong style="color: var(--color-text);">the model becomes its data</strong>. Quill will
				write like TinyStories because that's all it has ever read. Rook will play legal-but-aimless
				chess because that's all it has ever seen. Remember this when a later chapter asks you to
				fix a model's behavior — the first place to look is always the data.
			</p>

			<VibeBox
				prompts={[
					'Show me a few more stories from Quill’s corpus and point out the patterns',
					'If Rook only ever sees random moves, what CAN it possibly learn?'
				]}
			/>
		</div>

		<div id="section-1-3" class="mb-8">
			<SectionHeader
				level="section"
				icon={Filter}
				title="1.3 Cleaning & Dedup"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Raw corpora arrive full of junk, and duplicates quietly teach a model to recite instead of
				generalize. Cleaning and deduplication get treated as first-class ideas here — and the favor
				gets repaid in Part 4, when you watch a model memorize a story it saw too many times.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Our two slices arrive clean, because they were built that way: TinyStories was written under
				tight constraints, and Rook's games were generated by a rules engine that cannot produce an
				illegal move. Enjoy it — it's the last time data will be this easy. Real-world corpora are
				scraped from the web, and the web is a landfill with some libraries in it.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Cleaning: deciding what counts as food
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				A raw web scrape contains navigation menus repeated on every page of a site, cookie banners,
				SEO keyword sludge, broken text encodings, auto-generated boilerplate, other languages than
				the ones you're targeting, personal information that must not be learned, and text so
				garbled no one could learn from it. Frontier teams spend enormous effort — arguably their
				most closely guarded effort — on filters that decide, token by token, what a model gets to
				eat. Every choice shapes the model: filter too little and it learns junk; filter too
				aggressively and you delete the diversity that makes it robust.
			</p>

			<Callout type="tip" title="Data work is model work">
				It's tempting to treat data preparation as janitorial work before the "real" machine
				learning starts. The field learned otherwise: at a fixed size and compute budget, data
				quality is one of the strongest levers on final model ability. TinyStories itself is the
				proof you'll be holding all course long — a dataset designed so carefully that
				million-parameter models trained on it speak in coherent paragraphs.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Deduplication: why seeing it twice is worse than it sounds
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Suppose one story appears in the corpus fifty times — the web is full of mirrored and
				re-posted text, so at scale this is the norm, not the exception. Training rewards the model
				for predicting the next token well. For forty-nine of those fifty encounters, there is a
				strategy that predicts every token perfectly: <strong style="color: var(--color-text);"
					>remember the whole story and recite it</strong
				>. Memorization is the lowest-loss move, so the optimizer takes it. The parameters that
				could have learned reusable patterns — grammar, plot shapes, how needles behave — get spent
				storing one specific text verbatim.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The damage comes in three flavors: wasted capacity (a copy is stored instead of a
				generalization), skewed behavior (the model regurgitates the duplicated text at the
				slightest prompt), and leaked data (if the duplicate contained something private, the model
				can now be coaxed into repeating it). In Part 4, once you can read training curves, you'll
				run the demo: a corpus with one story duplicated many times, and a model that dutifully
				becomes a parrot for exactly that story while staying mediocre at everything else.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Exact copies and near copies
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Catching byte-identical copies is easy — hash every document, drop the collisions. The hard
				cases are <em>near</em> duplicates: the same article with a different headline, the same
				story with one name changed, the same code with different whitespace. Production pipelines
				fingerprint documents by the sets of short word-chunks they contain and drop pairs whose
				fingerprints overlap too much — near-copies caught without comparing every document to every
				other. The same machinery has a second job you'll meet in Part 5:
				<strong style="color: var(--color-text);">decontamination</strong> — making sure the test questions
				you'll grade the model on aren't sitting in its training data. A model that has already read the
				exam is not "smart," and a benchmark it has memorized measures nothing.
			</p>

			<Callout type="warning" title="A debt Part 4 will collect">
				Keep this chapter's claim in mind: <em>duplicates cause memorization</em>. It's stated here
				as a rule; in Part 4 you'll watch it happen live, on a training curve, with a story a model
				saw too many times. Course-wide pattern: every rule we assert, we eventually make you watch.
			</Callout>

			<VibeBox
				prompts={[
					'What kinds of junk would a raw web scrape add to a corpus like Quill’s?',
					'Why is near-duplicate detection harder than exact-duplicate detection?'
				]}
			/>
		</div>
	</div>
</section>
