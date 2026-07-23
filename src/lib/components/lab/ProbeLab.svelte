<script lang="ts">
	// Linear probes on Rook's residual stream — the Othello-GPT argument as an
	// interactive illustration. Left: the TRUE occupancy of a mid-game position
	// (closed Ruy Lopez). Middle: the residual stream h_ell at a layer you pick.
	// Right: what a LINEAR readout W·h recovers — accuracy peaks mid-network,
	// and flipping to an untrained model collapses it to chance. All error
	// masks are precomputed with a seeded RNG so the panel is deterministic and
	// honest about being an illustration, not a live probe.
	import { Microscope } from 'lucide-svelte';
	import Formula from '../ui/Math.svelte';
	import Slider from '../ui/Slider.svelte';

	function mulberry32(seed: number): () => number {
		let a = seed >>> 0;
		return () => {
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	// true occupancy after 8...O-O in a closed Ruy Lopez (rank 8 → rank 1)
	// '.' empty · 'w' white piece · 'b' black piece
	const ROWS = [
		'b.bb.bb.',
		'..b.bbbb',
		'b.bb.b..',
		'.b..b...',
		'....w...',
		'.ww..w..',
		'ww.w.www',
		'wwwww.w.'
	];
	const TRUE_BOARD: number[] = ROWS.join('')
		.split('')
		.map((c) => (c === 'w' ? 1 : c === 'b' ? 2 : 0));

	const N_LAYERS = 8;
	// wrong-square counts per layer → accuracies ~55/59/78/92/97/95/91/84%
	const WRONG_TRAINED = [29, 26, 14, 5, 2, 3, 6, 10];
	// untrained model: ~33% = 3-way chance
	const WRONG_UNTRAINED = [43, 42, 44, 43, 42, 43, 44, 43];

	function makePred(wrong: number, seed: number): number[] {
		const rand = mulberry32(seed);
		const idx = Array.from({ length: 64 }, (_, i) => i);
		for (let i = 63; i > 0; i--) {
			const j = Math.floor(rand() * (i + 1));
			[idx[i], idx[j]] = [idx[j], idx[i]];
		}
		const pred = [...TRUE_BOARD];
		for (let k = 0; k < wrong; k++) {
			const s = idx[k];
			pred[s] = (TRUE_BOARD[s] + 1 + (rand() < 0.5 ? 1 : 0)) % 3;
		}
		return pred;
	}

	const PRED_TRAINED = WRONG_TRAINED.map((w, l) =>
		makePred(w, 0x600d ^ Math.imul(l + 1, 2654435761))
	);
	const PRED_UNTRAINED = WRONG_UNTRAINED.map((w, l) =>
		makePred(w, 0xbad ^ Math.imul(l + 1, 2654435761))
	);
	const correctOf = (pred: number[]) =>
		pred.reduce((a, p, i) => a + (p === TRUE_BOARD[i] ? 1 : 0), 0);
	const ACC_TRAINED = PRED_TRAINED.map(correctOf); // counts out of 64
	const ACC_UNTRAINED = PRED_UNTRAINED.map(correctOf);

	// residual stream bars: deterministic per (mode, layer). Note they look
	// equally "busy" either way — the difference is what's linearly READABLE.
	const DIMS = 25;
	const STREAM = [0x51ab, 0x7e57].map((base) =>
		Array.from({ length: N_LAYERS }, (_, l) => {
			const rand = mulberry32(base ^ Math.imul(l + 1, 40503));
			return Array.from({ length: DIMS }, () => 0.12 + 0.88 * rand());
		})
	);

	let layer = $state(5);
	let untrained = $state(false);

	const li = $derived(layer - 1);
	const pred = $derived(untrained ? PRED_UNTRAINED[li] : PRED_TRAINED[li]);
	const correct = $derived(untrained ? ACC_UNTRAINED[li] : ACC_TRAINED[li]);
	const accPct = $derived(((correct / 64) * 100).toFixed(1));
	const stream = $derived(STREAM[untrained ? 1 : 0][li]);
	const curve = $derived(untrained ? ACC_UNTRAINED : ACC_TRAINED);
	const ghostCurve = $derived(untrained ? ACC_TRAINED : ACC_UNTRAINED);

	// ── board geometry (SVG user units; renders ≈26px cells) ──
	const CELL = 40;
	const BX = 24; // board origin
	const BY = 6;
	const BV = 350; // viewBox size
	const sqX = (i: number) => BX + (i % 8) * CELL;
	const sqY = (i: number) => BY + Math.floor(i / 8) * CELL;
	const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

	const FILL = [
		'var(--color-bg-tertiary)',
		'color-mix(in srgb, #d9a441 42%, var(--color-surface))',
		'color-mix(in srgb, #6d5fae 55%, var(--color-surface))'
	];

	// ── accuracy chart geometry ──
	const CW = 380;
	const CH = 175;
	const CM = { top: 10, right: 12, bottom: 28, left: 36 };
	const cpw = CW - CM.left - CM.right;
	const cph = CH - CM.top - CM.bottom;
	const chX = (l: number) => CM.left + ((l - 1) / (N_LAYERS - 1)) * cpw;
	const chY = (count: number) => CM.top + (1 - count / 64) * cph;
	const linePts = (c: number[]) => c.map((v, l) => `${chX(l + 1)},${chY(v)}`).join(' ');

	const TEX = String.raw`\hat{s}_{\text{sq}} \;=\; W_{\text{probe}}\, h_{\ell}`;
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
			<Microscope size={16} strokeWidth={2.5} />
			<span>Linear probes — is the board in there?</span>
		</div>
		<span class="illus-chip">illustration</span>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		Rook only ever sees move text — nobody gives it a board. Train a <em>linear</em> readout on its residual
		stream and ask each square "empty, white, or black?". Slide through the layers and watch where the
		board lives.
	</p>

	<div class="flex flex-wrap gap-5">
		<!-- ── left: the true board ── -->
		<div class="min-w-[200px] flex-1 basis-[220px]">
			<div class="panel-label mb-1">true occupancy — Rook's game, move 9</div>
			<svg
				viewBox="0 0 {BV} {BV}"
				class="board"
				role="img"
				aria-label="True board occupancy of a mid-game chess position"
			>
				{#each TRUE_BOARD as cls, i (i)}
					<rect
						x={sqX(i) + 1}
						y={sqY(i) + 1}
						width={CELL - 2}
						height={CELL - 2}
						rx="4"
						fill={FILL[cls]}
					/>
					{#if cls === 1}
						<circle
							cx={sqX(i) + 20}
							cy={sqY(i) + 20}
							r="9"
							fill="#f7f2e2"
							stroke="#8a6d1f"
							stroke-width="1.5"
						/>
					{:else if cls === 2}
						<circle
							cx={sqX(i) + 20}
							cy={sqY(i) + 20}
							r="9"
							fill="#262040"
							stroke="#0b0820"
							stroke-width="1.5"
						/>
					{/if}
				{/each}
				{#each FILES as f, j (f)}
					<text class="coord" x={BX + j * CELL + 20} y="342" text-anchor="middle">{f}</text>
					<text class="coord" x="11" y={BY + j * CELL + 24} text-anchor="middle">{8 - j}</text>
				{/each}
			</svg>
			<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
				<span class="legend"><span class="sw" style="background: {FILL[0]};"></span>empty</span>
				<span class="legend"
					><span class="sw" style="background: {FILL[1]};"></span>white piece</span
				>
				<span class="legend"
					><span class="sw" style="background: {FILL[2]};"></span>black piece</span
				>
			</div>
		</div>

		<!-- ── middle: the residual stream + layer dial ── -->
		<div class="min-w-[150px] flex-1 basis-[160px]">
			<div class="panel-label mb-1">residual stream h<sub>ℓ</sub></div>
			<svg
				viewBox="0 0 130 337"
				class="stream"
				role="img"
				aria-label="Residual stream activations at the selected layer"
			>
				{#each stream as v, i (i)}
					<rect
						x="4"
						y={4 + i * 13}
						width={4 + v * 120}
						height="9"
						rx="2"
						fill="#d9a441"
						opacity={0.45 + 0.55 * v}
					/>
				{/each}
			</svg>
			<div class="mt-2">
				<Slider
					label="probe layer"
					bind:value={layer}
					min={1}
					max={8}
					step={1}
					tone="violet"
					format={(v) => `ℓ = ${v}`}
					hint="where in the network you read the stream"
				/>
			</div>
			<p class="mt-2 text-[10.5px]" style="color: var(--color-text-muted);">
				the bars look equally busy at every layer — the question is what a linear map can
				<em>read</em> out of them
			</p>
		</div>

		<!-- ── right: the probe's reconstruction ── -->
		<div class="min-w-[200px] flex-1 basis-[220px]">
			<div class="panel-label mb-1" style="color: var(--color-important);">
				probe readout W·h<sub>ℓ</sub> — {untrained ? 'untrained model' : `layer ${layer}`}
			</div>
			<svg
				viewBox="0 0 {BV} {BV}"
				class="board"
				role="img"
				aria-label="Board occupancy reconstructed by the linear probe"
			>
				{#each pred as cls, i (i)}
					<rect
						x={sqX(i) + 1}
						y={sqY(i) + 1}
						width={CELL - 2}
						height={CELL - 2}
						rx="4"
						fill={FILL[cls]}
					/>
					{#if cls !== TRUE_BOARD[i]}
						<rect
							x={sqX(i) + 3}
							y={sqY(i) + 3}
							width={CELL - 6}
							height={CELL - 6}
							rx="3"
							fill="none"
							stroke="var(--color-challenge)"
							stroke-width="2.5"
						/>
					{/if}
				{/each}
				{#each FILES as f, j (f)}
					<text class="coord" x={BX + j * CELL + 20} y="342" text-anchor="middle">{f}</text>
					<text class="coord" x="11" y={BY + j * CELL + 24} text-anchor="middle">{8 - j}</text>
				{/each}
			</svg>
			<div class="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
				<span class="legend"><span class="ring"></span>probe wrong</span>
				<span
					class="acc"
					style="color: {untrained ? 'var(--color-challenge)' : 'var(--color-important)'};"
					>{accPct}% ({correct}/64)</span
				>
			</div>
			<button
				class="toggle mt-2"
				class:on={untrained}
				aria-pressed={untrained}
				onclick={() => (untrained = !untrained)}
			>
				<span class="dot"></span> probe an untrained model
			</button>
		</div>
	</div>

	<div class="mt-4 flex flex-wrap gap-5">
		<!-- ── accuracy vs layer ── -->
		<div class="min-w-[260px] flex-1 basis-[320px]">
			<div class="panel-label mb-1">where does the board live? — probe accuracy vs layer</div>
			<svg
				viewBox="0 0 {CW} {CH}"
				class="w-full"
				role="img"
				aria-label="Line chart of probe accuracy per layer with the current layer highlighted"
			>
				{#each [64, 32] as g (g)}
					<line
						x1={CM.left}
						y1={chY(g)}
						x2={CM.left + cpw}
						y2={chY(g)}
						stroke="var(--color-border-light)"
					/>
					<text class="tick" x={CM.left - 5} y={chY(g) + 3} text-anchor="end"
						>{Math.round((g / 64) * 100)}%</text
					>
				{/each}
				<!-- chance line: 3 classes → 33% -->
				<line
					x1={CM.left}
					y1={chY(64 / 3)}
					x2={CM.left + cpw}
					y2={chY(64 / 3)}
					stroke="var(--color-challenge)"
					stroke-dasharray="4 4"
					opacity="0.55"
				/>
				<text
					class="tick"
					x={CM.left - 5}
					y={chY(64 / 3) + 3}
					text-anchor="end"
					fill="var(--color-challenge)">33%</text
				>
				<text class="chance" x={CM.left + cpw} y={chY(64 / 3) - 5} text-anchor="end"
					>chance (3 classes)</text
				>

				<!-- ghost of the other mode, for contrast -->
				<polyline
					points={linePts(ghostCurve)}
					fill="none"
					stroke="var(--color-text-muted)"
					stroke-width="1.5"
					stroke-dasharray="3 4"
					opacity="0.45"
				/>
				<!-- active curve -->
				<polyline
					points={linePts(curve)}
					fill="none"
					stroke="#a855f7"
					stroke-width="2.5"
					stroke-linejoin="round"
				/>
				<line
					x1={chX(layer)}
					y1={CM.top}
					x2={chX(layer)}
					y2={CM.top + cph}
					stroke="#a855f7"
					stroke-dasharray="3 3"
					opacity="0.5"
				/>
				{#each curve as v, l (l)}
					<circle
						cx={chX(l + 1)}
						cy={chY(v)}
						r={l + 1 === layer ? 5.5 : 3}
						fill={l + 1 === layer ? '#a855f7' : 'var(--color-surface)'}
						stroke="#a855f7"
						stroke-width="2"
					/>
					<text class="tick" x={chX(l + 1)} y={CH - 10} text-anchor="middle">{l + 1}</text>
				{/each}
			</svg>
			<p class="mt-1 text-[11px]" style="color: var(--color-text-secondary);">
				{#if untrained}
					Flat at chance. Same architecture, same probe recipe, no training — the board-reading only
					exists because prediction pressure built it.
				{:else}
					Accuracy peaks mid-network: early layers still carry surface move-text features, late
					layers rotate toward picking the next move — the cleanest board sits in the middle.
				{/if}
			</p>
		</div>

		<!-- ── the formula and the claim ── -->
		<div class="min-w-[220px] flex-1 basis-[240px]">
			<div class="rounded-lg border p-3" style="border-color: var(--color-border-light);">
				<Formula tex={TEX} display />
				<p class="mt-1 text-[11px]" style="color: var(--color-text-secondary);">
					<strong style="color: var(--color-important);">W<sub>probe</sub> is one linear map</strong
					>
					— no hidden layers, no computation of its own. If it can read a square off h<sub>ℓ</sub>,
					the board state must already be sitting in the stream as directions. Rook was only ever
					graded on next-move text; nobody put a board in there.
				</p>
			</div>
		</div>
	</div>

	<p class="footnote mt-4">
		Illustration only: the numbers above are drawn to match the shape of the Othello-GPT result (Li
		et al., 2023), transposed to Rook. Training real linear probes on Rook's own activations is a
		planned lab later in the course.
	</p>
</div>

<style>
	.panel-label {
		font-family: var(--font-mono);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
	}
	.board {
		width: 100%;
		max-width: 240px;
		display: block;
	}
	.stream {
		width: 100%;
		max-width: 130px;
		display: block;
	}
	.coord {
		fill: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.tick {
		fill: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.chance {
		fill: var(--color-challenge);
		font-size: 10px;
		opacity: 0.8;
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
		border: 1px solid var(--color-border);
	}
	.ring {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		border: 2px solid var(--color-challenge);
	}
	.acc {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		padding: 0.25rem 0.7rem;
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}
	.toggle:hover {
		border-color: var(--color-challenge);
	}
	.toggle .dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--color-border);
		transition: background 120ms ease;
	}
	.toggle.on {
		border-color: var(--color-challenge);
		background: color-mix(in srgb, var(--color-challenge) 9%, transparent);
		color: var(--color-challenge);
	}
	.toggle.on .dot {
		background: var(--color-challenge);
	}

	.illus-chip {
		border: 1px solid var(--color-border);
		border-radius: 999px;
		padding: 0.1rem 0.55rem;
		font-family: var(--font-mono);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}

	.footnote {
		border-top: 1px solid var(--color-border-light);
		padding-top: 0.6rem;
		font-size: 10.5px;
		font-style: italic;
		color: var(--color-text-muted);
	}
</style>
