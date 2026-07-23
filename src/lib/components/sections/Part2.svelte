<script lang="ts">
	import { Binary, HelpCircle, Combine, LayoutGrid, Search } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import MermaidDiagram from '../ui/MermaidDiagram.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
	import TokenizerDemo from '../lab/TokenizerDemo.svelte';
</script>

<section id="part-2" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader icon={Binary} partLabel="Part 2" title="Tokens" color="var(--color-primary)" />

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			A language model never sees letters, words, or chessboards — it sees a stream of integers.
			This chapter is about the machinery that turns the world into that stream: one vocabulary
			learned from data, one designed by hand, and the inspector you'll use to look at token streams
			for the rest of the course.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter is already partly live: the tokenizer box in 2.2 runs Quill's real vocabulary in
			your browser. The full token-stream inspector arrives with a later milestone.
		</Callout>

		<div id="section-2-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={HelpCircle}
				title="2.1 Why Tokens"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Characters make sequences too long, whole words can't cover everything a human might type —
				tokens are the compromise every modern model lives with. Here's why the choice matters more
				than it looks, and why your emoji is about to become four strange tokens.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Start from the constraint: a neural network eats numbers. Specifically, it has a fixed menu
				— a <strong style="color: var(--color-text);">vocabulary</strong> — and every input must be
				expressed as a sequence of IDs from that menu. Quill's menu has 512 entries; a frontier
				model's has one or two hundred thousand. Either way the menu is frozen before training
				begins, and everything the model ever reads or writes passes through it. So the real design
				question is: <em>what should one entry on the menu stand for?</em>
			</p>

			<div class="mb-6 grid gap-3 sm:grid-cols-3">
				<div class="rounded-lg p-4" style="background: var(--color-caution-bg);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-caution);">
						One character per token?
					</p>
					<p class="text-xs leading-relaxed" style="color: var(--color-text-secondary);">
						Nothing is ever out of vocabulary — but sequences get brutally long. A 1,000-character
						story becomes 1,000 steps of prediction, and attention's cost grows with the square of
						sequence length. The model spends its capacity spelling instead of thinking.
					</p>
				</div>
				<div class="rounded-lg p-4" style="background: var(--color-caution-bg);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-caution);">
						One word per token?
					</p>
					<p class="text-xs leading-relaxed" style="color: var(--color-text-secondary);">
						Compact — but no finite word list covers what humans type. Typos, names, new slang,
						"needleish", 🦉: each one is an out-of-vocabulary wall, and the model has literally no
						ID to represent what it just saw.
					</p>
				</div>
				<div class="rounded-lg p-4" style="background: var(--color-tip-bg);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-tip);">
						Subword tokens
					</p>
					<p class="text-xs leading-relaxed" style="color: var(--color-text-secondary);">
						The compromise: common chunks ("the ", "look", "ed ") get their own IDs, rare stuff
						falls back to smaller pieces, worst case single bytes. Short sequences for common text,
						a guaranteed spelling for everything else.
					</p>
				</div>
			</div>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Quill's tokenizer is <strong style="color: var(--color-text);">byte-level</strong>: its
				atoms are not characters but the 256 possible bytes of UTF-8. That guarantee is airtight —
				any text on Earth is a byte sequence, so nothing can ever be unrepresentable. The cost shows
				up with characters that UTF-8 spells with several bytes. An owl emoji is four bytes, so if
				no merge covers it, 🦉 enters the model as four tokens that individually mean nothing:
			</p>

			<CodeBlock
				title="One emoji, four byte tokens"
				lang="text"
				code={`"🦉"  →  UTF-8 bytes  240 159 166 137  →  4 tokens`}
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				This is why tokenization is worth a whole chapter: it silently shapes what a model finds
				easy or hard. Questions like "why are LLMs bad at counting letters?" or "why does it handle
				English better than my language?" are usually tokenizer questions wearing a model costume.
				The model never sees your letters — it sees the chunks its vocabulary happened to make.
			</p>

			<VibeBox
				prompts={[
					'Why can’t we just grow the vocabulary whenever a new word shows up?',
					'How does tokenization explain LLMs being bad at spelling games?'
				]}
			/>
		</div>

		<div id="section-2-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Combine}
				title="2.2 Train a BPE Live"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Byte-pair encoding is simple enough to watch happen: start from raw bytes, repeatedly merge
				the most frequent pair, and a vocabulary grows in front of you — "th", then "the", then
				whole words. The box below runs Quill's actual tokenizer — byte-level BPE with 512
				tokens, trained on the same TinyStories slice Quill pretrains on in Part 5.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The algorithm fits in five lines, and none of them contain machine learning — BPE is pure
				counting:
			</p>

			<CodeBlock
				title="Byte-pair encoding, the whole algorithm"
				lang="text"
				code={`vocab = the 256 possible bytes            # tokens 0..255
while vocab is smaller than the target:
    count every adjacent pair of tokens in the corpus
    (a, b) = the most frequent pair
    add a new token meaning "a followed by b"
    replace every occurrence of a,b in the corpus with it`}
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Each merge invents one new token, so the vocabulary is a perfect fossil record of the
				corpus's statistics. Quill's vocabulary is 512 tokens: the 256 bytes plus 256 merges learned
				from the story slice. And the actual merge list is full of personality. The very first merge
				— the most frequent byte pair in all of TinyStories — is not "th". It's
				<Code code="e" /> followed by a space: word-final "e" is that common in English. "th" arrives
				as merge number three, and by merge thirteen the pieces snap together into the most common word
				in the language:
			</p>

			<MermaidDiagram
				definition={`graph BT
  t["byte 116 · t"] --> th["token 258 · th (merge 3)"]
  h["byte 104 · h"] --> th
  e["byte 101 · e"] --> e_["token 256 · e‿ (merge 1)"]
  sp["byte 32 · space"] --> e_
  th --> the["token 268 · the‿ (merge 13)"]
  e_ --> the`}
				id="bpe-merge-tree"
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				(The ‿ marks a trailing space — merges happily cross the letter/space boundary, which is
				why so many tokens carry their following space along.) Later merges climb from fragments to
				whole words: by the end of training, Quill's vocabulary contains
				<Code code="looked " />, <Code code="would " />, and — fittingly for TinyStories — token 511,
				the final merge, is <Code code="day " />. Nobody chose those words. The corpus did.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Now try it. This is not a mock-up: the box below loads Quill's real 512-token vocabulary and
				tokenizes as you type.
			</p>

			<TokenizerDemo />

			<Callout type="tip" title="Things worth typing">
				A sentence in TinyStories style ("Once upon a time…") tokenizes into big, satisfying chunks.
				Now try a word the corpus never taught it — "photosynthesis" — and watch it shatter into
				byte-sized gravel. Try an emoji: four opaque byte tokens, exactly as promised. The
				compression ratio under the box is the tokenizer's report card: on its own training slice,
				Quill's BPE averages 2.34 characters per token.
			</Callout>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				That ratio is the payoff of the whole exercise: the 2.6&nbsp;MB story slice becomes roughly
				1.1 million tokens instead of 2.6 million byte-steps — the same text in less than half the
				sequence length, which means less than half the prediction steps and a context window that
				holds more than twice the story. Frontier tokenizers play the identical game with bigger
				budgets: tens of thousands of merges instead of 256, trained on terabytes instead of
				megabytes, averaging around four characters per token. Same algorithm. Same counting loop.
			</p>

			<VibeBox
				prompts={[
					'Walk me through how "Once upon a time" gets encoded, merge by merge',
					'Why does BPE learn tokens with the space attached, like "the "?'
				]}
			/>
		</div>

		<div id="section-2-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={LayoutGrid}
				title="2.3 Rook's Designed Vocabulary"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Rook's vocabulary was never learned — it was designed: one token per chess move, plus a
				separator between games. Learned versus designed vocabularies is this chapter's real thesis
				— and the panel below settles why not characters, and why not board diagrams.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Chess moves have a standard coordinate notation called UCI: source square, destination
				square, and a letter for promotions. <Code code="e2e4" /> pushes the king's pawn;
				<Code code="e7e8q" /> promotes a pawn to a queen. Rook's vocabulary assigns
				<strong style="color: var(--color-text);">one token to each distinct move</strong> — no
				merging, no counting, no training. Across Rook's 6,000-game corpus, 1,930 distinct UCI moves
				actually occur; add one separator token, <Code code="<game>" />, that marks where one game
				ends and the next begins, and you get Rook's entire menu: 1,931 tokens, written down by hand
				before the model ever saw a game.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Why design instead of learn? Because in chess, unlike English, <em>we already know the
				units</em>. Language has no clean atomic unit — words blur into morphemes, spellings vary,
				vocabulary is open-ended — so we let BPE discover units statistically. Chess has a perfect
				unit handed to us by the rules: the move. When the domain gives you natural atoms, take
				them. When it doesn't, learn them. That's the whole design space of tokenization in two
				sentences.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Why not characters? Why not FEN?
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Two alternatives were on the table, and rejecting them teaches more than the choice itself.
				Here's the same three-move opening in all three encodings:
			</p>

			<CodeBlock
				title="Three ways to feed chess to a model"
				lang="text"
				code={`As UCI move tokens (Rook's way):        3 tokens
  [e2e4] [e7e5] [g1f3]

As characters:                          14 tokens
  [e][2][e][4][ ][e][7][e][5][ ][g][1][f][3]

As FEN, the position after those moves: ~60 characters, and the
board state is handed over on a plate:
  rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2`}
			/>

			<div class="mb-6 grid gap-3 sm:grid-cols-2">
				<div class="rounded-lg p-4" style="background: var(--color-caution-bg);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-caution);">
						Characters: shredded meaning
					</p>
					<p class="text-xs leading-relaxed" style="color: var(--color-text-secondary);">
						Sequences run three to five times longer, and the natural unit is destroyed: the model
						must first learn that <Code code="e" />, <Code code="2" />, <Code code="e" />,
						<Code code="4" /> form one action before it can learn anything about the action. All
						cost, no benefit — chess has no "rare words" needing byte fallback.
					</p>
				</div>
				<div class="rounded-lg p-4" style="background: var(--color-caution-bg);">
					<p class="mb-1 text-[13px] font-semibold" style="color: var(--color-caution);">
						FEN: the answer key in the question
					</p>
					<p class="text-xs leading-relaxed" style="color: var(--color-text-secondary);">
						FEN spells out the full board every step — so the model never needs to <em>infer</em> the
						board. Part 6's entire experiment is asking whether Rook builds an internal board from
						moves alone. Feed it FEN and the experiment evaporates: you can't discover a world model
						in a model you spoon-fed the world.
					</p>
				</div>
			</div>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Move tokens have one more gift for us: every token is a complete, meaningful action, so
				every position in the stream corresponds to a full board state. When Part 6 goes probing
				Rook's residual stream for a board, and when attention maps get drawn as arrows between
				moves in Part 3, that clean one-token-one-move grid is what makes the pictures legible.
			</p>

			<Callout type="note" title="Vocabulary as a control surface">
				A designed vocabulary can smuggle in information a learned one can't. The flagship Rook's
				vocabulary adds a few extra designed tokens: <em>Elo-bucket tags</em> that mark the strength
				of the players in each game. Prefix a game with a strength tag at generation time and you can
				ask the same model to play weaker or stronger. That trick — conditioning versus fine-tuning —
				is a Part 7 lesson, but the groundwork is being laid right here, in the token menu.
			</Callout>

			<VibeBox
				prompts={[
					'What would break if we trained BPE on chess games instead of using move tokens?',
					'Why does giving Rook the board in FEN ruin the Part 6 experiment?'
				]}
			/>
		</div>

		<div id="section-2-4" class="mb-8">
			<SectionHeader
				level="section"
				icon={Search}
				title="2.4 The Token-Stream Inspector"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The course's universal instrument makes its debut: paste anything, see exactly what the
				model sees, token by token — including a per-token surprise heatmap. It will come back to
				teach perplexity, pretraining progress, and loss masking in later chapters.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				You've already used its first slice: the tokenizer box in 2.2 shows text as a row of token
				chips. The full inspector adds the layer that makes it an instrument rather than a viewer —
				<strong style="color: var(--color-text);">what the model thought</strong> at every position.
				A trained model assigns a probability to each token before revealing it; from that
				probability comes a number worth internalizing now:
			</p>

			<CodeBlock
				title="Per-token surprise"
				lang="text"
				code={`surprise(token) = -log p(token | everything before it)

model was sure and right   →  p near 1  →  surprise near 0
model was unsure           →  p small   →  surprise large`}
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Paint each token's background by its surprise and a text becomes a heatmap: cool where the
				model coasted, hot where it was caught off guard. On a well-trained Quill, "Once upon a" is
				ice cold — <Code code="time" /> is nearly free — while the name of a brand-new character
				burns hot, because no model could have guessed "Marisol" from a cold start. The heatmap is a
				direct visualization of the training loss itself, token by token: the number training pushes
				down (Part 4) is exactly the average of these surprises.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				That's why this one component keeps coming back — it's the same lens aimed at different
				stages of the model's life:
			</p>

			<ul
				class="mb-5 list-inside list-disc space-y-1.5 text-[13px]"
				style="color: var(--color-text-secondary);"
			>
				<li>
					<strong style="color: var(--color-text);">Part 4:</strong> average surprise, exponentiated,
					is <em>perplexity</em> — the standard score for a language model, taught on this heatmap.
				</li>
				<li>
					<strong style="color: var(--color-text);">Part 5:</strong> watch the same paragraph cool
					down, checkpoint by checkpoint, as pretraining teaches the model what English is — the
					loss curve, made spatial.
				</li>
				<li>
					<strong style="color: var(--color-text);">Part 7:</strong> during instruction tuning, some
					tokens are deliberately excluded from the loss — the inspector shows masked tokens going
					grey, and loss masking stops being an abstract config flag.
				</li>
			</ul>

			<Callout type="note" title="Status">
				The full inspector — with the surprise heatmap and a trained model behind it — arrives with
				a later milestone, once Part 5 gives you a model whose surprises are worth inspecting. The
				tokenizer box above is the same component in its plain mode.
			</Callout>

			<VibeBox
				prompts={[
					'Which tokens in a typical TinyStories sentence should be high-surprise, and why?',
					'How does the surprise heatmap relate to the loss curve I’ll see in Part 5?'
				]}
			/>
		</div>
	</div>
</section>
