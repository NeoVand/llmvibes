<script lang="ts">
	// Vignette: RMSNorm. An uneven vector goes in, the same-shaped vector
	// scaled to unit RMS comes out; the learned per-channel γ is drawn as a
	// row of multiplier dots over the output bars.
	import { CH, NORM_IN, NORM_RMS, NORM_OUT, GAMMA } from './palette';
	import VectorBar from './VectorBar.svelte';

	let { nEmbd, guards }: { nEmbd: number; guards: string } = $props();

	const VW = 720;
	const VH = 226;
	const MID = 118;
	const barW = 224;
	const slot = barW / NORM_OUT.length;
</script>

<svg
	viewBox="0 0 {VW} {VH}"
	class="w-full"
	role="img"
	aria-label="RMSNorm: an uneven vector is rescaled to unit RMS, then gamma stretches each channel"
>
	<VectorBar
		x={40}
		y={MID}
		values={NORM_IN}
		width={barW}
		amp={52}
		color={CH.gold}
		dim
		label={`x · rms = ${NORM_RMS.toFixed(2)}`}
		shape="[1×{nEmbd}] per token"
	/>

	<!-- ÷ rms arrow -->
	<line class="arrow" x1="292" y1={MID} x2="392" y2={MID} />
	<path d="M 392 {MID} l -9 -5 l 0 10 z" fill="var(--color-text-secondary)" />
	<text class="op" x="342" y={MID - 12} text-anchor="middle">÷ rms(x)</text>
	<text class="op-sub" x="342" y={MID + 22} text-anchor="middle">then × γ</text>

	<!-- γ multiplier dots, one per channel, radius = the learned scale -->
	{#each GAMMA as g, i (i)}
		<circle
			class="gdot"
			cx={416 + i * slot + slot / 2}
			cy={MID - 64}
			r={2.2 + g * 2.6}
			fill-opacity={0.35 + 0.4 * g}
		/>
	{/each}
	<text class="gamma" x={416 - 10} y={MID - 60} text-anchor="end">γ</text>

	<VectorBar
		x={416}
		y={MID}
		values={NORM_OUT.map((v, i) => v * GAMMA[i])}
		width={barW}
		amp={52}
		color={CH.gold}
		label="RMSNorm(x) · rms = 1.00"
		shape="[1×{nEmbd}] per token"
	/>

	<text class="note" x={VW / 2} y={VH - 6} text-anchor="middle"
		>same direction, unit size — this one guards {guards}</text
	>
</svg>

<style>
	.arrow {
		stroke: var(--color-text-secondary);
		stroke-width: 1.5;
	}
	.op {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 600;
		fill: var(--color-text);
	}
	.op-sub {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
	.gdot {
		fill: var(--color-note);
	}
	.gamma {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 600;
		fill: var(--color-note);
	}
	.note {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
</style>
