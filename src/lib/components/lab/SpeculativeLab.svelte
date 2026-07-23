<script lang="ts">
	// The speculative-decoding handshake, animated. A fast draft model proposes
	// k=4 grey candidates (quick ticks); the big model verifies the whole burst
	// in ONE batched pass — accepted tokens turn tip-blue and lock, the first
	// rejection turns challenge-red and is replaced by the big model's own
	// token. A draft-accuracy slider drives random acceptance, and the meter
	// tracks tokens per big-model call against the baseline of 1.0. The output
	// is a canned target sentence for a reason: it NEVER changes — speculative
	// decoding provably reproduces the big model's exact output distribution.
	import { onDestroy } from 'svelte';
	import { FastForward, Pause, Play, Rabbit, RotateCcw, StepForward, Turtle } from 'lucide-svelte';
	import Slider from '../ui/Slider.svelte';

	const TARGET = [
		'Once',
		'upon',
		'a',
		'time,',
		'a',
		'little',
		'dragon',
		'found',
		'a',
		'shiny',
		'lantern',
		'in',
		'the',
		'woods',
		'and',
		'carried',
		'it',
		'home',
		'to',
		'show',
		'his',
		'mother.'
	];
	const K = 4;
	const DECOYS = ['blue', 'ran', 'very', 'big', 'tree', 'cat', 'was', 'happy', 'ball', 'slow'];

	type CandState = 'pending' | 'accepted' | 'rejected' | 'replaced' | 'dropped';
	type LockSrc = 'accepted' | 'corrected' | 'bonus';

	let locked = $state<{ text: string; src: LockSrc }[]>([]);
	let candidates = $state<{ text: string; ok: boolean; st: CandState }[]>([]);
	let phase = $state<'idle' | 'drafting' | 'verifying' | 'done'>('idle');
	let accuracy = $state(0.8);
	let auto = $state(false);
	let busy = $state(false);
	let bigCalls = $state(0);
	let drafted = $state(0);
	let accepted = $state(0);

	let runId = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;

	function later(ms: number, fn: () => void) {
		const id = runId;
		timer = setTimeout(() => {
			if (id === runId) fn();
		}, ms);
	}

	function decoyFor(pos: number): string {
		let i = (pos * 7 + 3) % DECOYS.length;
		if (DECOYS[i] === TARGET[pos]) i = (i + 1) % DECOYS.length;
		return DECOYS[i];
	}

	function startRound() {
		if (timer) clearTimeout(timer); // cancel any pending auto-scheduled round
		const pos = locked.length;
		if (pos >= TARGET.length) {
			finishAll();
			return;
		}
		busy = true;
		phase = 'drafting';
		candidates = [];
		const k = Math.min(K, TARGET.length - pos);
		draftStep(0, k, pos);
	}

	function draftStep(j: number, k: number, pos: number) {
		if (j >= k) {
			later(350, () => {
				phase = 'verifying';
				bigCalls += 1;
				later(300, () => verifyStep(0, pos));
			});
			return;
		}
		const ok = Math.random() < accuracy;
		candidates.push({ text: ok ? TARGET[pos + j] : decoyFor(pos + j), ok, st: 'pending' });
		drafted += 1;
		later(140, () => draftStep(j + 1, k, pos));
	}

	function verifyStep(j: number, pos: number) {
		if (j >= candidates.length) {
			// whole burst accepted — the same batched pass yields one bonus token free
			finalizeRound(candidates.length, pos, false);
			return;
		}
		const c = candidates[j];
		if (c.ok) {
			c.st = 'accepted';
			accepted += 1;
			later(240, () => verifyStep(j + 1, pos));
		} else {
			c.st = 'rejected';
			for (let m = j + 1; m < candidates.length; m++) candidates[m].st = 'dropped';
			later(550, () => {
				c.text = TARGET[pos + j];
				c.st = 'replaced';
				later(550, () => finalizeRound(j, pos, true));
			});
		}
	}

	function finalizeRound(nAccepted: number, pos: number, corrected: boolean) {
		const add: { text: string; src: LockSrc }[] = [];
		for (let j = 0; j < nAccepted; j++) add.push({ text: TARGET[pos + j], src: 'accepted' });
		if (corrected) {
			add.push({ text: TARGET[pos + nAccepted], src: 'corrected' });
		} else if (pos + nAccepted < TARGET.length) {
			add.push({ text: TARGET[pos + nAccepted], src: 'bonus' });
		}
		locked = [...locked, ...add];
		candidates = [];
		busy = false;
		if (locked.length >= TARGET.length) {
			finishAll();
		} else if (auto) {
			phase = 'idle';
			later(500, startRound);
		} else {
			phase = 'idle';
		}
	}

	function finishAll() {
		phase = 'done';
		busy = false;
		auto = false;
	}

	function togglePlay() {
		if (auto) {
			auto = false; // stops after the round in flight
			return;
		}
		if (phase === 'done') resetState();
		auto = true;
		if (!busy) startRound();
	}

	function stepRound() {
		if (busy) return;
		if (phase === 'done') resetState();
		auto = false;
		startRound();
	}

	function resetState() {
		runId += 1;
		if (timer) clearTimeout(timer);
		timer = null;
		locked = [];
		candidates = [];
		phase = 'idle';
		auto = false;
		busy = false;
		bigCalls = 0;
		drafted = 0;
		accepted = 0;
	}

	onDestroy(() => {
		runId += 1;
		if (timer) clearTimeout(timer);
	});

	const tokensPerCall = $derived(bigCalls > 0 ? locked.length / bigCalls : 0);
	const acceptRate = $derived(drafted > 0 ? accepted / drafted : 0);
	const started = $derived(bigCalls > 0 || busy);
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
			<FastForward size={16} strokeWidth={2.5} />
			<span>The handshake — draft, then verify in one pass</span>
		</div>
		<span class="text-xs" style="color: var(--color-text-muted); font-family: var(--font-mono);">
			{locked.length} / {TARGET.length} tokens
		</span>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		Grey chips are the draft's guesses. One batched pass from the big model then sweeps the burst:
		agree → lock in, first disagreement → replace and restart from there.
	</p>

	<!-- ── controls ── -->
	<div class="mb-4 flex flex-wrap items-center gap-2">
		<button
			class="ctl-btn"
			onclick={resetState}
			disabled={!started && phase !== 'done'}
			aria-label="reset"
		>
			<RotateCcw size={14} />
		</button>
		<button class="ctl-btn play" onclick={togglePlay} aria-label={auto ? 'pause' : 'play'}>
			{#if auto}<Pause size={14} />{:else}<Play size={14} />{/if}
		</button>
		<button class="ctl-btn" onclick={stepRound} disabled={busy} aria-label="run one round">
			<StepForward size={14} />
		</button>
		<div class="ml-2 max-w-56 min-w-36 flex-1">
			<Slider
				label="draft accuracy"
				bind:value={accuracy}
				min={0.5}
				max={0.95}
				step={0.05}
				tone="violet"
				format={(v) => `${Math.round(v * 100)}%`}
			/>
		</div>
	</div>

	<!-- ── the two models ── -->
	<div class="mb-4 grid gap-2 sm:grid-cols-2">
		<div class="model" class:active={phase === 'drafting'} style="--mc: var(--color-vibe);">
			<Rabbit size={16} strokeWidth={2.25} />
			<div>
				<div class="model-name">live-Quill — draft</div>
				<div class="model-status">
					{phase === 'drafting' ? `proposing ${K} candidates, fast…` : 'small, cheap, quick'}
				</div>
			</div>
		</div>
		<div class="model" class:active={phase === 'verifying'} style="--mc: var(--color-important);">
			<Turtle size={16} strokeWidth={2.25} />
			<div>
				<div class="model-name">flagship-Quill — target</div>
				<div class="model-status">
					{phase === 'verifying'
						? 'ONE batched pass scores the whole burst'
						: 'big, slow, authoritative'}
				</div>
			</div>
		</div>
	</div>

	<!-- ── the output stream ── -->
	<div
		class="mb-4 flex min-h-16 flex-wrap content-start items-center gap-1 rounded-lg border p-3"
		style="border-color: var(--color-border-light);"
	>
		{#if locked.length === 0 && candidates.length === 0}
			<span class="text-xs italic" style="color: var(--color-text-muted);">
				Press play — or step one round at a time.
			</span>
		{/if}
		{#each locked as t, i (i)}
			<span
				class="tok locked"
				class:corrected={t.src === 'corrected'}
				class:bonus={t.src === 'bonus'}>{t.text}</span
			>
		{/each}
		{#each candidates as c, i (i)}
			<span
				class="tok cand"
				class:accepted={c.st === 'accepted'}
				class:rejected={c.st === 'rejected'}
				class:replaced={c.st === 'replaced'}
				class:dropped={c.st === 'dropped'}>{c.text}</span
			>
		{/each}
	</div>

	<!-- ── legend ── -->
	<div class="mb-4 flex flex-wrap gap-x-4 gap-y-1">
		<span class="legend"
			><span class="sw" style="--c: var(--color-text-muted);"></span>draft candidate</span
		>
		<span class="legend"
			><span class="sw" style="--c: var(--color-tip);"></span>accepted &amp; locked</span
		>
		<span class="legend"
			><span class="sw" style="--c: var(--color-challenge);"></span>rejected → replaced by the big
			model</span
		>
		<span class="legend"
			><span class="sw" style="--c: var(--color-vibe);"></span>bonus — free when a whole burst
			survives</span
		>
	</div>

	<!-- ── the meter ── -->
	<div class="rounded-lg border p-3" style="border-color: var(--color-border-light);">
		<div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
			<span class="panel-label">tokens per big-model call</span>
			<span
				class="text-[11px]"
				style="font-family: var(--font-mono); color: var(--color-text-muted);"
			>
				{bigCalls} call{bigCalls === 1 ? '' : 's'} · {drafted} drafted · {drafted > 0
					? Math.round(acceptRate * 100) + '% accepted'
					: '—'}
			</span>
		</div>
		<div
			class="relative mb-1 h-4 overflow-visible rounded-full"
			style="background: var(--color-bg-tertiary);"
		>
			<div
				class="h-full rounded-full"
				style="width: {Math.min(
					(tokensPerCall / (K + 1)) * 100,
					100
				)}%; background: var(--color-important); transition: width 300ms ease;"
			></div>
			<!-- baseline marker: 1 token per call, what the big model does alone -->
			<div
				class="absolute top-[-3px] bottom-[-3px] w-0.5 rounded"
				style="left: {(1 / (K + 1)) * 100}%; background: var(--color-text-muted);"
			></div>
			<span
				class="absolute top-full mt-0.5 -translate-x-1/2 text-[9.5px] whitespace-nowrap"
				style="left: {(1 / (K + 1)) *
					100}%; font-family: var(--font-mono); color: var(--color-text-muted);">baseline 1.0</span
			>
		</div>
		<div class="mt-4 flex items-baseline gap-2">
			<span
				class="text-xl font-bold"
				style="font-family: var(--font-mono); color: var(--color-important);"
				>{bigCalls > 0 ? tokensPerCall.toFixed(2) : '—'}</span
			>
			<span class="text-[11px]" style="color: var(--color-text-secondary);">
				tokens per pass — the big model alone manages exactly 1.0
			</span>
		</div>
		{#if phase === 'done'}
			<p class="mt-2 text-[12px] font-semibold" style="color: var(--color-tip);">
				Done: {TARGET.length} tokens in {bigCalls} big-model passes instead of {TARGET.length} —
				{tokensPerCall.toFixed(1)}× the baseline.
			</p>
		{/if}
		<p class="mt-2 text-[11.5px]" style="color: var(--color-text-muted);">
			The aha: higher draft accuracy → longer accepted runs → fewer big-model passes. And the
			sentence itself never changes — rerun at any slider setting and you get the exact same words,
			because the accept/replace rule provably reproduces the big model's own output distribution.
			The slider buys speed, never quality.
		</p>
	</div>
</div>

<style>
	.tok {
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
			color 200ms ease,
			border-color 200ms ease,
			opacity 200ms ease;
	}
	.tok.locked {
		background: color-mix(in srgb, var(--color-tip) 14%, transparent);
		border-color: color-mix(in srgb, var(--color-tip) 35%, var(--color-border-light));
	}
	.tok.corrected {
		box-shadow: inset 0 -2px 0 var(--color-challenge);
	}
	.tok.bonus {
		box-shadow: inset 0 -2px 0 var(--color-vibe);
	}
	.tok.cand {
		border-style: dashed;
		color: var(--color-text-muted);
		animation: pop-in 200ms ease-out;
	}
	.tok.cand.accepted {
		border-style: solid;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-tip) 14%, transparent);
		border-color: color-mix(in srgb, var(--color-tip) 35%, var(--color-border-light));
		animation: pop-in 200ms ease-out;
	}
	.tok.cand.rejected {
		border-style: solid;
		color: var(--color-challenge);
		text-decoration: line-through;
		background: color-mix(in srgb, var(--color-challenge) 16%, transparent);
		border-color: color-mix(in srgb, var(--color-challenge) 45%, var(--color-border-light));
		animation: shake 360ms ease-in-out;
	}
	.tok.cand.replaced {
		border-style: solid;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-important) 18%, transparent);
		border-color: color-mix(in srgb, var(--color-important) 45%, var(--color-border-light));
		animation: pop-in 260ms ease-out;
	}
	.tok.cand.dropped {
		opacity: 0.25;
		text-decoration: line-through;
	}

	@keyframes pop-in {
		0% {
			transform: scale(0.6);
			opacity: 0;
		}
		60% {
			transform: scale(1.1);
			opacity: 1;
		}
		100% {
			transform: scale(1);
		}
	}
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		25% {
			transform: translateX(-2.5px);
		}
		50% {
			transform: translateX(2.5px);
		}
		75% {
			transform: translateX(-1.5px);
		}
	}

	.model {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		border: 1px solid var(--color-border-light);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		color: var(--color-text-secondary);
		transition:
			border-color 160ms ease,
			background 160ms ease,
			color 160ms ease;
	}
	.model.active {
		border-color: color-mix(in srgb, var(--mc) 55%, var(--color-border));
		background: color-mix(in srgb, var(--mc) 8%, transparent);
		color: var(--mc);
	}
	.model-name {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text);
	}
	.model-status {
		font-size: 10.5px;
	}
	.model.active .model-name {
		color: var(--mc);
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

	.panel-label {
		font-family: var(--font-mono);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
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
