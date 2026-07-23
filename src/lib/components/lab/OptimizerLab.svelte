<script lang="ts">
	// The optimizer race: three update rules loose on one curved, two-basin loss
	// landscape. SGD (raw gradient), Momentum (Polyak heavy ball, β=0.9) and
	// AdamW (bias-corrected moments + DECOUPLED weight decay, PyTorch
	// semantics) step from the same draggable start at the same learning rate.
	// The x-ray detail: at AdamW's marker, two arrows — the raw −∇f direction
	// and the step AdamW actually took — make visible everything the optimizer
	// adds on top of the slope. Math ported faithfully from the GradientDescent
	// project's gd.ts / momentum.ts / adamw.ts; gradients by central difference.
	import { onDestroy, onMount } from 'svelte';
	import { Flag, Pause, Play, RotateCcw, StepForward } from 'lucide-svelte';

	// ------------------------------------------------------------ landscape
	// A curved valley (y ≈ 0.45x² − 0.9) carrying a double well along its
	// floor: a shallow basin near (1.7, 0.3) and a deeper one near (−1.2,
	// −0.2), plus a tilt (0.18x) that makes the far basin worth reaching and a
	// mild ripple for texture. Hand-tuned so that from the default start at
	// γ = 0.1: SGD zigzags into the near basin, Momentum overshoots straight
	// through into the far one, and AdamW glides.
	const X_MIN = -3.5;
	const X_MAX = 3.5;
	const Y_MIN = -2.7;
	const Y_MAX = 2.7;
	const VW = 700;
	const VH = 540; // 100 px per math unit on BOTH axes — angles survive projection

	function f(x: number, y: number): number {
		const bend = y - 0.45 * x * x + 0.9;
		const well = x * x - 2.4;
		return (
			1.7 * bend * bend +
			0.035 * well * well +
			0.18 * x +
			0.25 * Math.sin(2.1 * x) * Math.cos(1.7 * y) +
			0.35
		);
	}

	// Numeric gradient — central differences, h = 1e-4.
	const H_DIFF = 1e-4;
	function grad(x: number, y: number): [number, number] {
		return [
			(f(x + H_DIFF, y) - f(x - H_DIFF, y)) / (2 * H_DIFF),
			(f(x, y + H_DIFF) - f(x, y - H_DIFF)) / (2 * H_DIFF)
		];
	}

	const sx = (x: number) => ((x - X_MIN) / (X_MAX - X_MIN)) * VW;
	const sy = (y: number) => VH - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * VH;
	const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

	// Loss grid, computed once; the canvas only ever re-COLORS it (theme flips).
	const GRID = 141;
	const gridF = new Float32Array(GRID * GRID);
	let gridMin = Infinity;
	let gridMax = -Infinity;
	for (let j = 0; j < GRID; j++) {
		const y = Y_MIN + (j / (GRID - 1)) * (Y_MAX - Y_MIN);
		for (let i = 0; i < GRID; i++) {
			const v = f(X_MIN + (i / (GRID - 1)) * (X_MAX - X_MIN), y);
			gridF[j * GRID + i] = v;
			if (v < gridMin) gridMin = v;
			if (v > gridMax) gridMax = v;
		}
	}

	function sampleGrid(u: number, v: number): number {
		// Bilinear over the cached grid; u across x, v across y (0 at Y_MIN).
		const gx = u * (GRID - 1);
		const gy = v * (GRID - 1);
		const i = Math.min(GRID - 2, Math.floor(gx));
		const j = Math.min(GRID - 2, Math.floor(gy));
		const fx = gx - i;
		const fy = gy - j;
		const a = gridF[j * GRID + i];
		const b = gridF[j * GRID + i + 1];
		const c = gridF[(j + 1) * GRID + i];
		const d = gridF[(j + 1) * GRID + i + 1];
		return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
	}

	// ------------------------------------------------------------ optimizers
	// Constants match the GradientDescent library's spec defaults exactly.
	const EPS = 1e-8;
	const MU = 0.9; // momentum μ
	const BETA1 = 0.9;
	const BETA2 = 0.999;
	const BOUND = 40; // divergence check, pre-commit — the marker never goes NaN
	const MAX_TRAIL = 700;
	const SPS = 30;

	interface Pt {
		x: number;
		y: number;
	}
	interface Runner {
		x: number;
		y: number;
		loss: number;
		diverged: boolean;
		trail: Pt[];
	}

	const START_DEFAULT: Pt = { x: 2.7, y: 2.3 };
	let start = $state<Pt>({ ...START_DEFAULT });

	function freshRunner(): Runner {
		return {
			x: start.x,
			y: start.y,
			loss: f(start.x, start.y),
			diverged: false,
			trail: [{ x: start.x, y: start.y }]
		};
	}

	let sgd = $state<Runner>(freshRunner());
	let mom = $state<Runner>(freshRunner());
	let adw = $state<Runner>(freshRunner());

	// Non-reactive optimizer internals (mirrored into $state via positions).
	let momV = { x: 0, y: 0 };
	let adamM = [0, 0];
	let adamV = [0, 0];
	let adamT = 0;

	const g0 = grad(START_DEFAULT.x, START_DEFAULT.y);
	// X-ray at AdamW's marker: gradient it just saw + step it actually took.
	let xray = $state({ gx: g0[0], gy: g0[1], dx: 0, dy: 0, hasStep: false });

	let stepCount = $state(0);
	let playing = $state(false);
	let dragging = $state(false);

	// Learning rate on a log slider: position = log10(γ), 1e-3 … 1.
	let lrExp = $state(-1);
	const lr = $derived(Math.pow(10, lrExp));
	const lrLabel = $derived(
		lr >= 0.0995 ? lr.toFixed(2) : lr >= 0.00995 ? lr.toFixed(3) : lr.toFixed(4)
	);
	let wd = $state(0); // λ — AdamW only

	function commit(r: Runner, nx: number, ny: number): boolean {
		// Divergence check BEFORE committing — the marker stays at its last
		// sane position (same policy as the GradientDescent trainer).
		if (
			!Number.isFinite(nx) ||
			!Number.isFinite(ny) ||
			Math.abs(nx) > BOUND ||
			Math.abs(ny) > BOUND
		) {
			r.diverged = true;
			return false;
		}
		r.x = nx;
		r.y = ny;
		r.loss = f(nx, ny);
		r.trail.push({ x: nx, y: ny });
		if (r.trail.length > MAX_TRAIL) r.trail.shift();
		return true;
	}

	function tick() {
		stepCount++;
		if (!sgd.diverged) {
			// [gd.ts] θ ← θ − γ∇ℒ — the whole algorithm.
			const [gx, gy] = grad(sgd.x, sgd.y);
			commit(sgd, sgd.x - lr * gx, sgd.y - lr * gy);
		}
		if (!mom.diverged) {
			// [momentum.ts] v ← μv + g; θ ← θ − γv (γ NOT folded into v).
			const [gx, gy] = grad(mom.x, mom.y);
			momV.x = MU * momV.x + gx;
			momV.y = MU * momV.y + gy;
			commit(mom, mom.x - lr * momV.x, mom.y - lr * momV.y);
		}
		if (!adw.diverged) {
			// [adamw.ts] moments + bias correction, then the adaptive step PLUS
			// a decoupled γλθ pull toward zero — the whole meaning of the "W".
			const [gx, gy] = grad(adw.x, adw.y);
			const t = ++adamT;
			const mc1 = 1 - Math.pow(BETA1, t);
			const mc2 = 1 - Math.pow(BETA2, t);
			const p = [adw.x, adw.y];
			const g = [gx, gy];
			const next = [0, 0];
			for (let i = 0; i < 2; i++) {
				adamM[i] = BETA1 * adamM[i] + (1 - BETA1) * g[i];
				adamV[i] = BETA2 * adamV[i] + (1 - BETA2) * g[i] * g[i];
				const mHat = adamM[i] / mc1;
				const vHat = adamV[i] / mc2;
				next[i] = p[i] - lr * (mHat / (Math.sqrt(vHat) + EPS) + wd * p[i]);
			}
			const ok = commit(adw, next[0], next[1]);
			xray = { gx, gy, dx: next[0] - p[0], dy: next[1] - p[1], hasStep: ok };
		}
	}

	function reseed() {
		stepCount = 0;
		momV = { x: 0, y: 0 };
		adamM = [0, 0];
		adamV = [0, 0];
		adamT = 0;
		sgd = freshRunner();
		mom = freshRunner();
		adw = freshRunner();
		const [gx, gy] = grad(start.x, start.y);
		xray = { gx, gy, dx: 0, dy: 0, hasStep: false };
	}

	// ----------------------------------------------------------- play loop
	let timer: ReturnType<typeof setInterval> | null = null;

	function stopTimer() {
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
	}
	function startTimer() {
		stopTimer();
		// setInterval-driven stepping (~30 steps/s), never per-frame RAF; the
		// loop holds while the start marker is being dragged.
		timer = setInterval(
			() => {
				if (!dragging) tick();
			},
			Math.round(1000 / SPS)
		);
	}
	function togglePlay() {
		playing = !playing;
		if (playing) startTimer();
		else stopTimer();
	}
	function stepOnce() {
		if (playing) {
			playing = false;
			stopTimer();
		}
		tick();
	}
	function reset() {
		playing = false;
		stopTimer();
		reseed();
	}

	// ------------------------------------------------- drag the start marker
	let svgEl: SVGSVGElement | undefined;

	function unproject(e: PointerEvent): Pt | null {
		const rect = svgEl?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return null;
		return {
			x: clamp(X_MIN + ((e.clientX - rect.left) / rect.width) * (X_MAX - X_MIN), X_MIN, X_MAX),
			y: clamp(Y_MAX - ((e.clientY - rect.top) / rect.height) * (Y_MAX - Y_MIN), Y_MIN, Y_MAX)
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
				x: clamp(start.x + d[0], X_MIN, X_MAX),
				y: clamp(start.y + d[1], Y_MIN, Y_MAX)
			};
			reseed();
		}
	}

	// ------------------------------------------------------- canvas heatmap
	let canvasEl: HTMLCanvasElement | undefined;
	const RES = 2; // backing-store scale over the viewBox

	type RGB = [number, number, number];
	function cssColor(name: string, probe: CanvasRenderingContext2D): RGB {
		// Normalize any CSS color the theme hands us via the canvas itself.
		const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		probe.fillStyle = '#808080';
		probe.fillStyle = raw;
		const s = String(probe.fillStyle);
		if (s.startsWith('#')) {
			return [
				parseInt(s.slice(1, 3), 16),
				parseInt(s.slice(3, 5), 16),
				parseInt(s.slice(5, 7), 16)
			];
		}
		const m = s.match(/[\d.]+/g);
		return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
	}

	function paintHeatmap() {
		const ctx = canvasEl?.getContext('2d');
		if (!ctx) return;
		// Two stops, both theme-derived: walls fade into the card surface,
		// basins pool into the vibe violet. Contour bands inked with the text
		// color so the topo lines read in both themes.
		const high = cssColor('--color-surface', ctx);
		const vibe = cssColor('--color-vibe', ctx);
		const ink = cssColor('--color-text', ctx);
		const low: RGB = [
			high[0] + (vibe[0] - high[0]) * 0.8,
			high[1] + (vibe[1] - high[1]) * 0.8,
			high[2] + (vibe[2] - high[2]) * 0.8
		];
		const W = VW * RES;
		const H = VH * RES;
		const img = ctx.createImageData(W, H);
		const data = img.data;
		const logDen = Math.log(1 + (gridMax - gridMin));
		let p = 0;
		for (let py = 0; py < H; py++) {
			const v = 1 - py / (H - 1); // canvas row 0 is Y_MAX
			for (let px = 0; px < W; px++) {
				const loss = sampleGrid(px / (W - 1), v);
				// Log scaling: the valley floor gets the color range, not the walls.
				const t = Math.log(1 + (loss - gridMin)) / logDen;
				const mix = 1 - t;
				let r = high[0] + (low[0] - high[0]) * mix;
				let g = high[1] + (low[1] - high[1]) * mix;
				let b = high[2] + (low[2] - high[2]) * mix;
				const band = t * 14;
				const fb = band - Math.floor(band);
				if (fb < 0.055) {
					const s = (1 - fb / 0.055) * 0.16;
					r += (ink[0] - r) * s;
					g += (ink[1] - g) * s;
					b += (ink[2] - b) * s;
				}
				data[p++] = r;
				data[p++] = g;
				data[p++] = b;
				data[p++] = 255;
			}
		}
		ctx.putImageData(img, 0, 0);
	}

	let themeObs: MutationObserver | null = null;
	let themeMql: MediaQueryList | null = null;
	const repaint = () => paintHeatmap();

	onMount(() => {
		paintHeatmap();
		// The class on <html> is what the in-app toggle changes; the media
		// query covers an OS-level switch while the site follows `system`.
		themeObs = new MutationObserver(repaint);
		themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		themeMql = window.matchMedia('(prefers-color-scheme: dark)');
		themeMql.addEventListener('change', repaint);
	});

	onDestroy(() => {
		stopTimer();
		themeObs?.disconnect();
		themeMql?.removeEventListener('change', repaint);
	});

	// ------------------------------------------------------------ rendering
	const CHUNK = 12;
	function fadeChunks(trail: Pt[]): Array<{ d: string; o: number }> {
		// Fading trail: chunked segments whose opacity ramps toward the head.
		if (trail.length < 2) return [];
		const out: Array<{ d: string; o: number }> = [];
		const n = Math.ceil((trail.length - 1) / CHUNK);
		for (let c = 0; c < n; c++) {
			const seg = trail.slice(c * CHUNK, c * CHUNK + CHUNK + 1);
			let d = '';
			for (let k = 0; k < seg.length; k++) {
				d += `${k === 0 ? 'M' : 'L'}${sx(seg[k].x).toFixed(1)} ${sy(seg[k].y).toFixed(1)}`;
			}
			out.push({ d, o: n === 1 ? 0.9 : 0.08 + 0.82 * (c / (n - 1)) });
		}
		return out;
	}
	const trailS = $derived(fadeChunks(sgd.trail));
	const trailM = $derived(fadeChunks(mom.trail));
	const trailA = $derived(fadeChunks(adw.trail));

	const ARROW_LEN = 44;
	function arrowFrom(vx: number, vy: number): { x2: number; y2: number } | null {
		const m = Math.hypot(vx, vy);
		if (m < 1e-12) return null;
		return {
			x2: sx(adw.x) + (vx / m) * ARROW_LEN,
			y2: sy(adw.y) - (vy / m) * ARROW_LEN
		};
	}
	const rawArrow = $derived(arrowFrom(-xray.gx, -xray.gy));
	const stepArrow = $derived(xray.hasStep ? arrowFrom(xray.dx, xray.dy) : null);

	const chips = $derived([
		{ name: 'SGD', color: 'var(--color-note)', r: sgd },
		{ name: 'Momentum', color: 'var(--color-tip)', r: mom },
		{ name: 'AdamW', color: 'var(--color-important)', r: adw }
	]);
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
		One landscape, one learning rate, three update rules. Drag the dashed ring — or click anywhere
		on the map — to restart the race from a new θ₀. Space plays and pauses.
	</p>

	<!-- role="application" is ARIA's role for widgets that handle their own
	     keyboard input (Space, arrows) — interactive by spec, even though
	     Svelte's a11y checker doesn't list it as such. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="stage relative w-full overflow-hidden rounded-lg border select-none"
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
		<div
			role="img"
			aria-label="Heatmap of a curved, two-basin loss landscape with the trajectories of SGD, Momentum and AdamW"
		>
			<canvas
				bind:this={canvasEl}
				width={VW * RES}
				height={VH * RES}
				class="absolute inset-0 h-full w-full"
			></canvas>
			<svg bind:this={svgEl} viewBox="0 0 {VW} {VH}" class="relative block h-auto w-full">
				<defs>
					<marker
						id="optlab-arrow-raw"
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerWidth="6"
						markerHeight="6"
						orient="auto-start-reverse"
					>
						<path d="M0 0L10 5L0 10z" fill="var(--color-note)" />
					</marker>
					<marker
						id="optlab-arrow-step"
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerWidth="6"
						markerHeight="6"
						orient="auto-start-reverse"
					>
						<path d="M0 0L10 5L0 10z" fill="var(--color-important)" />
					</marker>
				</defs>

				<!-- origin: where weight decay pulls -->
				<g opacity={wd > 0 ? 0.9 : 0.4}>
					<line
						x1={sx(0) - 7}
						y1={sy(0)}
						x2={sx(0) + 7}
						y2={sy(0)}
						stroke="var(--color-text-muted)"
						stroke-width="1"
					/>
					<line
						x1={sx(0)}
						y1={sy(0) - 7}
						x2={sx(0)}
						y2={sy(0) + 7}
						stroke="var(--color-text-muted)"
						stroke-width="1"
					/>
					<text x={sx(0) + 10} y={sy(0) - 6} font-size="10" fill="var(--color-text-muted)">0</text>
				</g>

				<!-- the decoupled λθ pull, made visible -->
				{#if wd > 0 && !adw.diverged}
					<line
						x1={sx(adw.x)}
						y1={sy(adw.y)}
						x2={sx(0)}
						y2={sy(0)}
						stroke="var(--color-important)"
						stroke-width="1"
						stroke-dasharray="3 5"
						opacity={0.15 + (wd / 0.3) * 0.35}
					/>
				{/if}

				<!-- fading trails -->
				{#each trailS as c, i (i)}
					<path
						d={c.d}
						fill="none"
						stroke="var(--color-note)"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						opacity={c.o}
					/>
				{/each}
				{#each trailM as c, i (i)}
					<path
						d={c.d}
						fill="none"
						stroke="var(--color-tip)"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						opacity={c.o}
					/>
				{/each}
				{#each trailA as c, i (i)}
					<path
						d={c.d}
						fill="none"
						stroke="var(--color-important)"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						opacity={c.o}
					/>
				{/each}

				<!-- x-ray: raw −∇f vs the step AdamW actually took -->
				{#if !adw.diverged}
					{#if rawArrow}
						<line
							x1={sx(adw.x)}
							y1={sy(adw.y)}
							x2={rawArrow.x2}
							y2={rawArrow.y2}
							stroke="var(--color-note)"
							stroke-width="2"
							marker-end="url(#optlab-arrow-raw)"
							opacity="0.9"
						/>
					{/if}
					{#if stepArrow}
						<line
							x1={sx(adw.x)}
							y1={sy(adw.y)}
							x2={stepArrow.x2}
							y2={stepArrow.y2}
							stroke="var(--color-important)"
							stroke-width="2"
							marker-end="url(#optlab-arrow-step)"
							opacity="0.95"
						/>
					{/if}
				{/if}

				<!-- runners -->
				<circle
					cx={sx(sgd.x)}
					cy={sy(sgd.y)}
					r="6"
					fill="var(--color-note)"
					stroke="var(--color-surface)"
					stroke-width="2"
				/>
				<circle
					cx={sx(mom.x)}
					cy={sy(mom.y)}
					r="6"
					fill="var(--color-tip)"
					stroke="var(--color-surface)"
					stroke-width="2"
				/>
				<circle
					cx={sx(adw.x)}
					cy={sy(adw.y)}
					r="6"
					fill="var(--color-important)"
					stroke="var(--color-surface)"
					stroke-width="2"
				/>

				<!-- draggable start -->
				<g transform="translate({sx(start.x)} {sy(start.y)})">
					<circle
						r="13"
						fill="transparent"
						stroke="var(--color-text)"
						stroke-width="2"
						stroke-dasharray="4 3"
						opacity="0.85"
					/>
					<circle r="3" fill="var(--color-text)" />
					<text
						x="17"
						y="4"
						font-size="11"
						fill="var(--color-text)"
						style="font-family: var(--font-mono);">θ₀</text
					>
				</g>
			</svg>
		</div>
	</div>

	<div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
		<div class="flex gap-2">
			<button class="lab-btn" onclick={togglePlay}>
				{#if playing}<Pause size={14} /> Pause{:else}<Play size={14} /> Play{/if}
			</button>
			<button class="lab-btn" onclick={stepOnce}><StepForward size={14} /> Step</button>
			<button class="lab-btn" onclick={reset}><RotateCcw size={14} /> Reset</button>
		</div>
		<label class="flex items-center gap-2 text-xs" style="color: var(--color-text-muted);">
			γ&nbsp;learning&nbsp;rate
			<input
				type="range"
				min="-3"
				max="0"
				step="0.01"
				bind:value={lrExp}
				class="w-28"
				aria-label="learning rate, log scale from 0.001 to 1"
			/>
			<span class="ctl-value">{lrLabel}</span>
		</label>
		<label class="flex items-center gap-2 text-xs" style="color: var(--color-text-muted);">
			λ&nbsp;decay
			<input
				type="range"
				min="0"
				max="0.3"
				step="0.005"
				bind:value={wd}
				class="w-28"
				aria-label="AdamW weight decay from 0 to 0.3"
			/>
			<span class="ctl-value">{wd.toFixed(3)}</span>
			<span class="text-[10px]" style="color: var(--color-text-muted);">(AdamW only)</span>
		</label>
	</div>

	<div class="mt-3 flex flex-wrap items-center gap-2">
		{#each chips as c (c.name)}
			<span class="chip" style="border-color: color-mix(in srgb, {c.color} 45%, transparent);">
				<span class="dot" style="background: {c.color};"></span>
				<span style="color: var(--color-text);">{c.name}</span>
				{#if c.r.diverged}
					<span style="color: var(--color-challenge); font-weight: 700;">diverged</span>
				{:else}
					<span style="color: var(--color-text-secondary); font-family: var(--font-mono);"
						>{c.r.loss.toFixed(2)}</span
					>
				{/if}
			</span>
		{/each}
		<span class="text-[11px]" style="color: var(--color-text-muted);"
			>current loss f(θ) — lower is better</span
		>
	</div>

	<div class="mt-3 rounded-lg border p-3" style="border-color: var(--color-border-light);">
		<div
			class="mb-1 text-[10px] font-bold tracking-wide uppercase"
			style="color: var(--color-text-muted); letter-spacing: 0.08em;"
		>
			X-ray — the two arrows at AdamW's marker
		</div>
		<div
			class="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px]"
			style="color: var(--color-text-secondary);"
		>
			<span class="inline-flex items-center gap-1.5">
				<svg viewBox="0 0 26 10" class="h-2.5 w-6" aria-hidden="true">
					<line x1="1" y1="5" x2="18" y2="5" stroke="var(--color-note)" stroke-width="2" />
					<path d="M17 1l8 4-8 4z" fill="var(--color-note)" />
				</svg>
				raw downhill −∇f — the step SGD would take
			</span>
			<span class="inline-flex items-center gap-1.5">
				<svg viewBox="0 0 26 10" class="h-2.5 w-6" aria-hidden="true">
					<line x1="1" y1="5" x2="18" y2="5" stroke="var(--color-important)" stroke-width="2" />
					<path d="M17 1l8 4-8 4z" fill="var(--color-important)" />
				</svg>
				AdamW's actual step — momentum + per-axis scaling + the λθ pull
			</span>
		</div>
		<p class="mt-1 text-[11px]" style="color: var(--color-text-muted);">
			When the two arrows disagree, you are watching everything the optimizer adds on top of the raw
			slope. Crank λ and the pink arrow leans toward the 0 mark — decoupled weight decay, live.
		</p>
	</div>
</div>

<style>
	.stage:focus-visible {
		outline: 2px solid var(--color-important);
		outline-offset: 2px;
	}
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
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid;
		border-radius: 9999px;
		padding: 0.15rem 0.6rem;
		font-size: 11.5px;
	}
	.dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 9999px;
	}
	.ctl-value {
		min-width: 5ch;
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-text-secondary);
	}
</style>
