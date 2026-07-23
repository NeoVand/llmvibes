<script lang="ts">
	// Play chess against the Rook you just trained. The pedagogical core is the
	// side panel: Rook's RAW next-move distribution (illegal moves and all) next
	// to the legal-move mask that makes it playable. Legality masking at
	// sampling time vs legality *learned* in the weights — the gap between the
	// two IS the legal-probability-mass gauge.
	import { onDestroy } from 'svelte';
	import { Play, RotateCcw, Loader2, Swords } from 'lucide-svelte';
	import { Chess } from 'chess.js';
	import { detectCapability, type ModelConfig } from '$lib/llm/engine';
	import { WorkerEngine } from '$lib/llm/worker-engine';
	import ChessBoard from '$lib/components/chess/ChessBoard.svelte';
	import { base } from '$app/paths';

	let { trainSteps = 300 }: { trainSteps?: number } = $props();

	type Phase =
		'idle' | 'loading' | 'training' | 'ready' | 'thinking' | 'over' | 'error' | 'no-webgpu';
	let phase = $state<Phase>('idle');
	let error = $state('');
	let trainProgress = $state(0);
	let engine: WorkerEngine | null = null;
	let moves: string[] = [];
	let idOf = new Map<string, number>();

	let chess = new Chess();
	let fen = $state(chess.fen());
	let lastMove = $state<{ from: string; to: string } | null>(null);
	let historyIds = $state<number[]>([0]);
	let historyUci = $state<string[]>([]);
	let outcome = $state('');
	let legalMass = $state<number | null>(null);
	let topRaw = $state<Array<{ uci: string; p: number; legal: boolean }>>([]);

	const config: Omit<ModelConfig, 'bird' | 'vocab'> = {
		nLayer: 4,
		nEmbd: 128,
		nHead: 4,
		blockSize: 128
	};

	async function setup() {
		phase = 'loading';
		error = '';
		try {
			if ((await detectCapability()) !== 'webgpu') {
				phase = 'no-webgpu';
				return;
			}
			const [binRes, vocabRes] = await Promise.all([
				fetch(`${base}/data/rook-tokens.bin`),
				fetch(`${base}/data/rook-vocab.json`)
			]);
			if (!binRes.ok || !vocabRes.ok) throw new Error('corpus download failed');
			const tokenData = new Uint16Array(await binRes.arrayBuffer());
			const vocab = (await vocabRes.json()) as { moves: string[]; vocabSize: number };
			moves = vocab.moves;
			idOf = new Map(moves.map((m, i) => [m, i + 1]));
			engine = new WorkerEngine({
				tokenData,
				decode: (ids) => ids.map((i) => (i === 0 ? '·' : moves[i - 1])).join(' '),
				decodeOne: (id) => (id === 0 ? '·' : (moves[id - 1] ?? '?')),
				seed: 7
			});
			await engine.init({ bird: 'rook', vocab: vocab.vocabSize, ...config });
			phase = 'training';
			trainProgress = 0;
			await engine.train(trainSteps, (m) => {
				trainProgress = Math.round((100 * (m.step ?? 0)) / trainSteps);
			});
			newGame();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	function newGame() {
		chess = new Chess();
		fen = chess.fen();
		lastMove = null;
		historyIds = [0];
		historyUci = [];
		outcome = '';
		legalMass = null;
		topRaw = [];
		phase = 'ready';
	}

	function endIfOver(): boolean {
		if (!chess.isGameOver()) return false;
		outcome = chess.isCheckmate()
			? chess.turn() === 'b'
				? 'Checkmate — you win!'
				: 'Checkmate — Rook wins!'
			: chess.isStalemate()
				? 'Stalemate.'
				: 'Draw.';
		phase = 'over';
		return true;
	}

	function userMove(from: string, to: string) {
		if (phase !== 'ready') return;
		const move = chess.move({ from, to, promotion: 'q' });
		fen = chess.fen();
		lastMove = { from: move.from, to: move.to };
		pushMove(move.from + move.to + (move.promotion ?? ''));
		if (!endIfOver()) rookMove();
	}

	// board-facing derivations (chess.js isn't reactive; key off fen)
	const legalMoves = $derived.by(() => {
		void fen;
		return chess.moves({ verbose: true }).map((m) => ({ from: m.from, to: m.to }));
	});
	const checkSquare = $derived.by(() => {
		void fen;
		if (!chess.inCheck()) return null;
		const turn = chess.turn();
		for (const row of chess.board()) {
			for (const p of row) {
				if (p && p.type === 'k' && p.color === turn) return p.square;
			}
		}
		return null;
	});

	function pushMove(uci: string) {
		historyUci = [...historyUci, uci];
		const id = idOf.get(uci);
		// A legal move can be absent from the vocab (never seen in 6k games);
		// skip it in the model's context rather than crash — and say so.
		if (id !== undefined) historyIds = [...historyIds, id];
	}

	async function rookMove() {
		if (!engine) return;
		phase = 'thinking';
		try {
			const row = await engine.nextDistribution(historyIds);
			const legal = chess.moves({ verbose: true });
			const legalIds = legal.map((m) => ({
				uci: m.from + m.to + (m.promotion ?? ''),
				id: idOf.get(m.from + m.to + (m.promotion ?? ''))
			}));
			// probabilities from logprobs
			const probs = new Float64Array(row.length);
			let total = 0;
			for (let i = 0; i < row.length; i++) {
				probs[i] = Math.exp(row[i]);
				total += probs[i];
			}
			// raw top-5 for the panel
			const order = Array.from(probs.keys()).sort((a, b) => probs[b] - probs[a]);
			const legalSet = new Set(legalIds.filter((l) => l.id !== undefined).map((l) => l.id));
			topRaw = order.slice(0, 5).map((i) => ({
				uci: i === 0 ? '·(new game)' : moves[i - 1],
				p: probs[i] / total,
				legal: legalSet.has(i)
			}));
			// legal mass + masked sampling
			let mass = 0;
			const cands: Array<{ uci: string; p: number }> = [];
			for (const l of legalIds) {
				const p = l.id !== undefined ? probs[l.id] / total : 0;
				mass += p;
				cands.push({ uci: l.uci, p });
			}
			legalMass = mass;
			let pick: string;
			if (mass > 1e-9) {
				let r = Math.random() * mass;
				pick = cands[cands.length - 1].uci;
				for (const c of cands) {
					r -= c.p;
					if (r <= 0) {
						pick = c.uci;
						break;
					}
				}
			} else {
				pick = cands[Math.floor(Math.random() * cands.length)].uci;
			}
			const move = chess.move({
				from: pick.slice(0, 2),
				to: pick.slice(2, 4),
				promotion: pick[4] ?? 'q'
			});
			fen = chess.fen();
			lastMove = { from: move.from, to: move.to };
			pushMove(pick);
			if (!endIfOver()) phase = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	onDestroy(() => {
		engine?.dispose();
	});
</script>

<div
	class="lab my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<Swords size={16} strokeWidth={2.5} />
		<span>Play your Rook</span>
	</div>

	{#if phase === 'idle'}
		<button class="lab-btn" onclick={setup}>
			<Play size={14} /> Hatch a Rook & train it ({trainSteps} steps, ~30s)
		</button>
		<p class="mt-2 text-xs" style="color: var(--color-text-muted);">
			Trains a fresh Rook right here, then you play it — White moves first (that's you).
		</p>
	{:else if phase === 'loading'}
		<div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> Preparing the board…
		</div>
	{:else if phase === 'training'}
		<div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> Rook is studying its 6,000 games… {trainProgress}%
		</div>
	{:else if phase === 'no-webgpu'}
		<p class="text-sm" style="color: var(--color-text-secondary);">
			The chess lab needs WebGPU (current Chrome or Edge). The rest of the chapter reads fine
			without it.
		</p>
	{:else if phase === 'error'}
		<p class="text-sm" style="color: var(--color-challenge);">Lab error: {error}</p>
		<button class="lab-btn mt-2" onclick={setup}>Retry</button>
	{:else}
		<div class="flex flex-wrap gap-5">
			<div class="min-w-[260px] flex-1">
				<div class="w-full max-w-[380px] overflow-hidden rounded-lg shadow-sm">
					<ChessBoard
						{fen}
						interactive={phase === 'ready'}
						moveableColor="w"
						{legalMoves}
						{lastMove}
						{checkSquare}
						onmove={userMove}
					/>
				</div>
				<div class="mt-2 flex items-center gap-2">
					<button class="lab-btn" onclick={newGame}><RotateCcw size={13} /> New game</button>
					{#if phase === 'thinking'}
						<span class="flex items-center gap-1 text-xs" style="color: var(--color-text-muted);">
							<Loader2 size={12} class="animate-spin" /> Rook is thinking…
						</span>
					{:else if phase === 'over'}
						<span class="text-xs font-semibold" style="color: var(--color-important);"
							>{outcome}</span
						>
					{/if}
				</div>
			</div>

			<div class="min-w-[220px] flex-1">
				{#if legalMass !== null}
					<div class="mb-1 text-xs" style="color: var(--color-text-muted);">
						probability Rook put on <em>legal</em> moves (before masking)
					</div>
					<div class="mb-3 flex items-center gap-2">
						<div
							class="h-2 flex-1 overflow-hidden rounded-full"
							style="background: var(--color-surface-hover);"
						>
							<div
								class="h-full rounded-full"
								style="width: {(legalMass * 100).toFixed(
									0
								)}%; background: var(--color-important); transition: width 400ms ease;"
							></div>
						</div>
						<span class="text-xs font-semibold" style="color: var(--color-text);">
							{(legalMass * 100).toFixed(0)}%
						</span>
					</div>
				{/if}
				{#if topRaw.length > 0}
					<div class="mb-1 text-xs" style="color: var(--color-text-muted);">
						Rook's raw top-5 for this position
					</div>
					<div class="space-y-1">
						{#each topRaw as t (t.uci)}
							<div class="flex items-center gap-2 text-xs" style="font-family: var(--font-mono);">
								<span class="w-16" style="color: var(--color-text);">{t.uci}</span>
								<div
									class="h-1.5 flex-1 overflow-hidden rounded-full"
									style="background: var(--color-surface-hover);"
								>
									<div
										class="h-full rounded-full"
										style="width: {Math.min(t.p * 300, 100).toFixed(0)}%; background: {t.legal
											? 'var(--color-tip)'
											: 'var(--color-challenge)'};"
									></div>
								</div>
								<span style="color: var(--color-text-muted); min-width: 3.5ch;"
									>{(t.p * 100).toFixed(1)}%</span
								>
								{#if !t.legal}<span style="color: var(--color-challenge);">illegal</span>{/if}
							</div>
						{/each}
					</div>
					<p class="mt-2 text-[11px] leading-relaxed" style="color: var(--color-text-muted);">
						Red bars are moves Rook wanted that the rules forbid <em>in this position</em> — mass it has
						not yet learned to withhold. The gauge above is the honest score; the mask is what makes it
						playable anyway.
					</p>
				{/if}
				{#if historyUci.length > 0}
					<div
						class="mt-3 text-[11px]"
						style="color: var(--color-text-muted); font-family: var(--font-mono); word-break: break-all;"
					>
						{historyUci.join(' ')}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.lab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 0.35rem 0.9rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text);
		background: var(--color-surface-hover);
		cursor: pointer;
		transition: border-color 120ms ease;
	}
	.lab-btn:hover {
		border-color: var(--color-important);
	}
</style>
