<script lang="ts" module>
	let uid = 0;
</script>

<script lang="ts">
	// LoRA made physical. The frozen weight matrix W is a big d×d slab; the
	// adapter is a thin bypass — down-project through A (d→r), back up through
	// B (r→d), scale by α/r, add back in. Block widths are proportional to the
	// real dims, so r stays visibly tiny against d. Slide r and watch the
	// parameter bill: full fine-tune pays d², LoRA pays 2·d·r. The second view
	// shows why merging W' = W + (α/r)BA makes the whole trick free at
	// inference time.
	import { Layers } from 'lucide-svelte';
	import Slider from '../ui/Slider.svelte';
	import Formula from '../ui/Math.svelte';

	uid += 1;
	const gid = `lora-${uid}`;

	// channel colors: W cool slate, A amber, B bronze
	const C_W = '#64748b';
	const C_A = '#ecc068';
	const C_A_DARK = '#a06b1c';
	const C_B = '#c08a38';
	const C_B_DARK = '#8a5f22';

	let rexp = $state(3); // r = 2^rexp, 1..64
	let d = $state(128); // pocket 128 / flagship-ish 768
	let view = $state<'bypass' | 'merged'>('bypass');

	const r = $derived(2 ** rexp);
	const fullParams = $derived(d * d);
	const loraParams = $derived(2 * d * r);
	const pct = $derived((loraParams / fullParams) * 100);
	const pctLabel = $derived(pct >= 99.95 ? '100' : pct >= 1 ? pct.toFixed(1) : pct.toFixed(2));

	// ── geometry: every matrix is a pixel field. d ↦ a fixed GRID×GRID downsample
	// so 768² never emits 590k rects; r shows directly as A's columns / B's rows. ──
	const DPX = 140; // the d×d block edge, in SVG units
	const GRID = 24; // d ↦ 24 cells per side (576 cells, capped ≤ 600)
	const P = DPX / GRID; // shared cell pitch — A/B cells match W's size exactly
	const rpxTrue = $derived((DPX * r) / d); // the true-to-scale adapter width
	const rClamped = $derived(rpxTrue < P); // true width is thinner than one cell
	// A/B expose the rank as pixels: r columns (A) / r rows (B), capped at 12.
	const rbCells = $derived(Math.max(1, Math.min(r, 12)));
	const aW = $derived(rbCells * P); // A: tall-thin, width grows with r
	const aX = $derived(365 - aW / 2); // centred on the bypass lane
	const bH = $derived(rbCells * P); // B: thin-wide, height grows with r
	const bY = $derived(290 - bH / 2);

	function fmtInt(n: number): string {
		return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	}

	// ── deterministic pixel textures — no Math.random at render ──
	// integer hash (xxHash-flavoured) → [0,1); pure, so cells are stable per (row,col).
	function hash01(a: number, b: number, salt: number): number {
		let h =
			(Math.imul(a + 1, 374761393) ^
				Math.imul(b + 1, 668265263) ^
				Math.imul(salt + 1, 2246822519)) >>>
			0;
		h = Math.imul(h ^ (h >>> 13), 1274126177);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	}
	function hx(n: number): string {
		return Math.max(0, Math.min(255, Math.round(n)))
			.toString(16)
			.padStart(2, '0');
	}
	function lerpHex(a: string, b: string, t: number): string {
		const k = Math.max(0, Math.min(1, t));
		const ar = parseInt(a.slice(1, 3), 16),
			ag = parseInt(a.slice(3, 5), 16),
			ab = parseInt(a.slice(5, 7), 16);
		const br = parseInt(b.slice(1, 3), 16),
			bg = parseInt(b.slice(3, 5), 16),
			bb = parseInt(b.slice(5, 7), 16);
		return '#' + hx(ar + (br - ar) * k) + hx(ag + (bg - ag) * k) + hx(ab + (bb - ab) * k);
	}

	// W — frozen pretrained weights: a busy field of cool-slate noise, value → lightness.
	const W_LO = '#334155';
	const W_HI = '#c3cdda';
	const wFill = (i: number, j: number) => lerpHex(W_LO, W_HI, 0.16 + 0.72 * hash01(i, j, 11));
	// A / B — the trained adapter, amber (down d→r) and bronze (up r→d).
	const aFill = (i: number, j: number) =>
		lerpHex('#9a6a1f', '#f6dc94', 0.2 + 0.7 * hash01(i, j, 23));
	const bFill = (i: number, j: number) =>
		lerpHex('#7d551e', '#e0ab55', 0.2 + 0.7 * hash01(i, j, 37));

	// ΔW = (α/r)·B·A — built as an ACTUAL rank-r product so it visibly reads low-rank.
	// Sum r deterministic outer products u_k ⊗ v_k over the visible grid; at r=1 the
	// whole block is one clean outer-product pattern, and it enriches (never noisifies)
	// as r climbs. Normalised by peak magnitude so the diverging ramp always fills.
	function lowRankGrid(rank: number): number[] {
		const K = Math.max(1, Math.min(rank, GRID)); // can't out-rank the grid
		const us: number[][] = [];
		const vs: number[][] = [];
		for (let k = 0; k < K; k++) {
			const fu = 1 + Math.floor(hash01(k, 0, 5) * 3); // gentle spatial frequency 1..3
			const pu = hash01(k, 1, 5) * Math.PI * 2;
			const su = hash01(k, 2, 5) < 0.5 ? -1 : 1;
			const fv = 1 + Math.floor(hash01(k, 0, 9) * 3);
			const pv = hash01(k, 1, 9) * Math.PI * 2;
			us.push(
				Array.from({ length: GRID }, (_, i) => su * Math.sin((i / (GRID - 1)) * Math.PI * fu + pu))
			);
			vs.push(
				Array.from({ length: GRID }, (_, j) => Math.sin((j / (GRID - 1)) * Math.PI * fv + pv))
			);
		}
		const g = new Array(GRID * GRID).fill(0);
		let maxAbs = 1e-6;
		for (let i = 0; i < GRID; i++) {
			for (let j = 0; j < GRID; j++) {
				let s = 0;
				for (let k = 0; k < K; k++) s += us[k][i] * vs[k][j];
				g[i * GRID + j] = s;
				if (Math.abs(s) > maxAbs) maxAbs = Math.abs(s);
			}
		}
		for (let n = 0; n < g.length; n++) g[n] = 0.5 + 0.5 * (g[n] / maxAbs); // → [0,1], 0.5 = zero
		return g;
	}
	const dwGrid = $derived(lowRankGrid(r));
	// diverging ramp: blue (−) → neutral slate → amber (+), so the structure pops.
	const dwFill = (i: number, j: number) => {
		const t = dwGrid[i * GRID + j];
		return t < 0.5
			? lerpHex('#3b6fe0', '#8b93a1', t * 2)
			: lerpHex('#8b93a1', '#e8b84b', (t - 0.5) * 2);
	};
	// W′ = W + ΔW — the frozen slate field with a whisper of the low-rank update mixed in.
	const wpFill = (i: number, j: number) => lerpHex(wFill(i, j), dwFill(i, j), 0.22);

	const EQ_TEX = String.raw`h \;=\; \textcolor{#64748b}{W}\,x \;+\; \frac{\alpha}{r}\,\textcolor{#c08a38}{B}\,\textcolor{#cf9a33}{A}\,x`;
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
			<Layers size={16} strokeWidth={2.5} />
			<span>LoRA — the low-rank bypass</span>
		</div>
		<span class="text-xs" style="color: var(--color-text-muted); font-family: var(--font-mono);">
			r = {r} · d = {d}
		</span>
	</div>
	<p class="mb-3 text-xs" style="color: var(--color-text-muted);">
		W never moves. All the learning squeezes through the thin bypass — block sizes below are drawn
		to scale, so the whole trick is visible: r is tiny against d.
	</p>

	<!-- ── controls ── -->
	<div class="mb-3 flex flex-wrap items-end gap-x-5 gap-y-3">
		<div class="seg" role="group" aria-label="view">
			<button class:active={view === 'bypass'} onclick={() => (view = 'bypass')}>the bypass</button>
			<button class:active={view === 'merged'} onclick={() => (view = 'merged')}>merged</button>
		</div>
		<div class="seg" role="group" aria-label="model width d">
			<button class:active={d === 128} onclick={() => (d = 128)}>d = 128 · pocket</button>
			<button class:active={d === 768} onclick={() => (d = 768)}>d = 768 · flagship-ish</button>
		</div>
		<div class="max-w-64 min-w-40 flex-1">
			<Slider
				label="rank r"
				bind:value={rexp}
				min={0}
				max={6}
				step={1}
				tone="amber"
				format={(v) => `r = ${2 ** v}`}
				hint="powers of two"
			/>
		</div>
	</div>

	{#if view === 'bypass'}
		<svg viewBox="0 0 820 380" class="w-full" role="img" aria-hidden="false">
			<title
				>The LoRA forward pass: input x through frozen W, plus a thin A then B bypass scaled by
				alpha over r, summed into h</title
			>
			<defs>
				<marker id="{gid}-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
					<path d="M0 0L8 4L0 8Z" fill="var(--color-text-muted)" />
				</marker>
			</defs>

			<!-- reusable pixel-grid: rows×cols little weight cells inside a box, coloured by fill(i,j).
			     Defined inside the <svg> so the <rect>s inherit the SVG namespace. -->
			{#snippet cells(
				x: number,
				y: number,
				w: number,
				h: number,
				rows: number,
				cols: number,
				fill: (i: number, j: number) => string
			)}
				{@const ix = Math.min(2.5, w * 0.12)}
				{@const iy = Math.min(2.5, h * 0.12)}
				{@const cw = (w - ix * 2) / cols}
				{@const ch = (h - iy * 2) / rows}
				{@const gap = Math.min(0.9, cw * 0.16, ch * 0.16)}
				{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
					{#each Array.from({ length: cols }, (_, j) => j) as j (j)}
						<rect
							x={x + ix + j * cw + gap / 2}
							y={y + iy + i * ch + gap / 2}
							width={Math.max(0.3, cw - gap)}
							height={Math.max(0.3, ch - gap)}
							rx="0.5"
							fill={fill(i, j)}
						/>
					{/each}
				{/each}
			{/snippet}

			<!-- lanes (drawn first, blocks sit on top) -->
			<line
				x1="44"
				y1="180"
				x2="624"
				y2="180"
				stroke="var(--color-text-muted)"
				stroke-width="1.6"
				marker-end="url(#{gid}-arr)"
			/>
			<path
				d="M100 180 V290 H640 V198"
				fill="none"
				stroke="var(--color-text-muted)"
				stroke-width="1.6"
				marker-end="url(#{gid}-arr)"
			/>
			<circle cx="100" cy="180" r="3.5" fill="var(--color-text-muted)" />
			<text class="io-label" x="30" y="185">x</text>

			<!-- W: the frozen d×d slab — a dense pixel field of pretrained weights -->
			<rect
				x="150"
				y="110"
				width={DPX}
				height={DPX}
				rx="6"
				fill="color-mix(in srgb, {C_W} 24%, var(--color-surface))"
				stroke={C_W}
				stroke-opacity="0.6"
				stroke-width="1.5"
			/>
			{@render cells(150, 110, DPX, DPX, GRID, GRID, wFill)}
			<text class="block-letter" x="220" y="188" fill="var(--color-text)">W</text>
			<!-- lock: shackle + body, paths only -->
			<circle
				cx="283"
				cy="121"
				r="11"
				fill="var(--color-surface)"
				stroke={C_W}
				stroke-width="1.4"
			/>
			<path
				d="M280 120.5 v-2.6 a3 3 0 0 1 6 0 v2.6"
				fill="none"
				stroke={C_W}
				stroke-width="1.6"
				stroke-linecap="round"
			/>
			<rect x="278.4" y="120.5" width="9.2" height="6.6" rx="1.4" fill={C_W} />
			<text class="dim-label" x="140" y="184" text-anchor="end">d</text>
			<text class="dim-label" x="220" y="266" text-anchor="middle">d</text>

			<!-- A: tall-thin — GRID rows, r amber columns (few, and they grow with the slider) -->
			<rect
				x={aX}
				y="220"
				width={aW}
				height={DPX}
				rx="2.5"
				fill="color-mix(in srgb, {C_A_DARK} 50%, var(--color-surface))"
				stroke={C_B}
				stroke-width="1.2"
				style="transition: x 300ms ease, width 300ms ease;"
			/>
			{@render cells(aX, 220, aW, DPX, GRID, rbCells, aFill)}
			<text class="block-letter-sm" x="365" y="212" fill={C_A_DARK}>A</text>
			<text class="dim-label" x="326" y="294" text-anchor="end">d</text>

			<!-- B: thin-wide — GRID cols, r bronze rows (few, and they grow with the slider) -->
			<rect
				x="430"
				y={bY}
				width={DPX}
				height={bH}
				rx="2.5"
				fill="color-mix(in srgb, {C_B_DARK} 50%, var(--color-surface))"
				stroke={C_B_DARK}
				stroke-width="1.2"
				style="transition: y 300ms ease, height 300ms ease;"
			/>
			{@render cells(430, bY, DPX, bH, rbCells, GRID, bFill)}
			<text class="block-letter-sm" x="500" y="246" fill={C_B_DARK}>B</text>

			<!-- α/r scale chip on the bypass -->
			<rect
				x="577"
				y="281"
				width="46"
				height="18"
				rx="9"
				fill="var(--color-surface)"
				stroke="var(--color-border)"
			/>
			<text class="chip-label" x="600" y="294" text-anchor="middle">×α/r</text>

			<!-- + junction and output -->
			<circle
				cx="640"
				cy="180"
				r="13"
				fill="var(--color-surface)"
				stroke="var(--color-important)"
				stroke-width="2"
			/>
			<text class="plus" x="640" y="186" text-anchor="middle">+</text>
			<line
				x1="653"
				y1="180"
				x2="714"
				y2="180"
				stroke="var(--color-text-muted)"
				stroke-width="1.6"
				marker-end="url(#{gid}-arr)"
			/>
			<text class="io-label" x="728" y="185">h</text>

			<!-- block name row -->
			<text class="name-label" x="220" y="376" text-anchor="middle">W — frozen d×d</text>
			<text class="name-label" x="365" y="376" text-anchor="middle">A · down d→r</text>
			<text class="name-label" x="500" y="376" text-anchor="middle">B · up r→d</text>
		</svg>
		{#if rClamped}
			<p class="mt-1 text-[10.5px]" style="color: var(--color-text-muted); font-style: italic;">
				At d = {d}, r = {r} the true adapter is a sub-pixel sliver of W — its cells are drawn oversized
				so the r columns stay countable.
			</p>
		{/if}
	{:else}
		<svg viewBox="0 0 820 250" class="w-full" role="img" aria-hidden="false">
			<title
				>Merging LoRA: W plus the scaled rank-r update BA collapses into a single matrix W prime of
				the same shape</title
			>
			<!-- reusable pixel-grid, re-declared so its <rect>s inherit this <svg>'s namespace -->
			{#snippet cells(
				x: number,
				y: number,
				w: number,
				h: number,
				rows: number,
				cols: number,
				fill: (i: number, j: number) => string
			)}
				{@const ix = Math.min(2.5, w * 0.12)}
				{@const iy = Math.min(2.5, h * 0.12)}
				{@const cw = (w - ix * 2) / cols}
				{@const ch = (h - iy * 2) / rows}
				{@const gap = Math.min(0.9, cw * 0.16, ch * 0.16)}
				{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
					{#each Array.from({ length: cols }, (_, j) => j) as j (j)}
						<rect
							x={x + ix + j * cw + gap / 2}
							y={y + iy + i * ch + gap / 2}
							width={Math.max(0.3, cw - gap)}
							height={Math.max(0.3, ch - gap)}
							rx="0.5"
							fill={fill(i, j)}
						/>
					{/each}
				{/each}
			{/snippet}

			<!-- W — frozen pretrained pixel field -->
			<rect
				x="80"
				y="50"
				width={DPX}
				height={DPX}
				rx="6"
				fill="color-mix(in srgb, {C_W} 24%, var(--color-surface))"
				stroke={C_W}
				stroke-opacity="0.6"
				stroke-width="1.5"
			/>
			{@render cells(80, 50, DPX, DPX, GRID, GRID, wFill)}
			<text class="block-letter" x="150" y="128" fill="var(--color-text)">W</text>
			<text class="name-label" x="150" y="214" text-anchor="middle">W — pretrained</text>

			<text class="op" x="255" y="132" text-anchor="middle">+</text>

			<!-- ΔW = (α/r)·B·A: full d×d shape, but an ACTUAL rank-r product inside -->
			<rect
				x="300"
				y="50"
				width={DPX}
				height={DPX}
				rx="6"
				fill="color-mix(in srgb, {C_W} 12%, var(--color-surface))"
				stroke={C_B}
				stroke-width="1.5"
			/>
			{@render cells(300, 50, DPX, DPX, GRID, GRID, dwFill)}
			<rect
				x="345"
				y="22"
				width="50"
				height="18"
				rx="9"
				fill="var(--color-surface)"
				stroke="var(--color-border)"
			/>
			<text class="chip-label" x="370" y="35" text-anchor="middle">×α/r</text>
			<text class="name-label" x="370" y="214" text-anchor="middle">B·A — same d×d shape</text>
			<text class="sub-label" x="370" y="232" text-anchor="middle"
				>but only r independent directions</text
			>

			<text class="op" x="495" y="132" text-anchor="middle">=</text>

			<!-- W′: merged pixel field — W with the low-rank update baked in -->
			<rect
				x="540"
				y="50"
				width={DPX}
				height={DPX}
				rx="6"
				fill="color-mix(in srgb, {C_W} 24%, var(--color-surface))"
				stroke={C_B}
				stroke-width="1.5"
			/>
			{@render cells(540, 50, DPX, DPX, GRID, GRID, wpFill)}
			<text class="block-letter" x="610" y="128" fill="var(--color-text)">W′</text>
			<text class="name-label" x="610" y="214" text-anchor="middle">W′ — merged</text>
			<text class="sub-label" x="610" y="232" text-anchor="middle">same shape, same cost as W</text>
		</svg>
		<p class="mt-2 text-xs" style="color: var(--color-text-muted);">
			rank r means only r independent patterns — that's the whole savings.
		</p>
		<div class="mt-2 grid gap-2 sm:grid-cols-2">
			<div class="note-card">
				<b>Zero latency tax.</b> After merging, inference is one d×d matmul — exactly what it cost before
				LoRA existed. The adapter leaves no trace at serving time.
			</div>
			<div class="note-card">
				<b>Adapter off = reference policy, free.</b> Keep A and B separate instead, and switching
				them off recovers the frozen base model — Parts 9–10 use exactly this to get π<sub>ref</sub>
				without a second copy of the weights.
			</div>
		</div>
	{/if}

	<!-- ── the parameter bill ── -->
	<div class="mt-4 rounded-lg border p-3" style="border-color: var(--color-border-light);">
		<div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
			<span class="bill-title">the parameter bill</span>
			<span class="pct-badge" style="--c: {pct >= 99.95 ? 'var(--color-challenge)' : C_B};"
				>{pctLabel}% of the weights train</span
			>
		</div>
		<div class="mb-1.5 flex items-center gap-2">
			<span class="bar-label">full fine-tune</span>
			<div
				class="h-3.5 flex-1 overflow-hidden rounded-full"
				style="background: var(--color-bg-tertiary);"
			>
				<div class="h-full rounded-full" style="width: 100%; background: {C_W};"></div>
			</div>
			<span class="bar-value">d² = {fmtInt(fullParams)}</span>
		</div>
		<div class="flex items-center gap-2">
			<span class="bar-label">LoRA</span>
			<div
				class="h-3.5 flex-1 overflow-hidden rounded-full"
				style="background: var(--color-bg-tertiary);"
			>
				<div
					class="h-full rounded-full"
					style="width: {pct}%; min-width: 2px; background: linear-gradient(90deg, {C_B}, {C_A}); transition: width 300ms ease;"
				></div>
			</div>
			<span class="bar-value">2·d·r = {fmtInt(loraParams)}</span>
		</div>
		{#if pct >= 99.95}
			<p class="mt-2 text-[11px]" style="color: var(--color-challenge);">
				At r = {r} with d = {d}, the "low-rank" bypass is as big as W itself — the trick has left
				the building. Low rank only pays while r ≪ d.
			</p>
		{/if}
	</div>

	<!-- ── the equation, colored to match the blocks ── -->
	<div class="mt-4 border-t pt-3" style="border-color: var(--color-border-light);">
		<Formula display tex={EQ_TEX} />
		<div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
			<span class="term" style="--c: {C_W};"><b>W</b> — frozen, never touched by training</span>
			<span class="term" style="--c: {C_A_DARK};"><b>A</b> — trained, projects d → r</span>
			<span class="term" style="--c: {C_B_DARK};"
				><b>B</b> — trained, projects r → d, zero-init so step 0 changes nothing</span
			>
		</div>
	</div>

	<p class="mt-3 text-xs leading-relaxed" style="color: var(--color-text-muted);">
		Why does a rank-{r} bottleneck suffice? Fine-tuning-sized updates are intrinsically low-rank: the
		gradients that adapt a pretrained model live in a small subspace, so forcing ΔW through r directions
		loses almost nothing. In practice r = 8 matches full fine-tune quality on small tasks — while the
		α/r scale keeps the update's magnitude steady as you sweep r.
	</p>
</div>

<style>
	.io-label {
		fill: var(--color-text);
		font-family: var(--font-mono);
		font-size: 15px;
		font-style: italic;
	}
	.block-letter {
		fill: var(--color-text);
		font-family: var(--font-heading);
		font-size: 24px;
		font-weight: 700;
		text-anchor: middle;
	}
	.block-letter-sm {
		font-family: var(--font-heading);
		font-size: 14px;
		font-weight: 700;
		text-anchor: middle;
	}
	.dim-label {
		fill: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
		font-style: italic;
	}
	.name-label {
		fill: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.sub-label {
		fill: var(--color-text-muted);
		font-family: var(--font-sans);
		font-size: 10px;
		font-style: italic;
	}
	.chip-label {
		fill: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.plus {
		fill: var(--color-important);
		font-family: var(--font-mono);
		font-size: 16px;
		font-weight: 700;
	}
	.op {
		fill: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 22px;
		font-weight: 700;
	}

	.seg {
		display: inline-flex;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		overflow: hidden;
	}
	.seg button {
		border: none;
		background: var(--color-surface);
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		padding: 0.32rem 0.65rem;
		cursor: pointer;
		transition:
			background 120ms ease,
			color 120ms ease;
	}
	.seg button + button {
		border-left: 1px solid var(--color-border);
	}
	.seg button:hover {
		background: var(--color-surface-hover);
	}
	.seg button.active {
		background: color-mix(in srgb, var(--color-important) 12%, var(--color-surface));
		color: var(--color-important);
	}

	.bill-title {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
	}
	.pct-badge {
		border-radius: 999px;
		padding: 2px 9px;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--c);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		white-space: nowrap;
	}
	.bar-label {
		width: 5.5rem;
		flex-shrink: 0;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-text-secondary);
	}
	.bar-value {
		width: 7.5rem;
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.note-card {
		border: 1px solid var(--color-border-light);
		border-radius: 0.5rem;
		padding: 0.6rem 0.75rem;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--color-text-secondary);
	}
	.note-card b {
		color: var(--color-text);
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
