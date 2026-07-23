<script lang="ts">
	// Vignette: the input is just integers. Six token chips with their IDs,
	// and the focus token expanded into its conceptual one-hot row — a 1×V
	// strip with a single lit cell.
	import { CH, ink, TOKENS, TOKEN_IDS, FOCUS } from './palette';

	let { vocab }: { vocab: number } = $props();

	const VW = 720;
	const VH = 208;
	const chipW = 92;
	const gap = 14;
	const rowW = TOKENS.length * chipW + (TOKENS.length - 1) * gap;
	const x0 = (VW - rowW) / 2;
	const chipY = 22;
	const chipH = 34;
	const cx = (i: number) => x0 + i * (chipW + gap) + chipW / 2;

	// one-hot strip
	const stripX = 70;
	const stripW = VW - 2 * stripX;
	const stripY = 142;
	const stripH = 18;
	const litX = $derived(stripX + (TOKEN_IDS[FOCUS] / vocab) * stripW);
</script>

<svg
	viewBox="0 0 {VW} {VH}"
	class="w-full"
	role="img"
	aria-label="Six prompt tokens as integer IDs; the last token expanded into a one-hot row of length {vocab}"
>
	<text class="axis-label" x={x0 - 12} y={chipY + 21} text-anchor="end">tokens</text>
	<text class="axis-label" x={x0 - 12} y={chipY + 52} text-anchor="end">ids</text>

	{#each TOKENS as tok, i (i)}
		{@const focus = i === FOCUS}
		<rect
			x={cx(i) - chipW / 2}
			y={chipY}
			width={chipW}
			height={chipH}
			rx="8"
			class="chip"
			style:stroke={focus ? CH.gold : 'var(--color-border)'}
			style:stroke-width={focus ? 2 : 1}
		/>
		<text class="chip-tok" x={cx(i)} y={chipY + 22} text-anchor="middle">{tok}</text>
		<text
			class="chip-id"
			x={cx(i)}
			y={chipY + 52}
			text-anchor="middle"
			style:fill={focus ? ink(CH.gold) : 'var(--color-text-muted)'}>{TOKEN_IDS[i]}</text
		>
	{/each}
	<text class="axis-label" x={x0 + rowW + 12} y={chipY + 52}>[6]</text>

	<!-- focus token drops into its one-hot row -->
	<path
		class="drop"
		d="M {cx(FOCUS)} {chipY + 58} C {cx(FOCUS)} {stripY - 32}, {litX} {stripY - 46}, {litX} {stripY -
			24}"
		style:stroke={CH.gold}
	/>
	<path
		d="M {litX} {stripY - 22} l -4 -7 l 8 0 z"
		fill={CH.gold}
	/>

	<!-- the 1×V one-hot strip: hatched "many cells", one lit -->
	<rect class="strip" x={stripX} y={stripY} width={stripW} height={stripH} rx="3" />
	{#each Array.from({ length: 47 }, (_, i) => i + 1) as t (t)}
		<line
			class="hatch"
			x1={stripX + (t * stripW) / 48}
			y1={stripY + 2}
			x2={stripX + (t * stripW) / 48}
			y2={stripY + stripH - 2}
		/>
	{/each}
	<rect x={litX - 4} y={stripY - 2} width="8" height={stripH + 4} rx="2" fill={CH.gold} />
	<text class="lit-label" x={litX} y={stripY + stripH + 17} text-anchor="middle"
		>index {TOKEN_IDS[FOCUS]} → 1</text
	>
	<text class="axis-label" x={stripX} y={stripY + stripH + 17} text-anchor="start">0</text>
	<text class="axis-label" x={stripX + stripW} y={stripY + stripH + 17} text-anchor="end"
		>{vocab - 1}</text
	>
	<text class="axis-label" x={stripX - 12} y={stripY + 13} text-anchor="end">"{TOKENS[FOCUS]}"</text>
	<text class="shape" x={stripX + stripW + 8} y={stripY + 13} text-anchor="start"
		>[1×{vocab}]</text
	>
	<text class="note" x={VW / 2} y={VH - 8} text-anchor="middle"
		>everything else in this row is 0 — an ID is just an address into the vocabulary</text
	>
</svg>

<style>
	.chip {
		fill: var(--color-surface-hover);
	}
	.chip-tok {
		font-family: var(--font-mono);
		font-size: 15px;
		font-weight: 600;
		fill: var(--color-text);
	}
	.chip-id {
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.axis-label,
	.shape {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
	.strip {
		fill: var(--color-surface-hover);
		stroke: var(--color-border);
	}
	.hatch {
		stroke: var(--color-border-light);
		stroke-width: 1;
	}
	.drop {
		fill: none;
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		opacity: 0.8;
	}
	.lit-label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		fill: color-mix(in srgb, #d9a441 62%, var(--color-text));
	}
	.note {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
</style>
