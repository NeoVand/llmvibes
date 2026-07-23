<script lang="ts">
	// Vignette: one-hot row × embedding table → token vector; plus the
	// positional vector (diverging cells); = the stream entry x_i.
	// Follows the focus token "the" (id 262, position 5).
	import { CH, TOKENS, TOKEN_IDS, FOCUS, EMB, POS, X0 } from './palette';
	import VectorBar from './VectorBar.svelte';
	import CellStrip from './CellStrip.svelte';

	let { nEmbd, vocab }: { nEmbd: number; vocab: number } = $props();

	const VW = 720;
	const VH = 252;
	const MID = 128; // shared midline for the vector bars

	// mini one-hot strip
	const ohX = 18;
	const ohW = 108;
	const ohY = MID - 7;

	// embedding table: tall thin grid, V rows × d cols
	const mX = 172;
	const mY = 44;
	const mW = 58;
	const mH = 168;
	const rowY = $derived(mY + (TOKEN_IDS[FOCUS] / vocab) * mH);
</script>

<svg
	viewBox="0 0 {VW} {VH}"
	class="w-full"
	role="img"
	aria-label="One-hot row times the embedding table gives the token vector; adding the positional vector gives the stream entry"
>
	<!-- one-hot row -->
	<rect class="oh" x={ohX} y={ohY} width={ohW} height="14" rx="2" />
	<rect
		x={ohX + (TOKEN_IDS[FOCUS] / vocab) * ohW - 2.5}
		y={ohY - 2}
		width="5"
		height="18"
		rx="1.5"
		fill={CH.gold}
	/>
	<text class="lbl" x={ohX + ohW / 2} y={ohY - 9} text-anchor="middle"
		>one-hot({TOKEN_IDS[FOCUS]})</text
	>
	<text class="shape" x={ohX + ohW / 2} y={ohY + 29} text-anchor="middle">[1×{vocab}]</text>

	<text class="op" x="149" y={MID + 5} text-anchor="middle">×</text>

	<!-- embedding table -->
	<rect class="mat" x={mX} y={mY} width={mW} height={mH} rx="3" />
	{#each Array.from({ length: 20 }, (_, i) => i + 1) as r (r)}
		<line class="grid" x1={mX + 1} y1={mY + (r * mH) / 21} x2={mX + mW - 1} y2={mY + (r * mH) / 21} />
	{/each}
	{#each Array.from({ length: 3 }, (_, i) => i + 1) as c (c)}
		<line class="grid" x1={mX + (c * mW) / 4} y1={mY + 1} x2={mX + (c * mW) / 4} y2={mY + mH - 1} />
	{/each}
	<rect x={mX} y={rowY - 3} width={mW} height="6" rx="2" fill={CH.gold} fill-opacity="0.9" />
	<text class="lbl" x={mX + mW / 2} y={mY - 9} text-anchor="middle">E_tok</text>
	<text class="shape" x={mX + mW / 2} y={mY + mH + 16} text-anchor="middle">[{vocab}×{nEmbd}]</text>
	<text class="row-pick" x={mX + mW + 7} y={rowY + 4} text-anchor="start">row {TOKEN_IDS[FOCUS]}</text>

	<text class="op" x="288" y={MID + 5} text-anchor="middle">→</text>

	<!-- picked row as a vector -->
	<VectorBar
		x={310}
		y={MID}
		values={EMB[FOCUS]}
		width={118}
		amp={32}
		color={CH.gold}
		label={`E_tok[${TOKEN_IDS[FOCUS]}]`}
		shape="[1×{nEmbd}]"
	/>

	<circle class="plus" cx="456" cy={MID} r="11" />
	<text class="plus-t" x="456" y={MID + 5} text-anchor="middle">+</text>

	<!-- positional vector: diverging cells -->
	<CellStrip
		x={482}
		y={MID - 8}
		values={POS[FOCUS]}
		width={104}
		height={16}
		mode="diverging"
		label={`E_pos[${FOCUS}]`}
		shape="[1×{nEmbd}]"
	/>

	<text class="op" x="608" y={MID + 5} text-anchor="middle">=</text>

	<VectorBar
		x={624}
		y={MID}
		values={X0[FOCUS]}
		width={82}
		amp={32}
		color={CH.gold}
		label="x₅"
		shape="[1×{nEmbd}]"
	/>

	<text class="note" x={VW / 2} y={VH - 8} text-anchor="middle"
		>done for all 6 positions ("{TOKENS[0]}" … "{TOKENS[FOCUS]}") → the stream enters as [6×{nEmbd}]</text
	>
</svg>

<style>
	.oh {
		fill: var(--color-surface-hover);
		stroke: var(--color-border);
	}
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
	.shape,
	.note {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
	.op {
		font-family: var(--font-mono);
		font-size: 17px;
		fill: var(--color-text-secondary);
	}
	.plus {
		fill: none;
		stroke: var(--color-text-secondary);
		stroke-width: 1.5;
	}
	.plus-t {
		font-family: var(--font-mono);
		font-size: 15px;
		fill: var(--color-text-secondary);
	}
	.row-pick {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		fill: color-mix(in srgb, #d9a441 62%, var(--color-text));
	}
</style>
