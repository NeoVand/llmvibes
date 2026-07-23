<script lang="ts">
	// Look INSIDE the transformer you just trained: real attention patterns,
	// straight off your GPU — softmax(QKᵀ/√d + M) rows captured by the worker's
	// 'attention' op, not an illustration. Quill mode draws the token×token
	// grid; Rook mode draws the same rows as arrows on a real board (each past
	// MOVE is a token, so attention over tokens IS attention over moves).
	import { onDestroy } from 'svelte';
	import { Play, Loader2, ScanEye } from 'lucide-svelte';
	import { detectCapability, type ModelConfig } from '$lib/llm/engine';
	import { WorkerEngine } from '$lib/llm/worker-engine';
	import { BpeTokenizer, type BpeVocab } from '$lib/llm/bpe';
	import { base } from '$app/paths';
	import ChessBoard from '$lib/components/chess/ChessBoard.svelte';

	let {
		bird = 'quill',
		trainSteps = 300
	}: {
		bird?: 'quill' | 'rook';
		trainSteps?: number;
	} = $props();

	const config: Omit<ModelConfig, 'bird' | 'vocab'> = {
		nLayer: 4,
		nEmbd: 128,
		nHead: 4,
		blockSize: 128
	};

	type Phase = 'idle' | 'loading' | 'training' | 'ready' | 'busy' | 'error' | 'no-webgpu';
	let phase = $state<Phase>('idle');
	let error = $state('');
	let trainProgress = $state(0);
	let engine: WorkerEngine | null = null;
	let quillTok: BpeTokenizer | null = null;
	let rookMoves: string[] = [];
	let idOf: Record<string, number> = {};

	// a short real opening so Rook's attention has structure to find
	const ROOK_LINE = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'c2c3'];

	let promptText = $state('Once upon a time , the little bird sang a song');
	let tokens = $state<Array<{ id: number; label: string }>>([]);
	let attn = $state<{ layers: Float32Array[]; nHead: number; blockSize: number } | null>(null);
	let layer = $state(0);
	let head = $state(0);
	let hover = $state<{ q: number; k: number } | null>(null);

	async function setup() {
		phase = 'loading';
		error = '';
		try {
			if ((await detectCapability()) !== 'webgpu') {
				phase = 'no-webgpu';
				return;
			}
			const [binRes, vocabRes] = await Promise.all([
				fetch(`${base}/data/${bird}-tokens.bin`),
				fetch(`${base}/data/${bird}-vocab.json`)
			]);
			if (!binRes.ok || !vocabRes.ok) throw new Error('corpus download failed');
			const tokenData = new Uint16Array(await binRes.arrayBuffer());
			let vocabSize: number;
			let decode: (ids: number[]) => string;
			let decodeOne: (id: number) => string;
			if (bird === 'quill') {
				const vocab = (await vocabRes.json()) as BpeVocab;
				quillTok = new BpeTokenizer(vocab);
				vocabSize = vocab.vocabSize;
				decode = (ids) => quillTok!.decode(ids);
				decodeOne = (id) => quillTok!.decodeOne(id);
			} else {
				const vocab = (await vocabRes.json()) as { moves: string[]; vocabSize: number };
				rookMoves = vocab.moves;
				vocabSize = vocab.vocabSize;
				idOf = Object.fromEntries(rookMoves.map((m, i) => [m, i + 1]));
				decode = (ids) => ids.map((i) => (i === 0 ? '·' : rookMoves[i - 1])).join(' ');
				decodeOne = (id) => (id === 0 ? '·' : (rookMoves[id - 1] ?? '?'));
			}
			engine = new WorkerEngine({ tokenData, decode, decodeOne, seed: 11 });
			await engine.init({ bird, vocab: vocabSize, ...config });
			phase = 'training';
			trainProgress = 0;
			await engine.train(trainSteps, (m) => {
				trainProgress = Math.round((100 * (m.step ?? 0)) / trainSteps);
			});
			phase = 'ready';
			await look();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	function currentIds(): Array<{ id: number; label: string }> {
		if (bird === 'quill') {
			const ids = quillTok!.encode(promptText || 'Once upon a time').slice(0, 18);
			return ids.map((id) => ({
				id,
				label: quillTok!.decodeOne(id).replaceAll('␣', ' ').replaceAll('⏎', '↵')
			}));
		}
		const seq = [{ id: 0, label: '<game>' }];
		for (const uci of ROOK_LINE) {
			const id = idOf[uci];
			if (id !== undefined) seq.push({ id, label: uci });
		}
		return seq;
	}

	/** Fetch real attention for the current prompt. */
	async function look() {
		if (!engine || phase === 'busy') return;
		phase = 'busy';
		try {
			const seq = currentIds();
			const r = await engine.attention(seq.map((t) => t.id));
			tokens = seq;
			attn = r;
			phase = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	/** attention weight: query position i → key position j, current layer/head */
	function w(i: number, j: number): number {
		if (!attn) return 0;
		const S = attn.blockSize;
		return attn.layers[layer][(head * S + i) * S + j];
	}

	const N = $derived(tokens.length);
	// grid geometry (big viewBox units)
	const CELL = 34;
	const LGUT = 120;
	const TGUT = 96;
	const gridW = $derived(LGUT + N * CELL + 8);
	const gridH = $derived(TGUT + N * CELL + 8);

	function cellColor(v: number): string {
		// plum ramp, perceptually lifted so small-but-real weights stay visible
		const a = Math.pow(Math.min(v, 1), 0.6);
		return `rgb(176 106 130 / ${(a * 0.92).toFixed(3)})`;
	}

	// Rook: arrows for the last query row — where does the model look while
	// deciding its NEXT move?
	const rookArrows = $derived.by(() => {
		if (bird !== 'rook' || !attn || N === 0) return [];
		const q = N - 1;
		const rows: Array<{ j: number; v: number }> = [];
		for (let j = 1; j <= q; j++) rows.push({ j, v: w(q, j) }); // skip <game> (no squares)
		rows.sort((a, b) => b.v - a.v);
		const top = rows.slice(0, 3).filter((r) => r.v > 0.01);
		const maxV = top[0]?.v ?? 1;
		return top.map((r, rank) => {
			const uci = tokens[r.j].label;
			return {
				from: uci.slice(0, 2),
				to: uci.slice(2, 4),
				tone: (rank === 0 ? 'accent' : 'good') as 'accent' | 'good',
				weight: r.v / maxV
			};
		});
	});
	const rookFen = $derived.by(() => {
		if (bird !== 'rook') return '';
		// board after the fixed line (positions replayed lazily client-side)
		return ROOK_FENS[ROOK_FENS.length - 1];
	});
	// precomputed: start + after each move of ROOK_LINE (avoids a chess.js dep here)
	const ROOK_FENS = [
		'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
		'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
		'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
		'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
		'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
		'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
		'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
		'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4',
		'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
		'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R b KQkq - 0 5'
	];

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
		<ScanEye size={16} strokeWidth={2.5} />
		<span>{bird === 'quill' ? "Quill's attention, live" : "Rook's attention, on the board"}</span>
	</div>

	{#if phase === 'idle'}
		<button class="lab-btn" onclick={setup}>
			<Play size={14} /> Hatch a {bird === 'quill' ? 'Quill' : 'Rook'} & look inside ({trainSteps} steps,
			~30s)
		</button>
		<p class="mt-2 text-xs" style="color: var(--color-text-muted);">
			Trains a fresh model right here, then shows you its actual attention patterns — the real
			softmax(QKᵀ/√d) rows, read back from your GPU.
		</p>
	{:else if phase === 'loading'}
		<div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> Preparing corpus and fresh weights…
		</div>
	{:else if phase === 'training'}
		<div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> Training so there's something to see… {trainProgress}%
		</div>
	{:else if phase === 'no-webgpu'}
		<p class="text-sm" style="color: var(--color-text-secondary);">
			This lab needs WebGPU (current Chrome or Edge). The rest of the chapter reads fine without it.
		</p>
	{:else if phase === 'error'}
		<p class="text-sm" style="color: var(--color-challenge);">Lab error: {error}</p>
		<button class="lab-btn mt-2" onclick={setup}>Retry</button>
	{:else}
		<div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
			{#if bird === 'quill'}
				<input
					class="prompt-input min-w-[240px] flex-1"
					type="text"
					bind:value={promptText}
					onkeydown={(e) => e.key === 'Enter' && look()}
					aria-label="prompt to inspect"
				/>
				<button class="lab-btn" disabled={phase === 'busy'} onclick={look}>
					{#if phase === 'busy'}<Loader2 size={14} class="animate-spin" />{:else}<ScanEye
							size={14}
						/>{/if}
					Look
				</button>
			{/if}
			<div class="flex items-center gap-1">
				<span class="sel-label">layer</span>
				{#each Array.from({ length: config.nLayer }, (_, i) => i) as li (li)}
					<button class="sel-btn" class:active={layer === li} onclick={() => (layer = li)}
						>{li + 1}</button
					>
				{/each}
			</div>
			<div class="flex items-center gap-1">
				<span class="sel-label">head</span>
				{#each Array.from({ length: config.nHead }, (_, i) => i) as h (h)}
					<button class="sel-btn" class:active={head === h} onclick={() => (head = h)}
						>{h + 1}</button
					>
				{/each}
			</div>
		</div>

		{#if attn && N > 0}
			{#if bird === 'quill'}
				<div class="overflow-x-auto">
					<svg
						viewBox="0 0 {gridW} {gridH}"
						style="width: {gridW * 0.9}px; max-width: 100%;"
						role="img"
						aria-label="attention weights from each token (rows) to each earlier token (columns)"
					>
						<!-- column labels (keys), vertical -->
						{#each tokens as t, j (j)}
							<text
								x={LGUT + j * CELL + CELL / 2 + 4}
								y={TGUT - 8}
								transform="rotate(-55 {LGUT + j * CELL + CELL / 2 + 4} {TGUT - 8})"
								class="tok-label"
								class:hl={hover !== null && hover.k === j}
								text-anchor="start">{t.label}</text
							>
						{/each}
						<!-- row labels (queries) -->
						{#each tokens as t, i (i)}
							<text
								x={LGUT - 8}
								y={TGUT + i * CELL + CELL / 2 + 4}
								class="tok-label"
								class:hl={hover !== null && hover.q === i}
								text-anchor="end">{t.label}</text
							>
						{/each}
						<!-- cells: lower triangle only (causal) -->
						{#each tokens, i (i)}
							{#each tokens, j (j)}
								{#if j <= i}
									<rect
										x={LGUT + j * CELL + 1.5}
										y={TGUT + i * CELL + 1.5}
										width={CELL - 3}
										height={CELL - 3}
										rx="4"
										fill={cellColor(w(i, j))}
										stroke={hover?.q === i && hover?.k === j
											? 'var(--color-text)'
											: 'var(--color-border-light)'}
										stroke-width={hover?.q === i && hover?.k === j ? 2 : 0.6}
										role="presentation"
										onmouseenter={() => (hover = { q: i, k: j })}
										onmouseleave={() => (hover = null)}
									>
										<title>{tokens[i].label} ← {tokens[j].label}: {w(i, j).toFixed(3)}</title>
									</rect>
								{/if}
							{/each}
						{/each}
					</svg>
				</div>
				{#if hover}
					<p class="mt-1 text-xs" style="font-family: var(--font-mono); color: var(--color-text);">
						while reading “{tokens[hover.q].label}”, this head puts {(
							w(hover.q, hover.k) * 100
						).toFixed(1)}% of its attention on “{tokens[hover.k].label}”
					</p>
				{:else}
					<p class="mt-1 text-xs" style="color: var(--color-text-muted);">
						rows = the token being processed; columns = who it listens to (hover any cell). Rows
						always sum to 1 — attention is a budget.
					</p>
				{/if}
				<p class="mt-2 text-[11.5px]" style="color: var(--color-text-muted);">
					Things to hunt for across layers and heads: a bright first column (an “attention sink” —
					the model parks spare budget on token one), a bright diagonal-minus-one (a previous-token
					head), and columns that light up under related words. Every number here is live — edit the
					prompt and Look again.
				</p>
			{:else}
				<div class="flex flex-wrap gap-5">
					<div class="min-w-[260px] flex-1">
						<div class="w-full max-w-[380px] overflow-hidden rounded-lg shadow-sm">
							<ChessBoard fen={rookFen} arrows={rookArrows} />
						</div>
					</div>
					<div class="min-w-[240px] flex-1">
						<div class="mb-1 text-xs" style="color: var(--color-text-muted);">
							deciding move {N} — how hard this head looks at each earlier move:
						</div>
						<div class="space-y-1">
							{#each tokens as t, j (j)}
								{#if j > 0}
									<div
										class="flex items-center gap-2 text-xs"
										style="font-family: var(--font-mono);"
									>
										<span style="width: 3.2rem; color: var(--color-text);">{t.label}</span>
										<div
											class="h-1.5 flex-1 overflow-hidden rounded-full"
											style="background: var(--color-surface-hover);"
										>
											<div
												class="h-full rounded-full"
												style="width: {Math.min(w(N - 1, j) * 220, 100).toFixed(
													1
												)}%; background: #b06a82;"
											></div>
										</div>
										<span style="color: var(--color-text-muted); min-width: 4ch;"
											>{(w(N - 1, j) * 100).toFixed(1)}%</span
										>
									</div>
								{/if}
							{/each}
						</div>
						<p class="mt-2 text-[11.5px]" style="color: var(--color-text-muted);">
							The arrows replay this head's top-3 attended MOVES on the board — brighter = more
							attention. Each past move is one token, so “which tokens matter” is literally “which
							moves matter”. Switch heads: some watch the last move, some track a whole piece's
							career.
						</p>
					</div>
				</div>
			{/if}
		{/if}
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
	.lab-btn:hover:not(:disabled) {
		border-color: var(--color-important);
	}
	.lab-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.prompt-input {
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 0.4rem 0.7rem;
		font-size: 13px;
		color: var(--color-text);
		background: var(--color-surface-hover);
	}
	.prompt-input:focus-visible {
		outline: none;
		border-color: var(--color-important);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-important) 18%, transparent);
	}
	.sel-label {
		font-family: var(--font-mono);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
		margin-right: 0.15rem;
	}
	.sel-btn {
		min-width: 26px;
		height: 24px;
		border: 1px solid var(--color-border);
		border-radius: 0.35rem;
		font-size: 11px;
		font-weight: 600;
		font-family: var(--font-mono);
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}
	.sel-btn:hover {
		border-color: var(--color-important);
	}
	.sel-btn.active {
		background: color-mix(in srgb, var(--color-important) 14%, transparent);
		border-color: var(--color-important);
		color: var(--color-text);
	}
	.tok-label {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-text-secondary);
	}
	.tok-label.hl {
		fill: var(--color-text);
		font-weight: 700;
	}
</style>
