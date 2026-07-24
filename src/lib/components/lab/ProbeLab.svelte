<script lang="ts">
	// Linear probes on Rook's residual stream — the Othello-GPT / Karvonen
	// experiment, run for REAL on a flagship Rook we trained offline (see
	// scripts/data/build-flagship-data.mjs + spikes/flagship/). Every number here
	// is measured: a linear readout W·hℓ trained on the actual activations of a
	// model that only ever saw move text, decoding each square as mine / theirs /
	// empty (the Nanda frame). Accuracy climbs with depth and an untrained control
	// stays flat — the board was built by training, not baked into the wiring.
	import { onMount } from 'svelte';
	import { Microscope, Loader2, Shuffle } from 'lucide-svelte';
	import Formula from '../ui/Math.svelte';
	import Slider from '../ui/Slider.svelte';
	import { base } from '$app/paths';

	interface Probe {
		config: {
			nLayer: number;
			nEmbd: number;
			nHead: number;
			params: number;
			games: number;
			trainMinutes: number;
			valLoss: number;
		};
		baseline: number;
		bestLayer: number;
		layers: Array<{ trained: number; control: number }>;
		perSquare: { trained: number[][]; control: number[][] };
		examples: Array<{ ply: number; turn: string; trueOriented: number[]; predByLayer: number[][] }>;
	}

	let data = $state<Probe | null>(null);
	let error = $state('');
	let layer = $state(5); // 0-indexed
	let untrained = $state(false);
	let exampleI = $state(0);

	onMount(async () => {
		try {
			const res = await fetch(`${base}/data/rook-probe.json`);
			if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
			data = (await res.json()) as Probe;
			layer = data.bestLayer;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	const nLayer = $derived(data?.config.nLayer ?? 6);
	const ex = $derived(data?.examples[exampleI] ?? null);
	const pred = $derived(ex?.predByLayer[layer] ?? null);
	const heat = $derived(data ? data.perSquare[untrained ? 'control' : 'trained'][layer] : null);
	const exAcc = $derived.by(() => {
		if (!ex || !pred) return 0;
		let c = 0;
		for (let i = 0; i < 64; i++) if (pred[i] === ex.trueOriented[i]) c++;
		return c;
	});

	// ── board geometry: oriented so the side-to-move's near rank is at the bottom.
	// data index 0 = mover's rank 1; grid position 0 = top-left.
	const CELL = 40;
	const BX = 24;
	const BY = 6;
	const BV = 350;
	const gx = (g: number) => BX + (g % 8) * CELL;
	const gy = (g: number) => BY + Math.floor(g / 8) * CELL;
	const dataIdx = (g: number) => (7 - Math.floor(g / 8)) * 8 + (g % 8);
	const grid = Array.from({ length: 64 }, (_, g) => g);

	const OCC = [
		'var(--color-bg-tertiary)',
		'color-mix(in srgb, #d9a441 45%, var(--color-surface))', // mine
		'color-mix(in srgb, #6d5fae 58%, var(--color-surface))' // theirs
	];
	function heatFill(acc: number): string {
		const t = Math.max(0, Math.min(1, (acc - 0.5) / 0.45));
		return `color-mix(in srgb, var(--color-important) ${(t * 92).toFixed(0)}%, var(--color-surface))`;
	}

	// ── depth-curve geometry ──
	const CW = 520;
	const CH = 190;
	const CM = { top: 14, right: 18, bottom: 30, left: 42 };
	const cpw = CW - CM.left - CM.right;
	const cph = CH - CM.top - CM.bottom;
	const Y0 = 0.55;
	const Y1 = 0.85;
	const cx = (l: number) => CM.left + (nLayer <= 1 ? 0 : (l / (nLayer - 1)) * cpw);
	const cy = (a: number) => CM.top + (1 - (a - Y0) / (Y1 - Y0)) * cph;
	const linePts = (key: 'trained' | 'control') =>
		data ? data.layers.map((v, l) => `${cx(l)},${cy(v[key])}`).join(' ') : '';

	const TEX = String.raw`\hat{s}_{\text{sq}} \;=\; W_{\text{probe}}\, h_{\ell}`;
	function fmtM(n: number): string {
		return `${(n / 1e6).toFixed(1)}M`;
	}
</script>

<div
	class="@container my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
			style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
		>
			<Microscope size={16} strokeWidth={2.5} />
			<span>Linear probes — the board Rook built</span>
		</div>
		<span class="measured-chip">measured · flagship Rook</span>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		Rook only ever saw move text — nobody gave it a board. We trained a <em>linear</em> readout on
		its residual stream to decode every square as
		<span style="color: #d9a441;">mine</span>, <span style="color: #8b7ed0;">theirs</span>, or empty
		(from the side-to-move's view). It works — and where it works, and how well, is the whole story.
	</p>

	{#if error}
		<p class="text-sm" style="color: var(--color-challenge);">
			couldn't load the probe run: {error}
		</p>
	{:else if !data || !ex || !pred || !heat}
		<div class="flex items-center gap-2 py-6 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> loading the measured probe run…
		</div>
	{:else}
		<!-- ── ROW A: watch the trained model decode a real position ── -->
		<div class="mb-2 flex items-baseline justify-between gap-2">
			<span class="panel-label">the trained Rook decoding a held-out position</span>
			<button
				class="mini-btn"
				onclick={() => data && (exampleI = (exampleI + 1) % data.examples.length)}
			>
				<Shuffle size={11} /> another position
			</button>
		</div>
		<div class="grid gap-x-5 gap-y-4 @[560px]:grid-cols-2">
			<!-- true board -->
			<div class="min-w-0">
				<div class="sub-label mb-1">true board (mover's view)</div>
				<svg viewBox="0 0 {BV} {BV}" class="board" role="img" aria-label="true board occupancy">
					{#each grid as g (g)}
						{@const cls = ex.trueOriented[dataIdx(g)]}
						<rect
							x={gx(g) + 1}
							y={gy(g) + 1}
							width={CELL - 2}
							height={CELL - 2}
							rx="4"
							fill={OCC[cls]}
						/>
						{#if cls > 0}
							<circle
								cx={gx(g) + 20}
								cy={gy(g) + 20}
								r="8.5"
								fill={cls === 1 ? '#f7f2e2' : '#2b2450'}
								stroke={cls === 1 ? '#8a6d1f' : '#0b0820'}
								stroke-width="1.5"
							/>
						{/if}
					{/each}
				</svg>
			</div>
			<!-- reconstruction at layer L -->
			<div class="min-w-0">
				<div class="sub-label mb-1" style="color: var(--color-important);">
					probe readout at layer {layer + 1} ·
					<span style="font-family: var(--font-mono);">{exAcc}/64 right</span>
				</div>
				<svg viewBox="0 0 {BV} {BV}" class="board" role="img" aria-label="probe-decoded board">
					{#each grid as g (g)}
						{@const di = dataIdx(g)}
						{@const cls = pred[di]}
						<rect
							x={gx(g) + 1}
							y={gy(g) + 1}
							width={CELL - 2}
							height={CELL - 2}
							rx="4"
							fill={OCC[cls]}
						/>
						{#if cls > 0}
							<circle
								cx={gx(g) + 20}
								cy={gy(g) + 20}
								r="8.5"
								fill={cls === 1 ? '#f7f2e2' : '#2b2450'}
								stroke={cls === 1 ? '#8a6d1f' : '#0b0820'}
								stroke-width="1.5"
							/>
						{/if}
						{#if cls !== ex.trueOriented[di]}
							<rect
								x={gx(g) + 3}
								y={gy(g) + 3}
								width={CELL - 6}
								height={CELL - 6}
								rx="3"
								fill="none"
								stroke="var(--color-challenge)"
								stroke-width="2.5"
							/>
						{/if}
					{/each}
				</svg>
			</div>
		</div>
		<div class="mt-3 max-w-[520px]">
			<Slider
				label="read the stream at layer"
				bind:value={layer}
				min={0}
				max={nLayer - 1}
				step={1}
				tone="violet"
				format={(v) => `ℓ = ${v + 1} of ${nLayer}`}
				hint="drag deeper and the reconstruction sharpens — the board is built up layer by layer"
			/>
		</div>

		<!-- ── ROW B: per-square accuracy heatmap + depth curve ── -->
		<div class="mt-6 grid gap-x-5 gap-y-5 @[620px]:grid-cols-[300px_1fr]">
			<!-- heatmap board -->
			<div class="min-w-0">
				<div class="panel-label mb-1">
					where the board lives — per-square accuracy, layer {layer + 1}
				</div>
				<svg
					viewBox="0 0 {BV} {BV}"
					class="board"
					role="img"
					aria-label="per-square probe accuracy heatmap"
				>
					{#each grid as g (g)}
						{@const acc = heat[dataIdx(g)]}
						<rect
							x={gx(g) + 1}
							y={gy(g) + 1}
							width={CELL - 2}
							height={CELL - 2}
							rx="4"
							fill={heatFill(acc)}
						/>
						<text x={gx(g) + 20} y={gy(g) + 24} text-anchor="middle" class="heatnum"
							>{Math.round(acc * 100)}</text
						>
					{/each}
				</svg>
				<p class="mt-1 text-[10.5px]" style="color: var(--color-text-muted);">
					the mover's own ranks (bottom) read near-perfectly; the far side is fuzzier — exactly what
					a next-move predictor needs most.
				</p>
			</div>

			<!-- depth curve -->
			<div class="min-w-0">
				<div class="panel-label mb-1">accuracy vs depth — trained vs an untrained control</div>
				<svg viewBox="0 0 {CW} {CH}" class="chart" role="img" aria-label="probe accuracy per layer">
					{#each [0.6, 0.7, 0.8] as g (g)}
						<line
							x1={CM.left}
							y1={cy(g)}
							x2={CM.left + cpw}
							y2={cy(g)}
							stroke="var(--color-border-light)"
						/>
						<text class="tick" x={CM.left - 5} y={cy(g) + 3} text-anchor="end"
							>{(g * 100).toFixed(0)}%</text
						>
					{/each}
					<!-- baseline (guess 'empty') -->
					<line
						x1={CM.left}
						y1={cy(data.baseline)}
						x2={CM.left + cpw}
						y2={cy(data.baseline)}
						stroke="var(--color-text-muted)"
						stroke-dasharray="4 4"
						opacity="0.6"
					/>
					<text
						class="tick"
						x={CM.left + cpw}
						y={cy(data.baseline) - 4}
						text-anchor="end"
						fill="var(--color-text-muted)">guess "empty" ({(data.baseline * 100).toFixed(0)}%)</text
					>
					<!-- control (flat) -->
					<polyline
						points={linePts('control')}
						fill="none"
						stroke="var(--color-text-muted)"
						stroke-width="2"
						stroke-dasharray="3 4"
						opacity="0.7"
					/>
					<!-- trained (rising) -->
					<polyline
						points={linePts('trained')}
						fill="none"
						stroke="#a855f7"
						stroke-width="2.6"
						stroke-linejoin="round"
					/>
					<line
						x1={cx(layer)}
						y1={CM.top}
						x2={cx(layer)}
						y2={CM.top + cph}
						stroke="#a855f7"
						stroke-dasharray="3 3"
						opacity="0.5"
					/>
					{#each data.layers as v, l (l)}
						<circle
							cx={cx(l)}
							cy={cy(v.trained)}
							r={l === layer ? 5.5 : 3}
							fill={l === layer ? '#a855f7' : 'var(--color-surface)'}
							stroke="#a855f7"
							stroke-width="2"
						/>
						<text class="tick" x={cx(l)} y={CH - 9} text-anchor="middle">{l + 1}</text>
					{/each}
					<text
						class="serieslbl"
						x={cx(nLayer - 1)}
						y={cy(data.layers[nLayer - 1].trained) - 9}
						text-anchor="end"
						fill="#a855f7">trained</text
					>
					<text
						class="serieslbl"
						x={cx(nLayer - 1)}
						y={cy(data.layers[nLayer - 1].control) + 15}
						text-anchor="end"
						fill="var(--color-text-muted)">untrained</text
					>
				</svg>
				<p class="mt-1 text-[11px]" style="color: var(--color-text-secondary);">
					The trained model's board gets <em>more</em> readable the deeper you look — it's
					constructed, layer by layer. The same architecture with random weights (dashed) is flat:
					<strong style="color: var(--color-text);">training put the board there.</strong>
				</p>
			</div>
		</div>

		<!-- formula + claim -->
		<div
			class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border p-4"
			style="border-color: var(--color-border-light);"
		>
			<div class="shrink-0"><Formula tex={TEX} display /></div>
			<p class="min-w-[240px] flex-1 text-[11px]" style="color: var(--color-text-secondary);">
				<strong style="color: var(--color-important);">W<sub>probe</sub> is one linear map</strong>
				— no hidden layers, no computation of its own. That it can read a square off h<sub>ℓ</sub> means
				the board is already sitting in the stream as directions. Rook was only ever graded on next-move
				text; nobody put a board in there.
			</p>
		</div>

		<p class="footnote mt-4">
			Real result, not an illustration. Flagship Rook — {fmtM(data.config.params)} parameters,
			{data.config.nLayer} layers — trained from scratch for {data.config.trainMinutes} minutes on
			{(data.config.games / 1000).toFixed(0)}k random-legal games (val loss {data.config.valLoss}),
			then probed on held-out games. Best layer decodes the board at
			<strong style="color: var(--color-important);"
				>{(data.layers[data.bestLayer].trained * 100).toFixed(1)}%</strong
			>
			per square, vs {(data.baseline * 100).toFixed(1)}% for guessing "empty" and
			{(data.layers[data.bestLayer].control * 100).toFixed(1)}% for the untrained control. Not the
			~99% of Karvonen's million-game chess-GPT (Li et al. 2023 · Karvonen 2024) — but the same
			emergent board, reproduced on a laptop.
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
	.sub-label {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--color-text-muted);
	}
	.board {
		width: 100%;
		max-width: 300px;
		margin-inline: auto;
		display: block;
	}
	.chart {
		width: 100%;
		max-width: 640px;
		display: block;
	}
	.heatnum {
		fill: var(--color-text);
		font-family: var(--font-mono);
		font-size: 12px;
		opacity: 0.75;
	}
	.tick {
		fill: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.serieslbl {
		font-family: var(--font-heading);
		font-size: 12px;
		font-weight: 700;
	}
	.mini-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid var(--color-border);
		border-radius: 0.4rem;
		padding: 0.15rem 0.55rem;
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
	}
	.mini-btn:hover {
		border-color: var(--color-important);
	}
	.measured-chip {
		border: 1px solid color-mix(in srgb, var(--color-tip) 40%, var(--color-border));
		border-radius: 999px;
		padding: 0.1rem 0.55rem;
		font-family: var(--font-mono);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-tip);
	}
	.footnote {
		border-top: 1px solid var(--color-border-light);
		padding-top: 0.6rem;
		font-size: 10.5px;
		font-style: italic;
		color: var(--color-text-muted);
	}
</style>
