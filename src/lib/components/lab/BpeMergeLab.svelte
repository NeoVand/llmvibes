<script lang="ts">
	// Ch. 2 merge scrubber: replay Quill's REAL BPE training run, merge by merge.
	// Loads the shipped 256-merge vocabulary (learned from the TinyStories
	// slice), then lets the learner scrub 0→256 merges and watch a demo sentence
	// coalesce from byte gravel into words — token chips visibly fuse, and the
	// chars/token readout climbs live. Encoding "as of merge k" is just the real
	// BpeTokenizer built from the first k merges.
	import { onDestroy, onMount } from 'svelte';
	import { GitMerge, Loader2, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-svelte';
	import { base } from '$app/paths';
	import { BpeTokenizer, type BpeVocab } from '$lib/llm/bpe';

	const SENTENCE = 'Once upon a time, the little dragon looked at the moon.';
	const PLAY_MS = 125; // ~8 merges per second
	const RECENT = 12;

	let vocab = $state<BpeVocab | null>(null);
	let error = $state('');
	let k = $state(0);
	let playing = $state(false);
	let timer: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		try {
			const res = await fetch(`${base}/data/quill-vocab.json`);
			if (!res.ok) throw new Error(`vocab fetch failed: ${res.status}`);
			vocab = (await res.json()) as BpeVocab;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	const nMerges = $derived(vocab?.merges.length ?? 256);
	/** Full tokenizer — expands the whole merge tree, so it can decode ANY token
	 * id (0..511) into its byte string, no matter where the scrubber sits. */
	const fullTok = $derived(vocab ? new BpeTokenizer(vocab) : null);
	/** byteLen[id] = how many raw bytes token id stands for (1 for raw bytes). */
	const byteLen = $derived.by(() => {
		const len: number[] = new Array(256).fill(1);
		if (vocab) for (const [a, b] of vocab.merges) len.push(len[a] + len[b]);
		return len;
	});
	/** The vocabulary mid-training: a tokenizer that knows only the first k merges. */
	const kTok = $derived(
		vocab ? new BpeTokenizer({ merges: vocab.merges.slice(0, k), vocabSize: 256 + k }) : null
	);
	const sentIds = $derived(kTok ? kTok.encode(SENTENCE) : []);
	const charsPerTok = $derived(sentIds.length > 0 ? SENTENCE.length / sentIds.length : 1);

	/** The merge the scrubber just crossed: its two parents and its new token. */
	const newest = $derived.by(() => {
		if (!vocab || !fullTok || k === 0) return null;
		const [a, b] = vocab.merges[k - 1];
		return {
			n: k,
			id: 255 + k,
			a: fullTok.decodeOne(a),
			b: fullTok.decodeOne(b),
			text: fullTok.decodeOne(255 + k),
			bytes: byteLen[255 + k]
		};
	});
	/** Newest merges first, up to RECENT of them. */
	const recent = $derived.by(() => {
		if (!fullTok) return [];
		const out: Array<{ n: number; id: number; text: string }> = [];
		for (let i = k - 1; i >= Math.max(0, k - RECENT); i--) {
			out.push({ n: i + 1, id: 256 + i, text: fullTok.decodeOne(256 + i) });
		}
		return out;
	});

	function stopPlay() {
		if (timer) clearInterval(timer);
		timer = null;
		playing = false;
	}

	function togglePlay() {
		if (playing) {
			stopPlay();
			return;
		}
		if (k >= nMerges) k = 0; // replay from the top
		playing = true;
		timer = setInterval(() => {
			if (k < nMerges) k += 1;
			if (k >= nMerges) stopPlay();
		}, PLAY_MS);
	}

	function step(d: number) {
		stopPlay();
		k = Math.min(nMerges, Math.max(0, k + d));
	}

	function reset() {
		stopPlay();
		k = 0;
	}

	/** Chip tint: the more bytes a token has swallowed, the deeper the wash —
	 * fusing reads as the sentence literally gaining color. */
	function tint(id: number): string {
		const L = byteLen[id] ?? 1;
		if (L <= 1) return 'transparent';
		const pct = Math.min(6 + L * 6, 44);
		return `color-mix(in srgb, var(--color-primary) ${pct}%, transparent)`;
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
			<GitMerge size={16} strokeWidth={2.5} />
			<span>Replay the training run</span>
		</div>
		{#if vocab}
			<div class="text-xs" style="color: var(--color-text-muted); font-family: var(--font-mono);">
				vocab {256 + k} / {256 + nMerges} tokens
			</div>
		{/if}
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		These are Quill's 256 actual merges, in the exact order the corpus voted for them. Scrub or
		press play — the sentence below is retokenized live with only the merges learned so far.
	</p>

	{#if error}
		<p class="text-sm" style="color: var(--color-challenge);">
			Couldn't load the vocabulary: {error}
		</p>
	{:else if !vocab}
		<div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> Loading Quill's merge list…
		</div>
	{:else}
		<div class="mb-4 flex flex-wrap items-center gap-2">
			<button class="ctl-btn" onclick={reset} disabled={k === 0} aria-label="reset to zero merges">
				<RotateCcw size={14} />
			</button>
			<button
				class="ctl-btn"
				onclick={() => step(-1)}
				disabled={k === 0}
				aria-label="back one merge"
			>
				<StepBack size={14} />
			</button>
			<button
				class="ctl-btn play"
				onclick={togglePlay}
				aria-label={playing ? 'pause' : 'play merges'}
			>
				{#if playing}<Pause size={14} />{:else}<Play size={14} />{/if}
			</button>
			<button
				class="ctl-btn"
				onclick={() => step(1)}
				disabled={k >= nMerges}
				aria-label="forward one merge"
			>
				<StepForward size={14} />
			</button>
			<input
				type="range"
				min="0"
				max={nMerges}
				step="1"
				bind:value={k}
				oninput={stopPlay}
				class="min-w-32 flex-1"
				aria-label="number of merges applied"
			/>
			<span
				class="text-xs font-semibold"
				style="color: var(--color-text-secondary); font-family: var(--font-mono); min-width: 8.5ch; text-align: right;"
			>
				merge {k} / {nMerges}
			</span>
		</div>

		<div
			class="mb-3 flex min-h-11 flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
			style="border-color: var(--color-border-light);"
		>
			{#if newest}
				<span class="text-[11px] tracking-wide uppercase" style="color: var(--color-text-muted);">
					merge #{newest.n}
				</span>
				<span class="tok" style="background: {tint(255)};">{newest.a}</span>
				<span class="text-xs" style="color: var(--color-text-muted);">+</span>
				<span class="tok" style="background: {tint(255)};">{newest.b}</span>
				<span class="text-xs" style="color: var(--color-text-muted);">→</span>
				{#key k}
					<span
						class="tok fused"
						style="background: {tint(newest.id)}; outline: 1.5px solid var(--color-important);"
						>{newest.text}</span
					>
				{/key}
				<span class="text-[11px]" style="color: var(--color-text-muted);">
					token {newest.id} · {newest.bytes} bytes
				</span>
			{:else}
				<span class="text-xs" style="color: var(--color-text-muted);">
					No merges yet — the vocabulary is just the 256 raw bytes. Press play.
				</span>
			{/if}
		</div>

		<div class="mb-4 min-h-16">
			<div class="mb-1 text-[11px] tracking-wide uppercase" style="color: var(--color-text-muted);">
				newest {Math.min(k, RECENT)} merges — freshest first
			</div>
			<div class="flex min-h-8 flex-wrap gap-1.5">
				{#if recent.length === 0}
					<span class="text-xs italic" style="color: var(--color-text-muted);">—</span>
				{:else}
					{#each recent as m (m.id)}
						<span
							class="tok"
							class:fused={m.n === k}
							style="background: {tint(m.id)}; {m.n === k
								? 'outline: 1.5px solid var(--color-important);'
								: ''}"
							title="merge #{m.n} → token {m.id}"
						>
							{m.text}<span class="tok-n">#{m.n}</span>
						</span>
					{/each}
				{/if}
			</div>
		</div>

		<div class="rounded-lg border p-3" style="border-color: var(--color-border-light);">
			<div class="mb-2 text-[11px] tracking-wide uppercase" style="color: var(--color-text-muted);">
				the same sentence, tokenized with the first {k} merges
			</div>
			<div class="flex flex-wrap gap-1" aria-live="off">
				{#each sentIds as id, i (i)}
					<span
						class="tok"
						class:fused={newest !== null && id === newest.id}
						style="background: {tint(id)}; {newest !== null && id === newest.id
							? 'outline: 1.5px solid var(--color-important);'
							: ''}">{kTok?.decodeOne(id) ?? ''}</span
					>
				{/each}
			</div>
			<div class="mt-3 flex flex-wrap items-center gap-3">
				<span class="text-xs" style="color: var(--color-text-secondary);">
					{SENTENCE.length} chars →
					<strong style="color: var(--color-text);">{sentIds.length} tokens</strong>
				</span>
				<div
					class="h-2 min-w-24 flex-1 overflow-hidden rounded-full"
					style="background: var(--color-surface-hover);"
				>
					<div
						class="h-full rounded-full"
						style="width: {Math.min(((charsPerTok - 1) / 2.6) * 100, 100).toFixed(
							1
						)}%; background: var(--color-important); transition: width 160ms ease;"
					></div>
				</div>
				<span
					class="text-xs font-semibold"
					style="color: var(--color-text); font-family: var(--font-mono);"
				>
					{charsPerTok.toFixed(2)} chars/token
				</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.tok {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
		border-radius: 0.375rem;
		padding: 0.125rem 0.375rem;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-text);
		border: 1px solid var(--color-border-light);
		white-space: pre;
	}
	.tok-n {
		font-size: 9px;
		color: var(--color-text-muted);
	}
	.fused {
		animation: pop 260ms ease-out;
	}
	@keyframes pop {
		0% {
			transform: scale(0.6);
		}
		60% {
			transform: scale(1.12);
		}
		100% {
			transform: scale(1);
		}
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
