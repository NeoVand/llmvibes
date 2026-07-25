<script lang="ts">
	// In-context copying, and how it grows with scale — measured, one clean plot.
	// Induction heads implement copying: "find the last time the current token
	// appeared, predict what followed it." We probe it the unambiguous way (Olsson
	// et al.): feed a string of DISTINCT random tokens, then the same string again;
	// the only way to predict the second copy is to look back and copy. The COPYING
	// SCORE is how much lower the next-token loss is on the second copy than the
	// first. It emerges as a bump during pretraining — and our ~5M flagship Quill
	// develops it far more strongly than the ~0.93M live pair. Real data, recorded
	// by spikes/timemachine/measure_induction.py. Nothing smoothed away: the raw
	// per-checkpoint points are drawn as dots under the trend line.
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { Copy, Loader2 } from 'lucide-svelte';

	interface Point {
		step: number;
		lossDelta: number;
	}
	interface Run {
		config: { model: string };
		steps: number;
		points: Array<Point & { valLoss: number }>;
		baseline: { model: string; points: Point[] };
	}

	let run = $state<Run | null>(null);
	let error = $state('');
	let hoverStep = $state<number | null>(null);

	onMount(async () => {
		try {
			const res = await fetch(`${base}/data/induction-run.json`);
			if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
			run = (await res.json()) as Run;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	const flag = $derived((run?.points ?? []).filter((p) => p.step > 0));
	const live = $derived((run?.baseline?.points ?? []).filter((p) => p.step > 0));
	const allSteps = $derived([...flag, ...live].map((p) => p.step));

	function fmtStep(s: number): string {
		return s >= 1000 ? `${(s / 1000).toFixed(s % 1000 === 0 ? 0 : 1)}k` : String(s);
	}

	// centred moving-average trend (window 5) for a clean line over noisy points
	function smoothed(pts: Point[]): Array<{ step: number; v: number; raw: number }> {
		return pts.map((p, i) => {
			let s = 0,
				c = 0;
			for (let k = Math.max(0, i - 2); k <= Math.min(pts.length - 1, i + 2); k++) {
				s += pts[k].lossDelta;
				c++;
			}
			return { step: p.step, v: s / c, raw: p.lossDelta };
		});
	}
	const flagS = $derived(smoothed(flag));
	const liveS = $derived(smoothed(live));

	// ── geometry (log-x) ────────────────────────────────────────────────────────
	const W = 720;
	const H = 300;
	const PAD = { l: 46, r: 18, t: 28, b: 36 };
	const lo = $derived(allSteps.length ? Math.log10(Math.max(1, Math.min(...allSteps))) : 0);
	const hi = $derived(allSteps.length ? Math.log10(Math.max(...allSteps, 10)) : 1);
	const yMax = $derived(Math.max(0.2, ...[...flag, ...live].map((p) => p.lossDelta)) * 1.12);
	const yMin = $derived(Math.min(0, ...[...flag, ...live].map((p) => p.lossDelta)));
	function x(step: number): number {
		return (
			PAD.l + ((Math.log10(Math.max(1, step)) - lo) / Math.max(hi - lo, 1e-9)) * (W - PAD.l - PAD.r)
		);
	}
	function y(v: number): number {
		return PAD.t + (1 - (v - yMin) / Math.max(yMax - yMin, 1e-9)) * (H - PAD.t - PAD.b);
	}
	function path(s: Array<{ step: number; v: number }>): string {
		return s
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.step).toFixed(1)},${y(p.v).toFixed(1)}`)
			.join(' ');
	}
	const decades = $derived.by(() => {
		const out: number[] = [];
		for (let d = Math.ceil(lo); d <= Math.floor(hi); d++) out.push(10 ** d);
		return out;
	});
	const flagPeak = $derived(
		flag.length ? flag.reduce((a, b) => (b.lossDelta > a.lossDelta ? b : a)) : null
	);
	const livePeak = $derived(
		live.length ? live.reduce((a, b) => (b.lossDelta > a.lossDelta ? b : a)) : null
	);

	function pointerMove(e: PointerEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const r = svg.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		const frac = Math.max(0, Math.min(1, (px - PAD.l) / (W - PAD.l - PAD.r)));
		const target = 10 ** (lo + frac * (hi - lo));
		let best: number | null = null;
		let bd = Infinity;
		for (const s of new Set(flag.map((p) => p.step))) {
			const d = Math.abs(Math.log10(s) - Math.log10(target));
			if (d < bd) {
				bd = d;
				best = s;
			}
		}
		hoverStep = best;
	}
	const hoverFlag = $derived(hoverStep != null ? flag.find((p) => p.step === hoverStep) : null);
	const hoverLive = $derived(hoverStep != null ? live.find((p) => p.step === hoverStep) : null);
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-1 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<Copy size={16} strokeWidth={2.5} />
		<span>In-context copying — and how it grows with scale</span>
	</div>
	<p class="mb-3 text-xs" style="color: var(--color-text-muted);">
		Feed the model a string of distinct random tokens, then the <em>same</em> string again. The only
		way to predict the second copy is to look back and copy. The
		<strong style="color: var(--color-important);">copying score</strong> is how much lower the loss is
		on the second copy than the first — it climbs as in-context copying switches on.
	</p>

	{#if error}
		<p class="text-sm" style="color: var(--color-challenge);">couldn't load the run: {error}</p>
	{:else if !run}
		<div class="flex items-center gap-2 py-8 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> loading the recorded run…
		</div>
	{:else}
		<svg
			viewBox="0 0 {W} {H}"
			class="w-full"
			style="touch-action: none;"
			role="img"
			aria-label="Copying score versus training step for the flagship and live-pair Quill"
			onpointermove={pointerMove}
			onpointerleave={() => (hoverStep = null)}
		>
			<!-- y gridlines -->
			{#each [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6] as g (g)}
				{#if g <= yMax}
					<line x1={PAD.l} y1={y(g)} x2={W - PAD.r} y2={y(g)} stroke="var(--color-border-light)" />
					<text
						x={PAD.l - 6}
						y={y(g) + 3.5}
						text-anchor="end"
						font-size="10.5"
						fill="var(--color-text-muted)"
						font-family="var(--font-mono)">{g.toFixed(1)}</text
					>
				{/if}
			{/each}
			<text
				x={13}
				y={PAD.t + (H - PAD.t - PAD.b) / 2}
				font-size="11"
				fill="var(--color-text-muted)"
				text-anchor="middle"
				transform="rotate(-90 13 {PAD.t + (H - PAD.t - PAD.b) / 2})">copying score (nats)</text
			>

			<!-- decade ticks -->
			{#each decades as d (d)}
				<line
					x1={x(d)}
					y1={PAD.t}
					x2={x(d)}
					y2={H - PAD.b}
					stroke="var(--color-border-light)"
					stroke-dasharray="2 5"
					opacity="0.7"
				/>
				<text
					x={x(d)}
					y={H - 13}
					text-anchor="middle"
					font-size="10.5"
					fill="var(--color-text-muted)"
					font-family="var(--font-mono)">{fmtStep(d)}</text
				>
			{/each}
			<text
				x={(PAD.l + W - PAD.r) / 2}
				y={H - 1}
				text-anchor="middle"
				font-size="10"
				fill="var(--color-text-muted)">training step (log scale)</text
			>

			<!-- zero line -->
			<line
				x1={PAD.l}
				y1={y(0)}
				x2={W - PAD.r}
				y2={y(0)}
				stroke="var(--color-text-muted)"
				stroke-width="1"
				opacity="0.4"
			/>

			<!-- raw dots -->
			{#each live as p (p.step)}
				<circle cx={x(p.step)} cy={y(p.lossDelta)} r="1.5" fill="#94a3b8" opacity="0.4" />
			{/each}
			{#each flag as p (p.step)}
				<circle
					cx={x(p.step)}
					cy={y(p.lossDelta)}
					r="1.6"
					fill="var(--color-important)"
					opacity="0.3"
				/>
			{/each}

			<!-- trend lines -->
			<path
				d={path(liveS)}
				fill="none"
				stroke="#94a3b8"
				stroke-width="2.2"
				stroke-linejoin="round"
			/>
			<path
				d={path(flagS)}
				fill="none"
				stroke="var(--color-important)"
				stroke-width="2.8"
				stroke-linejoin="round"
			/>

			<!-- peak markers -->
			{#if flagPeak}
				<circle
					cx={x(flagPeak.step)}
					cy={y(flagPeak.lossDelta)}
					r="3.5"
					fill="var(--color-important)"
				/>
				<text
					x={x(flagPeak.step)}
					y={y(flagPeak.lossDelta) - 8}
					text-anchor="middle"
					font-size="11"
					fill="var(--color-important)"
					font-weight="700">flagship (~5M) · peak {flagPeak.lossDelta.toFixed(2)}</text
				>
			{/if}
			{#if livePeak}
				<text
					x={x(livePeak.step)}
					y={y(livePeak.lossDelta) - 8}
					text-anchor="middle"
					font-size="10.5"
					fill="#94a3b8"
					font-weight="600">live pair (~0.9M) · {livePeak.lossDelta.toFixed(2)}</text
				>
			{/if}

			<!-- hover -->
			{#if hoverStep != null && hoverFlag}
				<line
					x1={x(hoverStep)}
					y1={PAD.t}
					x2={x(hoverStep)}
					y2={H - PAD.b}
					stroke="var(--color-text)"
					stroke-width="1"
					opacity="0.4"
				/>
				<circle cx={x(hoverStep)} cy={y(hoverFlag.lossDelta)} r="3" fill="var(--color-important)" />
				{#if hoverLive}<circle
						cx={x(hoverStep)}
						cy={y(hoverLive.lossDelta)}
						r="3"
						fill="#94a3b8"
					/>{/if}
				{@const tx = Math.min(x(hoverStep) + 10, W - 168)}
				<g transform="translate({tx}, {PAD.t + 4})">
					<rect
						width="158"
						height="52"
						rx="7"
						fill="var(--color-surface)"
						stroke="var(--color-border)"
						opacity="0.98"
					/>
					<text
						x="10"
						y="17"
						font-size="10.5"
						fill="var(--color-text-muted)"
						font-family="var(--font-mono)">step {hoverStep.toLocaleString()}</text
					>
					<text
						x="10"
						y="32"
						font-size="11"
						fill="var(--color-important)"
						font-family="var(--font-mono)">flagship {hoverFlag.lossDelta.toFixed(3)}</text
					>
					<text x="10" y="46" font-size="11" fill="#94a3b8" font-family="var(--font-mono)"
						>live pair {hoverLive ? hoverLive.lossDelta.toFixed(3) : '—'}</text
					>
				</g>
			{/if}
		</svg>

		<p class="mt-3 text-[11.5px] leading-relaxed" style="color: var(--color-text-muted);">
			Both models learn some copying — it emerges as a <strong style="color: var(--color-text);"
				>bump</strong
			>, surging mid-training then settling as the model specializes to real stories on these
			artificial probes. The headline is the gap: the flagship's copying peaks around
			<strong style="color: var(--color-important);"
				>{flagPeak ? flagPeak.lossDelta.toFixed(2) : ''}</strong
			>
			nats, more than double the live pair's
			<strong style="color: #94a3b8;">{livePeak ? livePeak.lossDelta.toFixed(2) : ''}</strong>. This
			is the behavioural shadow of
			<strong style="color: var(--color-text);">induction heads</strong>; the clean, sharp induction
			circuit interpretability work identifies wants more scale than even our flagship, but the
			ability is already visibly stronger with size — a first taste of why scale buys capabilities,
			not just lower loss.
		</p>
	{/if}
</div>
