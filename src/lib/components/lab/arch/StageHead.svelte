<script lang="ts">
	// Vignette: the LM head. The final vector for "the" times the
	// unembedding matrix gives vocab-many logits; softmax turns them into
	// next-token probabilities. Drawn back-to-back: logit bars grow left,
	// probability bars grow right, softmax between — winner in gold.
	import { CH, ink, TOKENS, FOCUS, HEAD_IN, CANDS, LOGITS, PROBS } from './palette';
	import VectorBar from './VectorBar.svelte';

	let { nEmbd, vocab }: { nEmbd: number; vocab: number } = $props();

	const VW = 720;
	const VH = 300;

	// left: vector × unembedding grid
	const vbY = 128;
	const mX = 178;
	const mY = 54;
	const mW = 54;
	const mH = 150;

	// tornado chart
	const rowY0 = 62;
	const rowH = 26;
	const cLab = 452; // center of the shared token-label column
	const labHalf = 34;
	const maxBarL = 110; // logit bars grow left from cLab - labHalf
	const maxBarR = 150; // prob bars grow right from cLab + labHalf
	const maxLogit = Math.max(...LOGITS);
	const maxProb = Math.max(...PROBS);
	const winner = PROBS.indexOf(maxProb);
</script>

<svg
	viewBox="0 0 {VW} {VH}"
	class="w-full"
	role="img"
	aria-label="The final vector times the unembedding matrix gives {vocab} logits; softmax turns them into probabilities and '{CANDS[
		winner
	]}' wins"
>
	<!-- final vector for the focus token -->
	<VectorBar
		x={20}
		y={vbY}
		values={HEAD_IN}
		width={118}
		amp={34}
		color={CH.gold}
		label={`x₅ ("${TOKENS[FOCUS]}")`}
		shape="[1×{nEmbd}]"
	/>

	<text class="op" x="158" y={vbY + 5} text-anchor="middle">×</text>

	<!-- unembedding matrix -->
	<rect class="mat" x={mX} y={mY} width={mW} height={mH} rx="3" />
	{#each Array.from({ length: 17 }, (_, i) => i + 1) as r (r)}
		<line
			class="grid"
			x1={mX + 1}
			y1={mY + (r * mH) / 18}
			x2={mX + mW - 1}
			y2={mY + (r * mH) / 18}
		/>
	{/each}
	{#each Array.from({ length: 3 }, (_, i) => i + 1) as c (c)}
		<line class="grid" x1={mX + (c * mW) / 4} y1={mY + 1} x2={mX + (c * mW) / 4} y2={mY + mH - 1} />
	{/each}
	<text class="lbl" x={mX + mW / 2} y={mY - 9} text-anchor="middle">W_head</text>
	<text class="shape" x={mX + mW / 2} y={mY + mH + 16} text-anchor="middle">[{nEmbd}×{vocab}]</text>

	<line class="arrow" x1={mX + mW + 12} y1={vbY} x2={mX + mW + 52} y2={vbY} />
	<path d="M {mX + mW + 52} {vbY} l -9 -5 l 0 10 z" fill="var(--color-text-secondary)" />

	<!-- headers -->
	<text class="hdr" x={cLab - labHalf - maxBarL / 2} y="34" text-anchor="middle"
		>logits · [1×{vocab}]</text
	>
	<text class="hdr-soft" x={cLab} y="34" text-anchor="middle">softmax →</text>
	<text class="hdr" x={cLab + labHalf + maxBarR / 2} y="34" text-anchor="middle">p(next token)</text
	>

	<!-- top-8 back-to-back bars -->
	{#each CANDS as tok, i (i)}
		{@const y = rowY0 + i * rowH}
		{@const lw = Math.max((Math.max(LOGITS[i], 0) / maxLogit) * maxBarL, 2)}
		{@const pw = Math.max((PROBS[i] / maxProb) * maxBarR, 2)}
		{@const win = i === winner}
		<rect
			x={cLab - labHalf - lw}
			y={y + 4}
			width={lw}
			height={rowH - 10}
			rx="3"
			fill="var(--color-text-muted)"
			fill-opacity="0.45"
		/>
		<text class="val" x={cLab - labHalf - lw - 6} y={y + rowH / 2 + 2} text-anchor="end"
			>{LOGITS[i].toFixed(1)}</text
		>
		<text
			class="tok"
			x={cLab}
			y={y + rowH / 2 + 3}
			text-anchor="middle"
			style:fill={win ? ink(CH.gold) : 'var(--color-text-secondary)'}
			style:font-weight={win ? '700' : '400'}>{tok}</text
		>
		<rect
			x={cLab + labHalf}
			y={y + 4}
			width={pw}
			height={rowH - 10}
			rx="3"
			fill={win ? CH.gold : CH.attn}
			fill-opacity={win ? 0.9 : 0.55}
		/>
		<text
			class="val"
			x={cLab + labHalf + pw + 6}
			y={y + rowH / 2 + 2}
			text-anchor="start"
			style:fill={win ? ink(CH.gold) : 'var(--color-text-muted)'}
			style:font-weight={win ? '700' : '400'}>{(PROBS[i] * 100).toFixed(0)}%</text
		>
	{/each}

	<text class="note" x={VW / 2} y={VH - 8} text-anchor="middle"
		>top 8 of {vocab} shown — "Once upon a time, the ___" → "{CANDS[winner]}" ({(
			PROBS[winner] * 100
		).toFixed(0)}%)</text
	>
</svg>

<style>
	.mat {
		fill: var(--color-surface-hover);
		stroke: var(--color-border);
	}
	.grid {
		stroke: var(--color-border-light);
		stroke-width: 1;
	}
	.lbl {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		fill: var(--color-text-secondary);
	}
	.arrow {
		stroke: var(--color-text-secondary);
		stroke-width: 1.5;
	}
	.op {
		font-family: var(--font-mono);
		font-size: 17px;
		fill: var(--color-text-secondary);
	}
	.hdr {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		fill: var(--color-text-secondary);
	}
	.hdr-soft {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		fill: color-mix(in srgb, #b06a82 62%, var(--color-text));
	}
	.tok {
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.val {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
	.shape,
	.note {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
</style>
