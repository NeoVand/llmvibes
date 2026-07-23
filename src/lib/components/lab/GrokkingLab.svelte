<script lang="ts">
	// Grokking, scrubbable. The data is a REAL recorded run (see
	// scripts/data/run-grokking.mjs): a tiny MLP learning a + b mod 97 with
	// half the addition table held out and strong weight decay. Drag the
	// cursor through training time: the model memorizes first (train 100%,
	// val at chance) and only later — suddenly — generalizes. That delayed
	// snap is grokking.
	import { onMount } from 'svelte';
	import { Loader2, Zap } from 'lucide-svelte';
	import { base } from '$app/paths';
	import Slider from '../ui/Slider.svelte';

	interface Point {
		step: number;
		trainLoss: number;
		valLoss: number;
		trainAcc: number;
		valAcc: number;
	}
	interface Run {
		meta: Record<string, unknown>;
		points: Point[];
	}

	let run = $state<Run | null>(null);
	let error = $state('');
	let cursorI = $state(0); // index into points
	let dragging = false;
	let svgEl: SVGSVGElement | undefined = $state();

	onMount(async () => {
		try {
			const res = await fetch(`${base}/data/grokking-run.json`);
			if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
			run = (await res.json()) as Run;
			cursorI = Math.floor(run.points.length * 0.25);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	// ── chart geometry (log-x accuracy chart) ─────────────────────────────────
	const W = 640;
	const H = 240;
	const PAD = { l: 42, r: 14, t: 10, b: 26 };
	const pts = $derived(run?.points ?? []);
	const lo = $derived(pts.length ? Math.log10(pts[0].step) : 0);
	const hi = $derived(pts.length ? Math.log10(pts[pts.length - 1].step) : 1);
	function x(step: number): number {
		return PAD.l + ((Math.log10(step) - lo) / Math.max(hi - lo, 1e-9)) * (W - PAD.l - PAD.r);
	}
	function y(acc: number): number {
		return PAD.t + (1 - acc) * (H - PAD.t - PAD.b);
	}
	function path(key: 'trainAcc' | 'valAcc'): string {
		return pts
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.step).toFixed(1)},${y(p[key]).toFixed(1)}`)
			.join(' ');
	}
	const decades = $derived.by(() => {
		const out: number[] = [];
		for (let d = Math.ceil(lo); d <= Math.floor(hi); d++) out.push(10 ** d);
		return out;
	});

	const cur = $derived(pts[Math.min(cursorI, pts.length - 1)]);
	const phase = $derived.by(() => {
		if (!cur) return null;
		if (cur.valAcc > 0.95) return { label: 'grokked', tone: 'var(--color-tip)' };
		if (cur.trainAcc > 0.95 && cur.valAcc < 0.3)
			return { label: 'memorized, not understood', tone: 'var(--color-challenge)' };
		if (cur.trainAcc > 0.95 && cur.valAcc >= 0.3)
			return { label: 'the grok is happening', tone: 'var(--color-important)' };
		return { label: 'still learning the training set', tone: 'var(--color-text-muted)' };
	});

	function stepToIndex(step: number): number {
		let best = 0;
		let bestD = Infinity;
		for (let i = 0; i < pts.length; i++) {
			const d = Math.abs(Math.log10(pts[i].step) - Math.log10(step));
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		}
		return best;
	}

	function pointerToCursor(e: PointerEvent) {
		if (!svgEl || pts.length === 0) return;
		const r = svgEl.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		const frac = Math.max(0, Math.min(1, (px - PAD.l) / (W - PAD.l - PAD.r)));
		cursorI = stepToIndex(10 ** (lo + frac * (hi - lo)));
	}
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-1 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<Zap size={16} strokeWidth={2.5} />
		<span>Grokking — a recorded run, scrubbable</span>
	</div>
	<p class="mb-3 text-xs" style="color: var(--color-text-muted);">
		A real training run of {String(run?.meta?.model ?? 'a tiny MLP')} on {String(
			run?.meta?.task ?? 'modular addition'
		)}, half the table held out, {String(run?.meta?.optimizer ?? 'AdamW + weight decay')}. Nothing
		smoothed, nothing staged.
	</p>

	{#if error}
		<p class="text-sm" style="color: var(--color-challenge);">couldn't load the run: {error}</p>
	{:else if !run}
		<div class="flex items-center gap-2 py-4 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> loading the recorded run…
		</div>
	{:else}
		<svg
			bind:this={svgEl}
			viewBox="0 0 {W} {H}"
			class="w-full cursor-crosshair"
			role="slider"
			aria-label="scrub through training time"
			aria-valuenow={cur?.step}
			tabindex="0"
			onpointerdown={(e) => {
				dragging = true;
				pointerToCursor(e);
			}}
			onpointermove={(e) => dragging && pointerToCursor(e)}
			onpointerup={() => (dragging = false)}
			onpointerleave={() => (dragging = false)}
			onkeydown={(e) => {
				if (e.key === 'ArrowRight') cursorI = Math.min(cursorI + 1, pts.length - 1);
				if (e.key === 'ArrowLeft') cursorI = Math.max(cursorI - 1, 0);
			}}
		>
			<!-- grid: accuracy lines -->
			{#each [0, 0.25, 0.5, 0.75, 1] as a (a)}
				<line
					x1={PAD.l}
					y1={y(a)}
					x2={W - PAD.r}
					y2={y(a)}
					stroke="var(--color-border-light)"
					stroke-width="1"
				/>
				<text
					x={PAD.l - 6}
					y={y(a) + 3}
					text-anchor="end"
					font-size="10"
					fill="var(--color-text-muted)">{(a * 100).toFixed(0)}%</text
				>
			{/each}
			{#each decades as d (d)}
				<line
					x1={x(d)}
					y1={PAD.t}
					x2={x(d)}
					y2={H - PAD.b}
					stroke="var(--color-border-light)"
					stroke-width="1"
					stroke-dasharray="2 4"
				/>
				<text x={x(d)} y={H - 8} text-anchor="middle" font-size="10" fill="var(--color-text-muted)"
					>{d >= 1000 ? `${d / 1000}k` : d} steps</text
				>
			{/each}
			<!-- chance line -->
			<line
				x1={PAD.l}
				y1={y(1 / 97)}
				x2={W - PAD.r}
				y2={y(1 / 97)}
				stroke="var(--color-text-muted)"
				stroke-width="1"
				stroke-dasharray="4 4"
				opacity="0.5"
			/>
			<!-- curves -->
			<path d={path('trainAcc')} fill="none" stroke="var(--color-important)" stroke-width="2" />
			<path d={path('valAcc')} fill="none" stroke="#a855f7" stroke-width="2" />
			<!-- cursor -->
			{#if cur}
				<line
					x1={x(cur.step)}
					y1={PAD.t}
					x2={x(cur.step)}
					y2={H - PAD.b}
					stroke="var(--color-text)"
					stroke-width="1.2"
					opacity="0.7"
				/>
				<circle cx={x(cur.step)} cy={y(cur.trainAcc)} r="4" fill="var(--color-important)" />
				<circle cx={x(cur.step)} cy={y(cur.valAcc)} r="4" fill="#a855f7" />
			{/if}
		</svg>

		<div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
			<div class="min-w-[220px] flex-1">
				<Slider
					label="training time (log)"
					value={cursorI}
					min={0}
					max={Math.max(pts.length - 1, 1)}
					step={1}
					tone="violet"
					format={() => `step ${cur?.step.toLocaleString() ?? 0}`}
					oninput={(v) => (cursorI = Math.round(v))}
				/>
			</div>
			{#if cur && phase}
				<div class="readout">
					<span class="mono" style="color: var(--color-important);"
						>train {(cur.trainAcc * 100).toFixed(1)}%</span
					>
					<span class="mono" style="color: #a855f7;">val {(cur.valAcc * 100).toFixed(1)}%</span>
					<span
						class="phase"
						style="color: {phase.tone}; border-color: color-mix(in srgb, {phase.tone} 40%, transparent);"
						>{phase.label}</span
					>
				</div>
			{/if}
		</div>

		<p class="mt-3 text-[11.5px] leading-relaxed" style="color: var(--color-text-muted);">
			Scrub through it. For thousands of steps the pink curve sits at 100% while the purple one
			crawls along chance (the dashed line at 1/97) — the network has memorized every training pair
			and understands nothing. Then, with no change to anything, validation snaps upward: weight
			decay has slowly ground away the memorization circuit until the cheaper general solution — the
			actual structure of modular addition — is all that's left. Generalization as a phase
			transition, not a gradual dawn.
		</p>
	{/if}
</div>

<style>
	.readout {
		display: inline-flex;
		align-items: center;
		gap: 0.8rem;
		font-size: 12px;
	}
	.mono {
		font-family: var(--font-mono);
		font-weight: 600;
	}
	.phase {
		border: 1px solid;
		border-radius: 999px;
		padding: 0.1rem 0.6rem;
		font-size: 11px;
		font-weight: 600;
	}
</style>
