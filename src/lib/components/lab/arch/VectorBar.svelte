<script lang="ts">
	// A d-dimensional vector drawn as signed bars around a midline axis —
	// the shared "this is a token vector" glyph across all ArchExplorer
	// vignettes. Renders as an SVG <g>; must sit inside an <svg>.
	// Opacity ramps with |value| so big channels glow and small ones recede.
	let {
		x = 0,
		y = 0,
		values,
		width = 140,
		amp = 30,
		color,
		label = '',
		shape = '',
		dim = false
	}: {
		x?: number;
		y?: number;
		values: number[];
		width?: number;
		/** max bar half-height in viewBox units */
		amp?: number;
		color: string;
		/** small colored label above the bars */
		label?: string;
		/** mono shape annotation below, e.g. [1×128] */
		shape?: string;
		/** render faded (used for "before" states) */
		dim?: boolean;
	} = $props();

	const slot = $derived(width / values.length);
	const bw = $derived(Math.max(2, slot - 2));
	const clamp = (v: number) => Math.max(-1, Math.min(1, v));
</script>

<g transform="translate({x} {y})" opacity={dim ? 0.55 : 1}>
	<line class="vb-axis" x1="0" y1="0" x2={width} y2="0" />
	{#each values as v, i (i)}
		{@const h = Math.max(Math.abs(clamp(v)) * amp, 1.5)}
		<rect
			x={i * slot + (slot - bw) / 2}
			y={v >= 0 ? -h : 0}
			width={bw}
			height={h}
			rx="1"
			fill={color}
			fill-opacity={0.35 + 0.6 * Math.min(1, Math.abs(v))}
		/>
	{/each}
	{#if label}
		<text class="vb-label" x={width / 2} y={-amp - 9} text-anchor="middle" fill={color}
			>{label}</text
		>
	{/if}
	{#if shape}
		<text class="vb-shape" x={width / 2} y={amp + 17} text-anchor="middle">{shape}</text>
	{/if}
</g>

<style>
	.vb-axis {
		stroke: var(--color-border);
		stroke-width: 1;
	}
	.vb-label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
	}
	.vb-shape {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
</style>
