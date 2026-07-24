<script lang="ts" module>
	let uid = 0;
</script>

<script lang="ts">
	// The scaling-laws map, as two clean static plots — no slider. Chinchilla's
	// fitted loss surface L(N, D) = E + A/N^α + B/D^β, sliced one curve per model
	// size N with D = C/(6N). Panel 1: the family of loss-vs-compute curves and
	// their lower envelope, THE compute-efficient frontier (the hero), with a
	// couple of labelled reference points and a hover-only read-out. Panel 2: the
	// two power laws the frontier splits every FLOP into — N* ∝ C^{β/(α+β)} and
	// D* ∝ C^{α/(α+β)} — with the widening tokens-per-parameter gap between them.
	import { TrendingDown } from 'lucide-svelte';
	import EquationAnatomy from '../ui/EquationAnatomy.svelte';

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
	function ratioAt(lc: number): number {
		const c = 10 ** lc;
		return c / (6 * nStar(c) ** 2); // D*/N* = C / (6 N*²)
	}

	// ── series palette: a violet → rose ramp for the size family ──
	const VIOLET = '#a855f7';
	const BLUE = '#2563eb';
	const SLATE = '#94a3b8';

	// ── Panel 1 geometry: both axes log10 ──
	const W = 720;
	const H = 360;
	const MG = { top: 30, right: 22, bottom: 44, left: 54 };
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
		{ n: 1e7, label: '10M', color: '#a855f7' },
		{ n: 10 ** 7.8, label: '63M', color: '#b95be0' },
		{ n: 10 ** 8.6, label: '400M', color: '#c960c9' },
		{ n: 10 ** 9.4, label: '2.5B', color: '#da66b2' },
		{ n: 10 ** 10.2, label: '16B', color: '#ea6b9c' },
		{ n: 1e11, label: '100B', color: '#fb7185' }
	];

	const lcSamples = Array.from({ length: 141 }, (_, i) => LX0 + (i * (LX1 - LX0)) / 140);
	function pathOf(f: (lc: number) => number): string {
		return lcSamples
			.map((lc, i) => `${i === 0 ? 'M' : 'L'}${sx(lc).toFixed(1)} ${sy(f(lc)).toFixed(1)}`)
			.join(' ');
	}
	const curves = SIZES.map((s) => ({ ...s, path: pathOf((lc) => lossAt(lc, s.n)) }));
	const frontierPath = pathOf(lStar);
	const frontierArea = `${frontierPath} L${sx(LX1).toFixed(1)} ${(MG.top + PH).toFixed(1)} L${sx(
		LX0
	).toFixed(1)} ${(MG.top + PH).toFixed(1)} Z`;

	// frontier label, rotated to ride along the envelope
	const flMid = 21.4;
	const flAngle =
		(Math.atan2(sy(lStar(22.4)) - sy(lStar(20.4)), sx(22.4) - sx(20.4)) * 180) / Math.PI;

	// labelled reference points sitting on the frontier
	const refs = [
		{ lc: 21, above: 'read one point off the frontier', below: '≈ 1.8B params · 91B tokens' },
		{ lc: Math.log10(3.15e23), above: "≈ GPT-3's compute budget", below: '' }
	];

	// ── Panel 1 axis ticks ──
	const xDecades = [17, 18, 19, 20, 21, 22, 23, 24];
	const xMinors = xDecades.slice(0, -1).flatMap((d) => [d + Math.log10(2), d + Math.log10(5)]);
	const yTicks = [0.8, 1, 2, 3, 5];

	// ── hover-only read-out (no slider, no persistent cursor) ──
	let hoverLc = $state<number | null>(null);
	let svgEl: SVGSVGElement | undefined = $state();

	function onHover(e: PointerEvent) {
		if (!svgEl) return;
		const r = svgEl.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		const lc = xToLc(px);
		hoverLc = lc < LX0 || lc > LX1 ? null : lc;
	}
	const hov = $derived.by(() => {
		if (hoverLc === null) return null;
		const c = 10 ** hoverLc;
		const n = nStar(c);
		const d = c / (6 * n);
		return { lc: hoverLc, c, n, d, loss: lossOf(n, d) };
	});
	const tipX = $derived(hov ? Math.min(sx(hov.lc) + 12, MG.left + PW - 168) : 0);

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

	// ── Panel 2 geometry: N* and D* vs C, both power laws ──
	const H2 = 300;
	const MG2 = { top: 28, right: 22, bottom: 44, left: 54 };
	const PW2 = W - MG2.left - MG2.right;
	const PH2 = H2 - MG2.top - MG2.bottom;
	const LV0 = 7; // 10^7
	const LV1 = 13; // 10^13
	const sx2 = (lc: number) => MG2.left + ((lc - LX0) / (LX1 - LX0)) * PW2;
	const syV = (v: number) => MG2.top + ((LV1 - Math.log10(v)) / (LV1 - LV0)) * PH2;
	const vDecades = [7, 8, 9, 10, 11, 12, 13];

	// exact power laws → straight lines from the two endpoints
	const nEnds = [nStar(10 ** LX0), nStar(10 ** LX1)];
	const dEnds = [10 ** LX0 / (6 * nEnds[0]), 10 ** LX1 / (6 * nEnds[1])];
	const gapLc = 20.5; // where the tokens-per-param measure sits
	const gapN = nStar(10 ** gapLc);
	const gapD = 10 ** gapLc / (6 * gapN);

	// ── the law itself, tagged for EquationAnatomy ──
	const LOSS_TEX = String.raw`L(N, D) \;=\; \textcolor{#94a3b8}{E} \;+\; \textcolor{#a855f7}{\frac{A}{N^{\alpha}}} \;+\; \textcolor{#2563eb}{\frac{B}{D^{\beta}}}`;
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-1 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<TrendingDown size={16} strokeWidth={2.5} />
		<span>The scaling-laws map</span>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		Chinchilla's fitted loss, read two ways. Every thin line is one model size fed ever more
		compute; their lower envelope is the law itself — the compute-efficient frontier.
	</p>

	<!-- ── PANEL 1: loss vs compute ─────────────────────────────────────────── -->
	<figure class="m-0">
		<figcaption
			class="mb-1 text-[13px] font-semibold"
			style="color: var(--color-text); font-family: var(--font-heading);"
		>
			1 · Loss falls as a power law
		</figcaption>

		<svg
			bind:this={svgEl}
			viewBox="0 0 {W} {H}"
			class="w-full"
			style="touch-action: none;"
			role="img"
			aria-label="Pretraining loss versus training compute on log-log axes. Six thin curves, one per model size from 10M to 100B parameters, fan across the plot; their bold lower envelope is the compute-efficient frontier, falling from about 4.3 at 10^17 FLOPs toward the entropy floor E = 1.69 at 10^24 FLOPs."
			onpointermove={onHover}
			onpointerleave={() => (hoverLc = null)}
		>
			<defs>
				<clipPath id="{gid}-clip">
					<rect x={MG.left} y={MG.top} width={PW} height={PH} />
				</clipPath>
				<linearGradient id="{gid}-front" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="var(--color-important)" stop-opacity="0.16" />
					<stop offset="100%" stop-color="var(--color-important)" stop-opacity="0" />
				</linearGradient>
			</defs>

			<!-- horizontal gridlines + loss ticks -->
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

			<!-- vertical decade grid + minor ticks -->
			{#each xMinors as m (m)}
				<line
					x1={sx(m)}
					y1={MG.top}
					x2={sx(m)}
					y2={MG.top + PH}
					stroke="var(--color-border-light)"
					stroke-width="1"
					opacity="0.4"
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
				transform="translate(13 {MG.top + PH / 2}) rotate(-90)"
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
				<!-- the family: thin, translucent, violet → rose -->
				{#each curves as c (c.label)}
					<path
						d={c.path}
						fill="none"
						stroke={c.color}
						stroke-width="1.5"
						stroke-linecap="round"
						opacity="0.5"
					/>
				{/each}

				<!-- THE scaling law: the bold lower envelope (hero) -->
				<path d={frontierArea} fill="url(#{gid}-front)" stroke="none" />
				<path
					d={frontierPath}
					fill="none"
					stroke="var(--color-important)"
					stroke-width="3.4"
					stroke-linecap="round"
				/>
			</g>

			<!-- inline family labels at the two extremes -->
			<text
				class="series-label"
				x={sx(17.1)}
				y={sy(lossAt(17.1, SIZES[0].n)) - 5}
				fill={SIZES[0].color}>N = 10M</text
			>
			<text
				class="series-label"
				x={sx(22.4)}
				y={sy(lossAt(22.4, SIZES[5].n)) - 6}
				text-anchor="end"
				fill={SIZES[5].color}>N = 100B</text
			>

			<!-- rotated frontier label riding the envelope -->
			<text
				class="frontier-label"
				transform="translate({sx(flMid)} {sy(lStar(flMid)) + 19}) rotate({flAngle})"
				text-anchor="middle">compute-efficient frontier</text
			>

			<!-- labelled reference points on the frontier -->
			{#each refs as r (r.lc)}
				<circle
					cx={sx(r.lc)}
					cy={sy(lStar(r.lc))}
					r="4.5"
					fill="var(--color-important)"
					stroke="var(--color-surface)"
					stroke-width="2"
				/>
				<line
					x1={sx(r.lc)}
					y1={sy(lStar(r.lc)) - 6}
					x2={sx(r.lc)}
					y2={sy(lStar(r.lc)) - 24}
					stroke="var(--color-text-muted)"
					stroke-width="1"
					opacity="0.6"
				/>
				{@const refAnchor =
					sx(r.lc) > MG.left + PW * 0.72
						? 'end'
						: sx(r.lc) < MG.left + PW * 0.28
							? 'start'
							: 'middle'}
				<text class="ref-label" x={sx(r.lc)} y={sy(lStar(r.lc)) - 28} text-anchor={refAnchor}
					>{r.above}</text
				>
				{#if r.below}
					<text class="ref-sub" x={sx(r.lc)} y={sy(lStar(r.lc)) - 17} text-anchor={refAnchor}
						>{r.below}</text
					>
				{/if}
			{/each}

			<!-- hover read-out: snaps to the frontier point under the cursor -->
			{#if hov}
				<line
					x1={sx(hov.lc)}
					y1={MG.top}
					x2={sx(hov.lc)}
					y2={MG.top + PH}
					stroke="var(--color-text)"
					stroke-width="1"
					opacity="0.35"
				/>
				<circle
					cx={sx(hov.lc)}
					cy={sy(hov.loss)}
					r="9"
					fill="var(--color-important)"
					opacity="0.2"
				/>
				<circle
					cx={sx(hov.lc)}
					cy={sy(hov.loss)}
					r="4.5"
					fill="var(--color-important)"
					stroke="var(--color-surface)"
					stroke-width="2"
				/>
				<g pointer-events="none" transform="translate({tipX} {MG.top + 6})">
					<rect
						width="156"
						height="66"
						rx="7"
						fill="var(--color-surface)"
						stroke="var(--color-border)"
						opacity="0.98"
					/>
					<text class="tip-dim" x="10" y="17">C = {fmtFlops(hov.lc)} FLOPs</text>
					<text class="tip-key" x="10" y="32" fill={VIOLET}>N* = {fmtCount(hov.n)} params</text>
					<text class="tip-key" x="10" y="46" fill={BLUE}>D* = {fmtCount(hov.d)} tokens</text>
					<text class="tip-key" x="10" y="60" fill="var(--color-important)"
						>loss = {hov.loss.toFixed(2)}</text
					>
				</g>
			{/if}
		</svg>

		<figcaption class="mt-1 text-[11px] leading-relaxed" style="color: var(--color-text-muted);">
			Each thin line is one fixed model size, worse on the left where it is data-starved, flattening
			once it saturates. The bold curve kisses the bottom of every one of them: at each compute
			budget it is the single best size-and-data split. GPT-3 spent roughly that
			<span style="color: var(--color-text-secondary);">3×10²³ FLOPs</span> — but on 175B parameters and
			only 300B tokens, sitting off the frontier's recipe. Hover the plot to read the optimum anywhere.
		</figcaption>
	</figure>

	<!-- ── PANEL 2: the optimal recipe ──────────────────────────────────────── -->
	<figure class="m-0 mt-6">
		<figcaption
			class="mb-1 text-[13px] font-semibold"
			style="color: var(--color-text); font-family: var(--font-heading);"
		>
			2 · The optimal recipe: grow both together
		</figcaption>

		<svg
			viewBox="0 0 {W} {H2}"
			class="w-full"
			role="img"
			aria-label="Optimal parameter count N* and optimal token count D* versus compute, on log-log axes. Both are straight power-law lines: N* grows as C to the 0.45 and D* as C to the 0.55, so the vertical gap between them — tokens per parameter — widens slowly from about 21 at 10^17 FLOPs to about 98 at 10^24."
		>
			<!-- value-axis grid + ticks -->
			{#each vDecades as d (d)}
				<line
					x1={MG2.left}
					y1={syV(10 ** d)}
					x2={MG2.left + PW2}
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

			<!-- compute-axis grid + ticks -->
			{#each xDecades as d (d)}
				<line
					x1={sx2(d)}
					y1={MG2.top}
					x2={sx2(d)}
					y2={MG2.top + PH2}
					stroke="var(--color-border-light)"
					stroke-width="1"
				/>
				<text class="tick" x={sx2(d)} y={MG2.top + PH2 + 18} text-anchor="middle"
					>10<tspan dy="-5" font-size="9">{d}</tspan></text
				>
			{/each}
			<line
				x1={MG2.left}
				y1={MG2.top + PH2}
				x2={MG2.left + PW2}
				y2={MG2.top + PH2}
				stroke="var(--color-text-muted)"
				stroke-width="1.2"
				opacity="0.6"
			/>
			<text class="axis-title" x={MG2.left + PW2 / 2} y={H2 - 8} text-anchor="middle"
				>training compute C — FLOPs (log)</text
			>
			<text
				class="axis-title"
				transform="translate(13 {MG2.top + PH2 / 2}) rotate(-90)"
				text-anchor="middle">count (log)</text
			>

			<!-- the gap between the lines IS tokens-per-param -->
			<polygon
				points="{sx2(LX0)},{syV(nEnds[0])} {sx2(LX1)},{syV(nEnds[1])} {sx2(LX1)},{syV(
					dEnds[1]
				)} {sx2(LX0)},{syV(dEnds[0])}"
				fill="color-mix(in srgb, {VIOLET} 8%, transparent)"
			/>
			<text
				class="gap-label"
				x={sx2(18.6)}
				y={(syV(nStar(10 ** 18.6)) + syV(10 ** 18.6 / (6 * nStar(10 ** 18.6)))) / 2 + 3}
				>≈ tokens per parameter</text
			>

			<!-- vertical measure of the gap at one compute -->
			<line
				x1={sx2(gapLc)}
				y1={syV(gapN)}
				x2={sx2(gapLc)}
				y2={syV(gapD)}
				stroke="var(--color-text-muted)"
				stroke-width="1"
				stroke-dasharray="3 3"
			/>
			<text class="measure-label" x={sx2(gapLc) + 6} y={(syV(gapN) + syV(gapD)) / 2 + 3}
				>≈ {Math.round(ratioAt(gapLc))}×</text
			>

			<!-- the two straight power laws -->
			<line
				x1={sx2(LX0)}
				y1={syV(dEnds[0])}
				x2={sx2(LX1)}
				y2={syV(dEnds[1])}
				stroke={BLUE}
				stroke-width="2.6"
				stroke-linecap="round"
			/>
			<line
				x1={sx2(LX0)}
				y1={syV(nEnds[0])}
				x2={sx2(LX1)}
				y2={syV(nEnds[1])}
				stroke={VIOLET}
				stroke-width="2.6"
				stroke-linecap="round"
			/>

			<!-- slope labels, computed from α, β -->
			<text class="slope-label" x={sx2(18)} y={syV(nStar(10 ** 18)) + 17} fill={VIOLET}
				>N* ∝ C^{EXP_A.toFixed(2)}</text
			>
			<text
				class="slope-label"
				x={sx2(18)}
				y={syV(10 ** 18 / (6 * nStar(10 ** 18))) - 9}
				fill={BLUE}>D* ∝ C^{EXP_B.toFixed(2)}</text
			>
			<text
				class="series-label"
				x={sx2(LX1) - 4}
				y={syV(nEnds[1]) + 14}
				text-anchor="end"
				fill={VIOLET}>N* params</text
			>
			<text
				class="series-label"
				x={sx2(LX1) - 4}
				y={syV(dEnds[1]) - 7}
				text-anchor="end"
				fill={BLUE}>D* tokens</text
			>
		</svg>

		<figcaption class="mt-1 text-[11px] leading-relaxed" style="color: var(--color-text-muted);">
			Both are exact power laws — straight in log-log — with exponents read straight off the loss
			fit: a = β/(α+β) ≈ {EXP_A.toFixed(2)} for parameters, b = α/(α+β) ≈ {EXP_B.toFixed(2)} for tokens.
			Because data grows a touch faster than parameters, the tokens-per-parameter band
			<em>widens</em>: about {Math.round(ratioAt(LX0))}× at 10¹⁷ FLOPs, about
			{Math.round(ratioAt(LX1))}× at 10²⁴ — not the flat "20 tokens per param" rule of thumb, though
			~20 is right at pocket scale.
		</figcaption>
	</figure>

	<!-- ── the law itself, term by term ─────────────────────────────────────── -->
	<div class="mt-5 border-t pt-2" style="border-color: var(--color-border-light);">
		<EquationAnatomy
			tex={LOSS_TEX}
			read="loss is an entropy floor, plus a price for being too small, plus a price for seeing too little data."
			terms={[
				{
					color: SLATE,
					label: String.raw`E`,
					note: 'the entropy floor — the irreducible loss left even with infinite parameters and infinite data (E = 1.69).'
				},
				{
					color: VIOLET,
					label: String.raw`\frac{A}{N^{\alpha}}`,
					note: 'the finite-width penalty — what too few parameters costs; shrinks as N grows (A = 406.4, α = 0.34).'
				},
				{
					color: BLUE,
					label: String.raw`\frac{B}{D^{\beta}}`,
					note: 'the finite-data penalty — what too few tokens costs; shrinks as D grows (B = 410.7, β = 0.28).'
				}
			]}
		/>
	</div>

	<p class="mt-2 text-xs leading-relaxed" style="color: var(--color-text-muted);">
		Where is Quill on this map? Four decades off the left edge: 0.9M params × 1.1M tokens is C ≈
		5.9×10¹² FLOPs at barely <strong style="color: var(--color-text);">1 token per parameter</strong
		>
		— way off-frontier, deep in the finite-data term. The ledger above says even a pocket model wants
		~20. Quill is deliberately data-starved so it trains in a coffee break; the law tells you exactly
		what that trade costs.
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
	.series-label {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
	}
	.ref-label {
		fill: var(--color-text-secondary);
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
	}
	.ref-sub {
		fill: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
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
	.measure-label {
		fill: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
	}
	.tip-dim {
		fill: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.tip-key {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
	}
</style>
