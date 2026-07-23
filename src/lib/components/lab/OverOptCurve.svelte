<script lang="ts">
	// The over-optimization curve, live. X is optimization pressure (best-of-N,
	// log scale); the RM's score of the argmax rises monotonically by
	// construction, while true quality rises with it, knees, then falls —
	// Goodhart's law as geometry. The curves follow the Gao et al. (2022)
	// functional form: drift d = sqrt(KL(best-of-N ‖ base)) with
	// KL = ln N − (N−1)/N, proxy ∝ d, gold = A·d − B·d². The β slider applies
	// the Part 10.3 KL leash by shrinking effective drift to d/(1+β): the knee
	// slides right and the fall softens — same pressure, spent inside the
	// region where the judge is sane.
	import { TrendingDown } from 'lucide-svelte';

	const W = 700;
	const H = 360;
	const MG = { top: 30, right: 20, bottom: 50, left: 54 };
	const PW = W - MG.left - MG.right;
	const PH = H - MG.top - MG.bottom;
	const VMAX = 10; // x = log2 N, N = 1..1024
	const YMAX = 5;

	const sx = (v: number) => MG.left + (v / VMAX) * PW;
	const sy = (y: number) => MG.top + PH - (y / YMAX) * PH;

	// ── the model ──
	const P_SLOPE = 1.9; // proxy score per unit of drift
	const A = 1.9; // gold: initial slope (matches proxy — they rise together)
	const B = 0.7; // gold: curvature; knee at d = A/2B ≈ 1.36 → N ≈ 16

	function drift(v: number): number {
		const n = 2 ** v;
		return Math.sqrt(Math.max(0, Math.log(n) - (n - 1) / n));
	}
	function proxyAt(v: number, b: number): number {
		return (P_SLOPE * drift(v)) / (1 + b);
	}
	function goldAt(v: number, b: number): number {
		const d = drift(v) / (1 + b);
		return A * d - B * d * d;
	}

	let logN = $state(5); // marker position, log2 N
	let beta = $state(0); // KL leash strength

	const n = $derived(2 ** logN);
	const rm = $derived(proxyAt(logN, beta));
	const tq = $derived(goldAt(logN, beta));
	const tax = $derived(rm - tq);

	// ── curves as SVG paths, computed from sample arrays ──
	const vs = Array.from({ length: 121 }, (_, i) => (i * VMAX) / 120);

	function pathOf(f: (v: number) => number): string {
		return vs
			.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(v).toFixed(1)} ${sy(f(v)).toFixed(1)}`)
			.join(' ');
	}
	const proxyPath = $derived(pathOf((v) => proxyAt(v, beta)));
	const goldPath = $derived(pathOf((v) => goldAt(v, beta)));
	const ghostPath = pathOf((v) => goldAt(v, 0));
	const gapPath = $derived.by(() => {
		const back = [...vs]
			.reverse()
			.map((v) => `L${sx(v).toFixed(1)} ${sy(goldAt(v, beta)).toFixed(1)}`)
			.join(' ');
		return `${proxyPath} ${back} Z`;
	});

	// ── the knee: where true quality peaks (argmax over samples) ──
	const knee = $derived.by(() => {
		let bi = 0;
		let bv = -Infinity;
		for (let i = 0; i < vs.length; i++) {
			const g = goldAt(vs[i], beta);
			if (g > bv) {
				bv = g;
				bi = i;
			}
		}
		return { v: vs[bi], y: bv, offChart: bi === vs.length - 1 };
	});

	// ── marker drag on the SVG ──
	let svgEl: SVGSVGElement | undefined = $state();
	let dragging = $state(false);

	function posFromEvent(e: PointerEvent): number {
		if (!svgEl) return logN;
		const rect = svgEl.getBoundingClientRect();
		const xSvg = ((e.clientX - rect.left) / rect.width) * W;
		const v = ((xSvg - MG.left) / PW) * VMAX;
		return Math.min(VMAX, Math.max(0, Math.round(v * 20) / 20));
	}
	function markDown(e: PointerEvent) {
		dragging = true;
		logN = posFromEvent(e);
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}
	function markMove(e: PointerEvent) {
		if (dragging) logN = posFromEvent(e);
	}
	function markUp() {
		dragging = false;
	}
	function markKey(e: KeyboardEvent) {
		const step =
			e.key === 'ArrowRight' || e.key === 'ArrowUp'
				? 0.25
				: e.key === 'ArrowLeft' || e.key === 'ArrowDown'
					? -0.25
					: null;
		if (step !== null) {
			logN = Math.min(VMAX, Math.max(0, logN + step));
			e.preventDefault();
		} else if (e.key === 'Home') {
			logN = 0;
			e.preventDefault();
		} else if (e.key === 'End') {
			logN = VMAX;
			e.preventDefault();
		}
	}

	const xTicks = [0, 2, 4, 6, 8, 10];
	const yTicks = [0, 1, 2, 3, 4, 5];
</script>

<div
	class="lab my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
			style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
		>
			<TrendingDown size={16} strokeWidth={2.5} />
			<span>The over-optimization curve</span>
		</div>
		<div class="flex flex-wrap gap-2" style="font-family: var(--font-mono);">
			<span class="chip" style="--c: var(--color-primary);">N ≈ {Math.round(n)}</span>
			<span class="chip" style="--c: var(--color-important);">RM score {rm.toFixed(2)}</span>
			<span class="chip" style="--c: var(--color-tip);">true quality {tq.toFixed(2)}</span>
			<span class="chip" style="--c: var(--color-challenge);">tax {tax.toFixed(2)}</span>
		</div>
	</div>

	<div
		class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]"
		style="color: var(--color-text-secondary);"
	>
		<span class="leg"
			><i class="sw" style="background: var(--color-important);"></i>RM score — the proxy</span
		>
		<span class="leg"
			><i class="sw" style="background: var(--color-tip);"></i>true quality — your actual taste</span
		>
		<span class="leg"
			><i
				class="sw"
				style="height: 9px; border-radius: 2px; background: color-mix(in srgb, var(--color-challenge) 22%, transparent);"
			></i>the gap — over-optimization tax</span
		>
		{#if beta > 0}
			<span class="leg" style="opacity: 0.7;"
				><i class="sw dashed" style="border-color: var(--color-tip);"></i>true quality at β = 0</span
			>
		{/if}
	</div>

	<svg bind:this={svgEl} viewBox="0 0 {W} {H}" class="w-full" role="img" aria-hidden="false">
		<title>RM score and true quality versus optimization pressure, with a draggable marker</title>

		<!-- grid + axes -->
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
		{#each xTicks as t (t)}
			<line
				x1={sx(t)}
				y1={MG.top}
				x2={sx(t)}
				y2={MG.top + PH}
				stroke="var(--color-border-light)"
				stroke-width="1"
			/>
			<text class="tick" x={sx(t)} y={MG.top + PH + 18} text-anchor="middle">{2 ** t}</text>
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
		<text class="axis-title" x={MG.left + PW / 2} y={H - 10} text-anchor="middle"
			>optimization pressure — best-of-N (log scale)</text
		>
		<text
			class="axis-title"
			transform="translate(15 {MG.top + PH / 2}) rotate(-90)"
			text-anchor="middle">score vs. one sample</text
		>

		<!-- the tax: shaded gap between the two judges -->
		<path d={gapPath} fill="color-mix(in srgb, var(--color-challenge) 13%, transparent)" />

		<!-- knee annotation -->
		{#if !knee.offChart}
			<line
				x1={sx(knee.v)}
				y1={sy(knee.y)}
				x2={sx(knee.v)}
				y2={MG.top + PH}
				stroke="var(--color-text-muted)"
				stroke-width="1.2"
				stroke-dasharray="4 4"
				opacity="0.8"
			/>
			<text class="knee-label" x={sx(knee.v) + 6} y={sy(knee.y) - 8}
				>the knee — N ≈ {Math.round(2 ** knee.v)}</text
			>
		{:else}
			<text class="knee-label" x={MG.left + PW - 6} y={MG.top + 14} text-anchor="end"
				>leashed hard enough, the knee never arrives →</text
			>
		{/if}

		<!-- ghost of the unleashed gold curve, for comparison -->
		{#if beta > 0}
			<path
				d={ghostPath}
				fill="none"
				stroke="var(--color-tip)"
				stroke-width="1.8"
				stroke-dasharray="5 5"
				opacity="0.35"
			/>
		{/if}

		<!-- the two judges -->
		<path
			d={proxyPath}
			fill="none"
			stroke="var(--color-important)"
			stroke-width="2.6"
			stroke-linecap="round"
		/>
		<path
			d={goldPath}
			fill="none"
			stroke="var(--color-tip)"
			stroke-width="2.6"
			stroke-linecap="round"
		/>
		<text
			class="curve-label"
			x={sx(VMAX) - 4}
			y={sy(proxyAt(VMAX, beta)) - 10}
			text-anchor="end"
			style="fill: var(--color-important);">RM score</text
		>
		<text
			class="curve-label"
			x={sx(VMAX) - 4}
			y={sy(goldAt(VMAX, beta)) + 18}
			text-anchor="end"
			style="fill: var(--color-tip);">true quality</text
		>

		<!-- draggable pressure marker -->
		<line
			x1={sx(logN)}
			y1={MG.top}
			x2={sx(logN)}
			y2={MG.top + PH}
			stroke="var(--color-primary)"
			stroke-width={dragging ? 2 : 1.5}
			opacity="0.85"
		/>
		<circle
			cx={sx(logN)}
			cy={sy(rm)}
			r="4.5"
			fill="var(--color-important)"
			stroke="var(--color-surface)"
			stroke-width="2"
		/>
		<circle
			cx={sx(logN)}
			cy={sy(tq)}
			r="4.5"
			fill="var(--color-tip)"
			stroke="var(--color-surface)"
			stroke-width="2"
		/>
		<circle
			cx={sx(logN)}
			cy={MG.top}
			r="5"
			fill="var(--color-primary)"
			stroke="var(--color-surface)"
			stroke-width="2"
		/>

		<!-- drag overlay: the whole plot is a slider -->
		<rect
			class="drag-zone"
			x={MG.left}
			y={MG.top}
			width={PW}
			height={PH}
			fill="transparent"
			role="slider"
			tabindex="0"
			aria-label="optimization pressure N, best-of-N on a log scale"
			aria-valuemin={1}
			aria-valuemax={1024}
			aria-valuenow={Math.round(n)}
			aria-orientation="horizontal"
			onpointerdown={markDown}
			onpointermove={markMove}
			onpointerup={markUp}
			onpointercancel={markUp}
			onkeydown={markKey}
		/>
	</svg>

	<div class="mt-3 flex flex-wrap gap-x-6 gap-y-2">
		<label class="flex min-w-[240px] flex-1 items-center gap-2">
			<span class="dial-label">N</span>
			<input
				class="hslider min-w-0 flex-1"
				type="range"
				min="0"
				max={VMAX}
				step="0.05"
				bind:value={logN}
				style="--fill: {(logN / VMAX) * 100}%; --fc: var(--color-primary);"
				aria-label="optimization pressure, log scale"
			/>
			<span class="dial-read" style="color: var(--color-primary-text);">N ≈ {Math.round(n)}</span>
		</label>
		<label class="flex min-w-[240px] flex-1 items-center gap-2">
			<span class="dial-label">β</span>
			<input
				class="hslider min-w-0 flex-1"
				type="range"
				min="0"
				max="1.5"
				step="0.05"
				bind:value={beta}
				style="--fill: {(beta / 1.5) * 100}%; --fc: var(--color-tip);"
				aria-label="KL leash strength beta"
			/>
			<span class="dial-read" style="color: var(--color-tip);">β = {beta.toFixed(2)}</span>
		</label>
	</div>

	<p class="mt-3 text-xs leading-relaxed" style="color: var(--color-text-muted);">
		Drag the marker (or slide N). The RM score of the winner rises forever — it's an argmax over
		more and more samples, so it can't do anything else. Your actual taste follows it to the knee,
		then pays for every extra doubling. Slide β to put on the KL leash from 10.3: pressure gets
		spent inside the region where the RM is sane, the knee slides right, and the fall softens — but
		note the tax never reaches zero. Goodhart is managed, not solved.
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
	.curve-label {
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 600;
	}
	.knee-label {
		fill: var(--color-text-muted);
		font-family: var(--font-sans);
		font-size: 12px;
		font-style: italic;
	}

	.drag-zone {
		cursor: ew-resize;
		touch-action: none;
	}
	.drag-zone:focus-visible {
		outline: none;
		fill: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.chip {
		border-radius: 999px;
		padding: 2px 9px;
		font-size: 11px;
		font-weight: 600;
		color: var(--c);
		background: color-mix(in srgb, var(--c) 10%, transparent);
		white-space: nowrap;
	}

	.leg {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.sw {
		display: inline-block;
		width: 18px;
		height: 3px;
		border-radius: 2px;
	}
	.sw.dashed {
		height: 0;
		background: none;
		border-top: 2px dashed;
	}

	.dial-label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text);
	}
	.dial-read {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		min-width: 5.4em;
		text-align: right;
	}

	.hslider {
		appearance: none;
		-webkit-appearance: none;
		height: 6px;
		border-radius: 999px;
		background: linear-gradient(
			to right,
			var(--fc) var(--fill),
			var(--color-bg-tertiary) var(--fill)
		);
		cursor: pointer;
		outline-offset: 4px;
	}
	.hslider::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--fc);
		border: 2.5px solid var(--color-surface);
		box-shadow: 0 0 0 1.5px var(--fc);
	}
	.hslider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--fc);
		border: 2.5px solid var(--color-surface);
		box-shadow: 0 0 0 1.5px var(--fc);
	}
</style>
