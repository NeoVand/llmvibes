<script lang="ts">
	// Rook's diet, live: fetches the ACTUAL /data/rook-tokens.bin + vocab the
	// Part 5 chess lab trains on, decodes a random random-legal game, and — the
	// point — REPLAYS it on a real board. Step through the plies and watch what
	// "legal but aimless" actually looks like; the aggregate panel shows the
	// uniform-opening fingerprint of randomness.
	import { onMount } from 'svelte';
	import {
		Castle,
		Shuffle,
		Loader2,
		Play,
		Pause,
		SkipBack,
		SkipForward,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';
	import { Chess } from 'chess.js';
	import { base } from '$app/paths';
	import ChessBoard from '$lib/components/chess/ChessBoard.svelte';

	type LoadState = 'idle' | 'loading' | 'ready' | 'error';
	let loadState = $state<LoadState>('idle');
	let error = $state('');
	let bytes = $state(0);
	let games = $state<number[][]>([]);
	let gameI = $state(0);
	let moves: string[] = [];
	let avgPlies = $state(0);
	let topOpenings = $state<Array<{ label: string; n: number }>>([]);

	async function load() {
		loadState = 'loading';
		error = '';
		try {
			const [binRes, vocabRes] = await Promise.all([
				fetch(`${base}/data/rook-tokens.bin`),
				fetch(`${base}/data/rook-vocab.json`)
			]);
			if (!binRes.ok || !vocabRes.ok) throw new Error('corpus fetch failed');
			const buf = await binRes.arrayBuffer();
			const vocab = (await vocabRes.json()) as { moves: string[]; vocabSize: number };
			moves = vocab.moves;
			bytes = buf.byteLength + JSON.stringify(vocab).length;
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
			topOpenings = Object.entries(firsts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 12)
				.map(([label, n]) => ({ label, n }));
			gameI = Math.floor(Math.random() * parsed.length);
			loadState = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			loadState = 'error';
		}
	}

	onMount(load);

	function reroll() {
		if (games.length < 2) return;
		let i = gameI;
		while (i === gameI) i = Math.floor(Math.random() * games.length);
		gameI = i;
	}

	// ── replay ─────────────────────────────────────────────────────────────────
	interface Pos {
		fen: string;
		lastMove: { from: string; to: string } | null;
		checkSquare: string | null;
	}
	const gameUci = $derived((games[gameI] ?? []).map((id) => moves[id - 1] ?? '?'));
	const positions = $derived.by<Pos[]>(() => {
		const chess = new Chess();
		const out: Pos[] = [{ fen: chess.fen(), lastMove: null, checkSquare: null }];
		for (const uci of gameUci) {
			try {
				const mv = chess.move({
					from: uci.slice(0, 2),
					to: uci.slice(2, 4),
					promotion: uci[4] ?? 'q'
				});
				let checkSquare: string | null = null;
				if (chess.inCheck()) {
					const turn = chess.turn();
					outer: for (const row of chess.board()) {
						for (const p of row) {
							if (p && p.type === 'k' && p.color === turn) {
								checkSquare = p.square;
								break outer;
							}
						}
					}
				}
				out.push({ fen: chess.fen(), lastMove: { from: mv.from, to: mv.to }, checkSquare });
			} catch {
				break; // unknown/illegal token: truncate the replay there
			}
		}
		return out;
	});

	let ply = $state(0);
	let playing = $state(false);
	let stripEl: HTMLDivElement | undefined = $state();

	// new game selected → rewind
	$effect(() => {
		void gameI;
		ply = 0;
		playing = false;
	});

	$effect(() => {
		if (!playing) return;
		const t = setInterval(() => {
			if (ply >= positions.length - 1) {
				playing = false;
			} else {
				ply += 1;
			}
		}, 750);
		return () => clearInterval(t);
	});

	// keep the active chip in view while stepping
	$effect(() => {
		void ply;
		const el = stripEl?.querySelector('.chip.active');
		el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	});

	const pos = $derived(positions[Math.min(ply, positions.length - 1)]);

	function fmt(n: number): string {
		return n.toLocaleString('en-US');
	}
	const maxOpenN = $derived(Math.max(...topOpenings.map((o) => o.n), 1));
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-1 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<Castle size={16} strokeWidth={2.5} />
		<span>Rook's diet — six thousand games</span>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		This lab fetches the very files Part 5 trains Rook on, and replays them on a board. Every move
		was chosen uniformly at random among the legal moves.
	</p>

	{#if loadState === 'loading' || loadState === 'idle'}
		<div class="load-row"><Loader2 size={14} class="animate-spin" /> fetching rook-tokens.bin…</div>
	{:else if loadState === 'error'}
		<div class="load-row" style="color: var(--color-caution);">
			couldn't fetch the corpus ({error}) — <button class="retry" onclick={load}>retry</button>
		</div>
	{:else}
		<div class="flex flex-wrap gap-6">
			<div class="min-w-[260px] flex-1 basis-[340px]">
				<div class="mb-2 flex items-baseline justify-between gap-2">
					<span class="panel-label"
						>game #{fmt(gameI + 1)} of {fmt(games.length)} · ply {ply}/{positions.length - 1}</span
					>
					<button class="shuffle-btn" onclick={reroll}><Shuffle size={12} /> another game</button>
				</div>
				<div class="w-full max-w-[380px] overflow-hidden rounded-lg shadow-sm">
					<ChessBoard fen={pos.fen} lastMove={pos.lastMove} checkSquare={pos.checkSquare} />
				</div>
				<div class="mt-2 flex items-center gap-1">
					<button
						class="tp-btn"
						aria-label="to start"
						onclick={() => (ply = 0)}
						disabled={ply === 0}
					>
						<SkipBack size={14} />
					</button>
					<button
						class="tp-btn"
						aria-label="previous move"
						onclick={() => (ply = Math.max(0, ply - 1))}
						disabled={ply === 0}
					>
						<ChevronLeft size={14} />
					</button>
					<button
						class="tp-btn play"
						aria-label={playing ? 'pause' : 'play'}
						onclick={() => (playing = !playing)}
						disabled={positions.length < 2}
					>
						{#if playing}<Pause size={14} />{:else}<Play size={14} />{/if}
					</button>
					<button
						class="tp-btn"
						aria-label="next move"
						onclick={() => (ply = Math.min(positions.length - 1, ply + 1))}
						disabled={ply >= positions.length - 1}
					>
						<ChevronRight size={14} />
					</button>
					<button
						class="tp-btn"
						aria-label="to end"
						onclick={() => (ply = positions.length - 1)}
						disabled={ply >= positions.length - 1}
					>
						<SkipForward size={14} />
					</button>
				</div>
				<div
					bind:this={stripEl}
					class="mt-2 max-h-24 overflow-y-auto rounded-lg border p-2"
					style="border-color: var(--color-border-light);"
				>
					<div class="flex flex-wrap gap-1">
						<button class="chip game-chip" class:active={ply === 0} onclick={() => (ply = 0)}
							>&lt;game&gt;</button
						>
						{#each gameUci as uci, i (i)}
							<button
								class="chip"
								class:black-move={i % 2 === 1}
								class:active={ply === i + 1}
								title="ply {i + 1} — {i % 2 === 0 ? 'White' : 'Black'}"
								onclick={() => (ply = i + 1)}>{uci}</button
							>
						{/each}
					</div>
				</div>
				<p class="mt-2 text-[11px]" style="color: var(--color-text-muted);">
					Light chips are White's moves, dark are Black's; click any chip to jump there. Legal,
					aimless, and exactly what Rook studies — this sequence is also precisely the token stream
					the model sees: <span class="mono">&lt;game&gt;</span> then one token per move.
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
						<span class="stat-n">{(bytes / 1e6).toFixed(1)} MB</span><span class="stat-l"
							>fetched</span
						>
					</div>
				</div>
				<div class="panel-label mb-1.5">top-12 opening moves</div>
				{#each topOpenings as o (o.label)}
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
			Fetched {fmt(bytes)} bytes of <span class="mono">rook-tokens.bin</span> + vocab — the same files
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
		border-color: var(--color-tip);
	}
	.tp-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 26px;
		border: 1px solid var(--color-border);
		border-radius: 0.4rem;
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}
	.tp-btn:hover:not(:disabled) {
		border-color: var(--color-important);
		color: var(--color-text);
	}
	.tp-btn.play {
		background: color-mix(in srgb, var(--color-important) 12%, transparent);
		border-color: color-mix(in srgb, var(--color-important) 40%, var(--color-border));
		color: var(--color-text);
	}
	.tp-btn:disabled {
		opacity: 0.35;
		cursor: default;
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
		border: none;
		border-radius: 0.3rem;
		padding: 0.1rem 0.3rem;
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-text) 4%, transparent);
		cursor: pointer;
	}
	.chip.black-move {
		background: color-mix(in srgb, var(--color-text) 13%, transparent);
	}
	.chip.active {
		outline: 2px solid var(--color-important);
		outline-offset: 1px;
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
