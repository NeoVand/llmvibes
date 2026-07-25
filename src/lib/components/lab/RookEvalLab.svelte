<script lang="ts">
	// Rook eval: memorized surface vs modeled board. Positions a few plies from the
	// start recur across random games (a model could score well by recall);
	// positions deep in a random game are astronomically unique — they appear
	// nowhere in training — so staying legal THERE can only come from something that
	// tracks the board. We plot the flagship Rook's legal-move rate binned by ply
	// depth against an untrained control (the chance floor). Real, recorded by
	// spikes/flagship/eval_rook_depth.py. This is the first piece of evidence for
	// Part 6's question — and the board the probe finds there is what keeps these
	// deep moves legal.
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { ClipboardCheck, Loader2, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import ChessBoard from '../chess/ChessBoard.svelte';

	interface Bin {
		plyLo: number;
		plyHi: number;
		trained: number;
		control: number;
		n: number;
	}
	interface Example {
		ply: number;
		fen: string;
		move: string;
		legal: boolean;
		turn: 'w' | 'b';
	}
	interface EvalData {
		model: string;
		bins: Bin[];
		examples: Example[];
	}

	let data = $state<EvalData | null>(null);
	let error = $state('');
	let ei = $state(0);

	onMount(async () => {
		try {
			const res = await fetch(`${base}/data/rook-eval.json`);
			if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
			data = (await res.json()) as EvalData;
			// open on the first legal deep example
			const li = data.examples.findIndex((e) => e.legal);
			ei = li >= 0 ? li : 0;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	const bins = $derived(data?.bins ?? []);
	const maxPly = $derived(bins.length ? bins[bins.length - 1].plyHi + 1 : 80);
	const shallow = $derived(bins[0]?.trained ?? 0);
	const deep = $derived(bins.length ? bins[bins.length - 1].trained : 0);
	const ctrlMean = $derived(
		bins.length ? bins.reduce((s, b) => s + b.control, 0) / bins.length : 0
	);
	const ex = $derived(data?.examples[ei]);
	const nEx = $derived(data?.examples.length ?? 0);
	function arrow(e: Example) {
		return e.move.length >= 4
			? [
					{
						from: e.move.slice(0, 2),
						to: e.move.slice(2, 4),
						tone: (e.legal ? 'good' : 'bad') as 'good' | 'bad'
					}
				]
			: [];
	}

	// ── plot geometry ───────────────────────────────────────────────────────────
	const W = 720;
	const H = 300;
	const PAD = { l: 44, r: 16, t: 24, b: 36 };
	function px(ply: number): number {
		return PAD.l + (ply / maxPly) * (W - PAD.l - PAD.r);
	}
	function py(rate: number): number {
		return PAD.t + (1 - rate) * (H - PAD.t - PAD.b);
	}
	function mid(b: Bin): number {
		return (b.plyLo + b.plyHi + 1) / 2;
	}
	function line(key: 'trained' | 'control'): string {
		return bins
			.map((b, i) => `${i === 0 ? 'M' : 'L'}${px(mid(b)).toFixed(1)},${py(b[key]).toFixed(1)}`)
			.join(' ');
	}
	const DEEP_FROM = 40; // plies past which random positions are effectively unique
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-1 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<ClipboardCheck size={16} strokeWidth={2.5} />
		<span>Memorized openings, or a modeled board?</span>
	</div>
	<p class="mb-3 text-xs" style="color: var(--color-text-muted);">
		Legal-move rate is a real eval — but legal on <em>which</em> positions? Shallow positions recur across
		games (a model could score by recall); positions deep in a random game are unique and appear nowhere
		in training, so staying legal there can only come from tracking the board.
	</p>

	{#if error}
		<p class="text-sm" style="color: var(--color-challenge);">couldn't load the eval: {error}</p>
	{:else if !data}
		<div class="flex items-center gap-2 py-8 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> loading the recorded eval…
		</div>
	{:else}
		<svg
			viewBox="0 0 {W} {H}"
			class="w-full"
			role="img"
			aria-label="Legal-move rate versus game depth"
		>
			<!-- deep region shading -->
			<rect
				x={px(DEEP_FROM)}
				y={PAD.t}
				width={px(maxPly) - px(DEEP_FROM)}
				height={H - PAD.t - PAD.b}
				fill="var(--color-important)"
				opacity="0.05"
			/>
			<text
				x={(px(DEEP_FROM) + px(maxPly)) / 2}
				y={PAD.t + 12}
				text-anchor="middle"
				font-size="10.5"
				fill="var(--color-important)"
				opacity="0.8">deep — unique positions, must be modeled</text
			>
			<text
				x={px(DEEP_FROM / 2)}
				y={PAD.t + 12}
				text-anchor="middle"
				font-size="10.5"
				fill="var(--color-text-muted)">shallow — could be recall</text
			>

			<!-- y gridlines -->
			{#each [0, 0.25, 0.5, 0.75, 1] as g (g)}
				<line x1={PAD.l} y1={py(g)} x2={W - PAD.r} y2={py(g)} stroke="var(--color-border-light)" />
				<text
					x={PAD.l - 6}
					y={py(g) + 3.5}
					text-anchor="end"
					font-size="10.5"
					fill="var(--color-text-muted)"
					font-family="var(--font-mono)">{(g * 100).toFixed(0)}</text
				>
			{/each}
			<text
				x={12}
				y={PAD.t + (H - PAD.t - PAD.b) / 2}
				font-size="10.5"
				fill="var(--color-text-muted)"
				text-anchor="middle"
				transform="rotate(-90 12 {PAD.t + (H - PAD.t - PAD.b) / 2})">legal-move rate %</text
			>

			<!-- x ticks -->
			{#each [0, 16, 32, 48, 64, maxPly] as t (t)}
				<text
					x={px(t)}
					y={H - 14}
					text-anchor="middle"
					font-size="10.5"
					fill="var(--color-text-muted)"
					font-family="var(--font-mono)">{t}</text
				>
			{/each}
			<text
				x={(PAD.l + W - PAD.r) / 2}
				y={H - 1}
				text-anchor="middle"
				font-size="10"
				fill="var(--color-text-muted)">move number (ply)</text
			>

			<!-- control (chance floor) -->
			<path
				d={line('control')}
				fill="none"
				stroke="#94a3b8"
				stroke-width="2"
				stroke-dasharray="5 4"
			/>
			<text
				x={px(mid(bins[bins.length - 1])) - 4}
				y={py(ctrlMean) - 7}
				text-anchor="end"
				font-size="10.5"
				fill="#94a3b8"
				font-weight="600">untrained (chance)</text
			>

			<!-- trained flagship -->
			<path
				d={line('trained')}
				fill="none"
				stroke="var(--color-important)"
				stroke-width="2.8"
				stroke-linejoin="round"
			/>
			{#each bins as b (b.plyLo)}
				<circle cx={px(mid(b))} cy={py(b.trained)} r="2.6" fill="var(--color-important)" />
			{/each}
			<text
				x={px(mid(bins[0])) + 6}
				y={py(bins[0].trained) - 8}
				font-size="10.5"
				fill="var(--color-important)"
				font-weight="600">flagship Rook</text
			>
		</svg>

		<p class="mt-1 mb-4 text-center text-[12px]" style="color: var(--color-text-secondary);">
			Shallow moves are <strong style="color: var(--color-important);"
				>{(shallow * 100).toFixed(0)}%</strong
			>
			legal — but so a memorizer could look good. Deep in the game, on positions seen
			<em>nowhere</em> in training, it still plays
			<strong style="color: var(--color-important);">{(deep * 100).toFixed(0)}%</strong> legal
			moves, far above the untrained
			<strong style="color: #94a3b8;">{(ctrlMean * 100).toFixed(1)}%</strong>
			floor. Recall can't do that; a modeled board can.
		</p>

		<!-- a deep example position -->
		{#if ex}
			<div class="rounded-lg border p-3" style="border-color: var(--color-border);">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<span class="text-[13px] font-semibold" style="color: var(--color-text);">
						A position from move {ex.ply} — never seen in training
					</span>
					<div class="flex items-center gap-2">
						<span
							class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
							style={ex.legal
								? 'background: color-mix(in srgb, var(--color-tip) 16%, transparent); color: var(--color-tip);'
								: 'background: color-mix(in srgb, var(--color-challenge) 16%, transparent); color: var(--color-challenge);'}
						>
							Rook plays {ex.move} — {ex.legal ? 'legal' : 'illegal'}
						</span>
						<button
							class="rounded p-1 transition-colors hover:bg-[var(--color-bg-secondary)]"
							aria-label="previous example"
							onclick={() => (ei = (ei - 1 + nEx) % nEx)}
						>
							<ChevronLeft size={16} />
						</button>
						<button
							class="rounded p-1 transition-colors hover:bg-[var(--color-bg-secondary)]"
							aria-label="next example"
							onclick={() => (ei = (ei + 1) % nEx)}
						>
							<ChevronRight size={16} />
						</button>
					</div>
				</div>
				<div class="mx-auto mt-2 max-w-[300px]">
					<ChessBoard
						fen={ex.fen}
						arrows={arrow(ex)}
						orientation={ex.turn === 'b' ? 'black' : 'white'}
						coordinates={false}
					/>
				</div>
				<p class="mt-2 text-center text-[11px]" style="color: var(--color-text-muted);">
					{ex.turn === 'w' ? 'White' : 'Black'} to move · the arrow is Rook's top prediction. Cycle through
					— most are legal this deep; the occasional slip is why the curve above isn't a flat 100%.
				</p>
			</div>
		{/if}

		<p class="mt-3 text-[11.5px] leading-relaxed" style="color: var(--color-text-muted);">
			Measured on our {data.model}. This is the eval that separates a lookup table from a world
			model — and it's the first hint of Part 6's headline: linear probes on this same Rook can read
			the board out of its activations. Legality holding up on never-seen positions is the
			behaviour; the emergent board is the mechanism.
		</p>
	{/if}
</div>
