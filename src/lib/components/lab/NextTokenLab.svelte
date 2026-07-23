<script lang="ts">
	// Self-supervision, the one picture: a window slides over ordinary text and
	// every position it visits mints a FREE training example — the context it
	// covers, the very next token as the answer. No annotator ever touches it.
	// A second tab runs the identical machinery over Rook's chess-move tokens:
	// the thesis of the whole course is that it's all next-token prediction.
	import { Castle, Feather, Pause, Play, RotateCcw, ScanText, StepForward } from 'lucide-svelte';
	import Slider from '../ui/Slider.svelte';

	const STORY =
		'Once upon a time, there was a little bird named Quill. Quill loved to sing songs about the sun.';
	const MOVES = 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6';

	// word-level pseudo-tokens for legibility: optional leading whitespace stays
	// INSIDE the chip (TokenStream idiom — boundaries come from the washes, not
	// from ␣ glyphs). Punctuation splits off as its own token.
	function tokenize(text: string): string[] {
		return text.match(/\s*[A-Za-z0-9']+|\s*[.,!?;:]/g) ?? [];
	}
	const QUILL_TOKENS = tokenize(STORY);
	const ROOK_TOKENS = tokenize(MOVES);

	// five house pastels, cycled by token index (TokenStream's wash cycle)
	const WASHES = [
		'color-mix(in srgb, #a855f7 16%, transparent)',
		'color-mix(in srgb, #2563eb 14%, transparent)',
		'color-mix(in srgb, #14b8a6 16%, transparent)',
		'color-mix(in srgb, #f59e0b 18%, transparent)',
		'color-mix(in srgb, #fb7185 16%, transparent)'
	];

	const BASE_MS = 600;

	let mode = $state<'quill' | 'rook'>('quill');
	let i = $state(0); // last token index inside the context window
	let examples = $state(1); // pairs minted so far — never stops counting
	let playing = $state(false);
	let speed = $state(1);
	let win = $state(5); // context window size, in tokens
	let history = $state<{ context: string[]; target: string }[]>([]);

	const tokens = $derived(mode === 'quill' ? QUILL_TOKENS : ROOK_TOKENS);
	const start = $derived(Math.max(0, i - win + 1));
	const target = $derived(i + 1);
	const ctxTokens = $derived(tokens.slice(start, i + 1));

	function advance() {
		history = [{ context: ctxTokens, target: tokens[target] }, ...history].slice(0, 4);
		examples += 1;
		i = target >= tokens.length - 1 ? 0 : i + 1;
	}

	// playback loop lives entirely in an $effect (SSR-safe, self-cleaning):
	// each advance() moves `i`, which re-arms the next timeout.
	$effect(() => {
		if (!playing) return;
		const from = i;
		const t = setTimeout(() => {
			if (i === from) advance();
		}, BASE_MS / speed);
		return () => clearTimeout(t);
	});

	function togglePlay() {
		playing = !playing;
	}
	function stepOnce() {
		playing = false;
		advance();
	}
	function reset() {
		playing = false;
		i = 0;
		examples = 1;
		history = [];
	}
	function setMode(m: 'quill' | 'rook') {
		if (mode === m) return;
		mode = m;
		reset();
	}
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
			<ScanText size={16} strokeWidth={2.5} />
			<span>One sentence, a whole batch</span>
		</div>
		<span class="text-xs" style="color: var(--color-text-muted); font-family: var(--font-mono);">
			position {i + 1} / {tokens.length - 1}
		</span>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		Slide a window over text that already exists. Whatever token comes next IS the label — the data
		grades itself. That's self-supervision, and it's the entire trick behind pretraining.
	</p>

	<!-- ── tabs: same machinery, two spines ── -->
	<div
		class="mb-3 inline-flex rounded-lg border p-0.5"
		style="border-color: var(--color-border); background: var(--color-surface-hover);"
	>
		<button class="seg" class:on={mode === 'quill'} onclick={() => setMode('quill')}>
			<Feather size={12} /> Quill's story
		</button>
		<button class="seg" class:on={mode === 'rook'} onclick={() => setMode('rook')}>
			<Castle size={12} /> Rook's game
		</button>
	</div>

	<!-- ── controls ── -->
	<div class="mb-4 flex flex-wrap items-center gap-2">
		<button class="ctl-btn" onclick={reset} disabled={i === 0 && examples === 1} aria-label="reset">
			<RotateCcw size={14} />
		</button>
		<button class="ctl-btn play" onclick={togglePlay} aria-label={playing ? 'pause' : 'play'}>
			{#if playing}<Pause size={14} />{:else}<Play size={14} />{/if}
		</button>
		<button class="ctl-btn" onclick={stepOnce} aria-label="step one position">
			<StepForward size={14} />
		</button>
		<div class="ml-2 max-w-44 min-w-28 flex-1">
			<Slider
				label="speed"
				bind:value={speed}
				min={0.5}
				max={3}
				step={0.5}
				tone="teal"
				format={(v) => v.toFixed(1).replace(/\.0$/, '') + '×'}
			/>
		</div>
		<div class="max-w-44 min-w-28 flex-1">
			<Slider label="context window" bind:value={win} min={1} max={8} tone="blue" unit=" tok" />
		</div>
	</div>

	<!-- ── the sliding window over the token stream ── -->
	<div
		class="flex flex-wrap items-center rounded-lg border p-2.5 pt-5"
		style="border-color: var(--color-border-light); font-family: var(--font-mono); font-size: 12.5px; line-height: 1.35; row-gap: 1.1rem;"
	>
		{#each tokens as t, idx (mode + idx)}
			<span
				class="tok relative"
				class:ctx={idx >= start && idx <= i}
				class:ctx-first={idx === start}
				class:ctx-last={idx === i}
				class:tgt={idx === target}
				class:future={idx > target}
				style="background: {WASHES[idx % WASHES.length]};"
			>
				{t}
				{#if idx === start}
					<span class="mark" style="color: var(--color-important);">context</span>
				{/if}
				{#if idx === target}
					<span class="mark" style="color: var(--color-tip);">free answer</span>
				{/if}
			</span>
		{/each}
	</div>

	<!-- ── the minted training example, with its predecessors stacked behind ── -->
	<div class="mt-5 mb-1 flex flex-wrap items-baseline justify-between gap-2">
		<span
			class="text-xs font-bold tracking-wide uppercase"
			style="color: var(--color-text-secondary); font-family: var(--font-mono); letter-spacing: 0.05em;"
		>
			training examples so far:
			<span style="color: var(--color-important); font-size: 14px;">{examples}</span>
		</span>
		<span class="text-[10.5px]" style="color: var(--color-text-muted);">
			no human labels — the text itself is the answer key
		</span>
	</div>
	<div class="relative" style="padding-top: {Math.min(history.length, 3) * 7 + 4}px;">
		{#each history.slice(0, 3) as h, n (examples + '-' + n)}
			<div
				class="ghost absolute inset-x-0 top-0 rounded-lg border px-3 py-2"
				style="
					transform: translateY({-(n + 1) * 7 + Math.min(history.length, 3) * 7 + 4}px) scale({1 -
					(n + 1) * 0.02});
					opacity: {0.4 - n * 0.12};
					z-index: {3 - n};
					border-color: var(--color-border-light);
					background: var(--color-surface);
				"
			>
				<span class="pair-label">example → {h.target.trim()}</span>
			</div>
		{/each}
		<div
			class="relative z-10 rounded-lg border px-3 py-2"
			style="border-color: color-mix(in srgb, var(--color-important) 40%, var(--color-border)); background: var(--color-surface);"
		>
			<div
				class="flex flex-wrap items-center gap-y-1"
				style="font-family: var(--font-mono); font-size: 12px;"
			>
				<span class="pair-label">context:</span>
				<span class="mx-1" style="color: var(--color-text-muted);">[</span>
				{#each ctxTokens as t, n (start + n)}
					<span class="mini" style="background: {WASHES[(start + n) % WASHES.length]};">{t}</span>
				{/each}
				<span class="mx-1" style="color: var(--color-text-muted);">]</span>
				<span class="mx-1" style="color: var(--color-text-secondary);">→</span>
				<span class="pair-label">target:</span>
				<span
					class="mini ml-1"
					style="background: color-mix(in srgb, var(--color-tip) 22%, transparent);"
					>{tokens[target]}</span
				>
			</div>
		</div>
	</div>

	<p class="mt-4 text-[11px] leading-relaxed" style="color: var(--color-text-muted);">
		Illustration only: words stand in for tokens here — the real Quill reads byte-BPE pieces, and
		its context window is 128 of them. And in real training every position in the window is
		predicted simultaneously, in a single pass. This animation slows the truth down; it doesn't
		change it.
	</p>
</div>

<style>
	.tok {
		border-radius: 0.3rem;
		padding: 0.1rem 0.18rem;
		margin: 0 0.5px;
		color: var(--color-text);
		white-space: pre;
		transition: opacity 200ms ease;
	}
	.tok.ctx {
		box-shadow:
			0 -2px 0 0 color-mix(in srgb, var(--color-important) 55%, transparent),
			0 2px 0 0 color-mix(in srgb, var(--color-important) 55%, transparent);
		background-image: linear-gradient(
			color-mix(in srgb, var(--color-important) 12%, transparent),
			color-mix(in srgb, var(--color-important) 12%, transparent)
		);
	}
	.tok.ctx-first {
		box-shadow:
			-2px 0 0 0 color-mix(in srgb, var(--color-important) 55%, transparent),
			0 -2px 0 0 color-mix(in srgb, var(--color-important) 55%, transparent),
			0 2px 0 0 color-mix(in srgb, var(--color-important) 55%, transparent);
		border-top-left-radius: 0.45rem;
		border-bottom-left-radius: 0.45rem;
	}
	.tok.ctx-last {
		box-shadow:
			2px 0 0 0 color-mix(in srgb, var(--color-important) 55%, transparent),
			0 -2px 0 0 color-mix(in srgb, var(--color-important) 55%, transparent),
			0 2px 0 0 color-mix(in srgb, var(--color-important) 55%, transparent);
		border-top-right-radius: 0.45rem;
		border-bottom-right-radius: 0.45rem;
	}
	.tok.ctx-first.ctx-last {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-important) 55%, transparent);
	}
	.tok.tgt {
		background-image: linear-gradient(
			color-mix(in srgb, var(--color-tip) 26%, transparent),
			color-mix(in srgb, var(--color-tip) 26%, transparent)
		);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-tip) 55%, transparent);
		border-radius: 0.45rem;
	}
	.tok.future {
		opacity: 0.28;
	}
	.mark {
		position: absolute;
		bottom: calc(100% + 3px);
		left: 0;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
		line-height: 1;
		pointer-events: none;
	}
	.tok.tgt .mark {
		left: auto;
		right: 0;
	}

	.mini {
		border-radius: 0.25rem;
		padding: 0.05rem 0.15rem;
		margin: 0 0.5px;
		color: var(--color-text);
		white-space: pre;
	}
	.pair-label {
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}
	.ghost {
		pointer-events: none;
	}

	.seg {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
		letter-spacing: 0.03em;
	}
	.seg.on {
		background: var(--color-surface);
		border-color: var(--color-border);
		color: var(--color-important);
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
