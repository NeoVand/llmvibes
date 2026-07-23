<script lang="ts">
	// The KV cache made visible: generate the same 12 tokens in two lanes. The
	// no-cache lane re-runs attention over EVERY previous position at every step
	// (all its cells flash again); the cached lane touches only the new position
	// while the shaded cache region grows behind it. Live position-computation
	// counters diverge quadratic-vs-linear, and the total-work bars at the
	// bottom end at 78 units against 12 — the exponent, not a constant factor.
	import { onDestroy } from 'svelte';
	import { Archive, Pause, Play, RotateCcw, StepForward } from 'lucide-svelte';
	import Slider from '../ui/Slider.svelte';

	const TOKENS = [
		'Once',
		'upon',
		'a',
		'time',
		',',
		'the',
		'little',
		'dragon',
		'looked',
		'at',
		'the',
		'moon'
	];
	const N = TOKENS.length; // 12
	const MAX_TOTAL = (N * (N + 1)) / 2; // 78
	const BASE_MS = 900;

	let step = $state(0); // tokens generated so far, 0..N
	let playing = $state(false);
	let speed = $state(1); // 0.25×..3×
	let timer: ReturnType<typeof setTimeout> | null = null;

	const withoutTotal = $derived((step * (step + 1)) / 2);
	const withTotal = $derived(step);
	const ratio = $derived(step > 0 ? withoutTotal / withTotal : 1);
	const done = $derived(step >= N);

	function stopPlay() {
		if (timer) clearTimeout(timer);
		timer = null;
		playing = false;
	}

	function tick() {
		if (!playing) return;
		step += 1;
		if (step >= N) {
			stopPlay();
			return;
		}
		timer = setTimeout(tick, BASE_MS / speed);
	}

	function togglePlay() {
		if (playing) {
			stopPlay();
			return;
		}
		if (step >= N) step = 0;
		playing = true;
		timer = setTimeout(tick, BASE_MS / speed);
	}

	function stepOnce() {
		stopPlay();
		if (step >= N) step = 0;
		else step += 1;
	}

	function reset() {
		stopPlay();
		step = 0;
	}

	onDestroy(stopPlay);
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
			<Archive size={16} strokeWidth={2.5} />
			<span>Generate 12 tokens, twice</span>
		</div>
		<span class="text-xs" style="color: var(--color-text-muted); font-family: var(--font-mono);">
			token {step} / {N}
		</span>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		Same model, same 12 tokens. Each cell is one position of attention work: watch which cells light
		up per step — that's the entire difference.
	</p>

	<!-- ── controls ── -->
	<div class="mb-4 flex flex-wrap items-center gap-2">
		<button class="ctl-btn" onclick={reset} disabled={step === 0} aria-label="reset">
			<RotateCcw size={14} />
		</button>
		<button class="ctl-btn play" onclick={togglePlay} aria-label={playing ? 'pause' : 'play'}>
			{#if playing}<Pause size={14} />{:else}<Play size={14} />{/if}
		</button>
		<button class="ctl-btn" onclick={stepOnce} aria-label="step one token">
			<StepForward size={14} />
		</button>
		<div class="ml-2 max-w-56 min-w-32 flex-1">
			<Slider
				label="speed"
				bind:value={speed}
				min={0.25}
				max={3}
				step={0.25}
				tone="teal"
				format={(v) => v.toFixed(2).replace(/\.?0+$/, '') + '×'}
			/>
		</div>
	</div>

	<!-- ── lane: without cache ── -->
	<div class="mb-3 rounded-lg border p-3" style="border-color: var(--color-border-light);">
		<div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
			<span class="lane-label" style="color: var(--color-challenge);">without kv cache</span>
			<span class="lane-note">recomputes attention for every position, every step</span>
		</div>
		<div class="flex flex-wrap gap-1">
			{#key step}
				{#each TOKENS as tok, i (i)}
					<span class="cell" class:re={i < step} class:future={i >= step}>{tok}</span>
				{/each}
			{/key}
		</div>
		<div class="counter mt-2">
			this step: <strong style="color: var(--color-challenge);"
				>{step} position{step === 1 ? '' : 's'}</strong
			>
			· total:
			<strong style="color: var(--color-challenge);">{withoutTotal}</strong> position-units
			<span style="color: var(--color-text-muted);">(1 + 2 + … + {step || '0'})</span>
		</div>
	</div>

	<!-- ── lane: with cache ── -->
	<div class="mb-4 rounded-lg border p-3" style="border-color: var(--color-border-light);">
		<div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
			<span class="lane-label" style="color: var(--color-tip);">with kv cache</span>
			<span class="lane-note">computes only the new position; the rest is read from cache</span>
		</div>
		<div class="flex flex-wrap gap-1">
			{#each TOKENS as tok, i (i)}
				{#if i === step - 1}
					{#key step}
						<span class="cell new">{tok}</span>
					{/key}
				{:else}
					<span class="cell" class:cached={i < step - 1} class:future={i >= step}>{tok}</span>
				{/if}
			{/each}
		</div>
		<div class="counter mt-2">
			this step: <strong style="color: var(--color-important);">{step > 0 ? 1 : 0} position</strong>
			· total: <strong style="color: var(--color-tip);">{withTotal}</strong> position-units
			<span style="color: var(--color-text-muted);">(+ {step > 1 ? step - 1 : 0} cached, free)</span
			>
		</div>
	</div>

	<!-- ── legend ── -->
	<div class="mb-4 flex flex-wrap gap-x-4 gap-y-1">
		<span class="legend"
			><span class="sw" style="--c: var(--color-challenge);"></span>recomputed this step — wasted</span
		>
		<span class="legend"
			><span class="sw" style="--c: var(--color-important);"></span>new position — real work</span
		>
		<span class="legend"
			><span class="sw" style="--c: var(--color-tip);"></span>cached — never recomputed</span
		>
		<span class="legend"
			><span class="sw" style="--c: var(--color-border);"></span>not generated yet</span
		>
	</div>

	<!-- ── total work bars ── -->
	<div class="rounded-lg border p-3" style="border-color: var(--color-border-light);">
		<div class="mb-2 flex items-baseline justify-between">
			<span class="lane-label" style="color: var(--color-text-secondary);">total work</span>
			{#if step > 0}
				<span
					class="text-xs font-bold"
					style="font-family: var(--font-mono); color: {done
						? 'var(--color-challenge)'
						: 'var(--color-text-secondary)'};"
				>
					{ratio.toFixed(1)}× more without the cache
				</span>
			{/if}
		</div>
		{#each [{ label: 'no cache', total: withoutTotal, color: 'var(--color-challenge)' }, { label: 'kv cache', total: withTotal, color: 'var(--color-tip)' }] as bar (bar.label)}
			<div class="mb-1.5 flex items-center gap-2">
				<span
					class="w-16 shrink-0 text-right text-[11px]"
					style="font-family: var(--font-mono); color: var(--color-text-secondary);"
					>{bar.label}</span
				>
				<div
					class="h-3.5 flex-1 overflow-hidden rounded-full"
					style="background: var(--color-bg-tertiary);"
				>
					<div
						class="h-full rounded-full"
						style="width: {(bar.total / MAX_TOTAL) *
							100}%; background: {bar.color}; transition: width 300ms ease;"
					></div>
				</div>
				<span
					class="w-16 shrink-0 text-[11px] font-semibold"
					style="font-family: var(--font-mono); color: var(--color-text);">{bar.total} units</span
				>
			</div>
		{/each}
		<p class="mt-2 text-[11.5px]" style="color: var(--color-text-muted);">
			{#if done}
				78 vs 12 — a quadratic sum against a linear one. And the gap grows with length: at 1,000
				tokens the no-cache column is ~500,000 units against 1,000. The cache doesn't shave a
				constant factor; it changes the exponent.
			{:else}
				The red bar grows by the step number; the blue bar grows by 1. Play to the end and compare
				the sums.
			{/if}
		</p>
	</div>
</div>

<style>
	.cell {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--color-border-light);
		border-radius: 0.375rem;
		padding: 0.125rem 0.4rem;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-text);
		white-space: pre;
		transition:
			background 200ms ease,
			opacity 200ms ease;
	}
	.cell.future {
		opacity: 0.3;
		border-style: dashed;
	}
	.cell.re {
		background: color-mix(in srgb, var(--color-challenge) 18%, transparent);
		animation: reflash 500ms ease-out;
	}
	.cell.cached {
		background: color-mix(in srgb, var(--color-tip) 14%, transparent);
	}
	.cell.new {
		background: color-mix(in srgb, var(--color-important) 20%, transparent);
		animation: newflash 500ms ease-out;
	}
	@keyframes reflash {
		0% {
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-challenge) 55%, transparent);
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
		}
	}
	@keyframes newflash {
		0% {
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-important) 55%, transparent);
			transform: scale(1.12);
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
			transform: scale(1);
		}
	}

	.lane-label {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.lane-note {
		font-size: 10.5px;
		color: var(--color-text-muted);
	}
	.counter {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-text-secondary);
	}

	.legend {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 10.5px;
		color: var(--color-text-muted);
	}
	.sw {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--c) 30%, transparent);
		border: 1px solid var(--c);
	}

	.ctl-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		color: var(--color-text);
		background: var(--color-surface-hover);
		cursor: pointer;
		transition: border-color 120ms ease;
	}
	.ctl-btn:hover:not(:disabled) {
		border-color: var(--color-important);
	}
	.ctl-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.ctl-btn.play {
		color: var(--color-important);
		border-color: color-mix(in srgb, var(--color-important) 45%, var(--color-border));
	}
</style>
