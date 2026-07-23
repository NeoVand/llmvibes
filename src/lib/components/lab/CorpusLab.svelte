<script lang="ts">
	// The corpora, live. This lab fetches the ACTUAL training files — the same
	// /data/quill-corpus.txt and /data/rook-tokens.bin the Part 5 training labs
	// stream into the birds — and lets the learner rummage through them: pull a
	// random TinyStories tale, decode a random random-legal chess game, and see
	// the whole pile summarized (story/game counts, sizes, top-12 bars). The aha
	// is provenance: nothing here is a mock-up; these are the bytes the birds eat.
	import { onMount } from 'svelte';
	import { Feather, Castle, Shuffle, Loader2 } from 'lucide-svelte';
	import { base } from '$app/paths';

	type Tab = 'quill' | 'rook';
	type LoadState = 'idle' | 'loading' | 'ready' | 'error';

	let tab = $state<Tab>('quill');

	// ── Quill: the story corpus ──
	let quillState = $state<LoadState>('idle');
	let quillError = $state('');
	let quillBytes = $state(0);
	let stories = $state<string[]>([]);
	let storyI = $state(0);
	let quillChars = $state(0);
	let quillTopWords = $state<Array<{ label: string; n: number }>>([]);

	const WORD_SLICE = 200_000; // count words on a 200 KB slice — plenty for ranks

	// The corpus file is ONE unbroken stream: stories were joined with a blank
	// line, and paragraphs inside a story are separated by the same blank line,
	// so no byte marks a document boundary — which is exactly how Quill reads
	// it. To show whole stories anyway, the reader re-finds story starts by
	// their telltale TinyStories openers (this recovers the slice's 3,000).
	const OPENER =
		/^(Once upon a time|Once there (?:was|lived)|Once,? there|One (?:day|morning|afternoon|evening|night|sunny|bright|time),? )/;

	async function loadQuill() {
		quillState = 'loading';
		quillError = '';
		try {
			const res = await fetch(`${base}/data/quill-corpus.txt`);
			if (!res.ok) throw new Error(`corpus fetch failed: ${res.status}`);
			const buf = await res.arrayBuffer();
			quillBytes = buf.byteLength;
			const text = new TextDecoder().decode(buf);
			quillChars = text.length;
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
			quillTopWords = Object.entries(counts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 12)
				.map(([label, n]) => ({ label, n }));
			storyI = Math.floor(Math.random() * stories.length);
			quillState = 'ready';
		} catch (e) {
			quillError = e instanceof Error ? e.message : String(e);
			quillState = 'error';
		}
	}

	// ── Rook: the game corpus ──
	let rookState = $state<LoadState>('idle');
	let rookError = $state('');
	let rookBytes = $state(0);
	let games = $state<number[][]>([]);
	let gameI = $state(0);
	let moves: string[] = [];
	let avgPlies = $state(0);
	let rookTopOpenings = $state<Array<{ label: string; n: number }>>([]);

	async function loadRook() {
		rookState = 'loading';
		rookError = '';
		try {
			const [binRes, vocabRes] = await Promise.all([
				fetch(`${base}/data/rook-tokens.bin`),
				fetch(`${base}/data/rook-vocab.json`)
			]);
			if (!binRes.ok || !vocabRes.ok) throw new Error('corpus fetch failed');
			const buf = await binRes.arrayBuffer();
			const vocab = (await vocabRes.json()) as { moves: string[]; vocabSize: number };
			moves = vocab.moves;
			rookBytes = buf.byteLength + JSON.stringify(vocab).length;
			const ids = new Uint16Array(buf);
			// Games are separated by token id 0 (<game>); ids 1.. index the move list.
			const parsed: number[][] = [];
			let current: number[] = [];
			for (const id of ids) {
				if (id === 0) {
					if (current.length > 0) parsed.push(current);
					current = [];
				} else {
					current.push(id);
				}
			}
			if (current.length > 0) parsed.push(current);
			games = parsed;
			avgPlies = parsed.reduce((a, g) => a + g.length, 0) / Math.max(parsed.length, 1);
			const firsts: Record<string, number> = Object.create(null);
			for (const g of parsed) {
				if (g.length === 0) continue;
				const uci = moves[g[0] - 1] ?? '?';
				firsts[uci] = (firsts[uci] ?? 0) + 1;
			}
			rookTopOpenings = Object.entries(firsts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 12)
				.map(([label, n]) => ({ label, n }));
			gameI = Math.floor(Math.random() * parsed.length);
			rookState = 'ready';
		} catch (e) {
			rookError = e instanceof Error ? e.message : String(e);
			rookState = 'error';
		}
	}

	onMount(loadQuill);

	function selectTab(t: Tab) {
		tab = t;
		if (t === 'rook' && rookState === 'idle') void loadRook();
	}

	function reroll(count: number, current: number): number {
		if (count < 2) return current;
		let i = current;
		while (i === current) i = Math.floor(Math.random() * count);
		return i;
	}

	const story = $derived(stories[storyI] ?? '');
	const game = $derived(games[gameI] ?? []);
	const gameUci = $derived(game.map((id) => moves[id - 1] ?? '?'));
	const maxWordN = $derived(Math.max(...quillTopWords.map((w) => w.n), 1));
	const maxOpenN = $derived(Math.max(...rookTopOpenings.map((o) => o.n), 1));

	function fmt(n: number): string {
		return n.toLocaleString('en-US');
	}
	function fmtMB(bytes: number): string {
		return (bytes / 1e6).toFixed(1) + ' MB';
	}
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-1 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		The corpora — the actual files
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		This lab fetches the very files Part 5 trains on and lets you rummage. Nothing is staged: every
		story and every game below comes straight out of the training data.
	</p>

	<div class="mb-4 flex gap-2" role="tablist" aria-label="Choose a corpus">
		<button
			class="tab-btn"
			class:active={tab === 'quill'}
			style="--tab-color: var(--color-note);"
			role="tab"
			aria-selected={tab === 'quill'}
			onclick={() => selectTab('quill')}
		>
			<Feather size={13} strokeWidth={2.5} /> Quill — stories
		</button>
		<button
			class="tab-btn"
			class:active={tab === 'rook'}
			style="--tab-color: var(--color-tip);"
			role="tab"
			aria-selected={tab === 'rook'}
			onclick={() => selectTab('rook')}
		>
			<Castle size={13} strokeWidth={2.5} /> Rook — games
		</button>
	</div>

	{#if tab === 'quill'}
		{#if quillState === 'loading' || quillState === 'idle'}
			<div class="load-row">
				<Loader2 size={14} class="animate-spin" /> fetching quill-corpus.txt…
			</div>
		{:else if quillState === 'error'}
			<div class="load-row" style="color: var(--color-caution);">
				couldn't fetch the corpus ({quillError}) —
				<button class="retry" onclick={loadQuill}>retry</button>
			</div>
		{:else}
			<div class="flex flex-wrap gap-6">
				<div class="min-w-[260px] flex-1 basis-[340px]">
					<div class="mb-2 flex items-baseline justify-between gap-2">
						<span class="panel-label">story #{fmt(storyI + 1)} of {fmt(stories.length)}</span>
						<button
							class="shuffle-btn"
							style="--tab-color: var(--color-note);"
							onclick={() => (storyI = reroll(stories.length, storyI))}
						>
							<Shuffle size={12} /> another story
						</button>
					</div>
					<div
						class="max-h-72 overflow-y-auto rounded-lg border p-3 text-[13px] leading-relaxed whitespace-pre-line"
						style="border-color: var(--color-border-light); color: var(--color-text-secondary);"
					>
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
							<span class="stat-n">{fmt(quillChars)}</span><span class="stat-l">characters</span>
						</div>
						<div class="stat">
							<span class="stat-n">{fmtMB(quillBytes)}</span><span class="stat-l">fetched</span>
						</div>
					</div>
					<div class="panel-label mb-1.5">top-12 words in the diet</div>
					{#each quillTopWords as w (w.label)}
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
						Word counts from the first 200 KB of the file, for speed — the ranking barely moves on
						the full 2.6 MB. Glue words dominate any natural-language pile: Zipf's law in the wild.
					</p>
				</div>
			</div>
			<p class="aha mt-3">
				Fetched {fmt(quillBytes)} bytes of <span class="mono">quill-corpus.txt</span> — the same URL the
				Part 5 training lab streams into Quill. This page is holding the bird's entire diet.
			</p>
		{/if}
	{:else if rookState === 'loading' || rookState === 'idle'}
		<div class="load-row"><Loader2 size={14} class="animate-spin" /> fetching rook-tokens.bin…</div>
	{:else if rookState === 'error'}
		<div class="load-row" style="color: var(--color-caution);">
			couldn't fetch the corpus ({rookError}) —
			<button class="retry" onclick={loadRook}>retry</button>
		</div>
	{:else}
		<div class="flex flex-wrap gap-6">
			<div class="min-w-[260px] flex-1 basis-[340px]">
				<div class="mb-2 flex items-baseline justify-between gap-2">
					<span class="panel-label"
						>game #{fmt(gameI + 1)} of {fmt(games.length)} · {game.length} plies</span
					>
					<button
						class="shuffle-btn"
						style="--tab-color: var(--color-tip);"
						onclick={() => (gameI = reroll(games.length, gameI))}
					>
						<Shuffle size={12} /> another game
					</button>
				</div>
				<div
					class="max-h-72 overflow-y-auto rounded-lg border p-2"
					style="border-color: var(--color-border-light);"
				>
					<div class="flex flex-wrap gap-1">
						<span class="chip game-chip">&lt;game&gt;</span>
						{#each gameUci as uci, i (i)}
							<span
								class="chip"
								class:black-move={i % 2 === 1}
								title="ply {i + 1} — {i % 2 === 0 ? 'White' : 'Black'}">{uci}</span
							>
						{/each}
					</div>
				</div>
				<p class="mt-2 text-[11px]" style="color: var(--color-text-muted);">
					Light chips are White's moves, dark are Black's — every one chosen uniformly at random
					among the legal moves. Legal, aimless, and exactly what Rook studies.
				</p>
			</div>

			<div class="min-w-[220px] flex-1 basis-[240px]">
				<div class="mb-2 grid grid-cols-3 gap-2">
					<div class="stat">
						<span class="stat-n">{fmt(games.length)}</span><span class="stat-l">games</span>
					</div>
					<div class="stat">
						<span class="stat-n">{avgPlies.toFixed(1)}</span><span class="stat-l">avg plies</span>
					</div>
					<div class="stat">
						<span class="stat-n">{fmtMB(rookBytes)}</span><span class="stat-l">fetched</span>
					</div>
				</div>
				<div class="panel-label mb-1.5">top-12 opening moves</div>
				{#each rookTopOpenings as o (o.label)}
					<div class="mb-1 flex items-center gap-2">
						<span class="bar-label">{o.label}</span>
						<div
							class="h-3 flex-1 overflow-hidden rounded-full"
							style="background: var(--color-bg-tertiary);"
						>
							<div
								class="h-full rounded-full"
								style="width: {(100 * o.n) / maxOpenN}%; background: var(--color-tip);"
							></div>
						</div>
						<span class="bar-n">{fmt(o.n)}</span>
					</div>
				{/each}
				<p class="mt-2 text-[11px]" style="color: var(--color-text-muted);">
					White's first move, counted across all games. A uniform roll over the 20 legal openings
					lands each near {Math.round(games.length / 20)} — flat bars are the fingerprint of randomness.
				</p>
			</div>
		</div>
		<p class="aha mt-3">
			Fetched {fmt(rookBytes)} bytes of <span class="mono">rook-tokens.bin</span> + vocab — the same files
			the Part 5 chess lab trains Rook on. Token id 0 separates games; every other id names one of 1,930
			possible moves.
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

	.tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 0.3rem 0.8rem;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}
	.tab-btn:hover {
		border-color: var(--tab-color);
	}
	.tab-btn.active {
		border-color: var(--tab-color);
		background: color-mix(in srgb, var(--tab-color) 10%, transparent);
		color: var(--color-text);
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
		border-color: var(--tab-color);
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

	.chip {
		border-radius: 0.3rem;
		padding: 0.1rem 0.3rem;
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-text) 4%, transparent);
	}
	.chip.black-move {
		background: color-mix(in srgb, var(--color-text) 13%, transparent);
	}
	.game-chip {
		color: var(--color-important);
		background: color-mix(in srgb, var(--color-important) 10%, transparent);
		font-weight: 600;
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
