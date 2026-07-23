<script lang="ts">
	// Mixture-of-experts routing, playable. Five tokens each carry their own
	// router logits (drag the bars, SoftmaxLab-style); softmax turns them into
	// gates, top-2 gating lights two expert lanes plus the always-on shared
	// expert, and the payoff counter shows the trick: the layer stores 9 experts
	// but each token pays for 3. Routing is per-token — the strip under every
	// chip shows ITS top-2 — and pumping one expert everywhere triggers the
	// expert-collapse warning that motivates the auxiliary load-balancing loss.
	import { Network, RotateCcw } from 'lucide-svelte';
	import Formula from '../ui/Math.svelte';

	function mulberry32(seed: number): () => number {
		let a = seed >>> 0;
		return () => {
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	// tokens as chips — cycling pastel washes, the TokenStream idiom
	const TOKENS = ['The', 'dragon', 'played', 'e4', '!'];
	const WASHES = [
		'color-mix(in srgb, #a855f7 16%, transparent)',
		'color-mix(in srgb, #2563eb 14%, transparent)',
		'color-mix(in srgb, #14b8a6 16%, transparent)',
		'color-mix(in srgb, #f59e0b 18%, transparent)',
		'color-mix(in srgb, #fb7185 16%, transparent)'
	];

	const EXPERTS = [
		{ name: 'E0', spec: 'syntax', hue: '#a855f7' },
		{ name: 'E1', spec: 'entities', hue: '#6366f1' },
		{ name: 'E2', spec: 'verbs', hue: '#14b8a6' },
		{ name: 'E3', spec: 'numbers', hue: '#f59e0b' },
		{ name: 'E4', spec: 'chess', hue: '#f43f5e' },
		{ name: 'E5', spec: 'punctuation', hue: '#84cc16' },
		{ name: 'E6', spec: 'dialogue', hue: '#d946ef' },
		{ name: 'E7', spec: 'rare words', hue: '#64748b' }
	];
	const SHARED_HUE = 'var(--color-tip)';

	// designed starting routes (top-1, top-2 per token) + seeded noise elsewhere
	const PREFERRED: [number, number][] = [
		[0, 1], // The → syntax + entities
		[1, 7], // dragon → entities + rare words
		[2, 4], // played → verbs + chess
		[4, 3], // e4 → chess + numbers
		[5, 6] // ! → punctuation + dialogue
	];
	const LMIN = -4;
	const LMAX = 4;

	function initialLogits(): number[][] {
		return TOKENS.map((_, t) => {
			const rand = mulberry32(0x5eed ^ Math.imul(t + 1, 2654435761));
			return EXPERTS.map((_, e) => {
				if (e === PREFERRED[t][0]) return 2.5;
				if (e === PREFERRED[t][1]) return 1.5;
				return Math.round((-0.6 + (rand() - 0.5) * 2) * 20) / 20;
			});
		});
	}

	let logits = $state(initialLogits());
	let selected = $state(3); // start on "e4" — the chess expert lights up

	function softmax(row: number[]): number[] {
		const m = Math.max(...row);
		const ex = row.map((v) => Math.exp(v - m));
		const z = ex.reduce((a, b) => a + b, 0);
		return ex.map((e) => e / z);
	}
	function top2(g: number[]): [number, number] {
		let a = 0;
		let b = 1;
		if (g[1] > g[0]) {
			a = 1;
			b = 0;
		}
		for (let i = 2; i < g.length; i++) {
			if (g[i] > g[a]) {
				b = a;
				a = i;
			} else if (g[i] > g[b]) {
				b = i;
			}
		}
		return [a, b];
	}

	const allGates = $derived(logits.map(softmax));
	const allTop = $derived(allGates.map(top2));
	const gates = $derived(allGates[selected]);
	const topPair = $derived(allTop[selected]);
	// path weights: gates renormalized over the kept two (the Mixtral recipe)
	const w1 = $derived(gates[topPair[0]] / (gates[topPair[0]] + gates[topPair[1]]));
	const w2 = $derived(1 - w1);

	// expert collapse: one expert winning (almost) every token
	const collapse = $derived.by(() => {
		const counts = [0, 0, 0, 0, 0, 0, 0, 0];
		for (const pair of allTop) counts[pair[0]] += 1;
		let best = 0;
		for (let i = 1; i < 8; i++) if (counts[i] > counts[best]) best = i;
		return counts[best] >= 4 ? { expert: best, count: counts[best] } : null;
	});

	// illustrative parameter math: each expert FFN ≈ 4·d² with d = 512
	const D = 512;
	const PER_EXPERT = 4 * D * D; // 1,048,576
	const STORED = 9 * PER_EXPERT; // 8 experts + shared
	const ACTIVE = 3 * PER_EXPERT; // top-2 + shared
	const fmtM = (n: number) => (n / 1e6).toFixed(2) + 'M';

	// ── router bar chart geometry (SVG user units) ──
	const VW = 440;
	const VH = 236;
	const MG = { top: 18, right: 8, bottom: 62, left: 30 };
	const plotW = VW - MG.left - MG.right;
	const plotH = VH - MG.top - MG.bottom;
	const colW = plotW / 8;
	const barW = 26;
	const unitsPerLogit = plotH / (LMAX - LMIN);
	const sy = (l: number) => MG.top + (LMAX - l) * unitsPerLogit;
	const cx = (i: number) => MG.left + i * colW + colW / 2;
	const gridLogits = [4, 2, 0, -2, -4];

	// ── flow diagram geometry ──
	const FW = 520;
	const FH = 470;
	const expY = (e: number) => 12 + e * 50; // expert rect top
	const expC = (e: number) => expY(e) + 19; // expert rect center
	const SHY = 420; // shared expert rect top
	const SHC = SHY + 19;

	// ── dragging (grab anywhere in a column, drag vertically) ──
	let svgEl: SVGSVGElement | undefined = $state();
	let dragI = $state<number | null>(null);
	let hoverI = $state<number | null>(null);
	let dragStart = { y: 0, logit: 0, pxPerLogit: 1 };

	function clampLogit(v: number): number {
		return Math.min(LMAX, Math.max(LMIN, Math.round(v * 20) / 20));
	}

	function barDown(e: PointerEvent, i: number) {
		if (!svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		dragStart = {
			y: e.clientY,
			logit: logits[selected][i],
			pxPerLogit: (rect.height / VH) * unitsPerLogit
		};
		dragI = i;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function barMove(e: PointerEvent) {
		if (dragI === null) return;
		logits[selected][dragI] = clampLogit(
			dragStart.logit + (dragStart.y - e.clientY) / dragStart.pxPerLogit
		);
	}

	function barUp() {
		dragI = null;
	}

	function barKey(e: KeyboardEvent, i: number) {
		const step =
			e.key === 'ArrowUp' || e.key === 'ArrowRight'
				? 0.25
				: e.key === 'ArrowDown' || e.key === 'ArrowLeft'
					? -0.25
					: e.key === 'PageUp'
						? 1
						: e.key === 'PageDown'
							? -1
							: null;
		if (step !== null) {
			logits[selected][i] = clampLogit(logits[selected][i] + step);
			e.preventDefault();
		} else if (e.key === 'Home') {
			logits[selected][i] = LMIN;
			e.preventDefault();
		} else if (e.key === 'End') {
			logits[selected][i] = LMAX;
			e.preventDefault();
		}
	}

	function reset() {
		logits = initialLogits();
	}

	const TEX = String.raw`y \;=\; \sum_{i \,\in\, \text{top-2}(g)} g_i \, E_i(x) \;+\; E_{\text{shared}}(x)`;
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
			<Network size={16} strokeWidth={2.5} />
			<span>Mixture of experts — route a token</span>
		</div>
		<button class="reset-btn" onclick={reset}><RotateCcw size={12} /> reset</button>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		One FFN layer, split into 8 specialist experts plus a shared lane. Click a token, then drag its
		router logits — only the top-2 gates fire, and only those experts' weights are touched.
	</p>

	<!-- ── token chips, each with its own top-2 routing strip ── -->
	<div class="mb-4 flex flex-wrap items-start gap-2">
		{#each TOKENS as tok, t (t)}
			<button
				class="chip"
				class:sel={selected === t}
				style="--wash: {WASHES[t % WASHES.length]};"
				aria-pressed={selected === t}
				onclick={() => (selected = t)}
			>
				<span class="chip-tok">{tok}</span>
				<span class="strip" aria-hidden="true">
					{#each EXPERTS as ex, e (e)}
						<span
							class="strip-cell"
							style="background: {allTop[t][0] === e || allTop[t][1] === e
								? ex.hue
								: 'var(--color-bg-tertiary)'}; opacity: {allTop[t][0] === e
								? 1
								: allTop[t][1] === e
									? 0.7
									: 0.6};"
						></span>
					{/each}
				</span>
			</button>
		{/each}
		<span class="mt-1 text-[10.5px]" style="color: var(--color-text-muted);">
			each strip = that token's own top-2 — routing is per-token, not per-sequence
		</span>
	</div>

	<div class="flex flex-wrap gap-5">
		<!-- ── left: the router — draggable logits + gates ── -->
		<div class="min-w-[260px] flex-1 basis-[320px]">
			<div class="mb-1 flex items-baseline justify-between gap-2">
				<span class="panel-label">router logits for "{TOKENS[selected]}"</span>
				<span class="panel-label" style="color: var(--color-text-muted);">drag ↕</span>
			</div>
			<svg
				bind:this={svgEl}
				viewBox="0 0 {VW} {VH}"
				class="w-full"
				role="group"
				aria-label="Eight draggable router logit bars for the selected token"
			>
				{#each gridLogits as g (g)}
					<line
						x1={MG.left}
						y1={sy(g)}
						x2={MG.left + plotW}
						y2={sy(g)}
						stroke={g === 0 ? 'var(--color-text-muted)' : 'var(--color-border-light)'}
						stroke-width={g === 0 ? 1.4 : 1}
						opacity={g === 0 ? 0.7 : 1}
					/>
					<text class="tick" x={MG.left - 6} y={sy(g) + 3} text-anchor="end">{g}</text>
				{/each}

				{#each EXPERTS as ex, i (ex.name)}
					{@const l = logits[selected][i]}
					{@const active = topPair[0] === i || topPair[1] === i}
					{@const engaged = dragI === i || hoverI === i}
					<rect
						x={cx(i) - barW / 2}
						y={Math.min(sy(0), sy(l))}
						width={barW}
						height={Math.max(Math.abs(sy(l) - sy(0)), 1.5)}
						rx="4"
						fill={ex.hue}
						opacity={active ? (engaged ? 1 : 0.9) : engaged ? 0.55 : 0.3}
						pointer-events="none"
					/>
					<text
						class="val"
						x={cx(i)}
						y={l >= 0 ? sy(l) - 5 : sy(l) + 13}
						text-anchor="middle"
						opacity={active ? 1 : 0.5}>{l.toFixed(1)}</text
					>
					<text
						class="gate"
						x={cx(i)}
						y={VH - 40}
						text-anchor="middle"
						fill={active ? ex.hue : 'var(--color-text-muted)'}
						opacity={active ? 1 : 0.55}
						font-weight={active ? 700 : 400}>{gates[i].toFixed(2)}</text
					>
					<text
						class="ename"
						x={cx(i)}
						y={VH - 24}
						text-anchor="middle"
						fill={ex.hue}
						opacity={active ? 1 : 0.45}>{ex.name}</text
					>
					<rect
						class="hit"
						x={MG.left + i * colW}
						y={MG.top - 8}
						width={colW}
						height={plotH + 46}
						fill={engaged ? ex.hue : 'transparent'}
						opacity={engaged ? 0.07 : 0}
						role="slider"
						tabindex="0"
						aria-label={`router logit for expert ${ex.name} (${ex.spec})`}
						aria-valuemin={LMIN}
						aria-valuemax={LMAX}
						aria-valuenow={l}
						aria-valuetext={`${l.toFixed(2)} for ${ex.name}`}
						aria-orientation="vertical"
						onpointerdown={(e) => barDown(e, i)}
						onpointermove={barMove}
						onpointerup={barUp}
						onpointercancel={barUp}
						onpointerenter={() => (hoverI = i)}
						onpointerleave={() => (hoverI = null)}
						onkeydown={(e) => barKey(e, i)}
					/>
				{/each}
			</svg>
			<p class="mt-1 text-[10.5px]" style="color: var(--color-text-muted);">
				bottom row: gate g = softmax(logits) over the 8 experts — the two highest fire
			</p>

			{#if collapse}
				<div class="collapse-chip mt-3">
					<strong>expert collapse:</strong>
					{EXPERTS[collapse.expert].name} wins {collapse.count}/{TOKENS.length}
					tokens — the rest starve. Real MoEs add an auxiliary load-balancing loss so the router keeps
					traffic spread.
				</div>
			{/if}
		</div>

		<!-- ── right: token → router → experts flow ── -->
		<div class="min-w-[260px] flex-1 basis-[340px]">
			<div class="mb-1 flex items-baseline justify-between gap-2">
				<span class="panel-label" style="color: var(--color-important);"
					>the routed forward pass</span
				>
				<span class="panel-label" style="color: var(--color-text-muted);">weights renormalized</span
				>
			</div>
			<svg
				viewBox="0 0 {FW} {FH}"
				class="w-full"
				role="img"
				aria-label="Flow diagram from the selected token through the router to the two active experts and the shared expert"
			>
				<!-- shared lane: bypasses the router, always on -->
				<path
					d="M 59 254 C 59 {SHC}, 170 {SHC}, 350 {SHC}"
					fill="none"
					stroke={SHARED_HUE}
					stroke-width="4"
					stroke-opacity="0.65"
					stroke-linecap="round"
				/>
				<text class="flabel" x="150" y={SHC - 10} fill={SHARED_HUE}>always on</text>

				<!-- token → router -->
				<line
					x1="104"
					y1="234"
					x2="150"
					y2="234"
					stroke="var(--color-text-muted)"
					stroke-width="2"
					opacity="0.6"
				/>
				<rect
					x="14"
					y="214"
					width="90"
					height="40"
					rx="8"
					fill={WASHES[selected % WASHES.length]}
					stroke="var(--color-border)"
				/>
				<text class="ftok" x="59" y="239" text-anchor="middle">{TOKENS[selected]}</text>

				<!-- the router -->
				<rect
					x="150"
					y="200"
					width="100"
					height="68"
					rx="10"
					fill="color-mix(in srgb, var(--color-important) 8%, transparent)"
					stroke="var(--color-important)"
					stroke-width="1.5"
				/>
				<text class="frouter" x="200" y="228" text-anchor="middle">ROUTER</text>
				<text class="fsub" x="200" y="248" text-anchor="middle">top-2 of 8</text>

				<!-- router → experts -->
				{#each EXPERTS as ex, e (ex.name)}
					{@const yc = expC(e)}
					{@const rank = topPair[0] === e ? 0 : topPair[1] === e ? 1 : -1}
					{@const w = rank === 0 ? w1 : rank === 1 ? w2 : 0}
					<path
						d="M 250 234 C 300 234, 300 {yc}, 350 {yc}"
						fill="none"
						stroke={rank >= 0 ? ex.hue : 'var(--color-text-muted)'}
						stroke-width={rank >= 0 ? 2 + 9 * w : 1.2}
						stroke-opacity={rank >= 0 ? 0.3 + 0.65 * w : 0.14}
						stroke-linecap="round"
					/>
					{#if rank >= 0}
						<text class="fgate" x="300" y={(234 + yc) / 2 - 6} text-anchor="middle" fill={ex.hue}
							>{w.toFixed(2)}</text
						>
					{/if}
					<g opacity={rank >= 0 ? 1 : 0.25}>
						<rect
							x="350"
							y={expY(e)}
							width="150"
							height="38"
							rx="8"
							fill="color-mix(in srgb, {ex.hue} 14%, transparent)"
							stroke={ex.hue}
							stroke-width={rank >= 0 ? 2 : 1}
						/>
						<text class="fename" x="364" y={expY(e) + 17} fill={ex.hue}>{ex.name}</text>
						<text class="fespec" x="364" y={expY(e) + 31}>{ex.spec}</text>
					</g>
				{/each}

				<!-- shared expert block -->
				<rect
					x="350"
					y={SHY}
					width="150"
					height="38"
					rx="8"
					fill="color-mix(in srgb, var(--color-tip) 14%, transparent)"
					stroke={SHARED_HUE}
					stroke-width="2"
				/>
				<text class="fename" x="364" y={SHY + 17} fill={SHARED_HUE}>shared</text>
				<text class="fespec" x="364" y={SHY + 31}>every token, no gate</text>
			</svg>
			<p class="mt-1 text-[10.5px]" style="color: var(--color-text-muted);">
				only the lit paths run — the other six experts stay cold for this token
			</p>
		</div>
	</div>

	<!-- ── the payoff counter ── -->
	<div class="mt-4 rounded-lg border p-3" style="border-color: var(--color-border-light);">
		<div class="panel-label mb-1" style="color: var(--color-tip);">
			parameters loaded this token
		</div>
		<div class="counter">
			<span style="color: var(--color-text);"
				>2/8 experts + shared = <strong style="color: var(--color-tip);">{fmtM(ACTIVE)}</strong> of
				{fmtM(STORED)} stored</span
			>
			· ≈ <strong style="color: var(--color-tip);">{Math.round((ACTIVE / STORED) * 100)}%</strong> of
			the dense equivalent
		</div>
		<div class="counter mt-1" style="color: var(--color-text-muted);">
			each expert 4·d² (d=512) ≈ {fmtM(PER_EXPERT)} · this token: {EXPERTS[topPair[0]].name} ({w1.toFixed(
				2
			)}) + {EXPERTS[topPair[1]].name} ({w2.toFixed(2)}) + shared (1.00)
		</div>
		<p class="mt-2 text-[11.5px]" style="color: var(--color-text-secondary);">
			That's the whole trade: the layer <em>stores</em> 9.4M parameters of capacity but each token
			<em>computes</em> with 3.1M — the memory of a big model at the speed of a small one.
		</p>
	</div>

	<!-- ── formula ── -->
	<div class="mt-4 rounded-lg border p-2" style="border-color: var(--color-border-light);">
		<Formula tex={TEX} display />
		<p class="mt-1 text-center text-[11px]" style="color: var(--color-text-muted);">
			the output is a gate-weighted blend of just two expert FFNs, plus the always-on shared one —
			the sum has two terms, never eight
		</p>
	</div>
</div>

<style>
	.chip {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 3px;
		border: 1px solid var(--color-border-light);
		border-radius: 0.5rem;
		padding: 0.3rem 0.45rem 0.35rem;
		background: var(--wash);
		cursor: pointer;
		transition:
			border-color 120ms ease,
			box-shadow 120ms ease,
			transform 120ms ease;
	}
	.chip:hover {
		border-color: var(--color-important);
	}
	.chip.sel {
		border-color: var(--color-important);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-important) 35%, transparent);
		transform: translateY(-1px);
	}
	.chip-tok {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--color-text);
		text-align: center;
		white-space: pre;
	}
	.strip {
		display: flex;
		gap: 2px;
		justify-content: center;
	}
	.strip-cell {
		width: 7px;
		height: 7px;
		border-radius: 2px;
	}

	.panel-label {
		font-family: var(--font-mono);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
	}

	.tick {
		fill: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.val {
		fill: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
	}
	.gate {
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.ename {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
	}
	.hit {
		cursor: ns-resize;
		touch-action: none;
		transition: opacity 120ms ease;
	}
	.hit:focus-visible {
		outline: none;
		opacity: 0.12;
	}

	.ftok {
		fill: var(--color-text);
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 600;
	}
	.frouter {
		fill: var(--color-important);
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 1px;
	}
	.fsub {
		fill: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.fgate {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		paint-order: stroke;
		stroke: var(--color-surface);
		stroke-width: 3px;
	}
	.flabel {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		paint-order: stroke;
		stroke: var(--color-surface);
		stroke-width: 3px;
	}
	.fename {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
	}
	.fespec {
		fill: var(--color-text-muted);
		font-size: 10px;
	}

	.counter {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--color-text-secondary);
	}

	.collapse-chip {
		border: 1px solid color-mix(in srgb, var(--color-challenge) 55%, var(--color-border));
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--color-challenge) 9%, transparent);
		padding: 0.4rem 0.6rem;
		font-size: 11px;
		line-height: 1.45;
		color: var(--color-text-secondary);
	}
	.collapse-chip strong {
		color: var(--color-challenge);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 10px;
	}

	.reset-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid var(--color-border);
		border-radius: 0.4rem;
		padding: 0.15rem 0.55rem;
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
		transition: border-color 120ms ease;
	}
	.reset-btn:hover {
		border-color: var(--color-important);
	}
</style>
