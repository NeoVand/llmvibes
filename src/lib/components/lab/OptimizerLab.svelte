<script lang="ts">
	// The optimizer race, rebuilt on the GradientDescent project's visual
	// system: d3-scale-chromatic heatmaps (cubehelix/viridis/inferno LUTs,
	// log-space normalization over the visible region, theme-tuned tone
	// curves), d3-contour rings, per-optimizer race trails with hover
	// spotlight, and the marker x-ray — blue −∇ℒ vs red Δθ plus the amber
	// next-step ghost. Five update rules (SGD, Momentum, Adam, AdamW, Lion)
	// start from one draggable θ₀ at one learning rate; the gap between the
	// arrows is everything the optimizer adds on top of the slope.
	import { onDestroy, onMount } from 'svelte';
	import { Flag, Pause, Play, RotateCcw, StepForward } from 'lucide-svelte';
	import Slider from '../ui/Slider.svelte';
	import {
		PRESETS,
		presetById,
		computeGrid,
		gradAt,
		fieldMaxMag,
		type PresetId,
		type Pt
	} from './optimizer/landscape';
	import { COLORMAPS, colormapStops, heatmapRGBA, type ColormapId } from './optimizer/colormaps';
	import {
		RUNNERS,
		initOptState,
		stepOptimizer,
		predictNext,
		type OptimizerId,
		type OptState
	} from './optimizer/optimizers';
	import { contourPaths } from './optimizer/contours';

	// ------------------------------------------------------------ projection
	const VW = 700;
	const VH = 540; // spans keep 700:540 per preset — angles survive projection
	const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

	let presetId = $state<PresetId>('basins');
	const preset = $derived(presetById(presetId));
	const grid = $derived(computeGrid(preset));
	const fieldMax = $derived(fieldMaxMag(preset));

	const sx = (x: number) => ((x - preset.xMin) / (preset.xMax - preset.xMin)) * VW;
	const sy = (y: number) => VH - ((y - preset.yMin) / (preset.yMax - preset.yMin)) * VH;
	// Param→pixel scale factors, for angle-faithful screen-space vectors.
	const kx = $derived(VW / (preset.xMax - preset.xMin));
	const ky = $derived(VH / (preset.yMax - preset.yMin));

	// ------------------------------------------------------------- runners
	const BOUND = 40; // divergence check, pre-commit — markers never go NaN
	const MAX_TRAIL = 700;

	interface Runner {
		id: OptimizerId;
		x: number;
		y: number;
		loss: number;
		diverged: boolean;
		trail: Pt[];
		lastDx: number;
		lastDy: number;
		hasStep: boolean;
	}

	let start = $state<Pt>({ ...PRESETS[0].start });

	function freshRunner(id: OptimizerId): Runner {
		return {
			id,
			x: start.x,
			y: start.y,
			loss: preset.f(start.x, start.y),
			diverged: false,
			trail: [{ x: start.x, y: start.y }],
			lastDx: 0,
			lastDy: 0,
			hasStep: false
		};
	}

	function initAllStates(): Record<OptimizerId, OptState> {
		return {
			gd: initOptState(),
			momentum: initOptState(),
			adam: initOptState(),
			adamw: initOptState(),
			lion: initOptState()
		};
	}

	let runners = $state<Runner[]>(RUNNERS.map((r) => freshRunner(r.id)));
	// Non-reactive optimizer internals (positions mirror into $state).
	let optStates: Record<OptimizerId, OptState> = initAllStates();

	let stepCount = $state(0);
	let playing = $state(false);
	let dragging = $state(false);
	let stopAt = $state(0);

	// ------------------------------------------------------------- controls
	// γ on a log slider: pos 0–100 → 10^(−3 + 3·pos/100), i.e. 0.001 … 1.
	let lrPos = $state(67);
	const lr = $derived(Math.pow(10, -3 + (3 * lrPos) / 100));
	const lrLabel = $derived(
		lr >= 0.0995 ? lr.toFixed(2) : lr >= 0.00995 ? lr.toFixed(3) : lr.toFixed(4)
	);
	// The tone heats up as γ grows toward the divergence zone.
	const lrTone = $derived<'teal' | 'amber' | 'rose'>(
		lr < 0.03 ? 'teal' : lr < 0.3 ? 'amber' : 'rose'
	);
	let wd = $state(0); // λ — AdamW only
	let sps = $state(30); // steps per second
	let stepBudget = $state(400); // steps per Play press

	let cmap = $state<ColormapId>('cubehelix');
	let showContours = $state(true);

	// --------------------------------------------------------------- theme
	// Effective theme: explicit .dark/.light class on <html> wins; otherwise
	// the OS preference (the site follows `system` by default).
	let isDark = $state(false);
	function readTheme(): boolean {
		const cl = document.documentElement.classList;
		if (cl.contains('dark')) return true;
		if (cl.contains('light')) return false;
		return window.matchMedia('(prefers-color-scheme: dark)').matches;
	}

	// -------------------------------------------------------------- physics
	function commit(r: Runner, nx: number, ny: number): boolean {
		if (
			!Number.isFinite(nx) ||
			!Number.isFinite(ny) ||
			Math.abs(nx) > BOUND ||
			Math.abs(ny) > BOUND
		) {
			r.diverged = true;
			r.hasStep = false;
			return false;
		}
		r.lastDx = nx - r.x;
		r.lastDy = ny - r.y;
		r.hasStep = true;
		r.x = nx;
		r.y = ny;
		r.loss = preset.f(nx, ny);
		r.trail.push({ x: nx, y: ny });
		if (r.trail.length > MAX_TRAIL) r.trail.shift();
		return true;
	}

	function tick() {
		stepCount++;
		for (const r of runners) {
			if (r.diverged) continue;
			const [gx, gy] = gradAt(preset, r.x, r.y);
			const next = stepOptimizer(r.id, r.x, r.y, gx, gy, optStates[r.id], lr, wd);
			commit(r, next.x, next.y);
		}
		if (playing && stepCount >= stopAt) playing = false;
	}

	function reseed() {
		stepCount = 0;
		playing = false;
		optStates = initAllStates();
		runners = RUNNERS.map((r) => freshRunner(r.id));
	}

	function selectPreset(id: PresetId) {
		presetId = id;
		start = { ...presetById(id).start };
		reseed();
	}

	function togglePlay() {
		if (playing) {
			playing = false;
		} else {
			stopAt = stepCount + stepBudget;
			playing = true;
		}
	}
	function stepOnce() {
		playing = false;
		tick();
	}
	function reset() {
		reseed();
	}

	// setInterval-driven stepping, rebuilt live whenever the speed changes;
	// the loop holds while the start marker is being dragged.
	$effect(() => {
		if (!playing) return;
		const ms = Math.max(8, 1000 / sps);
		const id = setInterval(() => {
			if (!dragging) tick();
		}, ms);
		return () => clearInterval(id);
	});

	const playProgress = $derived(
		playing && stepBudget > 0 ? clamp(1 - (stopAt - stepCount) / stepBudget, 0, 1) : 0
	);

	// ------------------------------------------------- focus, x-ray, ghost
	let hovered = $state<OptimizerId | null>(null);
	const focusId = $derived<OptimizerId>(hovered ?? 'adamw');
	const focusRunner = $derived(runners.find((r) => r.id === focusId) ?? runners[0]);
	const focusColor = $derived(RUNNERS.find((r) => r.id === focusId)?.color ?? '#ef4444');

	const ARROW_HIDE = 2.5;
	const GRAD_MAX_LEN = 42; // −∇ℒ at the steepest visible point
	const STEP_MAX_LEN = 46; // literal Δθ screen length, capped

	interface Vec {
		x2: number;
		y2: number;
	}
	function screenVec(vx: number, vy: number, len: number): Vec | null {
		// (vx, vy) in param space → screen direction, scaled to len px.
		const dx = vx * kx;
		const dy = -vy * ky;
		const m = Math.hypot(dx, dy);
		if (!Number.isFinite(m) || m < 1e-9 || len < ARROW_HIDE) return null;
		return { x2: (dx / m) * len, y2: (dy / m) * len };
	}

	const xray = $derived.by(() => {
		const r = focusRunner;
		if (r.diverged) return null;
		const [gx, gy] = gradAt(preset, r.x, r.y);
		const gradMag = Math.hypot(gx, gy);
		// −∇ℒ length ∝ steepness relative to the steepest visible point.
		const gradFrac = fieldMax > 0 && gradMag > 0 ? Math.min(1.3, gradMag / fieldMax) : 0;
		const gradArrow = screenVec(-gx, -gy, gradFrac * GRAD_MAX_LEN);
		// Δθ at its literal screen length (capped), so it grows with a bold
		// step and disappears at convergence.
		const stepPx = Math.hypot(r.lastDx * kx, r.lastDy * ky);
		const stepArrow = r.hasStep
			? screenVec(r.lastDx, r.lastDy, Math.min(STEP_MAX_LEN, stepPx))
			: null;
		// Next-step ghost: a dry run of the focused optimizer's next update —
		// velocity, moments and the λθ pull included, nothing committed.
		const pred = predictNext(r.id, r.x, r.y, gx, gy, optStates[r.id], lr, wd);
		const gdx = (pred.x - r.x) * kx;
		const gdy = -(pred.y - r.y) * ky;
		const ghost =
			Number.isFinite(gdx) && Number.isFinite(gdy) && Math.hypot(gdx, gdy) >= 4
				? { dx: gdx, dy: gdy }
				: null;
		return { gx, gy, gradMag, gradArrow, stepArrow, ghost };
	});

	function fmtParam(v: number): string {
		return Number.isFinite(v) ? v.toFixed(3) : '—';
	}
	function fmtMag(v: number): string {
		if (!Number.isFinite(v)) return '—';
		if (v === 0) return '0';
		return v >= 0.01 ? v.toFixed(3) : v.toExponential(1);
	}

	// ------------------------------------------------------------ trails
	function pathD(trail: Pt[]): string {
		let d = '';
		for (let k = 0; k < trail.length; k++) {
			d += `${k === 0 ? 'M' : 'L'}${sx(trail[k].x).toFixed(1)} ${sy(trail[k].y).toFixed(1)}`;
		}
		return d;
	}

	// The focused runner's recent path as individual segments with an age
	// ramp — faint and thin at the tail, bold and thick at the head.
	interface Seg {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		o: number;
		w: number;
	}
	const focusSegments = $derived.by<Seg[]>(() => {
		const trail = focusRunner.trail;
		if (trail.length < 2) return [];
		const recent = trail.slice(Math.max(0, trail.length - 100));
		const out: Seg[] = [];
		for (let i = 0; i < recent.length - 1; i++) {
			const p = i / (recent.length - 1);
			out.push({
				x1: sx(recent[i].x),
				y1: sy(recent[i].y),
				x2: sx(recent[i + 1].x),
				y2: sy(recent[i + 1].y),
				o: 0.05 + p * 0.75,
				w: 2 + p * 8
			});
		}
		return out;
	});

	interface Head {
		cx: number;
		cy: number;
		offMap: boolean;
	}
	function headPos(r: Runner, rad: number): Head {
		// Pin off-frame heads to the edge with a dashed, faded look instead
		// of letting the frame swallow them mid-divergence.
		const rawX = sx(r.x);
		const rawY = sy(r.y);
		const offMap =
			!Number.isFinite(rawX) ||
			!Number.isFinite(rawY) ||
			rawX < 0 ||
			rawX > VW ||
			rawY < 0 ||
			rawY > VH;
		return {
			cx: clamp(Number.isFinite(rawX) ? rawX : VW / 2, rad, VW - rad),
			cy: clamp(Number.isFinite(rawY) ? rawY : VH / 2, rad, VH - rad),
			offMap
		};
	}

	// ------------------------------------------------------------ contours
	const contourD = $derived(contourPaths(grid, (x, y) => [sx(x), sy(y)]));

	// ------------------------------------------------------- canvas heatmap
	let canvasEl: HTMLCanvasElement | undefined;
	let stageEl: HTMLDivElement | undefined;
	let stageW = $state(0);
	let stageH = $state(0);

	function paintHeatmap() {
		const canvas = canvasEl;
		if (!canvas || stageW === 0 || stageH === 0) return;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const W = Math.max(1, Math.round(stageW * dpr));
		const H = Math.max(1, Math.round(stageH * dpr));
		if (canvas.width !== W) canvas.width = W;
		if (canvas.height !== H) canvas.height = H;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// One pixel per grid cell on an offscreen canvas…
		const off = document.createElement('canvas');
		off.width = grid.res;
		off.height = grid.res;
		const offCtx = off.getContext('2d');
		if (!offCtx) return;
		const rgba = heatmapRGBA(grid, cmap, isDark ? 'dark' : 'light');
		offCtx.putImageData(new ImageData(rgba, grid.res, grid.res), 0, 0);

		// …then scaled up with smoothing, the extended 20% skirt hanging
		// past the frame so the visible window is seam-free at the edges.
		const visSpanX = preset.xMax - preset.xMin;
		const visSpanY = preset.yMax - preset.yMin;
		const dx = ((grid.extXMin - preset.xMin) / visSpanX) * W;
		const dw = ((grid.extXMax - grid.extXMin) / visSpanX) * W;
		const dy = ((preset.yMax - grid.extYMax) / visSpanY) * H;
		const dh = ((grid.extYMax - grid.extYMin) / visSpanY) * H;
		ctx.clearRect(0, 0, W, H);
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(off, dx, dy, dw, dh);
	}

	// Repaint on grid/preset, colormap, theme, or size changes.
	$effect(() => {
		void grid;
		void cmap;
		void isDark;
		void stageW;
		void stageH;
		paintHeatmap();
	});

	let themeObs: MutationObserver | null = null;
	let themeMql: MediaQueryList | null = null;
	let resizeObs: ResizeObserver | null = null;
	let resizeTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		isDark = readTheme();
		const onTheme = () => (isDark = readTheme());
		themeObs = new MutationObserver(onTheme);
		themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		themeMql = window.matchMedia('(prefers-color-scheme: dark)');
		themeMql.addEventListener('change', onTheme);

		// ResizeObserver → repaint, debounced ~100ms (first measure immediate).
		resizeObs = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (!rect) return;
			const apply = () => {
				stageW = rect.width;
				stageH = rect.height;
			};
			if (stageW === 0) {
				apply();
				return;
			}
			if (resizeTimer) clearTimeout(resizeTimer);
			resizeTimer = setTimeout(apply, 100);
		});
		if (stageEl) resizeObs.observe(stageEl);
	});

	onDestroy(() => {
		themeObs?.disconnect();
		themeMql?.removeEventListener('change', () => {});
		resizeObs?.disconnect();
		if (resizeTimer) clearTimeout(resizeTimer);
	});

	// ------------------------------------------------- drag the start marker
	let svgEl: SVGSVGElement | undefined;

	function unproject(e: PointerEvent): Pt | null {
		const rect = svgEl?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return null;
		return {
			x: clamp(
				preset.xMin + ((e.clientX - rect.left) / rect.width) * (preset.xMax - preset.xMin),
				preset.xMin,
				preset.xMax
			),
			y: clamp(
				preset.yMax - ((e.clientY - rect.top) / rect.height) * (preset.yMax - preset.yMin),
				preset.yMin,
				preset.yMax
			)
		};
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		const p = unproject(e);
		if (!p) return;
		dragging = true;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			// a pointer released before the handler ran can no longer be captured
		}
		start = p;
		reseed();
	}
	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const p = unproject(e);
		if (p) {
			start = p;
			reseed();
		}
	}
	function onPointerUp() {
		dragging = false;
	}

	function onKeyDown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement).tagName;
		if (tag === 'BUTTON' || tag === 'INPUT') return;
		if (e.code === 'Space') {
			e.preventDefault();
			togglePlay();
			return;
		}
		const nudge: Record<string, [number, number]> = {
			ArrowLeft: [-0.1, 0],
			ArrowRight: [0.1, 0],
			ArrowUp: [0, 0.1],
			ArrowDown: [0, -0.1]
		};
		const d = nudge[e.key];
		if (d) {
			e.preventDefault();
			start = {
				x: clamp(start.x + d[0], preset.xMin, preset.xMax),
				y: clamp(start.y + d[1], preset.yMin, preset.yMax)
			};
			reseed();
		}
	}

	function swallow(e: Event) {
		e.stopPropagation();
	}
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
			<Flag size={16} strokeWidth={2.5} />
			<span>The optimizer race</span>
		</div>
		<div class="text-xs" style="color: var(--color-text-muted); font-family: var(--font-mono);">
			step {stepCount}
		</div>
	</div>
	<p class="mb-3 text-xs" style="color: var(--color-text-muted);">
		One landscape, one learning rate, five update rules. Drag the amber handle — or click anywhere
		on the map — to restart the race from a new θ₀. Hover a name in the legend to spotlight that
		optimizer and move the x-ray to its marker. Space plays and pauses.
	</p>

	<div class="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
		<div class="seg" role="group" aria-label="Landscape preset">
			{#each PRESETS as p (p.id)}
				<button class="seg-btn" class:on={presetId === p.id} onclick={() => selectPreset(p.id)}>
					{p.label}
				</button>
			{/each}
		</div>
		<div class="flex items-center gap-3">
			<button
				class="ctoggle"
				class:on={showContours}
				role="switch"
				aria-checked={showContours}
				title="Contour lines — log-spaced level sets of the loss"
				onclick={() => (showContours = !showContours)}
			>
				<span class="ctoggle-knob"></span>
				<span>contours</span>
			</button>
			<div class="cmaps" role="group" aria-label="Colormap">
				{#each COLORMAPS as cm (cm)}
					<button
						class="cmap"
						class:on={cmap === cm}
						style="background: linear-gradient(to right, {colormapStops(
							cm,
							8,
							isDark ? 'dark' : 'light'
						)});"
						aria-label={cm}
						title={cm}
						onclick={() => (cmap = cm)}
					></button>
				{/each}
			</div>
		</div>
	</div>

	<!-- role="application" is ARIA's role for widgets that handle their own
	     keyboard input (Space, arrows) — interactive by spec, even though
	     Svelte's a11y checker doesn't list it as such. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={stageEl}
		class="stage relative w-full overflow-hidden rounded-lg border select-none"
		class:plot-dark={isDark}
		style="border-color: var(--color-border-light); cursor: {dragging
			? 'grabbing'
			: 'crosshair'}; touch-action: none;"
		role="application"
		aria-label="Optimizer race playground. Space plays or pauses the race. Arrow keys nudge the start point. Drag anywhere on the map to move the start."
		tabindex="0"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onkeydown={onKeyDown}
	>
		<canvas bind:this={canvasEl} class="absolute inset-0 h-full w-full"></canvas>
		<svg bind:this={svgEl} viewBox="0 0 {VW} {VH}" class="relative block h-auto w-full">
			<defs>
				<marker
					id="optx-grad-head"
					viewBox="0 -5 10 10"
					refX="8"
					refY="0"
					markerWidth="4.5"
					markerHeight="4.5"
					orient="auto"
				>
					<path d="M0,-5L10,0L0,5" fill="#3b82f6" />
				</marker>
				<marker
					id="optx-step-head"
					viewBox="0 -5 10 10"
					refX="8"
					refY="0"
					markerWidth="4.5"
					markerHeight="4.5"
					orient="auto"
				>
					<path d="M0,-5L10,0L0,5" fill="#ef4444" />
				</marker>
			</defs>

			<!-- contour rings over the heatmap -->
			{#if showContours}
				{#each contourD as d, i (i)}
					<path
						{d}
						fill="none"
						stroke={isDark ? '#ffffff' : '#334155'}
						stroke-width="1.5"
						opacity="0.5"
					/>
				{/each}
			{/if}

			<!-- axis labels, italic serif like the source plot -->
			<text class="axis-label" x={VW / 2} y={VH - 10} text-anchor="middle">α</text>
			<text class="axis-label" x="14" y={VH / 2} text-anchor="middle">β</text>

			<!-- origin: where weight decay pulls -->
			<g opacity={wd > 0 ? 0.9 : 0.4}>
				<line
					x1={sx(0) - 7}
					y1={sy(0)}
					x2={sx(0) + 7}
					y2={sy(0)}
					stroke={isDark ? '#94a3b8' : '#475569'}
					stroke-width="1"
				/>
				<line
					x1={sx(0)}
					y1={sy(0) - 7}
					x2={sx(0)}
					y2={sy(0) + 7}
					stroke={isDark ? '#94a3b8' : '#475569'}
					stroke-width="1"
				/>
				<text x={sx(0) + 10} y={sy(0) - 6} font-size="10" fill={isDark ? '#94a3b8' : '#475569'}>
					0
				</text>
			</g>

			<!-- the decoupled λθ pull, made visible at AdamW's marker -->
			{#each runners.filter((r) => r.id === 'adamw' && !r.diverged && wd > 0) as r (r.id)}
				<line
					x1={sx(r.x)}
					y1={sy(r.y)}
					x2={sx(0)}
					y2={sy(0)}
					stroke="#ef4444"
					stroke-width="1"
					stroke-dasharray="3 5"
					opacity={0.15 + (wd / 0.3) * 0.35}
				/>
			{/each}

			<!-- focused runner: recent path as age-ramped segments (thin+faint
			     at the tail → thick+bold at the head, round caps) -->
			{#each focusSegments as s, i (i)}
				<line
					x1={s.x1}
					y1={s.y1}
					x2={s.x2}
					y2={s.y2}
					stroke={focusColor}
					stroke-width={s.w}
					stroke-linecap="round"
					opacity={s.o}
				/>
			{/each}

			<!-- race trails: one smooth colored path per optimizer -->
			{#each runners as r (r.id)}
				{@const spec = RUNNERS.find((s) => s.id === r.id)}
				{@const hot = hovered === r.id}
				{@const dim = hovered !== null && !hot}
				{#if r.trail.length >= 2 && spec}
					<path
						d={pathD(r.trail)}
						fill="none"
						stroke={spec.color}
						stroke-width={hot ? 3.4 : 2.2}
						stroke-linecap="round"
						stroke-linejoin="round"
						opacity={r.diverged ? (dim ? 0.12 : 0.3) : hot ? 1 : dim ? 0.12 : 0.9}
					/>
				{/if}
			{/each}

			<!-- x-ray at the focused runner's marker -->
			{#if xray}
				<g transform="translate({sx(focusRunner.x)} {sy(focusRunner.y)})">
					{#if xray.ghost}
						<line
							x1="0"
							y1="0"
							x2={xray.ghost.dx}
							y2={xray.ghost.dy}
							stroke="#fbbf24"
							stroke-width="1.5"
							stroke-dasharray="3 3"
							opacity="0.8"
						/>
						<circle
							cx={xray.ghost.dx}
							cy={xray.ghost.dy}
							r="7"
							fill="rgba(251, 191, 36, 0.15)"
							stroke="#fbbf24"
							stroke-width="2"
							stroke-dasharray="4 3"
						/>
						<circle cx={xray.ghost.dx} cy={xray.ghost.dy} r="1.8" fill="#fbbf24" />
					{/if}
					{#if xray.gradArrow}
						<line
							x1="0"
							y1="0"
							x2={xray.gradArrow.x2}
							y2={xray.gradArrow.y2}
							stroke="#3b82f6"
							stroke-width="2.5"
							stroke-linecap="round"
							marker-end="url(#optx-grad-head)"
							opacity="0.95"
						/>
					{/if}
					{#if xray.stepArrow}
						<line
							x1="0"
							y1="0"
							x2={xray.stepArrow.x2}
							y2={xray.stepArrow.y2}
							stroke="#ef4444"
							stroke-width="2.5"
							stroke-linecap="round"
							marker-end="url(#optx-step-head)"
							opacity="0.95"
						/>
					{/if}
				</g>
			{/if}

			<!-- runner heads -->
			{#each runners as r (r.id)}
				{@const spec = RUNNERS.find((s) => s.id === r.id)}
				{@const hot = hovered === r.id}
				{@const dim = hovered !== null && !hot}
				{@const head = headPos(r, hot ? 5.9 : 4.5)}
				{#if spec}
					<circle
						cx={head.cx}
						cy={head.cy}
						r={hot ? 5.9 : 4.5}
						fill={spec.color}
						stroke="#fff"
						stroke-width="1.2"
						stroke-dasharray={head.offMap ? '3 2.5' : undefined}
						opacity={r.diverged
							? dim
								? 0.18
								: 0.35
							: hot
								? 1
								: dim
									? 0.12
									: head.offMap
										? 0.7
										: 1}
					/>
				{/if}
			{/each}

			<!-- draggable θ₀ handle: amber ring + dot, generous invisible hit area -->
			<g transform="translate({sx(start.x)} {sy(start.y)})" class="marker">
				<circle r="22" fill="transparent" style="cursor: grab;" />
				<circle r="10" fill="none" stroke="#f59e0b" stroke-width="2" />
				<circle r="6" fill="#f59e0b" stroke="#fff" stroke-width="2" />
				<text x="15" y="4" font-size="11" fill={isDark ? '#fcd34d' : '#b45309'} class="mono">
					θ₀
				</text>
			</g>
		</svg>

		<!-- live readout, top-left -->
		<div class="readout">
			<span class="ro-item"><em>α</em> {fmtParam(focusRunner.x)}</span>
			<span class="ro-item"><em>β</em> {fmtParam(focusRunner.y)}</span>
			<span class="ro-item"><em>‖∇ℒ‖</em> {fmtMag(xray ? xray.gradMag : NaN)}</span>
		</div>

		<!-- race legend: hover to spotlight -->
		<div class="legend" onpointerdown={swallow}>
			{#each RUNNERS as spec (spec.id)}
				{@const r = runners.find((x) => x.id === spec.id)}
				<button
					class="legend-row"
					class:hot={hovered === spec.id}
					class:dim={hovered !== null && hovered !== spec.id}
					title={spec.blurb}
					onmouseenter={() => (hovered = spec.id)}
					onmouseleave={() => (hovered = null)}
					onfocus={() => (hovered = spec.id)}
					onblur={() => (hovered = null)}
				>
					<span class="legend-dot" style="background: {spec.color};"></span>
					<span class="legend-name">{spec.label}</span>
					{#if r?.diverged}
						<span class="legend-x">✗</span>
					{:else if r}
						<span class="legend-loss">{r.loss.toFixed(2)}</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- vector key, bottom-left -->
		<div class="vec-key" onpointerdown={swallow}>
			<span class="vec-item" title="Steepest-descent direction at the marker: −∇ℒ, straight downhill">
				<svg width="20" height="10" viewBox="0 0 20 10" aria-hidden="true">
					<line x1="1" y1="5" x2="12" y2="5" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" />
					<path d="M12,1.5 L19,5 L12,8.5 Z" fill="#3b82f6" />
				</svg>
				<span>−∇ℒ</span>
			</span>
			<span
				class="vec-item"
				title="The optimizer's actual last step: Δθ (momentum and adaptive methods bend away from −∇ℒ)"
			>
				<svg width="20" height="10" viewBox="0 0 20 10" aria-hidden="true">
					<line x1="1" y1="5" x2="12" y2="5" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
					<path d="M12,1.5 L19,5 L12,8.5 Z" fill="#ef4444" />
				</svg>
				<span>Δθ</span>
			</span>
			<span
				class="vec-item"
				title="Where the focused optimizer's next update would land from here — velocity, moment estimates and the λθ pull all included. A dry run of the real step."
			>
				<svg width="20" height="10" viewBox="0 0 20 10" aria-hidden="true">
					<circle
						cx="10"
						cy="5"
						r="4"
						fill="rgba(251,191,36,0.18)"
						stroke="#fbbf24"
						stroke-width="1.5"
						stroke-dasharray="2.5 2"
					/>
				</svg>
				<span>next step</span>
			</span>
		</div>

		<!-- vertical loss color bar, bottom-right -->
		<div class="loss-key">
			<span class="key-title">Loss</span>
			<span class="key-val">{grid.visMax.toFixed(2)}</span>
			<div
				class="vbar"
				style="background: linear-gradient(to bottom, {colormapStops(
					cmap,
					8,
					isDark ? 'dark' : 'light'
				)});"
			></div>
			<span class="key-val">{grid.visMin.toFixed(2)}</span>
		</div>
	</div>

	<div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
		<div class="flex gap-2">
			<button
				class="lab-btn play-btn"
				style="--fill: {Math.round(playProgress * 100)}%"
				onclick={togglePlay}
			>
				{#if playing}<Pause size={14} /> Pause{:else}<Play size={14} /> Play{/if}
			</button>
			<button class="lab-btn" onclick={stepOnce}><StepForward size={14} /> Step</button>
			<button class="lab-btn" onclick={reset}><RotateCcw size={14} /> Reset</button>
		</div>
		<div class="sliders">
			<Slider
				label="γ learning rate"
				bind:value={lrPos}
				min={0}
				max={100}
				step={1}
				format={() => lrLabel}
				tone={lrTone}
				hint="log scale, 0.001 → 1"
			/>
			<Slider
				label="λ weight decay"
				bind:value={wd}
				min={0}
				max={0.3}
				step={0.005}
				decimals={3}
				tone="violet"
				hint="AdamW only — the decoupled pull to 0"
			/>
			<Slider
				label="speed"
				bind:value={sps}
				min={2}
				max={60}
				step={1}
				format={(v) => `${v} steps/s`}
				tone="blue"
			/>
			<Slider
				label="steps per run"
				bind:value={stepBudget}
				min={50}
				max={1500}
				step={25}
				decimals={0}
				tone="accent"
				hint="Play pauses itself after this many"
			/>
		</div>
	</div>

	<p class="mt-3 text-[11px]" style="color: var(--color-text-muted);">
		When the blue and red arrows disagree, you are watching everything the optimizer adds on top of
		the raw slope — momentum, per-axis scaling, the λθ pull. The dashed amber ring is a dry run of
		the next step. Hover a legend entry to x-ray a different optimizer; crank λ and AdamW's red
		arrow leans toward the 0 mark — decoupled weight decay, live.
	</p>
</div>

<style>
	.stage {
		background: #ffffff;
	}
	.stage.plot-dark {
		background: #060913;
	}
	.stage:focus-visible {
		outline: 2px solid var(--color-important);
		outline-offset: 2px;
	}

	.axis-label {
		font-family: Georgia, serif;
		font-style: italic;
		font-size: 14px;
		fill: #64748b;
		opacity: 0.65;
	}
	.plot-dark .axis-label {
		fill: #94a3b8;
	}
	.mono {
		font-family: var(--font-mono);
	}

	/* ---------- overlays ---------- */
	.readout {
		position: absolute;
		top: 8px;
		left: 8px;
		display: flex;
		gap: 0.625rem;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		font-weight: 600;
		pointer-events: none;
		white-space: nowrap;
		background: rgba(255, 255, 255, 0.75);
		color: #334155;
		z-index: 3;
	}
	.plot-dark .readout {
		background: rgba(6, 9, 19, 0.65);
		color: #cbd5e1;
	}
	.ro-item em {
		font-family: Georgia, serif;
		font-style: italic;
		font-weight: 400;
		opacity: 0.7;
		margin-right: 0.2rem;
	}

	.legend {
		position: absolute;
		top: 36px;
		left: 8px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		padding: 0.3rem 0.4rem;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.55);
		color: #334155;
		z-index: 4;
	}
	.plot-dark .legend {
		background: rgba(6, 9, 19, 0.5);
		color: #cbd5e1;
	}
	.legend-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.1rem 0.25rem;
		border: none;
		border-radius: 5px;
		background: transparent;
		color: inherit;
		font-size: 0.6875rem;
		font-weight: 600;
		cursor: default;
		transition:
			opacity 0.15s ease,
			background 0.15s ease;
	}
	.legend-row.dim {
		opacity: 0.5;
	}
	.legend-row.hot {
		background: rgba(127, 127, 127, 0.22);
	}
	.legend-row.hot .legend-name {
		font-weight: 800;
	}
	.legend-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.legend-loss {
		font-family: var(--font-mono);
		font-weight: 500;
		opacity: 0.75;
		font-size: 0.625rem;
	}
	.legend-x {
		color: #f87171;
		font-weight: 700;
		font-size: 0.625rem;
	}

	.vec-key {
		position: absolute;
		left: 8px;
		bottom: 8px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 0.35rem 0.5rem;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.78);
		color: #475569;
		z-index: 3;
	}
	.plot-dark .vec-key {
		background: rgba(6, 9, 19, 0.68);
		color: #94a3b8;
	}
	.vec-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.6875rem;
		font-weight: 600;
		font-family: var(--font-mono);
		cursor: help;
		white-space: nowrap;
	}
	.vec-item svg {
		flex-shrink: 0;
	}

	.loss-key {
		position: absolute;
		right: 8px;
		bottom: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 0.35rem 0.45rem;
		border-radius: 8px;
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 600;
		pointer-events: none;
		background: rgba(255, 255, 255, 0.78);
		color: #475569;
		z-index: 3;
	}
	.plot-dark .loss-key {
		background: rgba(6, 9, 19, 0.68);
		color: #94a3b8;
	}
	.key-title {
		font-family: var(--font-heading);
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.vbar {
		width: 10px;
		height: 56px;
		border-radius: 5px;
		border: 1px solid rgba(127, 127, 127, 0.35);
	}

	/* ---------- toolbar ---------- */
	.seg {
		display: flex;
		gap: 3px;
		padding: 3px;
		border-radius: 9px;
		background: color-mix(in srgb, var(--color-text) 7%, transparent);
	}
	.seg-btn {
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		padding: 0.2rem 0.6rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
		letter-spacing: 0.03em;
	}
	.seg-btn:hover:not(.on) {
		color: var(--color-text-secondary);
	}
	.seg-btn.on {
		background: color-mix(in srgb, var(--color-important) 14%, var(--color-surface));
		border-color: color-mix(in srgb, var(--color-important) 55%, transparent);
		color: var(--color-important);
	}

	.ctoggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		padding: 0.15rem 0.55rem 0.15rem 0.2rem;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.6875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.ctoggle-knob {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--color-border);
		transition: background 0.15s ease;
	}
	.ctoggle.on {
		border-color: color-mix(in srgb, var(--color-important) 55%, transparent);
		color: var(--color-text-secondary);
	}
	.ctoggle.on .ctoggle-knob {
		background: var(--color-important);
	}

	.cmaps {
		display: flex;
		gap: 5px;
	}
	.cmap {
		width: 44px;
		height: 19px;
		border-radius: 5px;
		border: none;
		appearance: none;
		cursor: pointer;
		padding: 0;
		/* border-box origin + no border: avoids Chromium painting a stray
		   end-color pixel at the left edge of the gradient. */
		background-origin: border-box;
		background-clip: border-box;
		transition:
			box-shadow 0.12s,
			transform 0.12s;
	}
	.cmap:hover {
		transform: translateY(-1px);
	}
	.cmap.on {
		box-shadow:
			0 0 0 2px var(--color-surface),
			0 0 0 3.5px var(--color-important);
	}

	/* ---------- transport + sliders ---------- */
	.lab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 0.35rem 0.9rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text);
		background: var(--color-surface-hover);
		cursor: pointer;
		transition: border-color 120ms ease;
	}
	.lab-btn:hover {
		border-color: var(--color-important);
	}
	.play-btn {
		/* progress fill sweeps left → right as the run burns its budget */
		background: linear-gradient(
			to right,
			color-mix(in srgb, var(--color-important) 20%, var(--color-surface-hover)) var(--fill, 0%),
			var(--color-surface-hover) var(--fill, 0%)
		);
	}
	.sliders {
		display: grid;
		grid-template-columns: repeat(2, minmax(9rem, 1fr));
		gap: 0.5rem 1.25rem;
		flex: 1;
		min-width: 16rem;
	}
	@media (min-width: 720px) {
		.sliders {
			grid-template-columns: repeat(4, minmax(8rem, 1fr));
		}
	}
</style>
