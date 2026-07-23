<script lang="ts">
	// Quill's diet, live: fetches the ACTUAL /data/quill-corpus.txt the Part 5
	// training lab streams into the bird and lets the learner rummage — pull a
	// random TinyStories tale, see the pile in aggregate. The aha is provenance:
	// nothing here is a mock-up; these are the bytes Quill eats.
	import { onMount } from 'svelte';
	import { Feather, Shuffle, Loader2 } from 'lucide-svelte';
	import { base } from '$app/paths';

	type LoadState = 'idle' | 'loading' | 'ready' | 'error';
	let loadState = $state<LoadState>('idle');
	let error = $state('');
	let bytes = $state(0);
	let stories = $state<string[]>([]);
	let storyI = $state(0);
	let chars = $state(0);
	let topWords = $state<Array<{ label: string; n: number }>>([]);

	const WORD_SLICE = 200_000; // count words on a 200 KB slice — plenty for ranks

	// The corpus file is ONE unbroken stream: stories were joined with a blank
	// line, and paragraphs inside a story are separated by the same blank line,
	// so no byte marks a document boundary — which is exactly how Quill reads
	// it. To show whole stories anyway, the reader re-finds story starts by
	// their telltale TinyStories openers (this recovers the slice's 3,000).
	const OPENER =
		/^(Once upon a time|Once there (?:was|lived)|Once,? there|One (?:day|morning|afternoon|evening|night|sunny|bright|time),? )/;

	async function load() {
		loadState = 'loading';
		error = '';
		try {
			const res = await fetch(`${base}/data/quill-corpus.txt`);
			if (!res.ok) throw new Error(`corpus fetch failed: ${res.status}`);
			const buf = await res.arrayBuffer();
			bytes = buf.byteLength;
			const text = new TextDecoder().decode(buf);
			chars = text.length;
			const paras = text
				.split('\n\n')
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			const grouped: string[] = [];
			let current: string[] = [];
			for (const p of paras) {
				if (OPENER.test(p) && current.length > 0) {
					grouped.push(current.join('\n\n'));
					current = [];
				}
				current.push(p);
			}
			if (current.length > 0) grouped.push(current.join('\n\n'));
			stories = grouped;
			const counts: Record<string, number> = Object.create(null);
			for (const m of text
				.slice(0, WORD_SLICE)
				.toLowerCase()
				.matchAll(/[a-z']+/g)) {
				counts[m[0]] = (counts[m[0]] ?? 0) + 1;
			}
			topWords = Object.entries(counts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 12)
				.map(([label, n]) => ({ label, n }));
			storyI = Math.floor(Math.random() * stories.length);
			loadState = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			loadState = 'error';
		}
	}

	onMount(load);

	function reroll() {
		if (stories.length < 2) return;
		let i = storyI;
		while (i === storyI) i = Math.floor(Math.random() * stories.length);
		storyI = i;
	}

	const story = $derived(stories[storyI] ?? '');
	const maxWordN = $derived(Math.max(...topWords.map((w) => w.n), 1));

	function fmt(n: number): string {
		return n.toLocaleString('en-US');
	}
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-1 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<Feather size={16} strokeWidth={2.5} />
		<span>Quill's diet — the story corpus</span>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		This lab fetches the very file Part 5 trains on. Every story below comes straight out of the
		training data.
	</p>

	{#if loadState === 'loading' || loadState === 'idle'}
		<div class="load-row">
			<Loader2 size={14} class="animate-spin" /> fetching quill-corpus.txt…
		</div>
	{:else if loadState === 'error'}
		<div class="load-row" style="color: var(--color-caution);">
			couldn't fetch the corpus ({error}) — <button class="retry" onclick={load}>retry</button>
		</div>
	{:else}
		<div class="flex flex-wrap gap-6">
			<div class="min-w-[260px] flex-1 basis-[340px]">
				<div class="mb-2 flex items-baseline justify-between gap-2">
					<span class="panel-label">story #{fmt(storyI + 1)} of {fmt(stories.length)}</span>
					<button class="shuffle-btn" onclick={reroll}><Shuffle size={12} /> another story</button>
				</div>
				<div class="story max-h-72 overflow-y-auto rounded-lg border p-4">
					{story}
				</div>
				<p class="mt-2 text-[11px]" style="color: var(--color-text-muted);">
					{fmt(story.length)} characters. Quill has read this exact text — and {fmt(
						stories.length - 1
					)} siblings of it — and nothing else, ever. One honest wrinkle: the file itself has no story
					boundaries (stories and paragraphs alike are separated by a blank line), so this reader re-finds
					the starts by their telltale openers. Quill gets no such help — it eats the stream whole.
				</p>
			</div>

			<div class="min-w-[220px] flex-1 basis-[240px]">
				<div class="mb-2 grid grid-cols-3 gap-2">
					<div class="stat">
						<span class="stat-n">{fmt(stories.length)}</span><span class="stat-l">stories</span>
					</div>
					<div class="stat">
						<span class="stat-n">{fmt(chars)}</span><span class="stat-l">characters</span>
					</div>
					<div class="stat">
						<span class="stat-n">{(bytes / 1e6).toFixed(1)} MB</span><span class="stat-l"
							>fetched</span
						>
					</div>
				</div>
				<div class="panel-label mb-1.5">top-12 words in the diet</div>
				{#each topWords as w (w.label)}
					<div class="mb-1 flex items-center gap-2">
						<span class="bar-label">{w.label}</span>
						<div
							class="h-3 flex-1 overflow-hidden rounded-full"
							style="background: var(--color-bg-tertiary);"
						>
							<div
								class="h-full rounded-full"
								style="width: {(100 * w.n) / maxWordN}%; background: var(--color-note);"
							></div>
						</div>
						<span class="bar-n">{fmt(w.n)}</span>
					</div>
				{/each}
				<p class="mt-2 text-[11px]" style="color: var(--color-text-muted);">
					Word counts from the first 200 KB of the file, for speed — the ranking barely moves on the
					full 2.6 MB. Glue words dominate any natural-language pile: Zipf's law in the wild.
				</p>
			</div>
		</div>
		<p class="aha mt-3">
			Fetched {fmt(bytes)} bytes of <span class="mono">quill-corpus.txt</span> — the same URL the Part
			5 training lab streams into Quill. This page is holding the bird's entire diet.
		</p>
	{/if}
</div>

<style>
	.panel-label {
		font-family: var(--font-mono);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
	}
	.story {
		border-color: var(--color-border-light);
		color: var(--color-text-secondary);
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 13.5px;
		line-height: 1.65;
		white-space: pre-line;
	}
	.shuffle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
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
	.shuffle-btn:hover {
		border-color: var(--color-note);
	}
	.load-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1.2rem 0.2rem;
		font-size: 12px;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
	}
	.retry {
		text-decoration: underline;
		cursor: pointer;
		color: inherit;
		background: none;
		border: none;
		font: inherit;
		padding: 0;
	}
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		border: 1px solid var(--color-border-light);
		border-radius: 0.5rem;
		padding: 0.4rem 0.2rem;
	}
	.stat-n {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
	}
	.stat-l {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}
	.bar-label {
		width: 3.6rem;
		flex-shrink: 0;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-text);
	}
	.bar-n {
		width: 2.8rem;
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--color-text-muted);
	}
	.aha {
		font-size: 11.5px;
		border-top: 1px dashed var(--color-border);
		padding-top: 0.6rem;
		color: var(--color-text-secondary);
	}
	.mono {
		font-family: var(--font-mono);
	}
</style>
