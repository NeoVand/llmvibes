<script lang="ts">
	// The time machine — one slider, both birds, their whole training run saved as
	// ~12 log-spaced checkpoints. Drag right→left and watch skill dissolve: Quill's
	// prose falls back through broken grammar to static, Rook's move arrows scatter
	// from legal openings to noise. Everything shown is REAL and recorded from an
	// offline run of the live-pair architecture (spikes/timemachine/record_timemachine.py):
	// the samples were generated from the same int8-quantized weights that ship, so
	// the optional "re-roll live" (WebGPU) reproduces them from the actual weights.
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { Chess } from 'chess.js';
	import { History, Loader2, Rewind, Sparkles, Zap } from 'lucide-svelte';
	import Slider from '../ui/Slider.svelte';
	import ChessBoard from '../chess/ChessBoard.svelte';
	import { WorkerEngine } from '../../llm/worker-engine';
	import { detectCapability } from '../../llm/engine';
	import { loadBpe, type BpeTokenizer } from '../../llm/bpe';

	interface QuillSample {
		prompt: string;
		text: string;
	}
	interface RookArrow {
		uci: string;
		p: number;
		legal: boolean;
	}
	interface RookScene {
		moves: string[];
		arrows: RookArrow[];
	}
	interface Waypoint {
		step: number;
		trainLoss: number;
		valLoss: number;
		scales: number[];
		bytes: number;
		samples?: QuillSample[];
		legalRate?: number;
		scenes?: RookScene[];
		game?: string[];
		illegalAt?: number | null;
	}
	interface Manifest {
		bird: 'quill' | 'rook';
		config: { nLayer: number; nEmbd: number; nHead: number; blockSize: number; vocab: number };
		params: number;
		leafSizes: number[];
		quant: string;
		steps: number;
		waypoints: Waypoint[];
	}

	let quill = $state<Manifest | null>(null);
	let rook = $state<Manifest | null>(null);
	let error = $state('');
	let i = $state(0); // shared waypoint index (both birds share the schedule)
	let sceneIdx = $state(0); // which Rook position: 0 = start, 1 = after 1.e4
	let webgpu = $state(false);

	onMount(async () => {
		try {
			const [q, r] = await Promise.all([
				fetch(`${base}/data/timemachine/quill-manifest.json`),
				fetch(`${base}/data/timemachine/rook-manifest.json`)
			]);
			if (!q.ok || !r.ok) throw new Error(`manifest fetch failed (${q.status}/${r.status})`);
			quill = (await q.json()) as Manifest;
			rook = (await r.json()) as Manifest;
			// open at the trained end — drag left to rewind
			i = Math.min(quill.waypoints.length, rook.waypoints.length) - 1;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
		detectCapability()
			.then((c) => (webgpu = c === 'webgpu'))
			.catch(() => (webgpu = false));
	});

	const wps = $derived(quill?.waypoints ?? []);
	const n = $derived(Math.min(quill?.waypoints.length ?? 0, rook?.waypoints.length ?? 0));
	const step = $derived(wps[i]?.step ?? 0);
	const totalSteps = $derived(quill?.steps ?? 0);
	const frac = $derived(n > 1 ? i / (n - 1) : 0);
	const phase = $derived(
		i === 0
			? 'random weights'
			: frac < 0.4
				? 'finding structure'
				: frac < 0.85
					? 'assembling ability'
					: 'trained'
	);

	function fmtStep(s: number): string {
		return s >= 1000 ? `${(s / 1000).toFixed(s % 1000 === 0 ? 0 : 1)}k` : String(s);
	}

	// ── Rook board state at the selected scene ──────────────────────────────────
	function parseUci(uci: string): { from: string; to: string; promotion?: string } {
		return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined };
	}
	const rookScene = $derived(rook?.waypoints[i]?.scenes?.[sceneIdx]);
	const rookFen = $derived.by(() => {
		const c = new Chess();
		for (const m of rookScene?.moves ?? []) c.move(parseUci(m));
		return c.fen();
	});
	const rookArrows = $derived.by(() => {
		const arr = rookScene?.arrows ?? [];
		const maxP = Math.max(1e-6, ...arr.map((a) => a.p));
		return arr
			.filter((a) => a.uci.length >= 4)
			.slice(0, 6)
			.map((a) => ({
				...parseUci(a.uci),
				tone: (a.legal ? 'good' : 'bad') as 'good' | 'bad',
				weight: 0.25 + 0.75 * (a.p / maxP)
			}));
	});
	const legalRate = $derived(rook?.waypoints[i]?.legalRate ?? 0);
	const rookGame = $derived(rook?.waypoints[i]?.game ?? []);
	const rookIllegalAt = $derived(rook?.waypoints[i]?.illegalAt ?? null);

	// ── mini-plot geometry (index-x, so the plot aligns with the slider) ────────
	const PW = 300;
	const PH = 96;
	const PAD = { l: 34, r: 10, t: 12, b: 18 };
	function px(idx: number): number {
		return PAD.l + (n > 1 ? idx / (n - 1) : 0) * (PW - PAD.l - PAD.r);
	}
	function py(v: number, lo: number, hi: number): number {
		const t = hi === lo ? 0 : (v - lo) / (hi - lo);
		return PAD.t + (1 - t) * (PH - PAD.t - PAD.b);
	}

	const quillLoss = $derived(wps.map((w) => w.valLoss));
	const lossHi = $derived(Math.max(...quillLoss, 1));
	const lossLo = $derived(Math.min(...quillLoss, 0));
	const rookRates = $derived((rook?.waypoints ?? []).map((w) => w.legalRate ?? 0));

	function pathFor(vals: number[], lo: number, hi: number): string {
		return vals
			.slice(0, n)
			.map((v, k) => `${k === 0 ? 'M' : 'L'}${px(k).toFixed(1)},${py(v, lo, hi).toFixed(1)}`)
			.join(' ');
	}

	// ── re-roll live: dequantize the shipped int8 waypoint, run the real weights ─
	let quillTok: BpeTokenizer | null = null;
	let quillEngine: WorkerEngine | null = null;
	let rookEngine: WorkerEngine | null = null;
	let quillLive = $state<{ i: number; text: string } | null>(null);
	let rookLive = $state<{ i: number; moves: string[]; legal: number } | null>(null);
	let busy = $state<'' | 'quill' | 'rook'>('');

	async function dequant(bird: 'quill' | 'rook', idx: number, man: Manifest): Promise<ArrayBuffer> {
		const res = await fetch(`${base}/data/timemachine/${bird}-w${idx}.i8`);
		if (!res.ok) throw new Error(`weights fetch failed: ${res.status}`);
		const q = new Int8Array(await res.arrayBuffer());
		const flat = new Float32Array(q.length);
		let off = 0;
		for (let li = 0; li < man.leafSizes.length; li++) {
			const s = man.waypoints[idx].scales[li];
			const sz = man.leafSizes[li];
			for (let k = 0; k < sz; k++) flat[off + k] = q[off + k] * s;
			off += sz;
		}
		return flat.buffer;
	}

	async function rerollQuill() {
		if (!quill || busy) return;
		busy = 'quill';
		try {
			if (!quillTok) quillTok = await loadBpe(`${base}/data/quill-vocab.json`);
			const tok = quillTok;
			if (!quillEngine) {
				quillEngine = new WorkerEngine({
					tokenData: new Uint16Array(2048),
					decode: (ids) => tok.decode(ids),
					decodeOne: (id) => tok.decodeOne(id)
				});
				await quillEngine.init({ bird: 'quill', ...quill.config });
			}
			await quillEngine.loadWeights(await dequant('quill', i, quill));
			const r = await quillEngine.sample(tok.encode('Once upon a time, '), {
				temperature: 0.7,
				maxTokens: 48
			});
			quillLive = { i, text: r.text };
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = '';
		}
	}

	async function rerollRook() {
		if (!rook || busy) return;
		busy = 'rook';
		try {
			const vocab = (await (await fetch(`${base}/data/rook-vocab.json`)).json()) as {
				moves: string[];
			};
			const uciOf = (id: number) => (id === 0 ? '' : (vocab.moves[id - 1] ?? ''));
			if (!rookEngine) {
				rookEngine = new WorkerEngine({
					tokenData: new Uint16Array(2048),
					decode: (ids) => ids.map(uciOf).filter(Boolean).join(' '),
					decodeOne: uciOf,
					stopToken: 0
				});
				await rookEngine.init({ bird: 'rook', ...rook.config });
			}
			await rookEngine.loadWeights(await dequant('rook', i, rook));
			const r = await rookEngine.sample([0], { temperature: 0.5, maxTokens: 24 });
			// validate legality with chess.js
			const board = new Chess();
			const played: string[] = [];
			let legal = 0;
			for (const id of r.tokens) {
				const uci = uciOf(id);
				if (!uci) break;
				try {
					board.move(parseUci(uci));
					played.push(uci);
					legal++;
				} catch {
					played.push(uci);
					break;
				}
			}
			rookLive = { i, moves: played, legal };
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = '';
		}
	}

	$effect(() => {
		// invalidate stale live results when scrubbing away
		if (quillLive && quillLive.i !== i) quillLive = null;
		if (rookLive && rookLive.i !== i) rookLive = null;
	});

	// tidy up workers on unmount
	onMount(() => () => {
		quillEngine?.dispose();
		rookEngine?.dispose();
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
		<History size={16} strokeWidth={2.5} />
		<span>The Time Machine — one slider, both birds</span>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		A real training run of the live pair, saved as {n || '12'} checkpoints. Drag from
		<em>trained</em> back toward <em>random weights</em> and watch skill come apart. Nothing is animated
		— each frame is the model's actual output at that step, generated from the shipped int8 weights.
	</p>

	{#if error}
		<p class="text-sm" style="color: var(--color-challenge);">couldn't load the run: {error}</p>
	{:else if !quill || !rook || n === 0}
		<div class="flex items-center gap-2 py-8 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> loading the recorded run…
		</div>
	{:else}
		<!-- shared scrubber -->
		<div class="mb-5 rounded-lg p-3" style="background: var(--color-bg-secondary);">
			<Slider
				label="training step"
				bind:value={i}
				min={0}
				max={n - 1}
				step={1}
				tone="accent"
				format={() => `${fmtStep(step)} of ${fmtStep(totalSteps)}`}
			/>
			<div class="mt-1.5 flex items-center justify-between text-[11px]">
				<span style="color: var(--color-text-muted);">
					checkpoint {i + 1}/{n}
				</span>
				<span
					class="rounded-full px-2 py-0.5 font-semibold"
					style="background: color-mix(in srgb, var(--color-important) 14%, transparent); color: var(--color-important);"
				>
					{phase}
				</span>
			</div>
		</div>

		<!-- twin columns -->
		<div class="grid gap-4 md:grid-cols-2">
			<!-- Quill -->
			<div class="rounded-lg border p-3" style="border-color: var(--color-border);">
				<div class="mb-1 flex items-center justify-between">
					<span
						class="flex items-center gap-1.5 text-[13px] font-semibold"
						style="color: var(--color-note);"
					>
						<Sparkles size={13} /> Quill — writing
					</span>
					<span class="font-mono text-[11px]" style="color: var(--color-text-muted);">
						val loss {wps[i].valLoss.toFixed(2)}
					</span>
				</div>

				<svg viewBox="0 0 {PW} {PH}" class="w-full" role="img" aria-label="Quill validation loss">
					<line
						x1={PAD.l}
						y1={PH - PAD.b}
						x2={PW - PAD.r}
						y2={PH - PAD.b}
						stroke="var(--color-border-light)"
					/>
					<text
						x={PAD.l - 5}
						y={PAD.t + 3}
						text-anchor="end"
						font-size="8.5"
						fill="var(--color-text-muted)">{lossHi.toFixed(1)}</text
					>
					<text
						x={PAD.l - 5}
						y={PH - PAD.b}
						text-anchor="end"
						font-size="8.5"
						fill="var(--color-text-muted)">{lossLo.toFixed(1)}</text
					>
					<path
						d={pathFor(quillLoss, lossLo, lossHi)}
						fill="none"
						stroke="var(--color-note)"
						stroke-width="2"
						stroke-linejoin="round"
					/>
					<line
						x1={px(i)}
						y1={PAD.t - 4}
						x2={px(i)}
						y2={PH - PAD.b}
						stroke="var(--color-important)"
						stroke-width="1.2"
						opacity="0.7"
					/>
					<circle
						cx={px(i)}
						cy={py(wps[i].valLoss, lossLo, lossHi)}
						r="3.5"
						fill="var(--color-note)"
					/>
					<text
						x={(PAD.l + PW - PAD.r) / 2}
						y={PH - 4}
						text-anchor="middle"
						font-size="8.5"
						fill="var(--color-text-muted)">step (log-spaced) →</text
					>
				</svg>

				<div class="mt-1 space-y-2">
					{#each wps[i].samples ?? [] as s (s.prompt)}
						<p
							class="rounded-md p-2 text-[12.5px] leading-snug"
							style="background: var(--color-bg-secondary); white-space: pre-wrap; word-break: break-word;"
						>
							<span style="color: var(--color-text-muted);">{s.prompt}</span><span
								style="color: var(--color-text);">{s.text}</span
							>
						</p>
					{/each}
				</div>

				{#if webgpu}
					<div class="mt-2 flex items-center gap-2">
						<button
							class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-50"
							style="background: color-mix(in srgb, var(--color-note) 16%, transparent); color: var(--color-note);"
							disabled={busy !== ''}
							onclick={rerollQuill}
						>
							{#if busy === 'quill'}<Loader2 size={12} class="animate-spin" />{:else}<Zap
									size={12}
								/>{/if}
							re-roll live
						</button>
						{#if quillLive && quillLive.i === i}
							<span class="text-[10.5px]" style="color: var(--color-text-muted);"
								>from the shipped int8 weights ↓</span
							>
						{/if}
					</div>
					{#if quillLive && quillLive.i === i}
						<p
							class="mt-1.5 rounded-md p-2 text-[12.5px] leading-snug"
							style="background: color-mix(in srgb, var(--color-note) 8%, transparent); white-space: pre-wrap; word-break: break-word;"
						>
							<span style="color: var(--color-text-muted);">Once upon a time, </span><span
								style="color: var(--color-note);">{quillLive.text}</span
							>
						</p>
					{/if}
				{/if}
			</div>

			<!-- Rook -->
			<div class="rounded-lg border p-3" style="border-color: var(--color-border);">
				<div class="mb-1 flex items-center justify-between">
					<span
						class="flex items-center gap-1.5 text-[13px] font-semibold"
						style="color: var(--color-tip);"
					>
						<Rewind size={13} /> Rook — playing
					</span>
					<span class="font-mono text-[11px]" style="color: var(--color-text-muted);">
						{(legalRate * 100).toFixed(0)}% legal
					</span>
				</div>

				<svg viewBox="0 0 {PW} {PH}" class="w-full" role="img" aria-label="Rook legal-move rate">
					<line
						x1={PAD.l}
						y1={PH - PAD.b}
						x2={PW - PAD.r}
						y2={PH - PAD.b}
						stroke="var(--color-border-light)"
					/>
					<text
						x={PAD.l - 5}
						y={PAD.t + 3}
						text-anchor="end"
						font-size="8.5"
						fill="var(--color-text-muted)">100%</text
					>
					<text
						x={PAD.l - 5}
						y={PH - PAD.b}
						text-anchor="end"
						font-size="8.5"
						fill="var(--color-text-muted)">0%</text
					>
					<path
						d={pathFor(rookRates, 0, 1)}
						fill="none"
						stroke="var(--color-tip)"
						stroke-width="2"
						stroke-linejoin="round"
					/>
					<line
						x1={px(i)}
						y1={PAD.t - 4}
						x2={px(i)}
						y2={PH - PAD.b}
						stroke="var(--color-important)"
						stroke-width="1.2"
						opacity="0.7"
					/>
					<circle cx={px(i)} cy={py(legalRate, 0, 1)} r="3.5" fill="var(--color-tip)" />
					<text
						x={(PAD.l + PW - PAD.r) / 2}
						y={PH - 4}
						text-anchor="middle"
						font-size="8.5"
						fill="var(--color-text-muted)">step (log-spaced) →</text
					>
				</svg>

				<div class="mt-1 flex gap-3">
					<div class="w-[46%] shrink-0">
						<ChessBoard fen={rookFen} arrows={rookArrows} coordinates={false} />
					</div>
					<div class="min-w-0 flex-1">
						<div class="mb-1 flex gap-1">
							{#each ['start', 'after 1.e4'] as lbl, si (lbl)}
								<button
									class="rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-colors"
									style={si === sceneIdx
										? 'background: var(--color-tip); color: var(--color-bg);'
										: 'background: var(--color-bg-secondary); color: var(--color-text-muted);'}
									onclick={() => (sceneIdx = si)}>{lbl}</button
								>
							{/each}
						</div>
						<p class="text-[11px] leading-snug" style="color: var(--color-text-muted);">
							Arrows are Rook's top moves here —
							<span style="color: var(--color-tip);">legal</span> /
							<span style="color: var(--color-challenge);">illegal</span>, opacity by confidence.
						</p>
						<!-- legal-move gauge -->
						<div class="mt-2">
							<div
								class="h-2 w-full overflow-hidden rounded-full"
								style="background: var(--color-bg-tertiary);"
							>
								<div
									class="h-full rounded-full transition-[width] duration-200"
									style="width: {legalRate * 100}%; background: var(--color-tip);"
								></div>
							</div>
							<p class="mt-1 text-[11px]" style="color: var(--color-text-secondary);">
								{(legalRate * 100).toFixed(0)}% of moves legal ·
								{#if rookIllegalAt === null}
									sampled game stayed legal {rookGame.length} plies
								{:else}
									sample broke rules at ply {rookIllegalAt + 1}
								{/if}
							</p>
						</div>
					</div>
				</div>

				{#if webgpu}
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<button
							class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-50"
							style="background: color-mix(in srgb, var(--color-tip) 16%, transparent); color: var(--color-tip);"
							disabled={busy !== ''}
							onclick={rerollRook}
						>
							{#if busy === 'rook'}<Loader2 size={12} class="animate-spin" />{:else}<Zap
									size={12}
								/>{/if}
							re-roll live
						</button>
						{#if rookLive && rookLive.i === i}
							<span class="font-mono text-[11px]" style="color: var(--color-text-muted);">
								{rookLive.legal} legal plies live:
								<span style="color: var(--color-tip);">{rookLive.moves.slice(0, 8).join(' ')}</span>
							</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<p class="mt-4 text-[11.5px] leading-relaxed" style="color: var(--color-text-muted);">
			Same architecture, same slider, opposite surfaces: Quill's prose and Rook's legality both
			assemble along the run in a stable order — noise → fragments → structure. This is the live
			pair (≈1M params each), trained offline in minutes; the flagships get the same treatment at
			far greater length in Part 5. Weights are int8-quantized per checkpoint; on WebGPU, “re-roll
			live” runs the actual shipped weights so you can confirm the frames aren't canned.
		</p>
	{/if}
</div>
