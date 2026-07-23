<script lang="ts">
	import { Network, Layers, Eye, RotateCw, Box } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import MermaidDiagram from '../ui/MermaidDiagram.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
</script>

<section id="part-3" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={Network}
			partLabel="Part 3"
			title="The Transformer"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			The same few hundred lines of architecture power Quill, Rook, and every frontier model you've
			heard of. This chapter builds the modern decoder block one sub-layer at a time — with Rook in
			the lead, because attention drawn as arrows on a chessboard is attention you can actually see.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-3-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Layers}
				title="3.1 Embeddings & the Residual Stream"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Every token becomes a vector, and every vector flows down one shared highway — the residual
				stream — that each layer reads from and writes back to. Getting this picture right first
				makes everything else in the transformer feel inevitable rather than arbitrary.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Part 2 ended with the world reduced to integers. But an integer ID is a name, not a
				description — token 268 isn't "more than" token 267 in any useful sense. Step one of the
				transformer is to swap each ID for something with room for meaning: a vector. The
				<strong style="color: var(--color-text);">embedding table</strong> is a big matrix with
				<em>one row per token in the vocabulary</em>, and "embedding a token" is nothing fancier
				than grabbing its row. For the pocket Rook you'll train in Part 5, that table is 1,931 rows
				(one per move token) of 128 numbers each; pocket Quill's is 512 rows of the same width.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Here's the part that deserves a pause: <strong style="color: var(--color-text);"
					>those numbers are learned</strong
				>. The table starts as random noise and gets nudged by training like every other parameter.
				Nobody tells Rook that <Code code="e2e4" /> and <Code code="d2d4" /> are similar moves;
				training discovers that treating them similarly reduces prediction error, and their rows
				drift together. Meaning ends up encoded as geometry — directions and distances in a
				128-dimensional space — because that's the only language the rest of the network speaks.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The residual stream: the model's one highway
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				After embedding, each position in the sequence owns one 128-dimensional vector. That
				per-position vector, flowing from the bottom of the network to the top, is the
				<strong style="color: var(--color-text);">residual stream</strong> — and it is the single
				most useful mental model in this course. Every sub-layer in the transformer has the same
				job description: <em>read</em> the stream, <em>compute</em> something, and
				<em>add</em> the result back into the stream. Nothing gets overwritten; information is
				accumulated by addition, layer after layer.
			</p>

			<MermaidDiagram
				definition={`graph TD
  A(["Token IDs"]) --> B(["Embedding lookup — one row per token"])
  B --> S1(["Residual stream"])
  S1 --> N1(["Norm"]) --> ATT(["Attention — mix info between positions"])
  ATT -->|add back| S2(["Residual stream"])
  S1 -->|unchanged copy| S2
  S2 --> N2(["Norm"]) --> MLP(["MLP — process each position alone"])
  MLP -->|add back| S3(["Residual stream"])
  S2 -->|unchanged copy| S3
  S3 --> R(["… repeat the block N times …"])
  R --> U(["Unembedding — score every token in the vocab"])
  U --> P(["Next-token probabilities"])`}
				id="residual-stream-flow"
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Two kinds of workers alternate along the highway. <strong style="color: var(--color-text);"
					>Attention</strong
				>
				is the only place where positions exchange information — where move 31 gets to look at move 4.
				The <strong style="color: var(--color-text);">MLP</strong> processes each position by itself,
				no peeking at neighbors. Everything else — the norms, the residual additions — is plumbing that
				keeps the highway stable. At the very top, the stream's final vector is compared against every
				row of an <em>unembedding</em> matrix, producing one score per vocabulary token: the model's
				bets on what comes next.
			</p>

			<Callout type="tip" title="Why 'residual'?">
				Because each sub-layer's output is added to its input, the sub-layer only has to learn the
				<em>difference</em> — the residual — between what the stream already says and what it should
				say next. Small refinements are easier to learn than full rewrites, and the additive highway
				also gives gradients a clean, unobstructed path from the loss back to the earliest layers
				(Part 4 will make you care about that). This one wiring decision is much of why deep stacks
				train at all — and in Part 6, it's the surface we'll press our probes against.
			</Callout>

			<VibeBox
				prompts={[
					'What does it mean geometrically for two of Rook’s move tokens to be similar?',
					'Why is adding to the residual stream better than replacing it?'
				]}
			/>
		</div>

		<div id="section-3-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Eye}
				title="3.2 Attention, Two Ways"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Attention lets every token look back at every token before it and decide what matters. For
				Quill that's spans of text lighting up; for Rook it's arrows between moves on a board — one
				mechanism, two visualizations, and the contrast is the lesson.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The problem attention solves: when Rook is predicting move 32, the information it needs is
				scattered across the whole game — which pieces already moved, where they went, what got
				captured. A fixed rule like "look at the previous 3 tokens" would be useless; <em>which</em>
				earlier moves matter depends entirely on the position. Attention makes the lookup itself
				learned and content-dependent. Every position produces three vectors, each a learned linear
				projection of its residual stream:
			</p>

			<ul
				class="mb-4 list-inside list-disc space-y-1.5 text-[13px]"
				style="color: var(--color-text-secondary);"
			>
				<li>
					a <strong style="color: var(--color-text);">query</strong> — "here's what I'm looking
					for" (what would help predict my next token)
				</li>
				<li>
					a <strong style="color: var(--color-text);">key</strong> — "here's what I can be found
					by" (an advertisement of what this position holds)
				</li>
				<li>
					a <strong style="color: var(--color-text);">value</strong> — "here's what you get if you
					pick me" (the payload actually delivered)
				</li>
			</ul>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Each position's query is dotted against every earlier position's key — a compatibility
				score. Softmax turns the scores into weights that sum to one, and the position collects the
				weighted mix of the corresponding values into its stream. The whole mechanism is four lines:
			</p>

			<CodeBlock
				title="Scaled dot-product attention, one head"
				lang="text"
				code={`scores  = Q · Kᵀ / √d_head        # every query against every key
scores[i, j] = -infinity  for j > i   # causal mask: no looking ahead
weights = softmax(scores)             # each row becomes a distribution
output  = weights · V                 # weighted mix of value vectors`}
			/>

			<MermaidDiagram
				definition={`graph LR
  X(["Residual stream, all positions"]) --> Q(["Q = X·Wq"])
  X --> K(["K = X·Wk"])
  X --> V(["V = X·Wv"])
  Q --> S(["scores = Q·Kᵀ / √d_head"])
  K --> S
  S --> M(["causal mask + softmax"])
  M --> W(["attention weights"])
  W --> O(["output = weights · V"])
  V --> O
  O --> P(["project (Wo), add to stream"])`}
				id="attention-dataflow"
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Two details earn their keep. The <Code code="√d_head" /> scaling keeps dot products from
				growing with vector width — unscaled, softmax saturates into winner-take-all and its
				gradients die. And the <strong style="color: var(--color-text);">causal mask</strong> is the
				transformer honoring the deal it made: it's a next-token predictor, so position <em>i</em>
				may only attend to positions at or before <em>i</em>. During training the model predicts
				every position of the sequence at once, and the mask is what keeps each prediction honest —
				no copying tomorrow's answer from tomorrow.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Many heads, many kinds of "relevant"
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				One softmax produces one pattern of looking — but "which earlier token matters" has many
				simultaneous right answers. So attention runs several
				<strong style="color: var(--color-text);">heads</strong> in parallel: the 128-wide stream is
				split into 4 heads of 32 dimensions each (in the pocket pair), each head runs the exact
				attention above with its own learned projections, and their outputs are concatenated and
				projected back into the stream. Each head is free to specialize in a different
				<em>relationship type</em>: in language models, heads emerge that track a pronoun back to
				its noun, watch sentence boundaries, or copy repeated names; in a move-stream model, heads
				can track what last touched the square being moved to, or where the moving piece came from.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				And that's why this chapter belongs to Rook. Attention weights are just numbers between
				positions, and for Quill you render them the standard way: spans of earlier text glowing
				brighter where weight is higher. Interpretable, but fuzzy — language relationships are
				gradient things. Rook's positions are <em>moves</em>, so the identical numbers render as
				<strong style="color: var(--color-text);">arrows between moves drawn over a chessboard</strong
				> — and an arrow from <Code code="f3g5" /> back to <Code code="g1f3" /> (the move that put
				that knight on f3) is a claim you can check against the rules of chess. One mechanism, two
				pictures; the formal world makes the informal one legible.
			</p>

			<VibeBox
				prompts={[
					'Explain queries, keys, and values with a chess example from Rook',
					'What goes wrong if we drop the causal mask during training?',
					'Why do we split attention into multiple heads instead of one big one?'
				]}
			/>
		</div>

		<div id="section-3-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={RotateCw}
				title="3.3 RoPE & Context Windows"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Attention by itself has no idea which token came first — position has to be smuggled in, and
				rotary embeddings are how modern models do it. Along the way: what a context window actually
				is, and why every model eventually runs out of one.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Look back at the attention equations: nothing in them mentions order. Shuffle the tokens
				and every query–key dot product gives the same score — attention treats the sequence as a
				<em>bag</em>. For chess that's fatal: <Code code="e2e4" /> as move one and
				<Code code="e2e4" /> as a replayed idea on move forty mean different things, and "the
				previous move" must be findable. Position information has to be injected, and <strong
					style="color: var(--color-text);">RoPE</strong
				> — rotary position embeddings, the modern standard — injects it with a trick of geometry:
			</p>

			<CodeBlock
				title="RoPE in one idea"
				lang="text"
				code={`Pair up the dimensions of each query and key vector: (q1,q2), (q3,q4), …
Treat each pair as a point in a 2-D plane.
At position p, rotate each pair by angle  p × θ  (a different θ per pair).

Rotating both q and k means their dot product depends only on the
DIFFERENCE of their positions — how far apart, not where.`}
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				That relative-position property is the entire sales pitch. A dot product between two
				rotated vectors depends on the angle <em>between</em> them, and that angle is proportional
				to the gap between their positions. So a head can learn "attend two tokens back" as a fixed
				geometric relationship that works identically at position 10 and position 90 — the pattern
				travels. Each dimension pair rotates at its own frequency <Code code="θ" />, fast pairs
				resolving nearby order precisely while slow pairs keep long-range gaps distinguishable —
				a clock with many hands, from seconds to hours.
			</p>

			<Callout type="warning" title="What the pocket pair actually uses">
				Honesty checkpoint. The pocket models you'll train live in Part 5 do <em>not</em> use RoPE —
				they use the older recipe: a second learned table, one row per <em>position</em>, added to
				the token embedding at the bottom of the stack. It's simpler, it's fast, and at a
				128-token window it works fine — but position 7 is just an arbitrary learned vector, and
				nothing generalizes across positions. RoPE is taught here because it's the modern standard,
				and it arrives with the offline-trained flagship models. When the course can show you both
				side by side, the difference stops being trivia.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The context window: the edge of the world
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The <strong style="color: var(--color-text);">context window</strong> is the block of
				tokens the model can see at once — the width of the attention computation. The pocket pair's
				window is 128 tokens. For Quill, at 2.34 characters per token, that's roughly 300 characters
				of story — a paragraph. For Rook it's about two full random-legal games, or one long game
				with room to spare. Anything before the window's left edge does not exist: not "remembered
				vaguely," but architecturally invisible — attention has nothing to dot against.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Every "the model forgot my earlier instructions" story you've heard is this edge. Frontier
				windows have grown from 2,048 tokens to hundreds of thousands, but the cost is real —
				attention compares every position with every earlier one, so doubling the window roughly
				quadruples that work — and the edge always exists somewhere. When Part 12 gives Quill a
				scratchpad tool, it will be precisely because a fixed window makes long-story consistency
				impossible without external memory. The limit is the lesson.
			</p>

			<VibeBox
				prompts={[
					'Why does rotating queries and keys make attention care about relative position?',
					'What can Rook not possibly do with a 128-token context window?'
				]}
			/>
		</div>

		<div id="section-3-4" class="mb-8">
			<SectionHeader
				level="section"
				icon={Box}
				title="3.4 SwiGLU, RMSNorm, the Block"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The last pieces click in: the gated feed-forward network where most of the parameters live,
				the normalization that keeps activations sane, and the pre-norm wiring that stacks it all
				into a block you can repeat a dozen times to get a real model.
			</p>

			<h4 class="mt-2 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				RMSNorm: keep the vectors on a leash
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Residual addition has a side effect: the stream's magnitude drifts as layers keep adding to
				it, and layers deeper in the stack would see ever-wilder inputs. The fix is to rescale
				before each sub-layer:
			</p>

			<CodeBlock
				title="RMSNorm"
				lang="text"
				code={`rmsnorm(x) = x / sqrt(mean(x²) + eps)      # then × a learned per-dim gain

Divide the vector by its own root-mean-square: direction preserved,
magnitude pinned. Unlike the older LayerNorm, there's no mean-centering
step — dropping it turns out to cost nothing and saves work.`}
			/>

			<p class="mt-4 mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Just as important is <em>where</em> the norm sits. Modern blocks are
				<strong style="color: var(--color-text);">pre-norm</strong>: normalize the copy of the
				stream a sub-layer reads, but add the sub-layer's output back to the <em>un</em>-normalized
				stream. The highway itself is never squeezed — each worker just gets a standardized view of
				it. That wiring keeps the residual path clean for gradients and is a big part of why you can
				stack dozens of blocks and have training simply work.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The MLP: where the parameters live
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				After attention has gathered information <em>between</em> positions, the MLP processes each
				position on its own: expand the 128-wide vector to 4× the width, apply a nonlinearity,
				project back down, add to the stream. This is the transformer's per-token thinking space —
				and its biggest line item in the parameter budget. The modern nonlinearity is a gated
				design called <strong style="color: var(--color-text);">SwiGLU</strong>:
			</p>

			<CodeBlock
				title="Two MLP recipes"
				lang="text"
				code={`classic:  out = relu(x·W1) · W2
SwiGLU:   out = ( silu(x·W1) ⊙ x·W3 ) · W2      # ⊙ = elementwise product

Two parallel expansions: one (through silu, a smooth relu) acts as a
GATE that scales the other, dimension by dimension. The network learns
not just features but when to let each feature through. Costs a third
weight matrix; wins consistently in practice.`}
			/>

			<Callout type="warning" title="What the pocket pair actually uses">
				Same honesty rule as RoPE: the live pocket models use the classic ReLU MLP — two matrices,
				no gate — because at pocket scale it's fast and the difference is small. They <em>do</em>
				use RMSNorm and pre-norm wiring exactly as taught above. SwiGLU arrives with the flagships,
				where the recipe matches what frontier models actually ship.
			</Callout>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				The block, assembled — and counted
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				That's every part. One <strong style="color: var(--color-text);">block</strong> is:
				norm, attention, add — then norm, MLP, add. Stack N blocks between the embedding and the
				unembedding and you have the whole architecture. The pocket pair stacks 4 blocks; the
				flagships stack more and go wider; frontier models stack around a hundred. Here's exactly
				where pocket Quill's parameters sit:
			</p>

			<div class="my-4 overflow-hidden rounded-lg" style="background: var(--color-bg-secondary);">
				<table class="w-full text-[13px]">
					<thead>
						<tr style="background: var(--color-bg-tertiary);">
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Component</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Shape</th
							>
							<th class="px-4 py-2 text-right font-semibold" style="color: var(--color-text);"
								>Parameters</th
							>
						</tr>
					</thead>
					<tbody style="color: var(--color-text-secondary);">
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Token embedding</td>
							<td class="px-4 py-2">512 × 128</td>
							<td class="px-4 py-2 text-right">65,536</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Position embedding</td>
							<td class="px-4 py-2">128 × 128</td>
							<td class="px-4 py-2 text-right">16,384</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Attention, 4 layers (Wq, Wk, Wv, Wo each 128 × 128)</td>
							<td class="px-4 py-2">4 × 4 × 128 × 128</td>
							<td class="px-4 py-2 text-right">262,144</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">MLPs, 4 layers (128 → 512 → 128)</td>
							<td class="px-4 py-2">4 × 2 × 128 × 512</td>
							<td class="px-4 py-2 text-right">524,288</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Unembedding</td>
							<td class="px-4 py-2">128 × 512</td>
							<td class="px-4 py-2 text-right">65,536</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2 font-medium" style="color: var(--color-text);">Total</td>
							<td class="px-4 py-2"></td>
							<td class="px-4 py-2 text-right font-medium" style="color: var(--color-text);"
								>933,888</td
							>
						</tr>
					</tbody>
				</table>
			</div>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Read the weights, not just the total: the MLPs hold more than half the model, attention a
				quarter, and the embeddings the rest. Pocket Rook is the identical stack with different
				bookends — its 1,931-token vocabulary makes the embedding and unembedding bigger, for about
				1.3M parameters total. Same blocks, same highway, different menu. Right now every one of
				those parameters is random noise, and both birds predict static. Part 4 is about the
				machine that turns noise into knowledge: the loss, the gradient, and the loop that runs
				them a few thousand times.
			</p>

			<VibeBox
				prompts={[
					'Why does the gate in SwiGLU help compared to a plain ReLU MLP?',
					'Walk me through one full block: what happens to a single move token’s vector?',
					'Where would the parameter budget shift if Quill’s vocabulary were 50,000 tokens?'
				]}
			/>
		</div>
	</div>
</section>
