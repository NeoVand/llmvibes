<script lang="ts">
	// Vignette: the per-token MLP. d dims widen to 4d (amber block, pre-ReLU
	// negatives drawn dying at the axis), a ReLU kink glyph marks the
	// nonlinearity, then W2 projects back down to d (bronze).
	import { CH, MLP_IN, MLP_HID, MLP_OUT } from './palette';
	import VectorBar from './VectorBar.svelte';

	let { nEmbd }: { nEmbd: number } = $props();

	const VW = 720;
	const VH = 252;
	const MID = 128;

	// hidden block geometry
	const hx = 258;
	const hw = 236;
	const slot = hw / MLP_HID.length;
	const mag = (v: number) => Math.min(1, Math.abs(v));
</script>

<svg
	viewBox="0 0 {VW} {VH}"
	class="w-full"
	role="img"
	aria-label="The MLP widens each token vector from {nEmbd} to {4 *
		nEmbd} dimensions, applies ReLU, and projects back down"
>
	<VectorBar
		x={36}
		y={MID}
		values={MLP_IN}
		width={128}
		amp={36}
		color={CH.gold}
		label="x"
		shape="[1×{nEmbd}]"
	/>

	<line class="arrow" x1="176" y1={MID} x2="246" y2={MID} />
	<path d="M 246 {MID} l -9 -5 l 0 10 z" fill="var(--color-text-secondary)" />
	<text class="wlbl" x="211" y={MID - 12} text-anchor="middle">W₁</text>
	<text class="wshape" x="211" y={MID + 22} text-anchor="middle">[{nEmbd}×{4 * nEmbd}]</text>

	<!-- ReLU kink glyph -->
	<g transform="translate({hx + hw / 2 - 20} 22)">
		<rect class="glyph-box" x="0" y="0" width="40" height="26" rx="6" />
		<polyline class="glyph-line" points="6,19 20,19 34,6" />
	</g>
	<text class="glyph-lbl" x={hx + hw / 2 + 32} y="40" text-anchor="start">ReLU</text>

	<!-- hidden 4d block: pre-activation bars; negatives die (faded, cut) -->
	<line class="vb-axis" x1={hx} y1={MID} x2={hx + hw} y2={MID} />
	{#each MLP_HID as v, i (i)}
		{@const h = Math.max(mag(v) * 44, 1.5)}
		{#if v >= 0}
			<rect
				x={i * slot + hx + 0.5}
				y={MID - h}
				width={slot - 1.5}
				height={h}
				rx="1"
				fill={CH.hidden}
				fill-opacity={0.45 + 0.5 * mag(v)}
			/>
		{:else}
			<!-- killed by ReLU: ghost of the negative pre-activation -->
			<rect
				x={i * slot + hx + 0.5}
				y={MID}
				width={slot - 1.5}
				height={h}
				rx="1"
				fill="var(--color-text-muted)"
				fill-opacity="0.18"
			/>
			<line
				class="cut"
				x1={i * slot + hx + 0.5}
				y1={MID + 1}
				x2={i * slot + hx + slot - 1}
				y2={MID + 1}
			/>
		{/if}
	{/each}
	<text class="hid-lbl" x={hx + hw / 2} y={MID - 58} text-anchor="middle">h = ReLU(W₁x)</text>
	<text class="wshape" x={hx + hw / 2} y={MID + 62} text-anchor="middle"
		>[1×{4 * nEmbd}] — negatives zeroed</text
	>

	<line class="arrow" x1="506" y1={MID} x2="576" y2={MID} />
	<path d="M 576 {MID} l -9 -5 l 0 10 z" fill="var(--color-text-secondary)" />
	<text class="wlbl" x="541" y={MID - 12} text-anchor="middle">W₂</text>
	<text class="wshape" x="541" y={MID + 22} text-anchor="middle">[{4 * nEmbd}×{nEmbd}]</text>

	<VectorBar
		x={586}
		y={MID}
		values={MLP_OUT}
		width={120}
		amp={36}
		color={CH.bronze}
		label="out"
		shape="[1×{nEmbd}]"
	/>

	<text class="note" x={VW / 2} y={VH - 8} text-anchor="middle"
		>per token, independently — no mixing: [6×{nEmbd}] → [6×{4 * nEmbd}] → [6×{nEmbd}]</text
	>
</svg>

<style>
	.arrow {
		stroke: var(--color-text-secondary);
		stroke-width: 1.5;
	}
	.wlbl {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 700;
		fill: var(--color-text);
	}
	.wshape {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
	.vb-axis {
		stroke: var(--color-border);
	}
	.cut {
		stroke: var(--color-caution);
		stroke-width: 2;
		opacity: 0.55;
	}
	.glyph-box {
		fill: var(--color-surface-hover);
		stroke: var(--color-border);
	}
	.glyph-line {
		fill: none;
		stroke: color-mix(in srgb, #ecc068 55%, var(--color-text));
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.glyph-lbl {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		fill: color-mix(in srgb, #ecc068 45%, var(--color-text));
	}
	.hid-lbl {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		fill: color-mix(in srgb, #ecc068 45%, var(--color-text));
	}
	.note {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
</style>
