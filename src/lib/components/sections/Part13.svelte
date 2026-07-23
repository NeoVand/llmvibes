<script lang="ts">
	import { Zap, Split, Wand2, Archive, Shrink, FastForward, Star } from 'lucide-svelte';
	import KvCacheLab from '../lab/KvCacheLab.svelte';
	import SpeculativeLab from '../lab/SpeculativeLab.svelte';
	import Callout from '../ui/Callout.svelte';
	import Code from '../ui/Code.svelte';
	import CodeBlock from '../ui/CodeBlock.svelte';
	import MermaidDiagram from '../ui/MermaidDiagram.svelte';
	import PseudoCode from '../ui/PseudoCode.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
	import VibeBox from '../ui/VibeBox.svelte';
</script>

<section id="part-13" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={Zap}
			partLabel="Part 13"
			title="Frontier & Inference"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			What separates your 25M-parameter birds from a frontier model, besides zeros? This chapter
			tries the frontier's tricks at toy scale and reports honestly which ones help — then turns to
			inference, where a bag of clever engineering makes generation fast enough to feel alive.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-13-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Split}
				title="13.1 Mixture of Experts"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Replace one feed-forward network with many and route each token to a couple of them: more
				parameters, same compute per token. A routing visualization shows which experts wake up for
				which tokens — and whether any of it helps at this scale.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Name the trade first. In a dense model — everything you've trained so far — every parameter
				touches every token, so capacity and compute grow in lockstep. Mixture of Experts decouples
				them: total parameters can be enormous while the compute spent per token stays small,
				because each token only visits a few parameters.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The surgery happens in the block you built in Part 3. Attention stays. The one big MLP is
				replaced by <Code code="E" /> small ones — the experts — plus a <em>router</em>: a tiny
				linear layer that scores all <Code code="E" /> experts for each token. Keep the top-k scorers,
				run the token through only those, and blend their outputs by the router's weights:
			</p>

			<PseudoCode
				number={1}
				title="Routing, per token"
				code={String.raw`input a token embedding $x$
$s \leftarrow \mathrm{router}(x)$ // one score per expert, for this token
$i, j \leftarrow \mathrm{top}_2(s)$ // say experts 3 and 7
output $w_i \, \mathrm{expert}_i(x) + w_j \, \mathrm{expert}_j(x) + \mathrm{shared}(x)$ // blend by the router's weights`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The unit of routing is the <em>token</em>, and that's worth sitting with. Not the prompt,
				not the sentence — every single token, at every MoE layer, gets its own routing decision.
				"dragon" might light up experts 3 and 7 while the "the" right before it went to 1 and 5. The
				routing visualization in the lab makes this visible: feed a story through and watch the
				expert lanes flicker token by token.
			</p>

			<MermaidDiagram
				definition={`graph TD
  T(["token embedding x"]) --> R{"router: pick top-2 of 8"}
  R --> E3(["expert 3 (small MLP)"])
  R --> E7(["expert 7 (small MLP)"])
  T --> S(["shared expert — always on"])
  E3 --> O(["weighted sum → next layer"])
  E7 --> O
  S --> O`}
				id="moe-routing"
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Two DeepSeek-flavored refinements are now standard. <em>Fine-grained experts:</em> instead
				of a few large experts picking one or two, use many small ones and activate several — more
				combinations of specialists per token, finer division of labor. And a
				<em>shared expert</em> that every token visits unconditionally: it absorbs the common patterns
				(grammar, punctuation, glue) so the specialists don't all waste capacity relearning them.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The classic failure mode is <em>router collapse</em>: a couple of experts win early, get all
				the tokens, therefore all the gradient, therefore keep winning — while the rest go dead. The
				textbook fix is an auxiliary load-balancing loss nudging usage toward uniform, but it
				literally fights the language-modeling objective: you pay model quality for balance.
				DeepSeek-V3's aux-loss-free alternative is sneakier — give each expert a bias added to its
				routing score <em>only for the top-k selection</em>, not for the mixing weights, and have a
				controller nudge each bias up when its expert is underused and down when overused. Balance
				gets steered by a thermostat instead of taxed into the loss.
			</p>

			<Callout type="warning" title="Verdict at our scale">
				Honest verdict: at 25M parameters, MoE shows <em>mechanism, not wins</em>. Slicing a small
				MLP into eight tiny experts leaves each too small to specialize meaningfully, and our corpus
				is too narrow to demand it. MoE pays off when the dense model you'd otherwise want can't fit
				your hardware — ours fits with room to spare. Watch the routing come alive; don't expect a
				better loss curve.
			</Callout>
		</div>

		<div id="section-13-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Wand2}
				title="13.2 MTP, Muon, QK-Clip"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Three tricks from recent frontier papers, each tried live: predicting several tokens ahead,
				racing the Muon optimizer against AdamW, and deliberately inducing an attention-logit
				explosion so QK-clip has something to fix. Verdicts included, hype not.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Multi-token prediction
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Your loss has always asked one question per position: what comes next? Multi-token
				prediction adds a second: what comes <em>after</em> next? DeepSeek-V3 bolts a small extra module
				onto the trunk that predicts one token further ahead, as an auxiliary objective during training
				only. The claim is data efficiency — every position now supplies two gradients instead of one,
				and planning two tokens out seems to build slightly better representations. At inference you can
				throw the module away, or keep it as a built-in draft generator for speculative decoding (13.5
				explains why that's valuable).
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">Muon</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				AdamW, your loyal optimizer since Part 4, keeps two scalars of bookkeeping per weight and
				treats every weight as an island. Muon's observation: most of a transformer is weight
				<em>matrices</em>, and a matrix update has structure a per-weight view can't see. Muon takes
				the momentum-averaged gradient of each matrix and <em>orthogonalizes</em> it (a few Newton-Schulz
				iterations — cheap matrix multiplies) before applying it, so the update pushes in many independent
				directions instead of piling onto a dominant few. Pedigree: Muon powers the nanoGPT speedrun leaderboard,
				and Kimi scaled it to K2's trillion-parameter training as half of MuonClip. Embeddings, norms,
				and other non-matrix parameters stay on AdamW. The lab demo is a straight race: same model, same
				data, same token budget, two optimizers, two loss curves.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">QK-clip</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				A failure mode you can summon on demand. Attention logits are dot products between queries
				and keys; if the <Code code="Wq" /> and <Code code="Wk" /> matrices grow during training, those
				logits can explode — softmax saturates into one-hot attention, gradients spike, and long runs
				die with a loss chart that looks like a heart attack. Kimi's fix for K2 is blunt and effective:
				watch the maximum attention logit per head, and whenever it exceeds a threshold, rescale <Code
					code="Wq"
				/> and <Code code="Wk" /> down to cap it. Muon plus this guard is MuonClip, and K2's famously
				spike-free loss curve over 15 trillion tokens is its advertisement. Our demo: provoke the explosion
				at toy scale — aggressive learning rate, weakened normalization — watch the max-logit gauge climb
				and the loss spike, then switch the clip on and rerun the same seed.
			</p>

			<div class="my-4 overflow-x-auto rounded-lg" style="background: var(--color-bg-secondary);">
				<table class="w-full text-[13px]">
					<thead>
						<tr style="background: var(--color-bg-tertiary);">
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Trick</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>What it buys the frontier</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>At our scale</th
							>
						</tr>
					</thead>
					<tbody style="color: var(--color-text-secondary);">
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">MTP</td>
							<td class="px-4 py-2">Denser training signal, free draft head</td>
							<td class="px-4 py-2">Trains fine; expect a wash to a small gain</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">Muon</td>
							<td class="px-4 py-2">Faster convergence per step</td>
							<td class="px-4 py-2">The one most likely to genuinely win the race</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">QK-clip</td>
							<td class="px-4 py-2">Insurance against divergence at huge scale</td>
							<td class="px-4 py-2">A reproducible failure-and-fix demo</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<div id="section-13-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={Archive}
				title="13.3 KV Cache & Sampling"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Without a cache, generating each token recomputes attention over everything before it.
				Toggle the KV cache and feel tokens-per-second jump — then finish the sampling toolbox with
				top-k and top-p, the dials temperature left unexplained in Part 5.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Here's the naive cost story. To sample token 501, run the full 500-token prefix through the
				model. To sample token 502, run 501 tokens through again. Per-token cost grows with
				position; a whole generation costs roughly the square of its length. And it's pure waste,
				because of a fact you already know from Part 3: attention is causal. Position 17's key and
				value vectors depend only on tokens up to 17 — they will never change for the rest of the
				generation. So compute them once and keep them.
			</p>

			<CodeBlock
				title="The cache changes the exponent"
				lang="text"
				code={`without cache   token n costs a forward pass over n positions
                1,000 tokens  ->  ~500,000 position-computations

with cache      token n costs a forward pass over 1 position
                1,000 tokens  ->  1,000 position-computations`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				That's the KV cache: per layer, per head, store every position's K and V. Each new token
				computes its own query, key, and value — one position of work — appends its K and V to the
				cache, and attends against everything stored. (Queries aren't cached; each is used once and
				discarded.) The lab's toggle makes it visceral: same model, same prompt, an
				order-of-magnitude jump in tokens per second.
			</p>

			<KvCacheLab />

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The cache isn't free — you're trading memory for compute:
			</p>

			<CodeBlock
				title="What the cache costs"
				lang="text"
				code="cache_bytes = 2 (K and V) x layers x kv_heads x head_dim x positions x bytes_per_value"
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				For Quill that's a few megabytes — invisible. For a frontier model serving long contexts,
				the cache outweighs the activations and becomes the thing engineers fight. That fight is why
				grouped-query attention exists (several query heads share one K/V head — fewer
				<Code code="kv_heads" /> in the formula) and why DeepSeek's MLA compresses K and V into a small
				latent vector and reconstructs them on the fly. Different tactics, same target: that formula.
			</p>

			<h4 class="mt-6 mb-2 text-[14px] font-semibold" style="color: var(--color-text);">
				Finishing the sampling toolbox
			</h4>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Part 5 gave you temperature: scale the logits before softmax to sharpen or flatten the
				distribution. Two truncation dials complete the set. <strong>Top-k</strong> keeps only the
				<Code code="k" /> most probable tokens and renormalizes — simple, but blunt: it keeps the same
				count whether the model is confident or lost. <strong>Top-p</strong> (nucleus sampling)
				keeps the smallest set of tokens whose cumulative probability reaches
				<Code code="p" /> — it adapts, trimming to a handful of candidates when the model is sure and
				widening when it isn't.
			</p>

			<div class="my-4 overflow-x-auto rounded-lg" style="background: var(--color-bg-secondary);">
				<table class="w-full text-[13px]">
					<thead>
						<tr style="background: var(--color-bg-tertiary);">
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>Dial</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>What it does</th
							>
							<th class="px-4 py-2 text-left font-semibold" style="color: var(--color-text);"
								>At the extremes</th
							>
						</tr>
					</thead>
					<tbody style="color: var(--color-text-secondary);">
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">temperature</td>
							<td class="px-4 py-2">Reshapes the whole distribution</td>
							<td class="px-4 py-2">Near 0 = greedy; high = word soup</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">top-k</td>
							<td class="px-4 py-2">Keeps a fixed number of candidates</td>
							<td class="px-4 py-2">k = 1 is greedy; huge k is off</td>
						</tr>
						<tr style="border-top: 1px solid var(--color-border);">
							<td class="px-4 py-2">top-p</td>
							<td class="px-4 py-2">Keeps a probability mass, adaptively</td>
							<td class="px-4 py-2">p = 1 is off; small p is near-greedy</td>
						</tr>
					</tbody>
				</table>
			</div>

			<Callout type="tip" title="Order of operations">
				The dials compose in sequence: temperature reshapes the distribution, then top-k and top-p
				truncate it, then what survives is renormalized and sampled. Typical defaults you'll meet in
				the wild — temperature around 0.7 with top-p around 0.9 — are taste, not law. The lab lets
				you feel each one against Quill's prose.
			</Callout>
		</div>

		<div id="section-13-4" class="mb-14">
			<SectionHeader
				level="section"
				icon={Shrink}
				title="13.4 Quantization"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Squeeze weights from 16 bits to 8 to 4 and watch memory shrink while Quill's prose slowly
				coarsens. Quantization is why big models fit on small machines — and reading degraded
				stories side by side makes its cost tangible.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Training needs precision — gradients are tiny nudges, and fp16 is about as coarse as
				training tolerates. Inference is more forgiving: the weights are frozen, and what matters is
				that the matmuls land close enough. So store each block of weights as small integers plus
				one shared scale factor — <Code code="w ≈ scale × q" /> with <Code code="q" /> an int8 (256 levels)
				or int4 (16 levels) — and expand them on the fly inside the matmul. The memory math is immediate:
			</p>

			<CodeBlock
				title="Flagship Quill, ~25M parameters"
				lang="text"
				code={`fp16   25M x 2.0 bytes  =  ~50 MB
int8   25M x 1.0 bytes  =  ~25 MB
int4   25M x 0.5 bytes  =  ~13 MB   (+ a few percent for the scales)`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Scale those numbers up and you get the modern deployment story: int4 is the reason
				multi-billion-parameter models run on laptops and phones, and the reason 13.6's guest star
				fits in this tab at all.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The quality cost is real but smaller than intuition suggests. Naive rounding hurts; the good
				methods — small per-group scales, error-compensating rounding, activation-aware choices
				about which weights deserve precision (the GPTQ/AWQ family) — keep 4-bit surprisingly close
				to full quality, with degradation showing up first in long-tail precision: rare words,
				delicate phrasing. The lab makes it a reading exercise: the same prompt at fp16, int8, and
				int4, side by side. Expect int8 to be imperceptible and int4 to occasionally flatten a
				phrase — a cost you can now see rather than take on faith.
			</p>

			<Callout type="note" title="You've been using it all course">
				The time machine's scrubbable checkpoints ship as int4/int8 — that's what makes carrying a
				dozen snapshots per bird affordable. But the designated resume points ship fp16, because
				<em>training</em> on top of quantized weights with fresh optimizer state is not something that
				works, and we don't pretend otherwise. Inference forgives rounding; optimization doesn't.
			</Callout>
		</div>

		<div id="section-13-5" class="mb-14">
			<SectionHeader
				level="section"
				icon={FastForward}
				title="13.5 Speculative Decoding"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Little live-Quill drafts a burst of tokens; big flagship-Quill checks the whole burst in one
				pass and keeps what it agrees with. Same output distribution, several times the speed — your
				two birds, cooperating at last.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The trick rides on an asymmetry: generating is sequential, checking is parallel. A big
				model's per-token latency is dominated by reading its weights from memory — and one forward
				pass over <em>five</em> tokens reads the weights once, same as a pass over one. Verifying a burst
				costs about the same as generating a single token. So let something cheap write the burst.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The protocol: the draft model (live-Quill, a few million parameters, fast) proposes, say, 5
				tokens. The target model (flagship-Quill, 25M) runs one batched forward pass over all 5,
				which yields its own next-token distribution at every position. Compare, position by
				position: accept while the target agrees, stop at the first rejection, resample that one
				position from a corrected distribution, and hand the new tail back to the draft.
			</p>

			<MermaidDiagram
				definition={`sequenceDiagram
    participant D as Live-Quill (draft)
    participant T as Flagship-Quill (target)
    D->>T: proposes 5 tokens: "the dragon spread its copper"
    T->>T: ONE batched pass scores all 5 positions
    T->>D: accepts 4, rejects "copper", resamples "great"
    D->>T: drafts the next burst from "...spread its great"`}
				id="speculative-handshake"
			/>

			<SpeculativeLab />

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The startling part is the guarantee. The acceptance rule — take a drafted token with
				probability <Code code="min(1, p_target / p_draft)" />, and on rejection sample from the
				renormalized excess <Code code="max(0, p_target − p_draft)" /> — makes the output distribution
				<em>exactly</em> what the target alone would have produced. Not approximately: token for token,
				mathematically identical. Speculative decoding is that rare deal — speed for free, quality untouched
				— paid for only in extra compute when the draft guesses wrong.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				So the speedup lives and dies by the acceptance rate. Most tokens of English are easy —
				"the", punctuation, the obvious next word — and a small model drafts them just as well as a
				big one, which is why acceptance runs high and the wins are real. When the models disagree
				often (say, after heavy RL reshapes one of them), the bursts shrink and the overhead wins.
				One hard requirement: both models must share a tokenizer — and yours do, by construction.
				The pocket-and-flagship pair already sitting in your browser's memory is the natural demo,
				and it arrives with the flagship milestone.
			</p>
		</div>

		<div id="section-13-6" class="mb-8">
			<SectionHeader
				level="section"
				icon={Star}
				title="13.6 The SmolLM Cameo"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				A real pretrained 135M-parameter model runs beside Quill for a direct conversation between
				scales. Same organism, more scale — the point of the whole course, made talkable.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				The guest is a SmolLM-class model, 135M parameters, running in this same browser tab via
				transformers.js — the same download that powers the AI tutor and Part 8's generator, so it
				costs you nothing new. It arrives with a later milestone; what it teaches can be said now:
				almost everything you know transfers.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Open its config file and you can read every field, because every field is a chapter you
				took. Byte-level BPE tokenizer — Part 2's algorithm with a bigger vocabulary. Decoder-only
				blocks with RoPE, pre-norm, a gated MLP — Part 3, stacked deeper and wider. Grouped-query
				attention — 13.3's cache formula, being fought. The sampling loop and KV cache serving its
				replies are the ones you just studied. Rough shape of the comparison:
			</p>

			<CodeBlock
				title="Same organism, more scale (illustrative configs)"
				lang="text"
				code={`                 flagship Quill        SmolLM-135M-class
layers           ~8                    30
d_model          ~384                  576
heads            ~6                    9  (3 KV heads — GQA)
vocab            ~8k byte-BPE          ~49k byte-BPE
params           ~25M                  ~135M
training tokens  ~100M (offline run)   hundreds of billions`}
			/>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				What actually changed is the exponents — above all the data: thousands of times more tokens,
				from carefully curated mixtures. And here's the kicker for anyone who took Part 8: a large
				share of SmolLM's training diet is <em>synthetic textbooks</em>, generated and filtered at
				industrial scale. The reveal that TinyStories was synthetic wasn't a toy-course curiosity —
				it's how real small models are fed now.
			</p>

			<p class="mb-3 text-[14px]" style="color: var(--color-text-secondary);">
				Put a prompt to Quill and the cameo side by side and you're not comparing two species.
				You're looking at the same organism at two points on the scaling curve — which is the
				cleanest possible setup for the epilogue's question: what, exactly, do the exponents buy?
			</p>

			<VibeBox
				prompts={[
					'Route a sentence through the MoE viz and narrate each expert choice',
					"Compute my KV cache size right now from Quill's actual config",
					'When would speculative decoding actually make things slower?'
				]}
			/>
		</div>
	</div>
</section>
