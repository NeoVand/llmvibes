<script lang="ts">
	// Vignette: the block repeats. One block chip with depth shadows behind
	// it, the gold residual stream threading straight through the stack,
	// and the ×N multiplier from the real config.
	import { CH } from './palette';

	let { nLayer, nEmbd }: { nLayer: number; nEmbd: number } = $props();

	const VW = 720;
	const VH = 232;
	const bandX = 330; // stream center, threads through the chip
	const chip = { x: 210, y: 74, w: 240, h: 84 };
	const paramsPerBlock = $derived(12 * nEmbd * nEmbd);

	function fmt(n: number): string {
		return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : (n / 1e3).toFixed(0) + 'k';
	}
</script>

<svg
	viewBox="0 0 {VW} {VH}"
	class="w-full"
	role="img"
	aria-label="One transformer block repeated {nLayer} times, the residual stream threading through the stack"
>
	<defs>
		<linearGradient id="blocks-band" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color={CH.gold} stop-opacity="0.25" />
			<stop offset="1" stop-color={CH.gold} stop-opacity="0.6" />
		</linearGradient>
	</defs>

	<text class="io-lbl" x={bandX + 24} y="18">from the embeddings · [6×{nEmbd}]</text>
	<rect x={bandX - 12} y="4" width="24" height={VH - 30} rx="9" fill="url(#blocks-band)" />
	<path d="M {bandX} {VH - 20} l -7 -11 l 14 0 z" fill={CH.gold} fill-opacity="0.8" />
	<text class="io-lbl" x={bandX + 24} y={VH - 16}>to the LM head · still [6×{nEmbd}]</text>

	<!-- depth shadows: the blocks behind this one -->
	{#each [3, 2, 1] as d (d)}
		<rect
			class="chip-shadow"
			x={chip.x + d * 11}
			y={chip.y - d * 9}
			width={chip.w}
			height={chip.h}
			rx="12"
			opacity={0.55 - d * 0.13}
		/>
	{/each}

	<!-- the block chip -->
	<rect class="chip" x={chip.x} y={chip.y} width={chip.w} height={chip.h} rx="12" />
	<text class="chip-line" x={chip.x + chip.w / 2} y={chip.y + 33} text-anchor="middle"
		>RMSNorm → attention → +</text
	>
	<text class="chip-line" x={chip.x + chip.w / 2} y={chip.y + 59} text-anchor="middle"
		>RMSNorm → MLP → +</text
	>

	<!-- the multiplier -->
	<text class="mult" x={chip.x + chip.w + 58} y={chip.y + chip.h / 2 + 2} text-anchor="start"
		>× {nLayer}</text
	>
	<text class="mult-sub" x={chip.x + chip.w + 58} y={chip.y + chip.h / 2 + 26} text-anchor="start"
		>same shape, different weights</text
	>

	<text class="params" x={chip.x + chip.w / 2} y={chip.y + chip.h + 26} text-anchor="middle"
		>12·d² = {fmt(paramsPerBlock)} params / block · {fmt(nLayer * paramsPerBlock)} total</text
	>
</svg>

<style>
	.chip {
		fill: var(--color-surface);
		stroke: color-mix(in srgb, #d9a441 55%, var(--color-border));
		stroke-width: 1.5;
	}
	.chip-shadow {
		fill: var(--color-surface-hover);
		stroke: var(--color-border);
		stroke-width: 1;
	}
	.chip-line {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 600;
		fill: var(--color-text);
	}
	.mult {
		font-family: var(--font-heading);
		font-size: 34px;
		font-weight: 700;
		fill: color-mix(in srgb, #d9a441 70%, var(--color-text));
	}
	.mult-sub {
		font-size: 11px;
		font-style: italic;
		fill: var(--color-text-muted);
	}
	.io-lbl,
	.params {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
</style>
