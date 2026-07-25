<script lang="ts">
	// Stockfish judges Rook. Step (or auto-play) through a recorded flagship-Rook
	// game while a real engine — single-threaded Stockfish 10 WASM, running live in
	// your browser — evaluates every position. The eval bar and curve swing as Rook
	// plays; Stockfish's preferred move sits beside Rook's actual one. Legality was
	// the last eval's story; this one is STRENGTH — and by a real engine's reckoning
	// Rook plays legal, plausible-looking moves while quietly losing ground.
	// Stockfish is pure WASM, so this runs for everyone (no WebGPU needed).
	import { onMount, onDestroy } from 'svelte';
	import { base } from '$app/paths';
	import { Chess } from 'chess.js';
	import { Swords, Loader2, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-svelte';
	import ChessBoard from '../chess/ChessBoard.svelte';
	import { Stockfish, type Analysis } from '../../chess/stockfish';

	interface Game {
		moves: string[];
		result: string;
		reason: string;
		plies: number;
	}
	interface Data {
		model: string;
		games: Game[];
	}

	const DEPTH = 11;
	let data = $state<Data | null>(null);
	let error = $state('');
	let gi = $state(0);
	let ply = $state(0); // number of moves played into the game
	let evals = $state<
		Record<number, { cpWhite: number | null; mate: number | null; best: string | null }>
	>({});
	let analyzing = $state(false);
	let autoplay = $state(false);

	let sf: Stockfish | null = null;
	let sfReady = $state(false);

	onMount(async () => {
		try {
			const res = await fetch(`${base}/data/rook-games.json`);
			if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
			data = (await res.json()) as Data;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			return;
		}
		try {
			sf = new Stockfish(base);
			await sf.analyse('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 4); // warm up
			sfReady = true;
			evalPly(0);
		} catch (e) {
			error = 'Stockfish failed to load: ' + (e instanceof Error ? e.message : String(e));
		}
	});
	onDestroy(() => sf?.dispose());

	const game = $derived(data?.games[gi]);
	const moves = $derived(game?.moves ?? []);
	const gameIdx = $derived((data?.games ?? []).map((_, i) => i));

	// board fen after `ply` moves, plus whose turn + the move Rook plays next
	const view = $derived.by(() => {
		const c = new Chess();
		for (let i = 0; i < ply && i < moves.length; i++) {
			try {
				c.move({
					from: moves[i].slice(0, 2),
					to: moves[i].slice(2, 4),
					promotion: moves[i].slice(4) || undefined
				});
			} catch {
				break;
			}
		}
		return { fen: c.fen(), turn: c.turn(), rookMove: moves[ply] ?? null };
	});
	const cur = $derived(evals[ply]);

	function uciArrow(uci: string, tone: 'good' | 'bad' | 'accent') {
		return { from: uci.slice(0, 2), to: uci.slice(2, 4), tone };
	}
	const arrows = $derived.by(() => {
		const a: Array<{ from: string; to: string; tone: 'good' | 'bad' | 'accent' }> = [];
		if (view.rookMove) a.push(uciArrow(view.rookMove, 'accent')); // Rook's actual move
		if (cur?.best && cur.best !== view.rookMove) a.push(uciArrow(cur.best, 'good')); // Stockfish's pick
		return a;
	});

	async function evalPly(p: number) {
		if (!sf || !data || evals[p] !== undefined) return;
		const c = new Chess();
		for (let i = 0; i < p && i < moves.length; i++) {
			try {
				c.move({
					from: moves[i].slice(0, 2),
					to: moves[i].slice(2, 4),
					promotion: moves[i].slice(4) || undefined
				});
			} catch {
				break;
			}
		}
		let a: Analysis;
		try {
			a = await sf.analyse(c.fen(), DEPTH);
		} catch {
			return;
		}
		const white = c.turn() === 'w';
		const cpWhite = a.scoreCp == null ? null : white ? a.scoreCp : -a.scoreCp;
		const mate = a.mate == null ? null : white ? a.mate : -a.mate;
		evals = { ...evals, [p]: { cpWhite, mate, best: a.bestMove } };
	}

	async function step(delta: number) {
		const np = Math.max(0, Math.min(moves.length, ply + delta));
		ply = np;
		await evalPly(np);
	}

	async function analyzeGame() {
		if (analyzing || !sf) return;
		analyzing = true;
		for (let p = 0; p <= moves.length; p++) await evalPly(p);
		analyzing = false;
	}

	async function toggleAuto() {
		if (autoplay) {
			autoplay = false;
			return;
		}
		autoplay = true;
		while (autoplay && ply < moves.length) {
			await step(1);
			await new Promise((r) => setTimeout(r, 350));
		}
		autoplay = false;
	}

	function selectGame(i: number) {
		autoplay = false;
		gi = i;
		ply = 0;
		evals = {};
		evalPly(0);
	}

	// ── agreement: how often Rook's move is Stockfish's top pick (over evaluated plies) ──
	const agree = $derived.by(() => {
		let match = 0,
			total = 0;
		for (let p = 0; p < moves.length; p++) {
			const e = evals[p];
			if (e?.best) {
				total++;
				if (e.best === moves[p]) match++;
			}
		}
		return { match, total, rate: total ? match / total : 0 };
	});

	// ── eval bar / curve helpers ─────────────────────────────────────────────────
	const CLAMP = 800;
	function frac(cp: number | null, mate: number | null): number {
		if (mate != null) return mate > 0 ? 1 : 0;
		if (cp == null) return 0.5;
		return Math.max(0, Math.min(1, 0.5 + cp / (2 * CLAMP)));
	}
	function evalLabel(e?: { cpWhite: number | null; mate: number | null }): string {
		if (!e) return '…';
		if (e.mate != null) return `M${Math.abs(e.mate)}`;
		if (e.cpWhite == null) return '—';
		const p = e.cpWhite / 100;
		return (p >= 0 ? '+' : '') + p.toFixed(1);
	}
	// curve
	const CW = 700;
	const CH = 120;
	const CP = { l: 6, r: 6, t: 8, b: 8 };
	function cx(p: number): number {
		return CP.l + (moves.length ? p / moves.length : 0) * (CW - CP.l - CP.r);
	}
	function cy(f: number): number {
		return CP.t + (1 - f) * (CH - CP.t - CP.b);
	}
	const curvePath = $derived.by(() => {
		const pts: string[] = [];
		for (let p = 0; p <= moves.length; p++) {
			const e = evals[p];
			if (!e) break;
			pts.push(
				`${pts.length === 0 ? 'M' : 'L'}${cx(p).toFixed(1)},${cy(frac(e.cpWhite, e.mate)).toFixed(1)}`
			);
		}
		return pts.join(' ');
	});
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-1 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<Swords size={16} strokeWidth={2.5} />
		<span>Stockfish judges Rook — live</span>
	</div>
	<p class="mb-3 text-xs" style="color: var(--color-text-muted);">
		A real engine — Stockfish, running in your browser as WASM — evaluates every position of a
		recorded flagship-Rook game. Watch the bar swing: Rook plays legal, plausible moves, but the
		engine's eye shows it quietly losing the thread.
	</p>

	{#if error}
		<p class="text-sm" style="color: var(--color-challenge);">{error}</p>
	{:else if !data}
		<div class="flex items-center gap-2 py-8 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> loading…
		</div>
	{:else}
		<!-- game selector -->
		<div class="mb-3 flex flex-wrap items-center gap-2">
			<span class="text-[11px]" style="color: var(--color-text-muted);">game</span>
			{#each gameIdx as i (i)}
				<button
					class="rounded px-2 py-0.5 text-[11.5px] font-medium transition-colors"
					style={i === gi
						? 'background: var(--color-important); color: var(--color-bg);'
						: 'background: var(--color-bg-secondary); color: var(--color-text-muted);'}
					onclick={() => selectGame(i)}>{i + 1}</button
				>
			{/each}
			{#if !sfReady}
				<span
					class="ml-1 flex items-center gap-1 text-[11px]"
					style="color: var(--color-text-muted);"
				>
					<Loader2 size={12} class="animate-spin" /> loading Stockfish…
				</span>
			{/if}
		</div>

		<div class="flex flex-col gap-4 sm:flex-row">
			<!-- board + eval bar -->
			<div class="flex gap-2">
				<div class="w-[260px] max-w-full">
					<ChessBoard fen={view.fen} {arrows} orientation="white" coordinates={false} />
				</div>
				<!-- eval bar (white = up) -->
				<div class="flex w-5 flex-col items-center">
					<div
						class="relative w-4 flex-1 overflow-hidden rounded"
						style="background: #3b3b46; border: 1px solid var(--color-border);"
					>
						<div
							class="absolute right-0 bottom-0 left-0 transition-[height] duration-200"
							style="height: {frac(cur?.cpWhite ?? null, cur?.mate ?? null) *
								100}%; background: #e9e9ef;"
						></div>
					</div>
					<span class="mt-1 font-mono text-[10px]" style="color: var(--color-text-muted);"
						>{evalLabel(cur)}</span
					>
				</div>
			</div>

			<!-- controls + verdict -->
			<div class="min-w-0 flex-1">
				<div class="mb-2 flex items-center gap-2">
					<button
						class="rounded p-1 hover:bg-[var(--color-bg-secondary)] disabled:opacity-40"
						aria-label="back"
						disabled={ply === 0}
						onclick={() => step(-1)}
					>
						<ChevronLeft size={16} />
					</button>
					<button
						class="flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-semibold"
						style="background: color-mix(in srgb, var(--color-important) 15%, transparent); color: var(--color-important);"
						disabled={!sfReady}
						onclick={toggleAuto}
					>
						{#if autoplay}<Pause size={13} />{:else}<Play size={13} />{/if}
						{autoplay ? 'pause' : 'play'}
					</button>
					<button
						class="rounded p-1 hover:bg-[var(--color-bg-secondary)] disabled:opacity-40"
						aria-label="forward"
						disabled={ply >= moves.length}
						onclick={() => step(1)}
					>
						<ChevronRight size={16} />
					</button>
					<span class="ml-1 font-mono text-[11px]" style="color: var(--color-text-muted);"
						>move {Math.ceil(ply / 2)} · ply {ply}/{moves.length}</span
					>
				</div>

				<div class="rounded-md p-2 text-[12.5px]" style="background: var(--color-bg-secondary);">
					{#if view.rookMove}
						<div>
							Rook plays <span
								class="font-mono font-semibold"
								style="color: var(--color-important);">{view.rookMove}</span
							>
						</div>
						{#if cur?.best}
							<div style="color: var(--color-text-secondary);">
								Stockfish prefers
								<span class="font-mono font-semibold" style="color: var(--color-tip);"
									>{cur.best}</span
								>
								{#if cur.best === view.rookMove}<span style="color: var(--color-tip);">
										— agreed ✓</span
									>{/if}
							</div>
						{/if}
					{:else}
						<div style="color: var(--color-text-muted);">
							end of game ({game?.result}, {game?.reason})
						</div>
					{/if}
				</div>

				<!-- eval curve -->
				<svg
					viewBox="0 0 {CW} {CH}"
					class="mt-3 w-full"
					role="img"
					aria-label="Stockfish evaluation over the game"
				>
					<rect
						x={CP.l}
						y={CP.t}
						width={CW - CP.l - CP.r}
						height={(CH - CP.t - CP.b) / 2}
						fill="#e9e9ef"
						opacity="0.06"
					/>
					<line
						x1={CP.l}
						y1={cy(0.5)}
						x2={CW - CP.r}
						y2={cy(0.5)}
						stroke="var(--color-text-muted)"
						stroke-width="1"
						opacity="0.4"
					/>
					<path
						d={curvePath}
						fill="none"
						stroke="var(--color-important)"
						stroke-width="2"
						stroke-linejoin="round"
					/>
					<line
						x1={cx(ply)}
						y1={CP.t}
						x2={cx(ply)}
						y2={CH - CP.b}
						stroke="var(--color-text)"
						stroke-width="1"
						opacity="0.5"
					/>
					<text x={CP.l + 2} y={CP.t + 9} font-size="9" fill="var(--color-text-muted)"
						>white better ↑</text
					>
					<text x={CP.l + 2} y={CH - CP.b - 3} font-size="9" fill="var(--color-text-muted)"
						>black better ↓</text
					>
				</svg>

				<div class="mt-2 flex items-center justify-between">
					<button
						class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold disabled:opacity-50"
						style="background: var(--color-bg-secondary); color: var(--color-text-secondary);"
						disabled={analyzing || !sfReady}
						onclick={analyzeGame}
					>
						{#if analyzing}<Loader2 size={12} class="animate-spin" />{/if}
						analyze whole game
					</button>
					{#if agree.total > 4}
						<span class="text-[11.5px]" style="color: var(--color-text-secondary);">
							Rook = Stockfish's top move
							<strong style="color: var(--color-important);"
								>{(agree.rate * 100).toFixed(0)}%</strong
							>
							of the time ({agree.match}/{agree.total})
						</span>
					{/if}
				</div>
			</div>
		</div>

		<p class="mt-3 text-[11.5px] leading-relaxed" style="color: var(--color-text-muted);">
			Measured on our {data.model}, judged live by Stockfish 10 (WASM, single-threaded — no server,
			no GPU). This is the honest ceiling of a coffee-break model: it has clearly learned the
			<em>shape</em> of chess — legal moves, developing pieces, plausible captures — but against a real
			engine it agrees with the best move only sometimes and drifts into lost positions. Strength is the
			eval that "loss went down" can't give you. The same Stockfish becomes a reward signal in Act III.
		</p>
	{/if}
</div>
