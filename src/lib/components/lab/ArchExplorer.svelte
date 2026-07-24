<script lang="ts">
	// Interactive architecture explorer: the pocket model's exact stack, stage
	// by stage. The residual stream is drawn as the gold spine it actually is —
	// one continuous SVG band with stage nodes attached; attention and the MLP
	// branch off it and merge back. Every stage gets its own vignette drawn
	// from a fixed 6-token prompt ("Once upon a time , the") with deterministic
	// example values, annotated with the REAL shapes from the lab config.
	// Channel colors are one-concept-one-color across all vignettes:
	// Q steel / K copper / V verdigris / weights plum / hidden amber /
	// stream gold (see arch/palette.ts).
	import Math from '../ui/Math.svelte';
	import { CH, ink } from './arch/palette';
	import StageTokens from './arch/StageTokens.svelte';
	import StageEmbed from './arch/StageEmbed.svelte';
	import StageNorm from './arch/StageNorm.svelte';
	import StageAttention from './arch/StageAttention.svelte';
	import StageResidual from './arch/StageResidual.svelte';
	import StageMlp from './arch/StageMlp.svelte';
	import StageBlocks from './arch/StageBlocks.svelte';
	import StageHead from './arch/StageHead.svelte';

	let {
		nLayer = 4,
		nEmbd = 128,
		nHead = 4,
		blockSize = 128,
		vocab = 512
	}: {
		nLayer?: number;
		nEmbd?: number;
		nHead?: number;
		blockSize?: number;
		vocab?: number;
	} = $props();

	const hd = $derived(nEmbd / nHead);

	interface Stage {
		id: string;
		label: string;
		kind: 'io' | 'embed' | 'norm' | 'attn' | 'res' | 'mlp' | 'blocks' | 'head';
		shape: string;
		params: number;
		caption: string;
		what: string;
		math?: string;
		note?: string;
	}

	const stages = $derived.by<Stage[]>(() => [
		{
			id: 'tokens',
			label: 'Token IDs',
			kind: 'io',
			shape: `S = ${blockSize} ints`,
			params: 0,
			caption: 'Six words in, six integers out — the model never sees letters, only addresses.',
			what: `The input is just integers from Part 2 — one ID per token, up to ${blockSize} of them (the context window). No meaning yet; meaning is assigned by the very next stage.`
		},
		{
			id: 'embed',
			label: 'Token + Position Embeddings',
			kind: 'embed',
			shape: `S×${nEmbd}`,
			params: vocab * nEmbd + blockSize * nEmbd,
			caption: `Row 262 of the table plus position 5's vector: "the", located in ${nEmbd}-d space.`,
			what: `Each ID indexes a learned row of the embedding table; each position adds its own learned vector. From here on, every token is a point in ${nEmbd}-dimensional space, and everything the model "knows" about a token starts as coordinates.`,
			math: `x_i = E_{\\text{tok}}[t_i] + E_{\\text{pos}}[i]`,
			note: 'The pocket model uses learned absolute positions; the flagship swaps these for RoPE.'
		},
		{
			id: 'norm1',
			label: 'RMSNorm',
			kind: 'norm',
			shape: `S×${nEmbd}`,
			params: 0,
			caption: 'Same direction, unit size — then the learned γ re-stretches each channel.',
			what: 'Rescales each token vector to unit RMS before attention reads it — pre-norm keeps activations in a stable range so deep stacks train without exploding.',
			math: `\\operatorname{RMSNorm}(x) = \\gamma \\odot \\frac{x}{\\sqrt{\\tfrac{1}{d}\\sum_j x_j^2 + \\varepsilon}}`
		},
		{
			id: 'attn',
			label: `Attention (${nHead} heads)`,
			kind: 'attn',
			shape: `Q,K,V: S×${nHead}×${hd}`,
			params: 4 * nEmbd * nEmbd,
			caption:
				'Each circle: how much query (row) reads from key (column) — softmax makes every row sum to 1.',
			what: `The only stage where tokens talk to each other. Each token asks a question (Q), offers a label (K) and a payload (V); scores Q·Kᵀ decide, per head, how much of every earlier token's payload to mix in. ${nHead} heads = ${nHead} different kinds of relationship, attended in parallel — try them.`,
			math: `\\operatorname{Attn}(Q,K,V) = \\operatorname{softmax}\\!\\left(\\frac{QK^{\\top}}{\\sqrt{d_h}} + M\\right)V`,
			note: 'M is the causal mask: −∞ above the diagonal (the slashed cells), so no token sees the future.'
		},
		{
			id: 'res1',
			label: '+ residual',
			kind: 'res',
			shape: `S×${nEmbd}`,
			params: 0,
			caption: "The stream flows past; attention's output is merely added on top.",
			what: "Attention's output is ADDED to the stream, not substituted for it. The residual spine is why gradients reach layer 1 and why a block can safely learn nothing at first (add ≈ 0) and refine later."
		},
		{
			id: 'norm2',
			label: 'RMSNorm',
			kind: 'norm',
			shape: `S×${nEmbd}`,
			params: 0,
			caption: 'The second guard rail: normalize again before the MLP reads the stream.',
			what: 'Same normalization again, guarding the MLP the way the first one guarded attention.'
		},
		{
			id: 'mlp',
			label: 'MLP (4× wide)',
			kind: 'mlp',
			shape: `S×${4 * nEmbd} → S×${nEmbd}`,
			params: nEmbd * 4 * nEmbd + 4 * nEmbd * nEmbd,
			caption: 'Widen ×4, cut the negatives, project back — computed on each token separately.',
			what: `Per-token computation: expand to ${4 * nEmbd} dims, apply a nonlinearity, project back. No token-to-token mixing here — this is where facts and features get computed on each position independently. Most of a transformer's parameters live in these MLPs.`,
			math: `\\operatorname{MLP}(x) = W_2\\,\\phi(W_1 x)`,
			note: 'The pocket model uses φ = ReLU (the kink glyph); the flagship uses SwiGLU (a gated φ).'
		},
		{
			id: 'res2',
			label: '+ residual',
			kind: 'res',
			shape: `S×${nEmbd}`,
			params: 0,
			caption: "Add, don't replace: one full block done, the stream carries on.",
			what: 'Merge back into the spine. Norm → attention → add, norm → MLP → add: that is one complete pre-norm block, and the stream leaves it the same shape it entered.'
		},
		{
			id: 'blocks',
			label: `× ${nLayer} blocks`,
			kind: 'blocks',
			shape: `S×${nEmbd}`,
			params: nLayer * 12 * nEmbd * nEmbd,
			caption: `The same shape stacked ×${nLayer} — only the learned weights differ.`,
			what: `The block repeats ${nLayer} times, identical in shape, different in learned weights. Early blocks tend to learn local, syntax-ish moves; later blocks compose them. The stream threads through all of them unchanged in shape: [S×${nEmbd}] in, [S×${nEmbd}] out.`
		},
		{
			id: 'head',
			label: 'LM Head → softmax',
			kind: 'head',
			shape: `S×${vocab}`,
			params: nEmbd * vocab,
			caption: `One matrix, ${vocab} scores, one softmax — and "little" wins the next-token lottery.`,
			what: `One last matrix turns each ${nEmbd}-dim vector into ${vocab} scores — one per vocabulary entry — and softmax turns scores into next-token probabilities. Every stage above exists to make this distribution sharp.`,
			math: `p(t_{i+1}\\mid t_{\\le i}) = \\operatorname{softmax}(x_i W_{\\text{head}})`
		}
	]);

	let selectedId = $state('attn');
	const selected = $derived(stages.find((s) => s.id === selectedId) ?? stages[0]);
	const totalParams = $derived(
		vocab * nEmbd + blockSize * nEmbd + nEmbd * vocab + nLayer * 12 * nEmbd * nEmbd
	);
	const blockStages = ['norm1', 'attn', 'res1', 'norm2', 'mlp', 'res2'];

	const COLOR: Record<Stage['kind'], string> = {
		io: 'var(--color-text-muted)',
		embed: ink(CH.gold),
		norm: 'var(--color-note)',
		attn: ink(CH.attn),
		res: ink(CH.gold),
		mlp: ink(CH.bronze, 78),
		blocks: ink(CH.gold),
		head: 'var(--color-challenge)'
	};

	function fmtParams(n: number): string {
		if (n === 0) return '—';
		return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : (n / 1e3).toFixed(1) + 'k';
	}

	// ── spine geometry (px units; rows align with the fixed-height buttons) ──
	const ROW_H = 46;
	const SPINE_W = 56;
	const BAND_X = 36;
	const rowIndex = $derived(Object.fromEntries(stages.map((s, i) => [s.id, i] as const)));
	const cy = (id: string) => rowIndex[id] * ROW_H + ROW_H / 2;
	const spineH = $derived(stages.length * ROW_H);
	const bracketMid = $derived(((rowIndex['norm1'] + rowIndex['res2'] + 1) * ROW_H) / 2);
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-3 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		The pocket model, stage by stage
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		This is the exact architecture you train in Part 5 — {nLayer} blocks, d={nEmbd}, {nHead} heads,
		{fmtParams(totalParams)} parameters. Click any stage; the example follows the prompt
		<span style="font-family: var(--font-mono); color: var(--color-text-secondary);"
			>"Once upon a time , the"</span
		>.
	</p>

	<div class="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-start">
		<!-- ── the spine: one continuous residual band with stage nodes ── -->
		<div class="flex w-full items-start sm:w-auto sm:min-w-[230px] sm:flex-shrink-0">
			<svg
				width={SPINE_W}
				height={spineH}
				class="flex-shrink-0"
				aria-hidden="true"
				style="overflow: visible;"
			>
				<defs>
					<linearGradient id="arch-spine-band" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stop-color={CH.gold} stop-opacity="0.22" />
						<stop offset="1" stop-color={CH.gold} stop-opacity="0.55" />
					</linearGradient>
				</defs>

				<!-- the residual band: born at the embeddings, ends at the head -->
				<rect
					x={BAND_X - 6}
					y={cy('embed')}
					width="12"
					height={cy('head') - cy('embed')}
					rx="6"
					fill="url(#arch-spine-band)"
				/>

				<!-- tokens feed the embeddings -->
				<line
					x1={BAND_X}
					y1={cy('tokens') + 8}
					x2={BAND_X}
					y2={cy('embed') - 8}
					stroke="var(--color-border)"
					stroke-width="1.5"
					stroke-dasharray="3 3"
				/>

				<!-- branches: split at the norm, merge at the + -->
				<path
					d="M {BAND_X} {cy('norm1')} C 16 {cy('norm1')}, 16 {cy('res1')}, {BAND_X} {cy('res1')}"
					fill="none"
					stroke={CH.attn}
					stroke-width="3.5"
					opacity="0.5"
				/>
				<path
					d="M {BAND_X} {cy('norm2')} C 16 {cy('norm2')}, 16 {cy('res2')}, {BAND_X} {cy('res2')}"
					fill="none"
					stroke={CH.bronze}
					stroke-width="3.5"
					opacity="0.55"
				/>

				<!-- × N bracket around the block rows -->
				<path
					d="M 7 {rowIndex['norm1'] * ROW_H + 5} L 3 {rowIndex['norm1'] * ROW_H + 5} L 3 {rowIndex[
						'res2'
					] *
						ROW_H +
						ROW_H -
						5} L 7 {rowIndex['res2'] * ROW_H + ROW_H - 5}"
					fill="none"
					stroke="var(--color-text-muted)"
					stroke-width="1.2"
				/>
				<text
					class="bracket-lbl"
					transform="rotate(-90 14 {bracketMid})"
					x="14"
					y={bracketMid}
					text-anchor="middle">× {nLayer}</text
				>

				<!-- stage nodes -->
				{#each stages as s (s.id)}
					{@const active = s.id === selectedId}
					{#if active}
						<circle
							cx={BAND_X}
							cy={cy(s.id)}
							r="13"
							fill="none"
							stroke={COLOR[s.kind]}
							stroke-width="1.5"
							opacity="0.55"
						/>
					{/if}
					<circle
						class="spine-node"
						cx={BAND_X}
						cy={cy(s.id)}
						r={active ? 8 : 5.5}
						fill="var(--color-surface)"
						stroke={COLOR[s.kind]}
						stroke-width={active ? 2.5 : 1.8}
					/>
					{#if s.kind === 'res'}
						<path
							d="M {BAND_X - 3} {cy(s.id)} L {BAND_X + 3} {cy(s.id)} M {BAND_X} {cy(s.id) -
								3} L {BAND_X} {cy(s.id) + 3}"
							stroke={COLOR[s.kind]}
							stroke-width="1.5"
						/>
					{/if}
				{/each}
			</svg>

			<!-- the stage buttons, one fixed-height row per node -->
			<div class="flex flex-1 flex-col">
				{#each stages as s (s.id)}
					<div class="flex items-center" style="height: {ROW_H}px;">
						<button
							class="stage-btn w-full rounded-md border px-3 py-1.5 text-left text-[12.5px]"
							class:ml-2={blockStages.includes(s.id)}
							style="border-color: {selectedId === s.id
								? COLOR[s.kind]
								: 'var(--color-border-light)'}; background: {selectedId === s.id
								? 'color-mix(in srgb, ' + COLOR[s.kind] + ' 10%, transparent)'
								: 'transparent'};"
							aria-pressed={selectedId === s.id}
							onclick={() => (selectedId = s.id)}
						>
							<span class="font-semibold" style="color: {COLOR[s.kind]};">{s.label}</span>
							<span
								class="ml-1 text-[10.5px] whitespace-nowrap"
								style="color: var(--color-text-muted); font-family: var(--font-mono);"
								>{s.shape}</span
							>
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- ── the stage detail: vignette + caption + prose + math ── -->
		<div class="w-full flex-1 sm:min-w-[19rem] sm:basis-[26rem]">
			{#key selected.id}
				<div class="stage-detail">
					<div class="mb-1 flex items-baseline justify-between">
						<span class="text-sm font-bold" style="color: {COLOR[selected.kind]};"
							>{selected.label}</span
						>
						<span
							class="text-[11px]"
							style="color: var(--color-text-muted); font-family: var(--font-mono);"
						>
							{fmtParams(selected.params)} params{selected.params > 0 &&
							blockStages.includes(selected.id)
								? ' / block'
								: ''}
						</span>
					</div>

					<div
						class="vignette-box mb-3 rounded-lg border px-3 py-3"
						style="border-color: var(--color-border-light); background: color-mix(in srgb, var(--color-surface-hover) 55%, transparent);"
					>
						{#if selected.id === 'tokens'}
							<StageTokens {vocab} />
						{:else if selected.id === 'embed'}
							<StageEmbed {nEmbd} {vocab} />
						{:else if selected.id === 'norm1'}
							<StageNorm {nEmbd} guards="attention" />
						{:else if selected.id === 'attn'}
							<StageAttention {nEmbd} {nHead} {hd} />
						{:else if selected.id === 'res1'}
							<StageResidual {nEmbd} branch="attn" />
						{:else if selected.id === 'norm2'}
							<StageNorm {nEmbd} guards="the MLP" />
						{:else if selected.id === 'mlp'}
							<StageMlp {nEmbd} />
						{:else if selected.id === 'res2'}
							<StageResidual {nEmbd} branch="mlp" />
						{:else if selected.id === 'blocks'}
							<StageBlocks {nLayer} {nEmbd} />
						{:else if selected.id === 'head'}
							<StageHead {nEmbd} {vocab} />
						{/if}
					</div>

					<p class="mb-2 text-[12px] italic" style="color: {COLOR[selected.kind]}; opacity: 0.85;">
						{selected.caption}
					</p>
					<p class="mb-3 text-[13.5px] leading-relaxed" style="color: var(--color-text-secondary);">
						{selected.what}
					</p>
					{#if selected.math}
						<Math tex={selected.math} display />
					{/if}
					{#if selected.note}
						<p class="mt-2 text-[11.5px] italic" style="color: var(--color-text-muted);">
							{selected.note}
						</p>
					{/if}
				</div>
			{/key}
		</div>
	</div>
</div>

<style>
	.stage-btn {
		cursor: pointer;
		color: var(--color-text);
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}
	.stage-btn:hover {
		border-color: var(--color-text-muted);
	}
	.spine-node {
		transition:
			r 200ms ease,
			stroke-width 200ms ease;
	}
	.bracket-lbl {
		font-family: var(--font-mono);
		font-size: 10px;
		fill: var(--color-text-muted);
	}
	/* A constant-height illustration frame: the vignette is centered inside it
	   and capped in height, so switching stages no longer jolts the panel. */
	.vignette-box {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 15rem;
	}
	.vignette-box :global(svg) {
		display: block;
		width: 100%;
		height: auto;
		max-height: 12rem;
	}
	.stage-detail {
		min-height: 24rem;
		animation: stage-in 200ms ease;
	}
	@keyframes stage-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.stage-detail {
			animation: none;
		}
		.spine-node {
			transition: none;
		}
	}
</style>
