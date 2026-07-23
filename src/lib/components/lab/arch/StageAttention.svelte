<script lang="ts">
	// Vignette: causal self-attention, the centerpiece. Left: per-token
	// Q/K/V mini-strips (steel/copper/verdigris). Middle: the 6×6
	// lower-triangular weight matrix as plum circles (radius/opacity =
	// weight), masked cells as faint slashes; hovering a circle lights its
	// query row and key column. Right: the highlighted row's weights mixing
	// the V vectors into one output vector. Head buttons swap between
	// deterministic named patterns (previous-token, sink, recency, mixed).
	import {
		CH,
		ink,
		TOKENS,
		FOCUS,
		HD_SHOW,
		qkvFor,
		attnPattern,
		HEAD_KIND_LABEL
	} from './palette';
	import VectorBar from './VectorBar.svelte';

	let { nEmbd, nHead, hd }: { nEmbd: number; nHead: number; hd: number } = $props();

	let head = $state(0);
	let hover = $state<{ i: number; j: number } | null>(null);

	const qkv = $derived(qkvFor(head));
	const W = $derived(attnPattern(head));
	const activeRow = $derived(hover ? hover.i : FOCUS);
	const mix = $derived(
		Array.from({ length: HD_SHOW }, (_, d) =>
			W[activeRow].reduce((acc, w, j) => acc + w * qkv[j].v[d], 0)
		)
	);

	const VW = 720;
	const VH = 330;

	// left column: per-token Q/K/V strips
	const L = { x: 70, y: 64, rowH: 40, stripW: 106, stripH: 9 };
	// middle: the weight matrix
	const M = { x: 268, y: 64, cell: 40 };
	// right column: the weighted mix
	const R = { x: 542, w: 128 };

	const CHANNELS = ['q', 'k', 'v'] as const;
	const mag = (v: number) => Math.min(1, Math.abs(v));
</script>

<div class="head-row">
	<span class="head-title">head</span>
	{#each Array.from({ length: nHead }, (_, h) => h) as h (h)}
		<button class="head-btn" class:active={head === h} onclick={() => (head = h)}>{h + 1}</button>
	{/each}
	<span class="head-kind">— {HEAD_KIND_LABEL[head % 4]}</span>
</div>

<svg
	viewBox="0 0 {VW} {VH}"
	class="w-full"
	role="img"
	aria-label="Per-token query, key and value vectors; the 6 by 6 causal attention weight matrix for head {head +
		1}; and the weighted mix of values producing the output vector"
>
	<!-- ── left: Q/K/V per token ── -->
	<text class="col-title" x={L.x + L.stripW / 2 + 26} y="26" text-anchor="middle">
		<tspan fill={ink(CH.q)}>Q</tspan><tspan fill="var(--color-text-muted)"> · </tspan><tspan
			fill={ink(CH.k)}>K</tspan
		><tspan fill="var(--color-text-muted)"> · </tspan><tspan fill={ink(CH.v)}>V</tspan>
		<tspan fill="var(--color-text-muted)"> per token</tspan>
	</text>
	{#each TOKENS as tok, t (t)}
		{@const ty = L.y + t * L.rowH}
		<text
			class="tok-lbl"
			x={L.x - 8}
			y={ty + 20}
			text-anchor="end"
			style:fill={t === activeRow ? 'var(--color-text)' : 'var(--color-text-muted)'}
			style:font-weight={t === activeRow ? '700' : '400'}>{tok}</text
		>
		{#each CHANNELS as ch, c (ch)}
			{@const sy = ty + c * (L.stripH + 2)}
			{#each qkv[t][ch] as v, d (d)}
				<rect
					x={L.x + d * (L.stripW / HD_SHOW) + 1}
					y={sy + (1 - mag(v)) * L.stripH * 0.5}
					width={L.stripW / HD_SHOW - 2}
					height={Math.max(mag(v) * L.stripH, 1.5)}
					rx="1"
					fill={CH[ch]}
					fill-opacity={0.35 + 0.6 * mag(v)}
				/>
			{/each}
		{/each}
	{/each}
	<text class="shape" x={L.x + L.stripW / 2} y={L.y + 6 * L.rowH + 8} text-anchor="middle"
		>Q,K,V: [6×{hd}] each</text
	>

	<!-- ── middle: the causal weight matrix ── -->
	<text class="col-title-muted" x={M.x + 3 * M.cell} y="26" text-anchor="middle"
		>A = softmax(QKᵀ/√{hd} + M)</text
	>
	<text class="axis-hint" x={M.x + 3 * M.cell} y="44" text-anchor="middle">keys →</text>
	<text
		class="axis-hint"
		transform="rotate(-90 {M.x - 54} {M.y + 3 * M.cell})"
		x={M.x - 54}
		y={M.y + 3 * M.cell}
		text-anchor="middle">queries ↓</text
	>
	{#each TOKENS as tok, j (j)}
		<text
			class="key-lbl"
			x={M.x + j * M.cell + M.cell / 2}
			y={M.y - 6}
			text-anchor="middle"
			style:fill={hover && hover.j === j ? ink(CH.k) : 'var(--color-text-muted)'}
			style:font-weight={hover && hover.j === j ? '700' : '400'}>{tok}</text
		>
	{/each}
	{#each TOKENS as tok, i (i)}
		<text
			class="query-lbl"
			x={M.x - 8}
			y={M.y + i * M.cell + M.cell / 2 + 4}
			text-anchor="end"
			style:fill={i === activeRow ? ink(CH.q) : 'var(--color-text-muted)'}
			style:font-weight={i === activeRow ? '700' : '400'}>{tok}</text
		>
	{/each}

	<!-- active row wash -->
	<rect
		class="row-wash"
		x={M.x - 2}
		y={M.y + activeRow * M.cell + 2}
		width={6 * M.cell + 4}
		height={M.cell - 4}
		rx="6"
	/>

	{#each TOKENS as _, i (i)}
		{#each TOKENS as _k, j (j)}
			{@const cx = M.x + j * M.cell + M.cell / 2}
			{@const cy = M.y + i * M.cell + M.cell / 2}
			{#if j > i}
				<!-- masked: the future -->
				<line class="mask" x1={cx - 6} y1={cy + 6} x2={cx + 6} y2={cy - 6} />
			{:else}
				{@const w = W[i][j]}
				<circle
					cx={cx}
					cy={cy}
					r={3 + Math.sqrt(w) * 13}
					fill={CH.attn}
					fill-opacity={0.22 + 0.68 * w}
					stroke={hover && hover.i === i && hover.j === j ? ink(CH.attn) : 'none'}
					stroke-width="2"
				/>
				{#if i === activeRow}
					<text class="wval" x={cx} y={cy - M.cell / 2 + 11} text-anchor="middle"
						>{w.toFixed(2)}</text
					>
				{/if}
				<rect
					class="hit"
					x={M.x + j * M.cell}
					y={M.y + i * M.cell}
					width={M.cell}
					height={M.cell}
					onmouseenter={() => (hover = { i, j })}
					onmouseleave={() => (hover = null)}
				/>
			{/if}
		{/each}
	{/each}
	<text class="shape" x={M.x + 3 * M.cell} y={M.y + 6 * M.cell + 20} text-anchor="middle"
		>A: [6×6] · rows sum to 1</text
	>

	<!-- ── right: the weighted mix for the active query ── -->
	<text class="col-title-muted" x={R.x + R.w / 2} y="26" text-anchor="middle"
		>out = Σⱼ wⱼ · Vⱼ</text
	>
	<text class="mix-query" x={R.x + R.w / 2} y="48" text-anchor="middle"
		>query "{TOKENS[activeRow]}"</text
	>
	<!-- the active row's weights as a plum strip -->
	{#each W[activeRow] as w, j (j)}
		<rect
			x={R.x + j * (R.w / 6)}
			y={64}
			width={R.w / 6 - 2}
			height="13"
			rx="2"
			fill={CH.attn}
			fill-opacity={j <= activeRow ? 0.1 + 0.85 * w : 0.04}
		/>
	{/each}
	<text class="tiny-lbl" x={R.x - 8} y={74} text-anchor="end" fill={ink(CH.attn)}>w</text>
	<text class="op" x={R.x + R.w / 2} y={100} text-anchor="middle">×</text>
	<!-- the V vectors as a 6×8 verdigris grid -->
	{#each TOKENS as _, t (t)}
		{#each qkv[t].v as v, d (d)}
			<rect
				x={R.x + d * (R.w / HD_SHOW) + 1}
				y={110 + t * 13}
				width={R.w / HD_SHOW - 2}
				height="11"
				rx="1"
				fill={CH.v}
				fill-opacity={0.1 + 0.75 * mag(v)}
				opacity={t <= activeRow ? 1 : 0.25}
			/>
		{/each}
	{/each}
	<text class="tiny-lbl" x={R.x - 8} y={150} text-anchor="end" fill={ink(CH.v)}>V</text>
	<text class="shape" x={R.x + R.w + 8} y={150} text-anchor="start">[6×{hd}]</text>
	<text class="op" x={R.x + R.w / 2} y={212} text-anchor="middle">=</text>
	<VectorBar
		x={R.x}
		y={258}
		values={mix}
		width={R.w}
		amp={26}
		color={CH.attn}
		label={`head ${head + 1} out`}
		shape="[1×{hd}]"
	/>

	<text class="note" x={VW / 2} y={VH - 6} text-anchor="middle"
		>{nHead} heads run in parallel → concat [6×{nEmbd}] → W_O mixes them back into the stream</text
	>
</svg>

<style>
	.head-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}
	.head-title {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-text-muted);
		margin-right: 0.15rem;
	}
	.head-btn {
		width: 26px;
		height: 24px;
		border: 1px solid var(--color-border);
		border-radius: 0.4rem;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}
	.head-btn:hover {
		border-color: #b06a82;
	}
	.head-btn.active {
		border-color: #b06a82;
		background: color-mix(in srgb, #b06a82 14%, transparent);
		color: color-mix(in srgb, #b06a82 62%, var(--color-text));
		font-weight: 700;
	}
	.head-kind {
		font-size: 11px;
		font-style: italic;
		color: var(--color-text-muted);
	}

	.col-title {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 700;
	}
	.col-title-muted {
		font-family: var(--font-mono);
		font-size: 12px;
		fill: var(--color-text-secondary);
	}
	.axis-hint {
		font-family: var(--font-mono);
		font-size: 10px;
		fill: var(--color-text-muted);
	}
	.tok-lbl,
	.key-lbl,
	.query-lbl {
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.row-wash {
		fill: color-mix(in srgb, #b06a82 8%, transparent);
		stroke: color-mix(in srgb, #b06a82 30%, transparent);
		stroke-width: 1;
		transition: y 160ms ease;
	}
	.mask {
		stroke: var(--color-border);
		stroke-width: 1.5;
		opacity: 0.7;
	}
	.hit {
		fill: transparent;
	}
	.wval {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		fill: color-mix(in srgb, #b06a82 70%, var(--color-text));
	}
	.mix-query {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		fill: var(--color-text);
	}
	.tiny-lbl {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
	}
	.op {
		font-family: var(--font-mono);
		font-size: 15px;
		fill: var(--color-text-secondary);
	}
	.shape,
	.note {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
</style>
