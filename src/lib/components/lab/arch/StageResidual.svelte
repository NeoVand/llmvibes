<script lang="ts">
	// Vignette: the residual add. The gold stream flows vertically past a
	// junction; the branch output (plum for attention, bronze for the MLP)
	// curves in and is ADDED — drawn as bars: x + Δ = x′, same shape.
	import { CH, ink, RES_STREAM, RES_DELTA_ATTN, RES_DELTA_MLP } from './palette';
	import VectorBar from './VectorBar.svelte';

	let { nEmbd, branch }: { nEmbd: number; branch: 'attn' | 'mlp' } = $props();

	const delta = $derived(branch === 'attn' ? RES_DELTA_ATTN : RES_DELTA_MLP);
	const branchColor = $derived(branch === 'attn' ? CH.attn : CH.bronze);
	const branchLabel = $derived(branch === 'attn' ? 'Δ from attention' : 'Δ from the MLP');
	const sum = $derived(RES_STREAM.map((v, i) => v + delta[i]));

	const VW = 720;
	const VH = 236;
	const MID = 118;
	const bandX = 96; // stream band center
</script>

<svg
	viewBox="0 0 {VW} {VH}"
	class="w-full"
	role="img"
	aria-label="The residual stream flows past; the {branch === 'attn'
		? 'attention'
		: 'MLP'} output is added onto it"
>
	<defs>
		<linearGradient id="res-band-{branch}" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color={CH.gold} stop-opacity="0.28" />
			<stop offset="0.5" stop-color={CH.gold} stop-opacity="0.5" />
			<stop offset="1" stop-color={CH.gold} stop-opacity="0.65" />
		</linearGradient>
	</defs>

	<!-- the stream: a thick soft gold band, top to bottom -->
	<rect x={bandX - 14} y="0" width="28" height={VH} rx="10" fill="url(#res-band-{branch})" />
	<text
		class="stream-lbl"
		transform="rotate(-90 {bandX - 26} {MID})"
		x={bandX - 26}
		y={MID}
		text-anchor="middle">residual stream</text
	>

	<!-- the branch curving in -->
	<path
		class="branch"
		d="M 320 30 C 200 30, 150 46, {bandX + 10} {MID - 26}"
		style:stroke={branchColor}
	/>
	<path d="M {bandX + 14} {MID - 20} l 10 -10 l 2 12 z" fill={branchColor} />
	<text class="branch-lbl" x="330" y="34" text-anchor="start" fill={ink(branchColor)}
		>{branchLabel}</text
	>

	<!-- junction -->
	<circle class="junction" cx={bandX} cy={MID} r="13" />
	<text class="junction-t" x={bandX} y={MID + 5} text-anchor="middle">+</text>

	<!-- the add, as bars: x + Δ = x′ -->
	<VectorBar
		x={196}
		y={MID + 26}
		values={RES_STREAM}
		width={124}
		amp={34}
		color={CH.gold}
		label="stream x"
		shape="[6×{nEmbd}]"
	/>
	<text class="op" x="342" y={MID + 31} text-anchor="middle">+</text>
	<VectorBar
		x={364}
		y={MID + 26}
		values={delta}
		width={124}
		amp={34}
		color={branchColor}
		label="Δ"
		shape="[6×{nEmbd}]"
	/>
	<text class="op" x="510" y={MID + 31} text-anchor="middle">=</text>
	<VectorBar
		x={532}
		y={MID + 26}
		values={sum}
		width={124}
		amp={34}
		color={CH.gold}
		label="x′ = x + Δ"
		shape="[6×{nEmbd}]"
	/>

	<text class="note" x={(196 + 656) / 2} y={VH - 10} text-anchor="middle"
		>added, not replaced — the untouched copy of x is the gradient highway to layer 1</text
	>
</svg>

<style>
	.stream-lbl {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: color-mix(in srgb, #d9a441 62%, var(--color-text));
		letter-spacing: 0.08em;
	}
	.branch {
		fill: none;
		stroke-width: 9;
		stroke-linecap: round;
		opacity: 0.55;
	}
	.branch-lbl {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
	}
	.junction {
		fill: var(--color-surface);
		stroke: color-mix(in srgb, #d9a441 80%, var(--color-text));
		stroke-width: 2;
	}
	.junction-t {
		font-family: var(--font-mono);
		font-size: 15px;
		font-weight: 700;
		fill: color-mix(in srgb, #d9a441 62%, var(--color-text));
	}
	.op {
		font-family: var(--font-mono);
		font-size: 17px;
		fill: var(--color-text-secondary);
	}
	.note {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-muted);
	}
</style>
