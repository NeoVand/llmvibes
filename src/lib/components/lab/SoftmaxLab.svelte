<script lang="ts">
	// Softmax, temperature and top-k made tangible. Six of Quill's candidate
	// next-tokens carry draggable logit bars; softmax turns them into the
	// probability bars on the right, live. Temperature divides every logit
	// before the exponential; top-k cuts the tail and renormalizes. The
	// probability bars sit on an ABSOLUTE 0–100% scale, so sharpening and
	// flattening are visible as bars actually growing and shrinking.
	import { Thermometer, RotateCcw } from 'lucide-svelte';
	import Formula from '../ui/Math.svelte';
	import Slider from '../ui/Slider.svelte';

	// The last candidate is the newline token — labeled with the word, not a
	// glyph, and styled as a muted small label wherever it renders.
	const NEWLINE = 'newline';
	const TOKENS = ['the', 'a', 'dragon', 'happy', 'ran', NEWLINE];
	const DEFAULT_LOGITS = [2.6, 1.8, 1.1, 0.2, -0.6, -1.5];
	const LOGIT_MIN = -4;
	const LOGIT_MAX = 6;

	let logits = $state([...DEFAULT_LOGITS]);
	let temperature = $state(1.0);
	let topK = $state(6);

	// ── softmax over logits / T, then the top-k cut ──
	const probs = $derived.by(() => {
		const scaled = logits.map((x) => x / temperature);
		const m = Math.max(...scaled);
		const exps = scaled.map((s) => Math.exp(s - m));
		const z = exps.reduce((a, b) => a + b, 0);
		return exps.map((e) => e / z);
	});
	const kept = $derived.by(() => {
		const order = probs.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
		return new Set(order.slice(0, topK).map(([, i]) => i));
	});
	const finalProbs = $derived.by(() => {
		let z = 0;
		for (let i = 0; i < probs.length; i++) if (kept.has(i)) z += probs[i];
		return probs.map((p, i) => (kept.has(i) ? p / z : 0));
	});
	const argmaxI = $derived(finalProbs.indexOf(Math.max(...finalProbs)));

	// ── logit chart geometry (SVG user units) ──
	const VW = 440;
	const VH = 264;
	const MG = { top: 16, right: 10, bottom: 54, left: 38 };
	const plotW = VW - MG.left - MG.right;
	const plotH = VH - MG.top - MG.bottom;
	const colW = plotW / TOKENS.length;
	const barW = 36;
	const unitsPerLogit = plotH / (LOGIT_MAX - LOGIT_MIN);
	const sy = (l: number) => MG.top + (LOGIT_MAX - l) * unitsPerLogit;
	const cx = (i: number) => MG.left + i * colW + colW / 2;
	const gridLogits = [6, 4, 2, 0, -2, -4];

	// ── dragging (relative: grab anywhere in a column, drag vertically) ──
	let svgEl: SVGSVGElement | undefined = $state();
	let dragI = $state<number | null>(null);
	let hoverI = $state<number | null>(null);
	let dragStart = { y: 0, logit: 0, pxPerLogit: 1 };

	function clampLogit(v: number): number {
		return Math.min(LOGIT_MAX, Math.max(LOGIT_MIN, Math.round(v * 20) / 20));
	}

	function barDown(e: PointerEvent, i: number) {
		if (!svgEl) return;
		const rect = svgEl.getBoundingClientRect();
		dragStart = {
			y: e.clientY,
			logit: logits[i],
			pxPerLogit: (rect.height / VH) * unitsPerLogit
		};
		dragI = i;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function barMove(e: PointerEvent) {
		if (dragI === null) return;
		logits[dragI] = clampLogit(dragStart.logit + (dragStart.y - e.clientY) / dragStart.pxPerLogit);
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
			logits[i] = clampLogit(logits[i] + step);
			e.preventDefault();
		} else if (e.key === 'Home') {
			logits[i] = LOGIT_MIN;
			e.preventDefault();
		} else if (e.key === 'End') {
			logits[i] = LOGIT_MAX;
			e.preventDefault();
		}
	}

	function reset() {
		logits = [...DEFAULT_LOGITS];
		temperature = 1.0;
		topK = 6;
	}

	const TEX =
		'p_i = \\operatorname{softmax}\\!\\left(\\tfrac{x}{T}\\right)_i = \\dfrac{e^{\\,x_i/T}}{\\sum_{j}\\, e^{\\,x_j/T}}';
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
			<Thermometer size={16} strokeWidth={2.5} />
			<span>Softmax &amp; temperature — live</span>
		</div>
		<button class="reset-btn" onclick={reset}><RotateCcw size={12} /> reset</button>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		Quill mid-story: next token after
		<span style="font-family: var(--font-mono); color: var(--color-primary-text);"
			>"Once upon a time, ___"</span
		>. Drag any logit bar up or down · slide T · cut the tail with top-k.
	</p>

	<div class="flex flex-wrap gap-6">
		<!-- ── left: draggable logits + dials ── -->
		<div class="min-w-[280px] flex-1 basis-[340px]">
			<div class="mb-1 flex items-baseline justify-between">
				<span class="panel-label">logits x — raw scores, the model's opinion</span>
				<span class="panel-label" style="color: var(--color-text-muted);">drag ↕</span>
			</div>
			<svg
				bind:this={svgEl}
				viewBox="0 0 {VW} {VH}"
				class="w-full"
				role="group"
				aria-label="Six candidate tokens with draggable logit bars"
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

				{#each TOKENS as tok, i (tok)}
					{@const l = logits[i]}
					{@const active = dragI === i || hoverI === i}
					<!-- visible bar (non-interactive; the column hit-rect below drives it) -->
					<rect
						x={cx(i) - barW / 2}
						y={Math.min(sy(0), sy(l))}
						width={barW}
						height={Math.max(Math.abs(sy(l) - sy(0)), 1.5)}
						rx="4"
						fill="var(--color-primary)"
						opacity={kept.has(i) ? (active ? 1 : 0.8) : 0.22}
						pointer-events="none"
					/>
					{#if Math.abs(sy(l) - sy(0)) > 16 && kept.has(i)}
						<rect
							x={cx(i) - 9}
							y={l >= 0 ? sy(l) + 5 : sy(l) - 8}
							width="18"
							height="3"
							rx="1.5"
							fill="var(--color-surface)"
							opacity="0.85"
							pointer-events="none"
						/>
					{/if}
					<text
						class="val"
						x={cx(i)}
						y={l >= 0 ? sy(l) - 6 : sy(l) + 14}
						text-anchor="middle"
						opacity={kept.has(i) ? 1 : 0.45}>{l.toFixed(1)}</text
					>
					<text
						class="tok"
						class:tok-newline={tok === NEWLINE}
						x={cx(i)}
						y={VH - 22}
						text-anchor="middle"
						opacity={kept.has(i) ? 1 : 0.45}>{tok}</text
					>
					<!-- full-column hit area: big target, works even at logit 0 -->
					<rect
						class="hit"
						x={MG.left + i * colW}
						y={MG.top}
						width={colW}
						height={plotH + 30}
						fill={active ? 'var(--color-primary)' : 'transparent'}
						opacity={active ? 0.07 : 0}
						role="slider"
						tabindex="0"
						aria-label={`logit for token "${tok}"`}
						aria-valuemin={LOGIT_MIN}
						aria-valuemax={LOGIT_MAX}
						aria-valuenow={l}
						aria-valuetext={`${l.toFixed(2)} for "${tok}"`}
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

			<div class="mt-3">
				<Slider
					label="temperature"
					bind:value={temperature}
					min={0.1}
					max={3}
					step={0.05}
					tone="amber"
					format={(v) => `T = ${v.toFixed(2)}`}
					hint="← sharper · safer — flatter · wilder →"
				/>
			</div>

			<div class="mt-3 flex flex-wrap items-center gap-2">
				<span class="dial-label">top-k</span>
				{#each [1, 2, 3, 4, 5, 6] as k (k)}
					<button
						class="kbtn"
						class:active={topK === k}
						aria-pressed={topK === k}
						onclick={() => (topK = k)}>{k}</button
					>
				{/each}
				<span class="dial-hint">keep the k likeliest, renormalize, sample</span>
			</div>
		</div>

		<!-- ── right: the resulting distribution ── -->
		<div class="min-w-[240px] flex-1 basis-[260px]">
			<div class="mb-2 flex items-baseline justify-between">
				<span class="panel-label" style="color: var(--color-important);"
					>p — what sampling actually draws from</span
				>
				<span class="panel-label" style="color: var(--color-text-muted);">0–100%</span>
			</div>
			<div class="space-y-2">
				{#each TOKENS as tok, i (tok)}
					{@const pct = finalProbs[i] * 100}
					<div
						class="flex items-center gap-2"
						style="opacity: {kept.has(i) ? 1 : 0.38}; transition: opacity 150ms ease;"
					>
						{#if tok === NEWLINE}
							<span
								class="w-14 shrink-0 text-right text-[10px] italic"
								style="color: var(--color-text-muted); letter-spacing: 0.04em;">{tok}</span
							>
						{:else}
							<span
								class="w-14 shrink-0 text-right text-[12px]"
								style="font-family: var(--font-mono); color: var(--color-text);">{tok}</span
							>
						{/if}
						<div
							class="h-3.5 flex-1 overflow-hidden rounded-full"
							style="background: var(--color-bg-tertiary);"
						>
							<div
								class="h-full rounded-full"
								style="width: {pct}%; background: var(--color-important); transition: width 150ms ease;"
							></div>
						</div>
						<span
							class="w-12 shrink-0 text-[11px]"
							style="font-family: var(--font-mono); color: var(--color-text-secondary);"
							>{kept.has(i) ? pct.toFixed(1) + '%' : 'cut'}</span
						>
						{#if i === argmaxI}
							<span class="greedy-chip">greedy pick</span>
						{/if}
					</div>
				{/each}
			</div>
			<p class="mt-2 text-[11px]" style="color: var(--color-text-muted);">
				The bars always sum to 100% — raise one logit and every other probability must pay for it.
			</p>

			<div class="mt-4 rounded-lg border p-2" style="border-color: var(--color-border-light);">
				<Formula tex={TEX} display />
				<p class="mt-1 text-center text-[11px]" style="color: var(--color-text-muted);">
					with top-k, the sum in the denominator runs over the kept k only
				</p>
			</div>
		</div>
	</div>
</div>

<style>
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
		font-size: 11px;
		font-weight: 600;
	}
	.tok {
		fill: var(--color-text);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.tok-newline {
		fill: var(--color-text-muted);
		font-family: var(--font-sans);
		font-size: 10px;
		font-style: italic;
		letter-spacing: 1px;
	}
	.hit {
		cursor: ns-resize;
		touch-action: none;
		transition: opacity 120ms ease;
	}
	.hit:focus-visible {
		outline: none;
		opacity: 0.12;
		fill: var(--color-primary);
	}

	.dial-label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text);
	}
	.dial-hint {
		font-size: 10.5px;
		color: var(--color-text-muted);
		white-space: nowrap;
	}
	.kbtn {
		width: 26px;
		height: 24px;
		border: 1px solid var(--color-border);
		border-radius: 0.4rem;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}
	.kbtn:hover {
		border-color: var(--color-primary);
	}
	.kbtn.active {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary-text);
		font-weight: 600;
	}

	.greedy-chip {
		flex-shrink: 0;
		border-radius: 999px;
		padding: 1px 7px;
		font-size: 10px;
		font-weight: 600;
		color: var(--color-important);
		background: color-mix(in srgb, var(--color-important) 10%, transparent);
		white-space: nowrap;
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
