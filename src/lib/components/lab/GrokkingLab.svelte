<script lang="ts">
	// Grokking, as one clean plot. The data is a REAL recorded run (see
	// scripts/data/run-grokking.mjs): a tiny MLP learning a + b mod 97 with most
	// of the addition table held out and weight decay. The story is the shape —
	// train accuracy snaps to 100% almost immediately, validation crawls at
	// chance for an order of magnitude longer, then suddenly groks. No slider:
	// the phases are annotated on the curve; hover to read exact values.
	import { onMount } from 'svelte';
	import { Loader2, Zap } from 'lucide-svelte';
	import { base } from '$app/paths';

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
	let hoverI = $state<number | null>(null);
	let svgEl: SVGSVGElement | undefined = $state();

	onMount(async () => {
		try {
			const res = await fetch(`${base}/data/grokking-run.json`);
			if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
			run = (await res.json()) as Run;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	// ── geometry (log-x accuracy plot) ─────────────────────────────────────────
	const W = 720;
	const H = 300;
	const PAD = { l: 46, r: 18, t: 30, b: 34 };
	const pts = $derived(run?.points ?? []);
	const lo = $derived(pts.length ? Math.log10(pts[0].step) : 0);
	const hi = $derived(pts.length ? Math.log10(pts[pts.length - 1].step) : 1);
	function x(step: number): number {
		return PAD.l + ((Math.log10(step) - lo) / Math.max(hi - lo, 1e-9)) * (W - PAD.l - PAD.r);
	}
	function y(acc: number): number {
		return PAD.t + (1 - acc) * (H - PAD.t - PAD.b);
	}
	function line(key: 'trainAcc' | 'valAcc'): string {
		return pts
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.step).toFixed(1)},${y(p[key]).toFixed(1)}`)
			.join(' ');
	}
	function area(key: 'trainAcc' | 'valAcc'): string {
		if (!pts.length) return '';
		const top = pts
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.step).toFixed(1)},${y(p[key]).toFixed(1)}`)
			.join(' ');
		return `${top} L${x(pts[pts.length - 1].step).toFixed(1)},${y(0).toFixed(1)} L${x(pts[0].step).toFixed(1)},${y(0).toFixed(1)} Z`;
	}
	const decades = $derived.by(() => {
		const out: number[] = [];
		for (let d = Math.ceil(lo); d <= Math.floor(hi); d++) out.push(10 ** d);
		return out;
	});

	const chance = $derived.by(() => {
		// 1/97 by default; read the modulus out of the task string if present
		const task = String(run?.meta?.task ?? '');
		const m = task.match(/mod\s+(\d+)/);
		return m ? 1 / Number(m[1]) : 1 / 97;
	});

	// key events
	const memI = $derived(pts.findIndex((p) => p.trainAcc > 0.95));
	const grokI = $derived(pts.findIndex((p) => p.valAcc > 0.95));
	const memStep = $derived(memI >= 0 ? pts[memI].step : null);
	const grokStep = $derived(grokI >= 0 ? pts[grokI].step : null);
	const delay = $derived(memStep && grokStep ? Math.round(grokStep / memStep) : null);

	function fmtStep(s: number): string {
		return s >= 1000 ? `${(s / 1000).toFixed(s % 1000 === 0 ? 0 : 1)}k` : String(s);
	}

	function pointerMove(e: PointerEvent) {
		if (!svgEl || pts.length === 0) return;
		const r = svgEl.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		const frac = Math.max(0, Math.min(1, (px - PAD.l) / (W - PAD.l - PAD.r)));
		const target = 10 ** (lo + frac * (hi - lo));
		let best = 0;
		let bestD = Infinity;
		for (let i = 0; i < pts.length; i++) {
			const d = Math.abs(Math.log10(pts[i].step) - Math.log10(target));
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		}
		hoverI = best;
	}
	const cur = $derived(hoverI !== null ? pts[hoverI] : null);
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
		<span>Grokking — one recorded run</span>
	</div>
	<p class="mb-2 text-xs" style="color: var(--color-text-muted);">
		{String(run?.meta?.model ?? 'a tiny MLP')} learning {String(
			run?.meta?.task ?? 'modular addition'
		)},
		{run?.meta?.trainFrac ? `${Math.round(Number(run.meta.trainFrac) * 100)}%` : 'part'} of the table
		shown and the rest held out, {String(run?.meta?.optimizer ?? 'AdamW + weight decay')}. Nothing
		smoothed.
	</p>

	{#if error}
		<p class="text-sm" style="color: var(--color-challenge);">couldn't load the run: {error}</p>
	{:else if !run}
		<div class="flex items-center gap-2 py-6 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> loading the recorded run…
		</div>
	{:else}
		<svg
			bind:this={svgEl}
			viewBox="0 0 {W} {H}"
			class="w-full"
			style="touch-action: none;"
			role="img"
			aria-label="Accuracy versus training step, log scale. Train accuracy reaches 100% at step {memStep}; validation accuracy stays near chance until it snaps to 100% at step {grokStep}."
			onpointermove={pointerMove}
			onpointerleave={() => (hoverI = null)}
		>
			<defs>
				<linearGradient id="grok-val-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="var(--color-important)" stop-opacity="0.18" />
					<stop offset="100%" stop-color="var(--color-important)" stop-opacity="0" />
				</linearGradient>
			</defs>

			<!-- horizontal gridlines -->
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
					x={PAD.l - 8}
					y={y(a) + 3.5}
					text-anchor="end"
					font-size="11"
					fill="var(--color-text-muted)"
					font-family="var(--font-mono)">{(a * 100).toFixed(0)}</text
				>
			{/each}
			<text
				x={14}
				y={PAD.t + (H - PAD.t - PAD.b) / 2}
				font-size="11"
				fill="var(--color-text-muted)"
				text-anchor="middle"
				transform="rotate(-90 14 {PAD.t + (H - PAD.t - PAD.b) / 2})">accuracy %</text
			>

			<!-- decade ticks -->
			{#each decades as d (d)}
				<line
					x1={x(d)}
					y1={PAD.t}
					x2={x(d)}
					y2={H - PAD.b}
					stroke="var(--color-border-light)"
					stroke-width="1"
					stroke-dasharray="2 5"
					opacity="0.7"
				/>
				<text
					x={x(d)}
					y={H - 12}
					text-anchor="middle"
					font-size="11"
					fill="var(--color-text-muted)"
					font-family="var(--font-mono)">{fmtStep(d)}</text
				>
			{/each}
			<text
				x={(PAD.l + W - PAD.r) / 2}
				y={H - 1}
				text-anchor="middle"
				font-size="10.5"
				fill="var(--color-text-muted)">training step (log scale)</text
			>

			<!-- the plateau: memorized but not generalized -->
			{#if memStep && grokStep}
				<rect
					x={x(memStep)}
					y={PAD.t}
					width={x(grokStep) - x(memStep)}
					height={H - PAD.t - PAD.b}
					fill="var(--color-challenge)"
					opacity="0.06"
				/>
				<line
					x1={x(memStep)}
					y1={PAD.t}
					x2={x(memStep)}
					y2={H - PAD.b}
					stroke="var(--color-challenge)"
					stroke-width="1.2"
					stroke-dasharray="3 3"
					opacity="0.55"
				/>
				<line
					x1={x(grokStep)}
					y1={PAD.t}
					x2={x(grokStep)}
					y2={H - PAD.b}
					stroke="var(--color-tip)"
					stroke-width="1.2"
					stroke-dasharray="3 3"
					opacity="0.7"
				/>
				<text
					x={(x(memStep) + x(grokStep)) / 2}
					y={PAD.t - 16}
					text-anchor="middle"
					font-size="11"
					fill="var(--color-challenge)"
					font-weight="600">memorized, not understood</text
				>
				<text
					x={(x(memStep) + x(grokStep)) / 2}
					y={PAD.t - 4}
					text-anchor="middle"
					font-size="10"
					fill="var(--color-text-muted)">…for {delay}× as long as it took to memorize</text
				>
			{/if}

			<!-- chance line -->
			<line
				x1={PAD.l}
				y1={y(chance)}
				x2={W - PAD.r}
				y2={y(chance)}
				stroke="var(--color-text-muted)"
				stroke-width="1"
				stroke-dasharray="5 4"
				opacity="0.55"
			/>
			<text
				x={W - PAD.r - 4}
				y={y(chance) - 5}
				text-anchor="end"
				font-size="10"
				fill="var(--color-text-muted)">chance</text
			>

			<!-- curves -->
			<path d={area('valAcc')} fill="url(#grok-val-fill)" />
			<path
				d={line('trainAcc')}
				fill="none"
				stroke="#94a3b8"
				stroke-width="2"
				stroke-linejoin="round"
			/>
			<path
				d={line('valAcc')}
				fill="none"
				stroke="var(--color-important)"
				stroke-width="2.6"
				stroke-linejoin="round"
			/>

			<!-- inline curve labels -->
			<text
				x={x(pts[pts.length - 1].step) - 4}
				y={y(1) - 8}
				text-anchor="end"
				font-size="11"
				fill="#94a3b8"
				font-weight="600">train</text
			>
			<text
				x={x(10 ** (lo + 0.35))}
				y={y(chance) - 9}
				font-size="11"
				fill="var(--color-important)"
				font-weight="600">validation</text
			>

			<!-- hover inspector -->
			{#if cur}
				<line
					x1={x(cur.step)}
					y1={PAD.t}
					x2={x(cur.step)}
					y2={H - PAD.b}
					stroke="var(--color-text)"
					stroke-width="1"
					opacity="0.5"
				/>
				<circle cx={x(cur.step)} cy={y(cur.trainAcc)} r="3.5" fill="#94a3b8" />
				<circle cx={x(cur.step)} cy={y(cur.valAcc)} r="4" fill="var(--color-important)" />
				{@const tx = Math.min(x(cur.step) + 10, W - 150)}
				<g transform="translate({tx}, {PAD.t + 6})">
					<rect
						width="140"
						height="52"
						rx="7"
						fill="var(--color-surface)"
						stroke="var(--color-border)"
						opacity="0.98"
					/>
					<text
						x="10"
						y="18"
						font-size="10.5"
						fill="var(--color-text-muted)"
						font-family="var(--font-mono)">step {cur.step.toLocaleString()}</text
					>
					<text x="10" y="33" font-size="11" fill="#94a3b8" font-family="var(--font-mono)"
						>train {(cur.trainAcc * 100).toFixed(1)}%</text
					>
					<text
						x="10"
						y="47"
						font-size="11"
						fill="var(--color-important)"
						font-family="var(--font-mono)">val&nbsp;&nbsp;{(cur.valAcc * 100).toFixed(1)}%</text
					>
				</g>
			{/if}
		</svg>

		{#if memStep && grokStep}
			<p class="mt-2 text-center text-xs" style="color: var(--color-text-secondary);">
				Train hits 100% at <strong style="color: #94a3b8;">step {fmtStep(memStep)}</strong>.
				Validation doesn't generalize until
				<strong style="color: var(--color-important);">step {fmtStep(grokStep)}</strong> — a
				<strong style="color: var(--color-text);">{delay}× delay</strong>.
			</p>
		{/if}

		<p class="mt-3 text-[11.5px] leading-relaxed" style="color: var(--color-text-muted);">
			For thousands of steps the slate line sits at 100% while the accent one crawls along chance —
			the network has memorized every training pair and understands nothing. Then, with no change to
			anything, validation snaps upward: weight decay has slowly ground away the memorization
			circuit until the cheaper general solution — the actual structure of modular addition — is all
			that's left. Generalization as a phase transition, not a gradual dawn.
		</p>
	{/if}
</div>
