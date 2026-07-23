<script lang="ts">
	// Reusable chess board. Pure view + gesture layer: the parent owns the rules
	// (chess.js or a recorded game) and passes fen / legalMoves / lastMove in;
	// the board owns selection, drag, hover, and piece animation. Pieces are the
	// cburnett SVG set (see piece-art.ts), not font glyphs — identical on every
	// platform.
	import { untrack } from 'svelte';
	import { PIECE_ART, type PieceKey } from './piece-art';

	interface Arrow {
		from: string;
		to: string;
		tone?: 'accent' | 'good' | 'bad';
	}

	let {
		fen,
		interactive = false,
		moveableColor = 'w',
		legalMoves = [],
		lastMove = null,
		checkSquare = null,
		orientation = 'white',
		coordinates = true,
		arrows = [],
		onmove
	}: {
		fen: string;
		interactive?: boolean;
		moveableColor?: 'w' | 'b' | 'both';
		legalMoves?: Array<{ from: string; to: string }>;
		lastMove?: { from: string; to: string } | null;
		checkSquare?: string | null;
		orientation?: 'white' | 'black';
		coordinates?: boolean;
		arrows?: Arrow[];
		onmove?: (from: string, to: string) => void;
	} = $props();

	const SQ = 100;
	const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

	// ── geometry ───────────────────────────────────────────────────────────────
	function sqToXY(square: string): { x: number; y: number } {
		const f = FILES.indexOf(square[0]);
		const r = Number(square[1]) - 1;
		return orientation === 'white'
			? { x: f * SQ, y: (7 - r) * SQ }
			: { x: (7 - f) * SQ, y: r * SQ };
	}
	function xyToSq(x: number, y: number): string | null {
		const f = Math.floor(x / SQ);
		const r = Math.floor(y / SQ);
		if (f < 0 || f > 7 || r < 0 || r > 7) return null;
		return orientation === 'white' ? FILES[f] + (8 - r) : FILES[7 - f] + (r + 1);
	}

	// ── fen → animated piece list ──────────────────────────────────────────────
	// Pieces keep a stable id across fens so CSS transitions animate the move
	// (matching prefers the nearest same-kind piece, which also gets the castling
	// rook right). Captures fade out; promotions swap art without sliding.
	interface RP {
		id: number;
		key: PieceKey;
		square: string;
	}
	let renderPieces = $state<RP[]>([]);
	let fading = $state<Array<{ id: number; key: PieceKey; square: string }>>([]);
	let nextId = 1;

	function parseFen(f: string): Record<string, PieceKey> {
		const out: Record<string, PieceKey> = {};
		const rows = f.split(' ')[0].split('/');
		for (let r = 0; r < 8; r++) {
			let file = 0;
			for (const ch of rows[r]) {
				if (ch >= '1' && ch <= '8') {
					file += Number(ch);
				} else {
					const color = ch === ch.toUpperCase() ? 'w' : 'b';
					out[FILES[file] + (8 - r)] = (color + ch.toUpperCase()) as PieceKey;
					file++;
				}
			}
		}
		return out;
	}

	function dist(a: string, b: string): number {
		return (
			Math.abs(FILES.indexOf(a[0]) - FILES.indexOf(b[0])) + Math.abs(Number(a[1]) - Number(b[1]))
		);
	}

	$effect(() => {
		const target = parseFen(fen);
		untrack(() => {
			const kept: RP[] = [];
			const leftover: RP[] = [];
			for (const rp of renderPieces) {
				if (target[rp.square] === rp.key) {
					delete target[rp.square];
					kept.push(rp);
				} else {
					leftover.push(rp);
				}
			}
			for (const [square, key] of Object.entries(target)) {
				let best = -1;
				let bestD = Infinity;
				for (let i = 0; i < leftover.length; i++) {
					if (leftover[i].key !== key) continue;
					const d = dist(leftover[i].square, square);
					if (d < bestD) {
						bestD = d;
						best = i;
					}
				}
				if (best >= 0) {
					const rp = leftover.splice(best, 1)[0];
					rp.square = square;
					kept.push(rp);
				} else {
					kept.push({ id: nextId++, key, square });
				}
			}
			// leftover = captured (or promoted-away) pieces: brief fade-out ghosts
			if (leftover.length > 0) {
				const ghosts = leftover.map((rp) => ({ id: rp.id, key: rp.key, square: rp.square }));
				fading = [...fading, ...ghosts];
				const ids = new Set(ghosts.map((g) => g.id));
				setTimeout(() => {
					fading = fading.filter((g) => !ids.has(g.id));
				}, 180);
			}
			kept.sort((a, b) => a.id - b.id);
			renderPieces = kept;
		});
	});

	// ── selection + drag ───────────────────────────────────────────────────────
	let selected = $state<string | null>(null);
	let hoverSq = $state<string | null>(null);
	let drag = $state<{ pieceId: number; from: string; x: number; y: number; moved: boolean } | null>(
		null
	);
	let wasSelectedOnDown = false;
	let svgEl: SVGSVGElement;

	const targets = $derived(
		selected ? new Set(legalMoves.filter((m) => m.from === selected).map((m) => m.to)) : new Set()
	);
	const occupied = $derived(
		Object.fromEntries(renderPieces.map((rp) => [rp.square, rp])) as Record<string, RP>
	);
	const moveSources = $derived(new Set(legalMoves.map((m) => m.from)));

	function ownsPiece(key: PieceKey): boolean {
		return moveableColor === 'both' || key.startsWith(moveableColor);
	}

	function evtXY(e: PointerEvent): { x: number; y: number } {
		const r = svgEl.getBoundingClientRect();
		return { x: ((e.clientX - r.left) / r.width) * 800, y: ((e.clientY - r.top) / r.height) * 800 };
	}

	function pointerDown(e: PointerEvent) {
		if (!interactive) return;
		const { x, y } = evtXY(e);
		const sq = xyToSq(x, y);
		if (!sq) return;
		const piece = occupied[sq];

		if (selected && targets.has(sq) && (!piece || !ownsPiece(piece.key))) {
			const from = selected;
			selected = null;
			onmove?.(from, sq);
			return;
		}
		if (piece && ownsPiece(piece.key)) {
			wasSelectedOnDown = selected === sq;
			selected = sq;
			drag = { pieceId: piece.id, from: sq, x, y, moved: false };
			try {
				svgEl.setPointerCapture(e.pointerId);
			} catch {
				// synthetic events have no active pointer to capture
			}
			e.preventDefault();
		} else {
			selected = null;
		}
	}

	function pointerMove(e: PointerEvent) {
		if (!drag) return;
		const { x, y } = evtXY(e);
		const moved = drag.moved || Math.hypot(x - drag.x, y - drag.y) > 6;
		drag = { ...drag, x, y, moved };
		hoverSq = moved ? xyToSq(x, y) : null;
	}

	function pointerUp(e: PointerEvent) {
		if (!drag) return;
		const { x, y } = evtXY(e);
		const sq = xyToSq(x, y);
		const { from, moved } = drag;
		drag = null;
		hoverSq = null;
		if (moved && sq && sq !== from && targets.has(sq)) {
			selected = null;
			onmove?.(from, sq);
		} else if (!moved && wasSelectedOnDown) {
			selected = null; // second tap on the same piece puts it down
		}
		// otherwise: invalid drop → piece snaps home, selection stays
		void e;
	}

	function keyActivate(e: KeyboardEvent, sq: string) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		if (!interactive) return;
		const piece = occupied[sq];
		if (selected && targets.has(sq) && (!piece || !ownsPiece(piece.key))) {
			const from = selected;
			selected = null;
			onmove?.(from, sq);
		} else if (piece && ownsPiece(piece.key)) {
			selected = selected === sq ? null : sq;
		} else {
			selected = null;
		}
	}

	// Deselect when the position or interactivity changes under us
	$effect(() => {
		void fen;
		void interactive;
		selected = null;
		drag = null;
		hoverSq = null;
	});

	const ARROW_TONE: Record<string, string> = {
		accent: 'var(--color-important)',
		good: 'var(--color-tip)',
		bad: 'var(--color-challenge)'
	};

	// unique ids for defs so several boards can coexist on a page
	const uid = `cb${Math.random().toString(36).slice(2, 8)}`;

	function pieceXY(rp: RP): { x: number; y: number } {
		if (drag && drag.pieceId === rp.id && drag.moved) {
			return { x: drag.x - SQ / 2, y: drag.y - SQ / 2 };
		}
		return sqToXY(rp.square);
	}

	const ranks = [0, 1, 2, 3, 4, 5, 6, 7];
</script>

<svg
	bind:this={svgEl}
	viewBox="0 0 800 800"
	class="chess-board"
	class:interactive
	role="group"
	aria-label="chess board"
	onpointerdown={pointerDown}
	onpointermove={pointerMove}
	onpointerup={pointerUp}
	onpointercancel={pointerUp}
>
	<defs>
		<clipPath id="{uid}-clip">
			<rect x="0" y="0" width="800" height="800" rx="10" ry="10" />
		</clipPath>
		<radialGradient id="{uid}-check">
			<stop offset="0%" stop-color="rgb(224 54 54 / 0.85)" />
			<stop offset="55%" stop-color="rgb(224 54 54 / 0.45)" />
			<stop offset="100%" stop-color="rgb(224 54 54 / 0)" />
		</radialGradient>
		{#each ['accent', 'good', 'bad'] as tone (tone)}
			<marker
				id="{uid}-arrow-{tone}"
				viewBox="0 0 10 10"
				refX="7"
				refY="5"
				markerWidth="4"
				markerHeight="4"
				orient="auto-start-reverse"
			>
				<path d="M0 0 L10 5 L0 10 z" fill={ARROW_TONE[tone]} />
			</marker>
		{/each}
	</defs>

	<g clip-path="url(#{uid}-clip)">
		<!-- squares -->
		{#each ranks as r (r)}
			{#each ranks as f (f)}
				<rect
					x={f * SQ}
					y={r * SQ}
					width={SQ}
					height={SQ}
					class={(r + f) % 2 === 1 ? 'sq-dark' : 'sq-light'}
				/>
			{/each}
		{/each}

		<!-- last move tint -->
		{#if lastMove}
			{@const from = sqToXY(lastMove.from)}
			{@const to = sqToXY(lastMove.to)}
			<rect x={from.x} y={from.y} width={SQ} height={SQ} class="sq-lastmove" />
			<rect x={to.x} y={to.y} width={SQ} height={SQ} class="sq-lastmove" />
		{/if}

		<!-- check glow -->
		{#if checkSquare}
			{@const c = sqToXY(checkSquare)}
			<circle cx={c.x + SQ / 2} cy={c.y + SQ / 2} r={SQ * 0.62} fill="url(#{uid}-check)" />
		{/if}

		<!-- selection -->
		{#if selected}
			{@const s = sqToXY(selected)}
			<rect x={s.x} y={s.y} width={SQ} height={SQ} class="sq-selected" />
		{/if}

		<!-- drag hover target -->
		{#if hoverSq && targets.has(hoverSq)}
			{@const h = sqToXY(hoverSq)}
			<rect x={h.x + 3} y={h.y + 3} width={SQ - 6} height={SQ - 6} class="sq-hover" />
		{/if}

		<!-- coordinates, lichess-style corner labels -->
		{#if coordinates}
			{#each FILES as file, i (file)}
				{@const x = orientation === 'white' ? i * SQ : (7 - i) * SQ}
				<text x={x + SQ - 7} y={800 - 7} class="coord" class:on-dark={i % 2 === 0}>{file}</text>
			{/each}
			{#each ranks as r (r)}
				{@const rank = orientation === 'white' ? 8 - r : r + 1}
				<text x="6" y={r * SQ + 22} class="coord" class:on-dark={r % 2 === 1}>{rank}</text>
			{/each}
		{/if}

		<!-- legal-move hints: dot on empty squares, ring on captures -->
		{#each [...targets] as t (t)}
			{@const p = sqToXY(t as string)}
			{#if (t as string) in occupied}
				<circle cx={p.x + SQ / 2} cy={p.y + SQ / 2} r={SQ * 0.44} class="hint-ring" />
			{:else}
				<circle cx={p.x + SQ / 2} cy={p.y + SQ / 2} r={SQ * 0.16} class="hint-dot" />
			{/if}
		{/each}

		<!-- fading captured pieces -->
		{#each fading as g (g.id)}
			{@const p = sqToXY(g.square)}
			<g class="piece captured" style="transform: translate({p.x}px, {p.y}px)">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted bundled piece art -->
				<g transform="scale(2.2222)">{@html PIECE_ART[g.key]}</g>
			</g>
		{/each}

		<!-- pieces (dragged one rendered last, on top) -->
		{#each renderPieces.filter((rp) => !(drag && drag.pieceId === rp.id)) as rp (rp.id)}
			{@const p = pieceXY(rp)}
			<g
				class="piece"
				class:grabbable={interactive && ownsPiece(rp.key) && moveSources.has(rp.square)}
				style="transform: translate({p.x}px, {p.y}px)"
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted bundled piece art -->
				<g transform="scale(2.2222)">{@html PIECE_ART[rp.key]}</g>
			</g>
		{/each}
		{#each renderPieces.filter((rp) => drag && drag.pieceId === rp.id) as rp (rp.id)}
			{@const p = pieceXY(rp)}
			<g
				class="piece dragging"
				class:lifted={drag?.moved}
				style="transform: translate({p.x}px, {p.y}px)"
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted bundled piece art -->
				<g transform="scale(2.2222)">{@html PIECE_ART[rp.key]}</g>
			</g>
		{/each}

		<!-- arrows -->
		{#each arrows as a (a.from + a.to)}
			{@const from = sqToXY(a.from)}
			{@const to = sqToXY(a.to)}
			{@const tone = a.tone ?? 'accent'}
			<line
				x1={from.x + SQ / 2}
				y1={from.y + SQ / 2}
				x2={to.x + SQ / 2}
				y2={to.y + SQ / 2}
				stroke={ARROW_TONE[tone]}
				stroke-width="18"
				stroke-linecap="round"
				opacity="0.75"
				marker-end="url(#{uid}-arrow-{tone})"
			/>
		{/each}

		<!-- keyboard/AT layer: focusable squares, transparent to the pointer
		     (mouse interaction is delegated to the svg root) -->
		{#if interactive}
			{#each ranks as r (r)}
				{#each ranks as f (f)}
					{@const sq = xyToSq(f * SQ + 1, r * SQ + 1)}
					<rect
						x={f * SQ}
						y={r * SQ}
						width={SQ}
						height={SQ}
						fill="transparent"
						pointer-events="none"
						role="button"
						tabindex="0"
						aria-label="square {sq}"
						onkeydown={(e) => sq && keyActivate(e, sq)}
					/>
				{/each}
			{/each}
		{/if}
	</g>

	<rect x="0.75" y="0.75" width="798.5" height="798.5" rx="10" class="board-edge" />
</svg>

<style>
	.chess-board {
		display: block;
		width: 100%;
		height: auto;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		/* board stays warm wood in both themes, like lichess */
		--cb-light: #f0d9b5;
		--cb-dark: #b58863;
		--cb-lastmove: rgb(205 210 106 / 0.55);
		--cb-selected: rgb(20 85 30 / 0.32);
		--cb-hint: rgb(20 60 30 / 0.28);
		--cb-coord-light: #b58863;
		--cb-coord-dark: #f0d9b5;
	}
	.sq-light {
		fill: var(--cb-light);
	}
	.sq-dark {
		fill: var(--cb-dark);
	}
	.sq-lastmove {
		fill: var(--cb-lastmove);
		pointer-events: none;
	}
	.sq-selected {
		fill: var(--cb-selected);
		pointer-events: none;
	}
	.sq-hover {
		fill: none;
		stroke: rgb(255 255 255 / 0.75);
		stroke-width: 6;
		pointer-events: none;
	}
	.hint-dot {
		fill: var(--cb-hint);
		pointer-events: none;
	}
	.hint-ring {
		fill: none;
		stroke: var(--cb-hint);
		stroke-width: 9;
		pointer-events: none;
	}
	.coord {
		font-family: var(--font-heading, system-ui);
		font-size: 21px;
		font-weight: 700;
		fill: var(--cb-coord-light);
		pointer-events: none;
	}
	.coord.on-dark {
		fill: var(--cb-coord-dark);
	}
	.piece {
		transition: transform 140ms ease;
	}
	.piece.grabbable {
		cursor: grab;
	}
	.piece.dragging {
		transition: none;
	}
	.piece.lifted {
		filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.35));
		cursor: grabbing;
	}
	.piece.captured {
		animation: cb-fade 170ms ease forwards;
		pointer-events: none;
	}
	@keyframes cb-fade {
		to {
			opacity: 0;
		}
	}
	.board-edge {
		fill: none;
		stroke: rgb(0 0 0 / 0.18);
		stroke-width: 1.5;
		pointer-events: none;
	}
	.chess-board.interactive {
		cursor: default;
	}
	.chess-board.interactive :global(rect[role='button']:focus-visible) {
		outline: none;
		stroke: var(--color-important, #4a90d9);
		stroke-width: 5;
	}
</style>
