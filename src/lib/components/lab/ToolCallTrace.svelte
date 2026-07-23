<script lang="ts">
	// The tool-call loop, animated at token speed. The dragon.name trace from
	// the prose replays chip by chip: the model samples story tokens, samples
	// the <|call|> grammar the same way, hits its own stop token — and then the
	// mode handoff happens on screen: sampling pauses, a runtime row shimmers,
	// result tokens slide in FROM THE RUNTIME, and sampling resumes with the
	// fact in the window. The phase indicator is the lesson: two regimes, one
	// transcript.
	import { onDestroy } from 'svelte';
	import { Play, Pause, RotateCcw, StepForward, Footprints } from 'lucide-svelte';

	type Kind = 'story' | 'marker' | 'payload' | 'echo';
	interface Tok {
		text: string;
		kind: Kind;
		origin: 'model' | 'runtime';
	}

	const story = (text: string): Tok => ({ text, kind: 'story', origin: 'model' });

	const TOKENS: Tok[] = [
		...'...Mira pushed open the heavy door and stepped into the hall.'.split(' ').map(story),
		{ text: '<|call|>', kind: 'marker', origin: 'model' },
		{ text: 'lookup(', kind: 'payload', origin: 'model' },
		{ text: '"dragon.name"', kind: 'payload', origin: 'model' },
		{ text: ')', kind: 'payload', origin: 'model' },
		{ text: '<|end_call|>', kind: 'marker', origin: 'model' },
		{ text: '<|result|>', kind: 'marker', origin: 'runtime' },
		{ text: 'Ember', kind: 'payload', origin: 'runtime' },
		{ text: '<|end_result|>', kind: 'marker', origin: 'runtime' },
		{ text: '"Ember?"', kind: 'echo', origin: 'model' },
		...'Mira whispered. The dragon lifted its head...'.split(' ').map(story)
	];

	/** Visible-count at which <|end_call|> has just landed and the runtime must run. */
	const EXEC_AT = TOKENS.findIndex((t) => t.origin === 'runtime');
	const BASE_TOKEN_MS = 80;
	const BASE_EXEC_MS = 500;

	let n = $state(0); // how many tokens are visible
	let playing = $state(false);
	let stepMode = $state(false);
	let speed = $state(1);
	let executing = $state(false); // play-mode shimmer window
	let execDone = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	function clearTimer() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}
	onDestroy(clearTimer);

	function scheduleNext() {
		clearTimer();
		if (!playing || stepMode) return;
		if (n >= TOKENS.length) {
			playing = false;
			return;
		}
		if (n === EXEC_AT && !execDone) {
			executing = true;
			timer = setTimeout(() => {
				executing = false;
				execDone = true;
				n += 1;
				scheduleNext();
			}, BASE_EXEC_MS / speed);
			return;
		}
		timer = setTimeout(() => {
			n += 1;
			scheduleNext();
		}, BASE_TOKEN_MS / speed);
	}

	function playPause() {
		if (playing) {
			playing = false;
			executing = false;
			clearTimer();
			return;
		}
		if (n >= TOKENS.length) replay();
		else {
			playing = true;
			scheduleNext();
		}
	}

	function replay() {
		clearTimer();
		n = 0;
		execDone = false;
		executing = false;
		playing = !stepMode;
		scheduleNext();
	}

	function step() {
		if (n >= TOKENS.length) return;
		if (n === EXEC_AT && !execDone) {
			execDone = true; // the shimmer row was already showing; this click is the return
			n += 1;
			return;
		}
		n += 1;
	}

	function toggleStepMode() {
		stepMode = !stepMode;
		if (stepMode) {
			playing = false;
			executing = false;
			clearTimer();
		}
	}

	// The runtime row is visible during the play-mode pause, and in step mode
	// while the learner sits on the boundary deciding to click the runtime on.
	const showExec = $derived(executing || (stepMode && n === EXEC_AT && !execDone));
	const done = $derived(n >= TOKENS.length);
	const started = $derived(n > 0);
	const runtimeActive = $derived(
		showExec || (started && !done && TOKENS[Math.min(n, TOKENS.length - 1)].origin === 'runtime')
	);

	const status = $derived.by(() => {
		if (!started) return 'press play — every chip that appears is one next-token prediction';
		if (showExec)
			return 'stop token seen. Sampling is HALTED — a while-loop, not the model, runs the lookup';
		if (done) return 'done. The fact reached the story because it reached the context — no magic';
		const next = TOKENS[n];
		if (next.origin === 'runtime')
			return 'the runtime splices result tokens into the context; the model predicts nothing here';
		if (n > EXEC_AT)
			return 'sampling resumed — "Ember" now sits in the window, attended to like any other tokens';
		if (TOKENS[n - 1].kind !== 'story')
			return 'the model is writing a tool call — each delimiter sampled exactly like the word "door"';
		return 'model sampling: story tokens, one prediction at a time';
	});
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-1 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		The tool-call loop, at token speed
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		The trace above, replayed the way it actually happens. Watch the phase pills: the whole trick of
		"agents" is the handoff between them.
	</p>

	<!-- phase indicator -->
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<span
			class="phase"
			class:on={started && !runtimeActive && !done}
			style="--ph: var(--color-primary);"
		>
			<span class="dot"></span> model sampling
		</span>
		<span class="text-[11px]" style="color: var(--color-text-muted);">⇄</span>
		<span class="phase" class:on={runtimeActive} style="--ph: var(--color-challenge);">
			<span class="dot"></span> runtime executing
		</span>
		{#if done}
			<span class="phase on" style="--ph: var(--color-earned-bright);">done</span>
		{/if}
	</div>

	<!-- the transcript -->
	<div
		class="min-h-[7.5rem] rounded-lg border p-2"
		style="border-color: var(--color-border-light);"
	>
		<div class="flex flex-wrap gap-1">
			{#each TOKENS.slice(0, n) as t, i (i)}
				<span
					class="chip {t.kind}"
					class:spliced={t.origin === 'runtime'}
					title={t.origin === 'runtime'
						? 'written by the runtime, not sampled'
						: t.kind === 'echo'
							? 'the looked-up fact, used by the model'
							: 'sampled by the model'}
				>
					{t.text}
				</span>
			{/each}
			{#if started && !done && !showExec}
				<span class="caret" class:runtime-caret={TOKENS[n]?.origin === 'runtime'}>▍</span>
			{/if}
		</div>
		{#if showExec}
			<div class="exec-row mt-2">
				<span class="mono">runtime executing…</span>
				<span class="mono" style="color: var(--color-tip);">lookup("dragon.name")</span>
				<span class="mono">→ Ember</span>
			</div>
		{/if}
	</div>

	<p class="mt-2 min-h-[1.6em] text-[11.5px]" style="color: var(--color-text-secondary);">
		{status}
	</p>

	<!-- controls -->
	<div class="mt-3 flex flex-wrap items-center gap-3">
		{#if stepMode}
			<button class="ctl primary" onclick={step} disabled={done}>
				<StepForward size={13} />
				{showExec ? 'let the runtime return' : done ? 'done' : 'next token'}
			</button>
		{:else}
			<button class="ctl primary" onclick={playPause}>
				{#if playing}
					<Pause size={13} /> pause
				{:else}
					<Play size={13} />
					{started && !done ? 'resume' : 'play'}
				{/if}
			</button>
		{/if}
		<button class="ctl" onclick={replay} disabled={!started}><RotateCcw size={13} /> replay</button>
		<button class="ctl" class:toggled={stepMode} aria-pressed={stepMode} onclick={toggleStepMode}>
			<Footprints size={13} /> step mode
		</button>
		<label class="flex min-w-[140px] flex-1 items-center gap-2" style="max-width: 260px;">
			<span class="mono text-[11px]" style="color: var(--color-text-secondary);">speed</span>
			<input
				class="sslider min-w-0 flex-1"
				type="range"
				min="0.5"
				max="3"
				step="0.25"
				bind:value={speed}
				style="--fill: {((speed - 0.5) / 2.5) * 100}%;"
				aria-label="playback speed"
			/>
			<span class="mono w-8 text-right text-[11px]" style="color: var(--color-text);"
				>{speed.toFixed(2).replace(/\.?0+$/, '')}×</span
			>
		</label>
	</div>

	<p
		class="mt-3 border-t border-dashed pt-2 text-[11px]"
		style="border-color: var(--color-border); color: var(--color-text-muted);"
	>
		Solid chips were sampled by the model; dashed chips were written into the context by the
		runtime. The model never executed anything — it wrote a note, a program obeyed it, and the
		transcript grew.
	</p>
</div>

<style>
	.mono {
		font-family: var(--font-mono);
	}

	.phase {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		padding: 0.15rem 0.7rem;
		font-family: var(--font-mono);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}
	.phase .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--color-border);
		transition: background 150ms ease;
	}
	.phase.on {
		border-color: var(--ph);
		background: color-mix(in srgb, var(--ph) 10%, transparent);
		color: var(--ph);
		font-weight: 600;
	}
	.phase.on .dot {
		background: var(--ph);
		animation: pulse 1s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.35;
		}
	}

	.chip {
		border-radius: 0.3rem;
		padding: 0.1rem 0.35rem;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-text);
		animation: pop-in 160ms ease-out;
	}
	.chip.marker {
		color: var(--color-important);
		background: color-mix(in srgb, var(--color-important) 12%, transparent);
		font-weight: 600;
	}
	.chip.payload {
		color: var(--color-tip);
		background: color-mix(in srgb, var(--color-tip) 10%, transparent);
	}
	.chip.echo {
		border-bottom: 2px solid var(--color-tip);
		border-radius: 0.3rem 0.3rem 0 0;
	}
	.chip.spliced {
		outline: 1.5px dashed color-mix(in srgb, var(--color-challenge) 55%, transparent);
		outline-offset: -1.5px;
		animation: slide-in 260ms ease-out;
	}
	@keyframes pop-in {
		from {
			opacity: 0;
			transform: translateY(3px);
		}
	}
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(-10px);
		}
	}

	.caret {
		color: var(--color-primary);
		animation: pulse 0.8s ease-in-out infinite;
	}
	.caret.runtime-caret {
		color: var(--color-challenge);
	}

	.exec-row {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		border: 1px dashed color-mix(in srgb, var(--color-challenge) 55%, transparent);
		border-radius: 0.4rem;
		padding: 0.3rem 0.6rem;
		font-size: 11.5px;
		color: var(--color-challenge);
		animation: pop-in 160ms ease-out;
	}
	.exec-row::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			100deg,
			transparent 25%,
			color-mix(in srgb, var(--color-challenge) 14%, transparent) 50%,
			transparent 75%
		);
		animation: sweep 0.9s linear infinite;
	}
	@keyframes sweep {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(100%);
		}
	}

	.ctl {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: 0.4rem;
		padding: 0.25rem 0.7rem;
		font-size: 11.5px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}
	.ctl:hover:not(:disabled) {
		border-color: var(--color-primary);
	}
	.ctl:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.ctl.primary {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary-text);
	}
	.ctl.toggled {
		border-color: var(--color-vibe);
		background: color-mix(in srgb, var(--color-vibe) 10%, transparent);
		color: var(--color-vibe-text);
	}

	.sslider {
		appearance: none;
		-webkit-appearance: none;
		height: 6px;
		border-radius: 999px;
		background: linear-gradient(
			to right,
			var(--color-primary) var(--fill),
			var(--color-bg-tertiary) var(--fill)
		);
		cursor: pointer;
		outline-offset: 4px;
	}
	.sslider::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-primary);
		border: 2.5px solid var(--color-surface);
		box-shadow: 0 0 0 1.5px var(--color-primary);
	}
	.sslider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-primary);
		border: 2.5px solid var(--color-surface);
		box-shadow: 0 0 0 1.5px var(--color-primary);
	}

	@media (prefers-reduced-motion: reduce) {
		.chip,
		.exec-row,
		.exec-row::after,
		.phase.on .dot,
		.caret {
			animation: none;
		}
	}
</style>
