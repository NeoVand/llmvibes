<script lang="ts">
	// A vector drawn as a strip of colored cells (heatmap row) — used where
	// bars would be the wrong metaphor: positional encodings (diverging
	// steel ↔ copper), attention-weight rows (mono plum, opacity = weight).
	// Renders as an SVG <g>; must sit inside an <svg>.
	import { CH } from './palette';

	let {
		x = 0,
		y = 0,
		values,
		width = 140,
		height = 14,
		mode = 'diverging',
		color = CH.attn,
		label = '',
		shape = ''
	}: {
		x?: number;
		y?: number;
		values: number[];
		width?: number;
		height?: number;
		/** diverging: negative → steel, positive → copper; mono: one hue, opacity = value */
		mode?: 'diverging' | 'mono';
		color?: string;
		label?: string;
		shape?: string;
	} = $props();

	const cw = $derived(width / values.length);
	const mag = (v: number) => Math.min(1, Math.abs(v));
</script>

<g transform="translate({x} {y})">
	{#each values as v, i (i)}
		<rect
			x={i * cw}
			y="0"
			width={cw}
			{height}
			fill={mode === 'diverging' ? (v >= 0 ? CH.k : CH.q) : color}
			fill-opacity={mode === 'diverging' ? 0.12 + 0.78 * mag(v) : 0.1 + 0.85 * mag(v)}
		/>
	{/each}
	<rect class="cs-frame" x="0" y="0" {width} {height} rx="2" />
	{#if label}
		<text class="cs-label" x={width / 2} y="-7" text-anchor="middle">{label}</text>
	{/if}
	{#if shape}
		<text class="cs-shape" x={width / 2} y={height + 15} text-anchor="middle">{shape}</text>
	{/if}
</g>

<style>
	.cs-frame {
		fill: none;
		stroke: var(--color-border);
		stroke-width: 1;
	}
	.cs-label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		fill: var(--color-text-secondary);
	}
	.cs-shape {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
</style>
