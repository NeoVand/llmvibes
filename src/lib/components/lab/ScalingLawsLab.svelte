<script lang="ts" module>
	let uid = 0;
</script>

<script lang="ts">
	// The scaling-laws map, live. Chinchilla's fitted loss surface
	// L(N, D) = E + A/N^α + B/D^β, sliced one curve per model size N with
	// D = C/(6N) — so each curve is "this model, fed more compute". The lower
	// envelope is THE scaling law: the compute-efficient frontier. Drag the
	// compute budget and read off the optimal N*, D*, and loss from the closed
	// form (N* ∝ C^{β/(α+β)}); toggle the second panel to see the two power
	// laws that split every FLOP between parameters and tokens.
	import { ChartLine } from 'lucide-svelte';
	import Slider from '../ui/Slider.svelte';
	import Formula from '../ui/Math.svelte';

	uid += 1;
	const gid = `sclaw-${uid}`;

	// ── Chinchilla parametric fit (Hoffmann et al. 2022, approach 3) ──
	const E = 1.69;
	const CA = 406.4;
	const CB = 410.7;
	const ALPHA = 0.34;
	const BETA = 0.28;
	// compute-optimal exponents, derived — N* ∝ C^a, D* ∝ C^b, a + b = 1
	const EXP_A = BETA / (ALPHA + BETA); // ≈ 0.45
	const EXP_B = ALPHA / (ALPHA + BETA); // ≈ 0.55
	const G = ((ALPHA * CA) / (BETA * CB)) ** (1 / (ALPHA + BETA));

	function lossOf(n: number, d: number): number {
		return E + CA / n ** ALPHA + CB / d ** BETA;
	}
	function nStar(c: number): number {
		return G * (c / 6) ** EXP_A;
	}
	function lossAt(lc: number, n: number): number {
		return lossOf(n, 10 ** lc / (6 * n));
	}
	function lStar(lc: number): number {
		const c = 10 ** lc;
		const n = nStar(c);
		return lossOf(n, c / (6 * n));
	}
	// log10 of the compute where model size n IS the optimum (envelope tangency)
	function lcTangent(n: number): number {
		return Math.log10(6) + (Math.log10(n) - Math.log10(G)) / EXP_A;
	}

	// ── plot geometry: both axes log10 ──
	const W = 760;
	const H = 420;
	const MG = { top: 26, right: 96, bottom: 48, left: 56 };
	const PW = W - MG.left - MG.right;
	const PH = H - MG.top - MG.bottom;
	const LX0 = 17; // 10^17 FLOPs
	const LX1 = 24; // 10^24 FLOPs
	const LY0 = Math.log10(0.8);
	const LY1 = Math.log10(5);

	const sx = (lc: number) => MG.left + ((lc - LX0) / (LX1 - LX0)) * PW;
	const sy = (loss: number) => MG.top + ((LY1 - Math.log10(loss)) / (LY1 - LY0)) * PH;
	const xToLc = (x: number) => LX0 + ((x - MG.left) / PW) * (LX1 - LX0);

	// ── the curve family: one loss-vs-compute curve per model size ──
	const SIZES = [
		{ n: 1e7, label: '10M', color: '#6d28d9' },
		{ n: 10 ** 7.8, label: '63M', color: '#7c3aed' },
		{ n: 10 ** 8.6, label: '398M', color: '#9333ea' },
		{ n: 10 ** 9.4, label: '2.5B', color: '#a855f7' },
		{ n: 10 ** 10.2, label: '16B', color: '#d946ef' },
		{ n: 1e11, label: '100B', color: '#f472b6' }
	];

	const lcSamples = Array.from({ length: 141 }, (_, i) => LX0 + (i * (LX1 - LX0)) / 140);

	function pathOf(f: (lc: number) => number): string {
		return lcSamples
			.map((lc, i) => `${i === 0 ? 'M' : 'L'}${sx(lc).toFixed(1)} ${sy(f(lc)).toFixed(1)}`)
			.join(' ');
	}

	const curves = SIZES.map((s, i) => {
		const lcT = lcTangent(s.n);
		return {
			...s,
			i,
			path: pathOf((lc) => lossAt(lc, s.n)),
			// where along the x-axis this size touches the frontier (0..1, clamped)
			t: Math.min(1, Math.max(0, (lcT - LX0) / (LX1 - LX0))),
			lcT
		};
	});
	const frontierPath = pathOf(lStar);

	// frontier label: rotated to sit along the envelope
	const flMid = 21.4;
	const flAngle =
		(Math.atan2(sy(lStar(22.4)) - sy(lStar(20.4)), sx(22.4) - sx(20.4)) * 180) / Math.PI;

	// ── interactive compute budget ──
	let lcC = $state(21.5);
	let dragging = $state(false);
	let hovered = $state<{ i: number; x: number; y: number } | null>(null);
	let svgEl: SVGSVGElement | undefined = $state();

	const cNow = $derived(10 ** lcC);
	const nOpt = $derived(nStar(cNow));
	const dOpt = $derived(cNow / (6 * nOpt));
	const ratioOpt = $derived(dOpt / nOpt);
	const lossOpt = $derived(lossOf(nOpt, dOpt));

	// ── formatting ──
	function trim(v: number): string {
		return v >= 9.95 ? Math.round(v).toString() : v.toFixed(1);
	}
	function fmtCount(n: number): string {
		if (n >= 1e12) return trim(n / 1e12) + 'T';
		if (n >= 1e9) return trim(n / 1e9) + 'B';
		if (n >= 1e6) return trim(n / 1e6) + 'M';
		return trim(n / 1e3) + 'k';
	}
	function fmtFlops(lc: number): string {
		let e = Math.floor(lc);
		let m = 10 ** (lc - e);
		if (m >= 9.95) {
			m = 1;
			e += 1;
		}
		return `${m.toFixed(1)}e${e}`;
	}

	// ── pointer: the whole plot is a slider; near-curve motion is a hover ──
	function svgPoint(e: PointerEvent): { x: number; y: number } {
		if (!svgEl) return { x: 0, y: 0 };
		const rect = svgEl.getBoundingClientRect();
		return {
			x: ((e.clientX - rect.left) / rect.width) * W,
			y: ((e.clientY - rect.top) / rect.height) * H
		};
	}
	function clampLc(lc: number): number {
		return Math.min(LX1, Math.max(LX0, Math.round(lc * 50) / 50));
	}
	function detectHover(p: { x: number; y: number }) {
		const lc = xToLc(p.x);
		if (lc < LX0 || lc > LX1) {
			hovered = null;
			return;
		}
		let best: { i: number; dy: number } | null = null;
		for (const c of curves) {
			const loss = lossAt(lc, c.n);
			if (loss > 5.4) continue;
			const dy = Math.abs(sy(loss) - p.y);
			if (dy < 13 && (best === null || dy < best.dy)) best = { i: c.i, dy };
		}
		hovered = best ? { i: best.i, x: p.x, y: p.y } : null;
	}
	function onDown(e: PointerEvent) {
		dragging = true;
		hovered = null;
		lcC = clampLc(xToLc(svgPoint(e).x));
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}
	function onMove(e: PointerEvent) {
		const p = svgPoint(e);
		if (dragging) lcC = clampLc(xToLc(p.x));
		else detectHover(p);
	}
	function onUp() {
		dragging = false;
	}
	function onLeave() {
		if (!dragging) hovered = null;
	}
	function onKey(e: KeyboardEvent) {
		const step =
			e.key === 'ArrowRight' || e.key === 'ArrowUp'
				? 0.1
				: e.key === 'ArrowLeft' || e.key === 'ArrowDown'
					? -0.1
					: null;
		if (step !== null) {
			lcC = Math.min(LX1, Math.max(LX0, lcC + step));
			e.preventDefault();
		} else if (e.key === 'Home') {
			lcC = LX0;
			e.preventDefault();
		} else if (e.key === 'End') {
			lcC = LX1;
			e.preventDefault();
		}
	}

	// tooltip placement, clamped inside the plot
	const tipX = $derived(
		hovered ? Math.min(MG.left + PW - 196, Math.max(MG.left + 4, hovered.x + 14)) : 0
	);
	const tipY = $derived(
		hovered ? Math.min(MG.top + PH - 62, Math.max(MG.top + 4, hovered.y - 58)) : 0
	);

	// ── axis ticks ──
	const xDecades = [17, 18, 19, 20, 21, 22, 23, 24];
	const xMinors = xDecades.slice(0, -1).flatMap((d) => [d + Math.log10(2), d + Math.log10(5)]);
	const yTicks = [0.8, 1, 2, 3, 5];

	// ── second panel: N* and D* vs C ──
	let showOpt = $state(false);
	const H2 = 252;
	const MG2 = { top: 22, right: 96, bottom: 44, left: 56 };
	const PH2 = H2 - MG2.top - MG2.bottom;
	const LV0 = 7; // 10^7
	const LV1 = 13; // 10^13
	const syV = (v: number) => MG2.top + ((LV1 - Math.log10(v)) / (LV1 - LV0)) * PH2;
	const vDecades = [7, 8, 9, 10, 11, 12, 13];
	// both are exact power laws → straight lines from two endpoints
	const nEnds = [nStar(10 ** LX0), nStar(10 ** LX1)];
	const dEnds = [10 ** LX0 / (6 * nEnds[0]), 10 ** LX1 / (6 * nEnds[1])];

	const LOSS_TEX = String.raw`L(N, D) \;=\; E \;+\; \textcolor{#8b5cf6}{\frac{A}{N^{\alpha}}} \;+\; \textcolor{#0284c7}{\frac{B}{D^{\beta}}}`;
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
			style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
		>
			<ChartLine size={16} strokeWidth={2.5} />
			<span>The scaling-laws map</span>
		</div>
		<span class="text-xs" style="color: var(--color-text-muted); font-family: var(--font-mono);">
			C = {fmtFlops(lcC)} FLOPs
		</span>
	</div>
	<p class="mb-3 text-xs" style="color: var(--color-text-muted);">
		Every curve is one model size fed more compute; the lower envelope is the law. Drag the compute
		budget, hover a curve, and watch where every FLOP should go.
	</p>

	<svg bind:this={svgEl} viewBox="0 0 {W} {H}" class="w-full" role="img" aria-hidden="false">
		<title
			>Loss versus training compute, log-log, one curve per model size, with the compute-efficient
			frontier and a draggable compute budget</title
		>
		<defs>
			<clipPath id="{gid}-clip">
				<rect x={MG.left} y={MG.top} width={PW} height={PH} />
			</clipPath>
			{#each curves as c (c.label)}
				<linearGradient
					id="{gid}-g{c.i}"
					gradientUnits="userSpaceOnUse"
					x1={MG.left}
					y1="0"
					x2={MG.left + PW}
					y2="0"
				>
					<stop offset="0" stop-color={c.color} stop-opacity="0.14" />
					<stop offset={Math.max(0, c.t - 0.3)} stop-color={c.color} stop-opacity="0.4" />
					<stop offset={c.t} stop-color={c.color} stop-opacity="0.95" />
					<stop offset={Math.min(1, c.t + 0.3)} stop-color={c.color} stop-opacity="0.4" />
					<stop offset="1" stop-color={c.color} stop-opacity="0.14" />
				</linearGradient>
			{/each}
		</defs>

		<!-- grid: decades solid, 2× / 5× minors faint + small axis ticks -->
		{#each yTicks as t (t)}
			<line
				x1={MG.left}
				y1={sy(t)}
				x2={MG.left + PW}
				y2={sy(t)}
				stroke="var(--color-border-light)"
				stroke-width="1"
			/>
			<text class="tick" x={MG.left - 8} y={sy(t) + 4} text-anchor="end">{t}</text>
		{/each}
		{#each xMinors as m (m)}
			<line
				x1={sx(m)}
				y1={MG.top}
				x2={sx(m)}
				y2={MG.top + PH}
				stroke="var(--color-border-light)"
				stroke-width="1"
				opacity="0.45"
			/>
			<line
				x1={sx(m)}
				y1={MG.top + PH}
				x2={sx(m)}
				y2={MG.top + PH + 4}
				stroke="var(--color-text-muted)"
				stroke-width="1"
				opacity="0.6"
			/>
		{/each}
		{#each xDecades as d (d)}
			<line
				x1={sx(d)}
				y1={MG.top}
				x2={sx(d)}
				y2={MG.top + PH}
				stroke="var(--color-border-light)"
				stroke-width="1"
			/>
			<text class="tick" x={sx(d)} y={MG.top + PH + 18} text-anchor="middle"
				>10<tspan dy="-5" font-size="9">{d}</tspan></text
			>
		{/each}
		<line
			x1={MG.left}
			y1={MG.top + PH}
			x2={MG.left + PW}
			y2={MG.top + PH}
			stroke="var(--color-text-muted)"
			stroke-width="1.2"
			opacity="0.6"
		/>
		<text class="axis-title" x={MG.left + PW / 2} y={H - 8} text-anchor="middle"
			>training compute C — FLOPs (log)</text
		>
		<text
			class="axis-title"
			transform="translate(14 {MG.top + PH / 2}) rotate(-90)"
			text-anchor="middle">pretraining loss (log)</text
		>

		<!-- entropy floor -->
		<line
			x1={MG.left}
			y1={sy(E)}
			x2={MG.left + PW}
			y2={sy(E)}
			stroke="var(--color-text-muted)"
			stroke-width="1.2"
			stroke-dasharray="5 5"
			opacity="0.55"
		/>
		<text class="floor-label" x={MG.left + 6} y={sy(E) + 14}>E = {E} — the entropy floor</text>

		<g clip-path="url(#{gid}-clip)">
			<!-- the family: bright near each size's optimum, fading with distance -->
			{#each curves as c (c.label)}
				<path
					d={c.path}
					fill="none"
					stroke="url(#{gid}-g{c.i})"
					stroke-width={hovered?.i === c.i ? 3 : 1.8}
					stroke-linecap="round"
				/>
				{#if hovered?.i === c.i}
					<path d={c.path} fill="none" stroke={c.color} stroke-width="2.6" stroke-linecap="round" />
				{/if}
			{/each}

			<!-- THE scaling law: the lower envelope -->
			<path
				d={frontierPath}
				fill="none"
				stroke="var(--color-important)"
				stroke-width="3.2"
				stroke-linecap="round"
			/>
		</g>
		<text
			class="frontier-label"
			transform="translate({sx(flMid)} {sy(lStar(flMid)) + 20}) rotate({flAngle})"
			text-anchor="middle">compute-efficient frontier</text
		>

		<!-- compute-budget cursor + optimal point -->
		<line
			x1={sx(lcC)}
			y1={MG.top}
			x2={sx(lcC)}
			y2={MG.top + PH}
			stroke="var(--color-primary)"
			stroke-width={dragging ? 2 : 1.5}
			opacity="0.85"
		/>
		<circle
			cx={sx(lcC)}
			cy={MG.top}
			r="5"
			fill="var(--color-primary)"
			stroke="var(--color-surface)"
			stroke-width="2"
		/>
		<circle cx={sx(lcC)} cy={sy(lossOpt)} r="9" fill="var(--color-important)" opacity="0.25" />
		<circle
			cx={sx(lcC)}
			cy={sy(lossOpt)}
			r="4.5"
			fill="var(--color-important)"
			stroke="var(--color-surface)"
			stroke-width="2"
		/>

		<!-- legend, right edge -->
		<g style="font-family: var(--font-mono);">
			<text class="legend-title" x={W - MG.right + 10} y={MG.top + 8}>model size N</text>
			{#each curves as c (c.label)}
				<g
					class="legend-row"
					role="presentation"
					opacity={hovered === null || hovered.i === c.i ? 1 : 0.4}
					onpointerenter={() => {
						if (!dragging)
							hovered = {
								i: c.i,
								x: sx(c.lcT),
								y: sy(lossAt(Math.min(LX1, Math.max(LX0, c.lcT)), c.n))
							};
					}}
					onpointerleave={() => (hovered = null)}
				>
					<line
						x1={W - MG.right + 10}
						y1={MG.top + 22 + c.i * 19}
						x2={W - MG.right + 24}
						y2={MG.top + 22 + c.i * 19}
						stroke={c.color}
						stroke-width="3"
						stroke-linecap="round"
					/>
					<text class="legend-text" x={W - MG.right + 30} y={MG.top + 26 + c.i * 19}>{c.label}</text
					>
				</g>
			{/each}
			<line
				x1={W - MG.right + 10}
				y1={MG.top + 32 + curves.length * 19}
				x2={W - MG.right + 24}
				y2={MG.top + 32 + curves.length * 19}
				stroke="var(--color-important)"
				stroke-width="3.5"
				stroke-linecap="round"
			/>
			<text class="legend-text" x={W - MG.right + 30} y={MG.top + 36 + curves.length * 19}
				>frontier</text
			>
		</g>

		<!-- hover tooltip -->
		{#if hovered}
			<g pointer-events="none">
				<rect
					x={tipX}
					y={tipY}
					width="192"
					height="52"
					rx="6"
					fill="var(--color-surface)"
					stroke={SIZES[hovered.i].color}
					stroke-width="1.2"
					opacity="0.96"
				/>
				<text class="tip-strong" x={tipX + 10} y={tipY + 19} fill={SIZES[hovered.i].color}
					>N = {SIZES[hovered.i].label} params</text
				>
				<text class="tip-dim" x={tipX + 10} y={tipY + 38}>
					{#if curves[hovered.i].lcT < LX0}
						optimal left of this map
					{:else if curves[hovered.i].lcT > LX1}
						optimal past C = 1e24 →
					{:else}
						on frontier at C ≈ {fmtFlops(curves[hovered.i].lcT)}
					{/if}
				</text>
			</g>
		{/if}

		<!-- drag overlay: the whole plot is a compute slider -->
		<rect
			class="drag-zone"
			x={MG.left}
			y={MG.top}
			width={PW}
			height={PH}
			fill="transparent"
			role="slider"
			tabindex="0"
			aria-label="compute budget C in FLOPs, log scale"
			aria-valuemin={LX0}
			aria-valuemax={LX1}
			aria-valuenow={lcC}
			aria-valuetext="{fmtFlops(lcC)} FLOPs"
			aria-orientation="horizontal"
			onpointerdown={onDown}
			onpointermove={onMove}
			onpointerup={onUp}
			onpointercancel={onUp}
			onpointerleave={onLeave}
			onkeydown={onKey}
		/>
	</svg>

	<div class="mt-2">
		<Slider
			label="compute budget C (log scale)"
			bind:value={lcC}
			min={LX0}
			max={LX1}
			step={0.02}
			tone="blue"
			format={(v) => `${fmtFlops(v)} FLOPs`}
			hint="drag the plot or slide — same cursor"
		/>
	</div>

	<!-- readout: the closed-form optimum at this budget -->
	<div class="readout mt-3 rounded-lg border p-3" style="border-color: var(--color-border-light);">
		<div class="cells">
			<div class="cell">
				<span class="k">optimal params N*</span>
				<span class="v" style="color: #8b5cf6;">{fmtCount(nOpt)}</span>
			</div>
			<div class="cell">
				<span class="k">optimal tokens D*</span>
				<span class="v" style="color: var(--color-tip);">{fmtCount(dOpt)}</span>
			</div>
			<div class="cell">
				<span class="k">tokens / param</span>
				<span class="v" style="color: var(--color-text);">≈ {Math.round(ratioOpt)}</span>
			</div>
			<div class="cell">
				<span class="k">predicted loss</span>
				<span class="v" style="color: var(--color-important);">{lossOpt.toFixed(2)}</span>
			</div>
		</div>
	</div>

	<button class="toggle-btn mt-3" onclick={() => (showOpt = !showOpt)} aria-expanded={showOpt}>
		{showOpt ? '▾' : '▸'} params vs tokens at the optimum
	</button>

	{#if showOpt}
		<svg viewBox="0 0 {W} {H2}" class="mt-2 w-full" role="img" aria-hidden="false">
			<title
				>Optimal parameter count and token count versus compute, both power laws on log-log axes</title
			>
			{#each vDecades as d (d)}
				<line
					x1={MG2.left}
					y1={syV(10 ** d)}
					x2={MG2.left + PW}
					y2={syV(10 ** d)}
					stroke="var(--color-border-light)"
					stroke-width="1"
					opacity={d % 2 === 1 ? 1 : 0.5}
				/>
				{#if d % 2 === 1}
					<text class="tick" x={MG2.left - 8} y={syV(10 ** d) + 4} text-anchor="end"
						>10<tspan dy="-5" font-size="9">{d}</tspan></text
					>
				{/if}
			{/each}
			{#each xDecades as d (d)}
				<line
					x1={sx(d)}
					y1={MG2.top}
					x2={sx(d)}
					y2={MG2.top + PH2}
					stroke="var(--color-border-light)"
					stroke-width="1"
				/>
				<text class="tick" x={sx(d)} y={MG2.top + PH2 + 18} text-anchor="middle"
					>10<tspan dy="-5" font-size="9">{d}</tspan></text
				>
			{/each}
			<line
				x1={MG2.left}
				y1={MG2.top + PH2}
				x2={MG2.left + PW}
				y2={MG2.top + PH2}
				stroke="var(--color-text-muted)"
				stroke-width="1.2"
				opacity="0.6"
			/>
			<text class="axis-title" x={MG.left + PW / 2} y={H2 - 6} text-anchor="middle"
				>training compute C — FLOPs (log)</text
			>

			<!-- the gap between the lines IS tokens-per-param -->
			<polygon
				points="{sx(LX0)},{syV(nEnds[0])} {sx(LX1)},{syV(nEnds[1])} {sx(LX1)},{syV(dEnds[1])} {sx(
					LX0
				)},{syV(dEnds[0])}"
				fill="color-mix(in srgb, var(--color-tip) 7%, transparent)"
			/>
			<text
				class="gap-label"
				x={sx(20.5)}
				y={(syV(nStar(10 ** 20.5)) + syV(10 ** 20.5 / (6 * nStar(10 ** 20.5)))) / 2 + 4}
				text-anchor="middle">gap = tokens per param</text
			>

			<!-- two straight power laws -->
			<line
				x1={sx(LX0)}
				y1={syV(nEnds[0])}
				x2={sx(LX1)}
				y2={syV(nEnds[1])}
				stroke="#8b5cf6"
				stroke-width="2.6"
				stroke-linecap="round"
			/>
			<line
				x1={sx(LX0)}
				y1={syV(dEnds[0])}
				x2={sx(LX1)}
				y2={syV(dEnds[1])}
				stroke="var(--color-tip)"
				stroke-width="2.6"
				stroke-linecap="round"
			/>
			<text class="slope-label" x={sx(19)} y={syV(nStar(10 ** 19)) + 18} fill="#8b5cf6"
				>N* ∝ C^{EXP_A.toFixed(2)}</text
			>
			<text
				class="slope-label"
				x={sx(19)}
				y={syV(10 ** 19 / (6 * nStar(10 ** 19))) - 10}
				fill="var(--color-tip)">D* ∝ C^{EXP_B.toFixed(2)}</text
			>
			<text class="legend-text" x={W - MG2.right + 8} y={syV(nEnds[1]) + 4} fill="#8b5cf6"
				>N* params</text
			>
			<text class="legend-text" x={W - MG2.right + 8} y={syV(dEnds[1]) + 4} fill="var(--color-tip)"
				>D* tokens</text
			>

			<!-- shared compute cursor -->
			<line
				x1={sx(lcC)}
				y1={MG2.top}
				x2={sx(lcC)}
				y2={MG2.top + PH2}
				stroke="var(--color-primary)"
				stroke-width="1.5"
				opacity="0.85"
			/>
			<line
				x1={sx(lcC)}
				y1={syV(nOpt)}
				x2={sx(lcC)}
				y2={syV(dOpt)}
				stroke="var(--color-text-muted)"
				stroke-width="1.2"
				stroke-dasharray="3 3"
			/>
			<circle
				cx={sx(lcC)}
				cy={syV(nOpt)}
				r="4"
				fill="#8b5cf6"
				stroke="var(--color-surface)"
				stroke-width="2"
			/>
			<circle
				cx={sx(lcC)}
				cy={syV(dOpt)}
				r="4"
				fill="var(--color-tip)"
				stroke="var(--color-surface)"
				stroke-width="2"
			/>
			<text
				class="slope-label"
				x={sx(lcC) + 8}
				y={(syV(nOpt) + syV(dOpt)) / 2 + 4}
				fill="var(--color-text-secondary)">×{Math.round(ratioOpt)}</text
			>
		</svg>
		<p class="mt-1 text-[11.5px]" style="color: var(--color-text-muted);">
			Both are exact power laws — straight lines in log-log. The exponents come from the loss fit: a
			= β/(α+β) ≈ {EXP_A.toFixed(2)} for params, b = α/(α+β) ≈ {EXP_B.toFixed(2)} for tokens. Data grows
			slightly faster than parameters, so the tokens-per-param gap widens slowly — from ~20 at the left
			edge of this map to ~{Math.round(10 ** LX1 / (6 * nStar(10 ** LX1) ** 2))} at the right.
		</p>
	{/if}

	<!-- the law itself, term by term -->
	<div class="mt-4 border-t pt-3" style="border-color: var(--color-border-light);">
		<Formula display tex={LOSS_TEX} />
		<div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
			<span class="term" style="--c: var(--color-text-secondary);"
				><b>E</b> — the entropy floor you can never beat</span
			>
			<span class="term" style="--c: #8b5cf6;"><b>A/N^α</b> — what finite width costs</span>
			<span class="term" style="--c: var(--color-tip);"><b>B/D^β</b> — what finite data costs</span>
		</div>
		<p
			class="mt-1 text-[10.5px]"
			style="color: var(--color-text-muted); font-family: var(--font-mono);"
		>
			E = {E} · A = {CA} · B = {CB} · α = {ALPHA} · β = {BETA} — Chinchilla's fitted numbers (Hoffmann
			et al., 2022)
		</p>
	</div>

	<p class="mt-3 text-xs leading-relaxed" style="color: var(--color-text-muted);">
		Where's Quill on this map? Four decades off the left edge: 0.9M params × 1.1M tokens is C ≈
		5.9e12 FLOPs at barely 1 token per parameter — way off-frontier, deep in the finite-data term.
		Chinchilla's ledger says even a pocket model wants ~20 tokens per param. Quill is deliberately
		data-starved so it trains in a coffee break — the law tells you exactly what that trade costs.
	</p>
</div>

<style>
	.tick {
		fill: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.axis-title {
		fill: var(--color-text-secondary);
		font-family: var(--font-sans);
		font-size: 12px;
	}
	.frontier-label {
		fill: var(--color-important);
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 600;
	}
	.floor-label {
		fill: var(--color-text-muted);
		font-family: var(--font-sans);
		font-size: 11px;
		font-style: italic;
	}
	.legend-title {
		fill: var(--color-text-muted);
		font-size: 10px;
	}
	.legend-text {
		fill: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.legend-row {
		cursor: pointer;
	}
	.slope-label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
	}
	.gap-label {
		fill: var(--color-text-muted);
		font-family: var(--font-sans);
		font-size: 11px;
		font-style: italic;
	}
	.tip-strong {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
	}
	.tip-dim {
		fill: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.drag-zone {
		cursor: ew-resize;
		touch-action: none;
	}
	.drag-zone:focus-visible {
		outline: none;
		fill: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.readout .cells {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 0.5rem 1rem;
	}
	.readout .cell {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.readout .k {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}
	.readout .v {
		font-family: var(--font-mono);
		font-size: 15px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-surface-hover);
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		transition: border-color 120ms ease;
	}
	.toggle-btn:hover {
		border-color: var(--color-important);
	}

	.term {
		font-size: 11px;
		color: var(--color-text-secondary);
	}
	.term b {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--c);
	}
</style>
