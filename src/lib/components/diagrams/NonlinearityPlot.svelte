<script lang="ts">
	// Three activation functions on one clean plot — the choice hiding inside the
	// MLP. ReLU is the cheap kinked default (dead below zero); GELU and SiLU are
	// smooth and let a little negative signal through, which is why SwiGLU (the
	// flagship recipe) gates with a smooth curve. Everything is closed-form and
	// sampled deterministically, so it renders identically on the server.
	import { Spline } from 'lucide-svelte';

	// ── activations ────────────────────────────────────────────────────────────
	const relu = (x: number) => Math.max(0, x);
	const gelu = (x: number) =>
		0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
	const silu = (x: number) => x / (1 + Math.exp(-x));

	// ── geometry ─────────────────────────────────────────────────────────────
	const W = 620;
	const H = 300;
	const PAD = { l: 46, r: 62, t: 18, b: 36 };
	const XMIN = -4;
	const XMAX = 4;
	const YMIN = -1.5;
	const YMAX = 4;
	const plotW = W - PAD.l - PAD.r;
	const plotH = H - PAD.t - PAD.b;
	const SAMPLES = 120;

	const x = (v: number) => PAD.l + ((v - XMIN) / (XMAX - XMIN)) * plotW;
	const y = (v: number) => PAD.t + ((YMAX - v) / (YMAX - YMIN)) * plotH;

	function path(f: (x: number) => number): string {
		let d = '';
		for (let i = 0; i <= SAMPLES; i++) {
			const xv = XMIN + ((XMAX - XMIN) * i) / SAMPLES;
			d += `${i === 0 ? 'M' : 'L'}${x(xv).toFixed(2)},${y(f(xv)).toFixed(2)} `;
		}
		return d.trim();
	}

	const curves = [
		{ key: 'relu', name: 'ReLU', formula: 'max(0, x)', color: '#94a3b8', width: 2 },
		{ key: 'gelu', name: 'GELU', formula: 'x · Φ(x)', color: '#2563eb', width: 2.2 },
		{
			key: 'silu',
			name: 'SiLU',
			formula: 'x · σ(x)',
			color: 'var(--color-important)',
			width: 2.4
		}
	] as const;

	const fns: Record<string, (x: number) => number> = { relu, gelu, silu };

	const xTicks = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
	const yTicks = [-1, 0, 1, 2, 3, 4];

	// ── right-end inline labels, declumped so the near-identical tails read ──────
	const endLabels = $derived.by(() => {
		const rows = curves
			.map((c) => ({ name: c.name, color: c.color, trueY: y(fns[c.key](XMAX)), labelY: 0 }))
			.sort((a, b) => a.trueY - b.trueY);
		let prev = -Infinity;
		for (const r of rows) {
			r.labelY = Math.max(r.trueY, prev + 15, PAD.t + 6);
			prev = r.labelY;
		}
		return rows;
	});
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<Spline size={16} strokeWidth={2.5} />
		<span>Three gates, side by side</span>
	</div>

	<svg
		viewBox="0 0 {W} {H}"
		class="w-full"
		role="img"
		aria-label="Plot of three activation functions from x equals minus four to four. ReLU is a kinked line, flat at zero for negative x. GELU and SiLU are smooth curves that dip slightly below zero near x equals minus one before rising, and all three coincide for large positive x."
	>
		<!-- gridlines -->
		{#each xTicks as t (t)}
			<line
				x1={x(t)}
				y1={PAD.t}
				x2={x(t)}
				y2={H - PAD.b}
				stroke="var(--color-border-light)"
				stroke-width="1"
			/>
		{/each}
		{#each yTicks as t (t)}
			<line
				x1={PAD.l}
				y1={y(t)}
				x2={W - PAD.r}
				y2={y(t)}
				stroke="var(--color-border-light)"
				stroke-width="1"
			/>
		{/each}

		<!-- emphasized zero axes -->
		<line
			x1={PAD.l}
			y1={y(0)}
			x2={W - PAD.r}
			y2={y(0)}
			stroke="var(--color-border)"
			stroke-width="1.6"
		/>
		<line
			x1={x(0)}
			y1={PAD.t}
			x2={x(0)}
			y2={H - PAD.b}
			stroke="var(--color-border)"
			stroke-width="1.6"
		/>

		<!-- tick labels -->
		{#each xTicks as t (t)}
			{#if t !== 0}
				<text
					x={x(t)}
					y={H - PAD.b + 15}
					text-anchor="middle"
					font-size="10"
					fill="var(--color-text-muted)"
					font-family="var(--font-mono)">{t}</text
				>
			{/if}
		{/each}
		{#each yTicks as t (t)}
			{#if t !== 0}
				<text
					x={PAD.l - 8}
					y={y(t) + 3.5}
					text-anchor="end"
					font-size="10"
					fill="var(--color-text-muted)"
					font-family="var(--font-mono)">{t}</text
				>
			{/if}
		{/each}
		<text
			x={x(0) - 6}
			y={y(0) + 14}
			text-anchor="end"
			font-size="10"
			fill="var(--color-text-muted)"
			font-family="var(--font-mono)">0</text
		>
		<text x={W - PAD.r + 4} y={y(0) - 5} font-size="10" fill="var(--color-text-muted)">x</text>

		<!-- subtle legend, tucked into the empty upper-left -->
		{#each curves as c, i (c.key)}
			{@const ly = PAD.t + 14 + i * 17}
			<line x1={PAD.l + 12} y1={ly} x2={PAD.l + 34} y2={ly} stroke={c.color} stroke-width="2.6" />
			<text x={PAD.l + 40} y={ly + 3.5} font-size="11" fill="var(--color-text)" font-weight="600"
				>{c.name}</text
			>
			<text
				x={PAD.l + 78}
				y={ly + 3.5}
				font-size="10.5"
				fill="var(--color-text-muted)"
				font-family="var(--font-mono)">{c.formula}</text
			>
		{/each}

		<!-- curves -->
		{#each curves as c (c.key)}
			<path
				d={path(fns[c.key])}
				fill="none"
				stroke={c.color}
				stroke-width={c.width}
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		{/each}

		<!-- ReLU's kink at the origin -->
		<circle cx={x(0)} cy={y(0)} r="3" fill="#94a3b8" />

		<!-- right-end inline labels with short leaders -->
		{#each endLabels as l (l.name)}
			<line
				x1={W - PAD.r}
				y1={l.trueY}
				x2={W - PAD.r + 6}
				y2={l.labelY}
				stroke={l.color}
				stroke-width="1"
				opacity="0.6"
			/>
			<text
				x={W - PAD.r + 9}
				y={l.labelY + 3.5}
				font-size="11"
				fill={l.color}
				font-weight="700"
				font-family="var(--font-mono)">{l.name}</text
			>
		{/each}
	</svg>

	<p class="mt-3 text-[11.5px] leading-relaxed" style="color: var(--color-text-muted);">
		ReLU is cheap and kinked (dead below zero); GELU and SiLU are smooth and let a little negative
		signal through, which is why the flagship recipe (SwiGLU) gates with a smooth curve. The pocket
		models use plain ReLU; SwiGLU is the flagship recipe.
	</p>
</div>
