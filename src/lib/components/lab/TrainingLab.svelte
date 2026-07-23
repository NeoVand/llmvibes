<script lang="ts">
	// The pretraining cockpit. v2 de-contrives the original: you choose the step
	// budget and learning rate, train MORE whenever you like (weights persist in
	// the worker), watch train AND held-out validation loss, X-ray per-tensor
	// gradient norms, and — the point — a two-sided playground: your prompt on
	// the left, the model's next-token distribution and per-token surprise on
	// the right. Nothing is canned; every number is measured on your GPU.
	import { onDestroy } from 'svelte';
	import { Play, Square, Sparkles, Cpu, Loader2, RotateCcw, Activity, Eye } from 'lucide-svelte';
	import {
		detectCapability,
		type ModelConfig,
		type TrainStepMetrics,
		type PerTokenInfo
	} from '$lib/llm/engine';
	import { WorkerEngine } from '$lib/llm/worker-engine';
	import { BpeTokenizer, type BpeVocab } from '$lib/llm/bpe';
	import { base } from '$app/paths';
	import TokenStream from './TokenStream.svelte';
	import Slider from '../ui/Slider.svelte';

	interface RookVocab {
		moves: string[];
		vocabSize: number;
	}

	let {
		bird,
		title,
		steps = 200,
		config
	}: {
		bird: 'quill' | 'rook';
		title: string;
		steps?: number;
		config: Omit<ModelConfig, 'bird' | 'vocab'>;
	} = $props();

	type Phase = 'idle' | 'loading' | 'ready' | 'training' | 'error' | 'no-webgpu';
	let phase = $state<Phase>('idle');
	let error = $state('');
	let engine: WorkerEngine | null = null;
	let paramCountM = $state(0);
	let corpusTokens = $state(0);

	let losses = $state<number[]>([]);
	let valPoints = $state<Array<{ step: number; loss: number }>>([]);
	let lastMetrics = $state<TrainStepMetrics | null>(null);
	let totalSteps = $state(0);
	let stopFlag = false;

	// training knobs (lrLog is log10 of the real learning rate)
	let stepsToRun = $state(steps);
	let lrLog = $state(Math.log10(3e-4));
	let lrApplied = 3e-4;
	const lrWanted = $derived(10 ** lrLog);

	let samples = $state<Array<{ text: string; temp: number }>>([]);
	let sampling = $state(false);
	let temperature = $state(0.8);
	let inspected = $state<PerTokenInfo[] | null>(null);
	/** Rook only: fraction of sampled moves that were legal in context. */
	let legalRate = $state<number | null>(null);

	// two-sided playground
	let promptText = $state('Once upon a time');
	let dist = $state<Array<{ label: string; p: number }> | null>(null);
	let entropyBits = $state<number | null>(null);
	let peeking = $state(false);

	// gradient x-ray
	let gradReport = $state<{ loss: number; norms: Array<{ name: string; norm: number }> } | null>(
		null
	);
	let gradBusy = $state(false);
	let showGrad = $state(false);

	let quillTok: BpeTokenizer | null = null;
	let rookMoves: string[] = [];

	let engineVocab = $state(0);
	const lnV = $derived(corpusTokens > 0 && engineVocab > 0 ? Math.log(engineVocab) : 0);

	async function setup() {
		phase = 'loading';
		error = '';
		try {
			if ((await detectCapability()) !== 'webgpu') {
				phase = 'no-webgpu';
				return;
			}
			const dataUrl = `${base}/data/${bird}-tokens.bin`;
			const vocabUrl = `${base}/data/${bird}-vocab.json`;
			const [binRes, vocabRes] = await Promise.all([fetch(dataUrl), fetch(vocabUrl)]);
			if (!binRes.ok || !vocabRes.ok) throw new Error('corpus download failed');
			const tokenData = new Uint16Array(await binRes.arrayBuffer());
			corpusTokens = tokenData.length;

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
				const vocab = (await vocabRes.json()) as RookVocab;
				rookMoves = vocab.moves;
				vocabSize = vocab.vocabSize;
				decode = (ids) => ids.map((i) => (i === 0 ? '·' : rookMoves[i - 1])).join(' ');
				decodeOne = (id) => (id === 0 ? '·' : (rookMoves[id - 1] ?? '?'));
			}
			engineVocab = vocabSize;

			engine = new WorkerEngine({ tokenData, decode, decodeOne, seed: 42, lr: lrApplied });
			const modelConfig: ModelConfig = { bird, vocab: vocabSize, ...config };
			await engine.init(modelConfig);
			paramCountM = countParams(modelConfig) / 1e6;
			phase = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	function countParams(c: ModelConfig): number {
		const d = c.nEmbd;
		return c.vocab * d + c.blockSize * d + d * c.vocab + c.nLayer * (4 * d * d + 8 * d * d);
	}

	/** Chunked training: every 25 steps, pause to measure held-out loss so the
	 * validation curve is real, not decorative. */
	async function train() {
		if (!engine) return;
		phase = 'training';
		stopFlag = false;
		try {
			if (Math.abs(lrWanted - lrApplied) / lrApplied > 1e-3) {
				await engine.setLr(lrWanted);
				lrApplied = lrWanted;
			}
			let remaining = stepsToRun;
			const CHUNK = 25;
			while (remaining > 0 && !stopFlag) {
				const n = Math.min(CHUNK, remaining);
				await engine.train(n, (m) => {
					losses = [...losses, m.loss];
					lastMetrics = m;
					totalSteps = m.step;
				});
				remaining -= n;
				const vl = await engine.valLoss();
				valPoints = [...valPoints, { step: totalSteps, loss: vl }];
			}
			phase = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	async function stopTraining() {
		stopFlag = true;
		await engine?.stop();
	}

	/** Fresh weights, same corpus — the honest reset. */
	async function resetWeights() {
		if (!engine) return;
		await engine.dispose();
		engine = null;
		losses = [];
		valPoints = [];
		lastMetrics = null;
		totalSteps = 0;
		samples = [];
		inspected = null;
		legalRate = null;
		dist = null;
		entropyBits = null;
		gradReport = null;
		await setup();
	}

	function promptIds(): number[] {
		if (bird === 'quill') return quillTok!.encode(promptText || 'Once upon a time');
		return [0];
	}

	async function sample() {
		if (!engine || sampling) return;
		sampling = true;
		try {
			const prompt = promptIds();
			const r = await engine.sample(prompt, { temperature, topK: 40, maxTokens: 100 });
			samples = [{ text: r.text, temp: temperature }, ...samples].slice(0, 3);
			if (bird === 'rook') legalRate = await measureLegalRate(r.tokens);
			const promptAndSample = [...prompt, ...r.tokens].slice(0, config.blockSize);
			inspected = await engine.inspect(promptAndSample);
			await peek();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			sampling = false;
		}
	}

	/** The under-the-hood side: full next-token distribution for the prompt. */
	async function peek() {
		if (!engine || totalSteps === 0 || peeking) return;
		peeking = true;
		try {
			const row = await engine.nextDistribution(promptIds());
			let total = 0;
			const probs = new Float64Array(row.length);
			for (let i = 0; i < row.length; i++) {
				probs[i] = Math.exp(row[i]);
				total += probs[i];
			}
			let H = 0;
			for (let i = 0; i < row.length; i++) {
				const p = probs[i] / total;
				if (p > 1e-12) H -= p * Math.log(p);
			}
			entropyBits = H / Math.LN2;
			const order = Array.from(probs.keys()).sort((a, b) => probs[b] - probs[a]);
			dist = order.slice(0, 8).map((i) => ({
				label: labelFor(i),
				p: probs[i] / total
			}));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			peeking = false;
		}
	}

	function labelFor(id: number): string {
		if (bird === 'rook') return id === 0 ? '<game>' : (rookMoves[id - 1] ?? '?');
		return quillTok!.decodeOne(id).replaceAll('␣', ' ').replaceAll('⏎', '↵');
	}

	let peekTimer: ReturnType<typeof setTimeout> | undefined;
	function promptEdited() {
		clearTimeout(peekTimer);
		peekTimer = setTimeout(() => void peek(), 500);
	}

	async function xray() {
		if (!engine || gradBusy) return;
		gradBusy = true;
		showGrad = true;
		try {
			gradReport = await engine.gradNorms();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			gradBusy = false;
		}
	}

	const KIND_COLOR: Record<string, string> = {
		wte: '#d9a441',
		wpe: '#d9a441',
		lmHead: 'var(--color-important)',
		wq: '#5a8fc0',
		wk: '#c87142',
		wv: '#56a884',
		wo: '#b06a82',
		mlpFc1: '#ecc068',
		mlpFc2: '#c08a38'
	};
	function normColor(name: string): string {
		const kind = name.includes('.') ? name.split('.')[1] : name;
		return KIND_COLOR[kind] ?? 'var(--color-text-muted)';
	}
	const gradScale = $derived.by(() => {
		if (!gradReport) return null;
		const vals = gradReport.norms.map((n) => Math.max(n.norm, 1e-8));
		const lo = Math.log10(Math.min(...vals));
		const hi = Math.log10(Math.max(...vals));
		return { lo, span: Math.max(hi - lo, 1e-6) };
	});

	/** Replay a sampled token stream through real chess rules: what fraction of
	 * the model's moves are legal in the position where it played them? THE
	 * pretraining metric for Rook — next-token prediction with an external
	 * ground truth. (chess.js loads lazily; ~70KB, first call only.) */
	async function measureLegalRate(tokens: number[]): Promise<number | null> {
		const { Chess } = await import('chess.js');
		let attempted = 0;
		let legal = 0;
		let game: InstanceType<typeof Chess> | null = null;
		for (const id of tokens) {
			if (id === 0) {
				game = new Chess();
				continue;
			}
			game ??= new Chess();
			const uci = rookMoves[id - 1];
			if (!uci) continue;
			attempted++;
			try {
				game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
				legal++;
			} catch {
				// illegal here — keep scoring the rest against a fresh board
				game = new Chess();
			}
		}
		return attempted > 0 ? legal / attempted : null;
	}

	// ── loss chart geometry ────────────────────────────────────────────────────
	const W = 560;
	const H = 150;
	const PAD = { l: 30, r: 8, t: 8, b: 16 };
	const chart = $derived.by(() => {
		if (losses.length < 2) return null;
		const allVals = [...losses, ...valPoints.map((v) => v.loss)];
		const lo = Math.min(...allVals) - 0.1;
		const hi = Math.max(...allVals, lnV || 0) + 0.15;
		const span = Math.max(hi - lo, 1e-6);
		const maxStep = Math.max(totalSteps, 1);
		const x = (step: number) => PAD.l + (step / maxStep) * (W - PAD.l - PAD.r);
		const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);
		const trainPath = losses
			.map((l, i) => `${i === 0 ? 'M' : 'L'}${x(i + 1).toFixed(1)},${y(l).toFixed(1)}`)
			.join(' ');
		const valPath = valPoints
			.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(v.step).toFixed(1)},${y(v.loss).toFixed(1)}`)
			.join(' ');
		// nice-ish y ticks: at most 5, on halves
		const ticks: number[] = [];
		const stepSize = span > 3 ? 1 : 0.5;
		for (let t = Math.ceil(lo / stepSize) * stepSize; t < hi; t += stepSize) ticks.push(t);
		const xticks: number[] = [];
		const xstep = maxStep > 600 ? 200 : maxStep > 250 ? 100 : 50;
		for (let s = xstep; s <= maxStep; s += xstep) xticks.push(s);
		return { x, y, trainPath, valPath, ticks, xticks, lo, hi };
	});

	onDestroy(() => {
		clearTimeout(peekTimer);
		engine?.dispose();
	});
</script>

<div
	class="lab my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
			style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
		>
			<Cpu size={16} strokeWidth={2.5} />
			<span>{title}</span>
		</div>
		{#if phase !== 'idle' && phase !== 'no-webgpu' && phase !== 'loading'}
			<div class="text-xs" style="color: var(--color-text-muted);">
				{paramCountM.toFixed(1)}M params · {(corpusTokens / 1000).toFixed(0)}k corpus tokens
				{#if lastMetrics}
					· step {totalSteps} · {lastMetrics.tokensPerSec.toLocaleString()} tok/s
				{/if}
			</div>
		{/if}
	</div>

	{#if phase === 'idle'}
		<button class="lab-btn" onclick={setup}>
			<Play size={14} /> Load {bird === 'quill' ? 'Quill' : 'Rook'}'s lab
		</button>
		<p class="mt-2 text-xs" style="color: var(--color-text-muted);">
			Downloads the corpus (~1 MB) and initializes a fresh model on your GPU.
		</p>
	{:else if phase === 'loading'}
		<div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> Preparing the lab — corpus, tokenizer, fresh weights…
		</div>
	{:else if phase === 'no-webgpu'}
		<p class="text-sm" style="color: var(--color-text-secondary);">
			This browser doesn't expose WebGPU, which live training needs. Chrome or Edge (or Safari 26+)
			will run this lab; the rest of the course works fine without it.
		</p>
	{:else if phase === 'error'}
		<p class="text-sm" style="color: var(--color-challenge);">Lab error: {error}</p>
		<button class="lab-btn mt-2" onclick={setup}>Retry</button>
	{:else}
		<!-- training controls -->
		<div class="mb-3 flex flex-wrap items-end gap-x-4 gap-y-2">
			{#if phase === 'training'}
				<button class="lab-btn" onclick={stopTraining}><Square size={14} /> Stop</button>
			{:else}
				<button class="lab-btn" onclick={train}>
					<Play size={14} />
					{totalSteps > 0 ? `Train ${stepsToRun} more` : `Train ${stepsToRun} steps`}
				</button>
			{/if}
			<div class="w-40">
				<Slider label="steps" bind:value={stepsToRun} min={50} max={500} step={50} tone="blue" />
			</div>
			<div class="w-44">
				<Slider
					label="learning rate γ"
					bind:value={lrLog}
					min={-4}
					max={-2.5}
					step={0.05}
					tone="violet"
					format={(v) => (10 ** v).toExponential(1)}
					hint={Math.abs(lrWanted - lrApplied) / lrApplied > 1e-3
						? 'applies on next run (Adam moments reset)'
						: ''}
				/>
			</div>
			<button
				class="lab-btn"
				disabled={phase === 'training' || totalSteps === 0}
				onclick={resetWeights}
				title="throw the weights away and hatch a fresh bird"
			>
				<RotateCcw size={13} /> Reset
			</button>
		</div>

		<!-- loss chart -->
		<div class="rounded-lg border p-3" style="border-color: var(--color-border-light);">
			<div class="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
				<div class="flex items-center gap-3" style="color: var(--color-text-muted);">
					<span class="legend"><i style="background: var(--color-important);"></i> train loss</span>
					<span class="legend"><i style="background: #a855f7;"></i> validation (held-out 5%)</span>
					<span class="legend"><i class="dash"></i> uniform guess ln(V)</span>
				</div>
				{#if lastMetrics}
					<span style="color: var(--color-text-secondary); font-weight: 600;">
						{lastMetrics.loss.toFixed(3)}
						{#if valPoints.length > 0}
							<span style="color: #a855f7;">
								/ {valPoints[valPoints.length - 1].loss.toFixed(3)}</span
							>
						{/if}
					</span>
				{/if}
			</div>
			<svg
				viewBox="0 0 {W} {H}"
				class="h-36 w-full"
				preserveAspectRatio="none"
				role="img"
				aria-label="training and validation loss curves"
			>
				{#if chart}
					{#each chart.ticks as t (t)}
						<line
							x1={PAD.l}
							y1={chart.y(t)}
							x2={W - PAD.r}
							y2={chart.y(t)}
							stroke="var(--color-border-light)"
							stroke-width="1"
						/>
						<text
							x={PAD.l - 4}
							y={chart.y(t) + 3}
							text-anchor="end"
							font-size="9"
							fill="var(--color-text-muted)">{t.toFixed(1)}</text
						>
					{/each}
					{#each chart.xticks as s (s)}
						<text
							x={chart.x(s)}
							y={H - 4}
							text-anchor="middle"
							font-size="9"
							fill="var(--color-text-muted)">{s}</text
						>
					{/each}
					{#if lnV > chart.lo && lnV < chart.hi}
						<line
							x1={PAD.l}
							y1={chart.y(lnV)}
							x2={W - PAD.r}
							y2={chart.y(lnV)}
							stroke="var(--color-text-muted)"
							stroke-dasharray="4 4"
							stroke-width="1"
							opacity="0.6"
						/>
					{/if}
					<path
						d={chart.trainPath}
						fill="none"
						stroke="var(--color-important)"
						stroke-width="1.8"
					/>
					{#if chart.valPath}
						<path d={chart.valPath} fill="none" stroke="#a855f7" stroke-width="1.8" />
						{#each valPoints as v (v.step)}
							<circle cx={chart.x(v.step)} cy={chart.y(v.loss)} r="2.6" fill="#a855f7" />
						{/each}
					{/if}
				{:else}
					<text
						x={W / 2}
						y={H / 2}
						text-anchor="middle"
						font-size="12"
						fill="var(--color-text-muted)">press Train — both curves draw themselves</text
					>
				{/if}
			</svg>
			{#if valPoints.length > 1}
				<p class="mt-1 text-[11px]" style="color: var(--color-text-muted);">
					Validation is measured on the last 5% of the corpus, which training never touches. While
					the purple curve falls with the pink one, the model is learning the language, not
					memorizing its windows.
				</p>
			{/if}
		</div>

		<!-- two-sided playground -->
		{#if totalSteps > 0}
			<div class="mt-3 grid gap-3 lg:grid-cols-2">
				<!-- your side -->
				<div class="rounded-lg border p-3" style="border-color: var(--color-border-light);">
					<div class="side-label">you</div>
					{#if bird === 'quill'}
						<input
							class="prompt-input"
							type="text"
							bind:value={promptText}
							oninput={promptEdited}
							placeholder="Once upon a time"
							aria-label="prompt"
						/>
					{:else}
						<p class="mb-2 text-xs" style="color: var(--color-text-muted);">
							Rook samples whole games from the <span style="font-family: var(--font-mono);"
								>&lt;game&gt;</span
							> token. (To actually play it, scroll down to the board.)
						</p>
					{/if}
					<div class="mt-2 flex flex-wrap items-end gap-3">
						<button class="lab-btn" disabled={sampling} onclick={sample}>
							{#if sampling}<Loader2 size={14} class="animate-spin" />{:else}<Sparkles
									size={14}
								/>{/if}
							Sample
						</button>
						<div class="w-36">
							<Slider
								label="temp"
								bind:value={temperature}
								min={0.1}
								max={1.5}
								step={0.1}
								decimals={1}
								tone="amber"
							/>
						</div>
					</div>
					{#if samples.length > 0}
						<div class="mt-3 space-y-2">
							{#each samples as s, i (i)}
								<div
									class="rounded-lg border p-3 text-[13px] leading-relaxed"
									style="border-color: var(--color-border-light); color: var(--color-text); font-family: {bird ===
									'rook'
										? 'var(--font-mono)'
										: 'inherit'};"
								>
									<span
										class="mr-1 rounded px-1 text-[10px]"
										style="background: var(--color-surface-hover); color: var(--color-text-muted);"
										>T={s.temp.toFixed(1)}</span
									>
									{s.text}
								</div>
							{/each}
						</div>
					{/if}
					{#if bird === 'rook' && legalRate !== null}
						<div class="mt-3 flex items-center gap-3">
							<span class="text-xs" style="color: var(--color-text-muted);">legal-move rate</span>
							<div
								class="h-2 flex-1 overflow-hidden rounded-full"
								style="background: var(--color-surface-hover);"
							>
								<div
									class="h-full rounded-full"
									style="width: {(legalRate * 100).toFixed(
										0
									)}%; background: var(--color-important); transition: width 400ms ease;"
								></div>
							</div>
							<span class="text-xs font-semibold" style="color: var(--color-text);"
								>{(legalRate * 100).toFixed(0)}%</span
							>
						</div>
					{/if}
				</div>

				<!-- under the hood -->
				<div class="rounded-lg border p-3" style="border-color: var(--color-border-light);">
					<div class="side-label flex items-center gap-2">
						under the hood
						<button
							class="peek-btn"
							disabled={peeking}
							onclick={peek}
							title="recompute the next-token distribution for the current prompt"
						>
							{#if peeking}<Loader2 size={11} class="animate-spin" />{:else}<Eye size={11} />{/if}
							peek
						</button>
						{#if entropyBits !== null}
							<span class="ml-auto text-[11px]" style="color: var(--color-text-muted);">
								H = {entropyBits.toFixed(2)} bits
							</span>
						{/if}
					</div>
					{#if dist}
						<div class="mb-1 text-[11px]" style="color: var(--color-text-muted);">
							what {bird === 'quill' ? 'Quill' : 'Rook'} wants to say next, given
							{bird === 'quill' ? 'your prompt' : 'a fresh game'}:
						</div>
						<div class="space-y-1">
							{#each dist as d, i (d.label + i)}
								<div class="flex items-center gap-2 text-xs" style="font-family: var(--font-mono);">
									<span class="dist-label">{d.label}</span>
									<div
										class="h-2 flex-1 overflow-hidden rounded-full"
										style="background: var(--color-surface-hover);"
									>
										<div
											class="h-full rounded-full"
											style="width: {Math.max(d.p * 100, 1).toFixed(1)}%; background: {i === 0
												? 'var(--color-important)'
												: 'color-mix(in srgb, var(--color-important) 45%, transparent)'}; transition: width 250ms ease;"
										></div>
									</div>
									<span style="color: var(--color-text-muted); min-width: 4ch; text-align: right;"
										>{(d.p * 100).toFixed(1)}%</span
									>
								</div>
							{/each}
						</div>
						<p class="mt-2 text-[11px]" style="color: var(--color-text-muted);">
							The whole model is this list (all {engineVocab} entries of it), reshuffled after every token.
							Entropy says how torn it is: log₂({engineVocab}) ≈ {(
								Math.log(engineVocab) / Math.LN2
							).toFixed(1)} bits would be a coin toss over everything.
						</p>
					{:else}
						<p class="text-xs" style="color: var(--color-text-muted);">
							Press <em>peek</em> (or Sample) to see the model's next-token distribution for the current
							prompt.
						</p>
					{/if}
					{#if inspected}
						<div class="mt-3">
							<div class="mb-1 text-[11px]" style="color: var(--color-text-muted);">
								per-token surprise on the last sample — darker = the model was more wrong
							</div>
							<TokenStream tokens={inspected} mode="loss" />
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- gradient x-ray -->
		<div class="mt-3">
			<button class="lab-btn" disabled={gradBusy} onclick={xray}>
				{#if gradBusy}<Loader2 size={14} class="animate-spin" />{:else}<Activity size={14} />{/if}
				X-ray gradients
			</button>
			{#if showGrad && gradReport && gradScale}
				<div class="mt-2 rounded-lg border p-3" style="border-color: var(--color-border-light);">
					<div class="mb-2 text-[11px]" style="color: var(--color-text-muted);">
						‖∇L‖ per tensor on a fixed probe batch (log scale) — loss there: {gradReport.loss.toFixed(
							3
						)}. Colors: <span style="color: #d9a441;">embeddings</span>,
						<span style="color: #5a8fc0;">Q</span>/<span style="color: #c87142;">K</span>/<span
							style="color: #56a884;">V</span
						>/<span style="color: #b06a82;">O</span>, <span style="color: #ecc068;">MLP</span>, and
						the output head.
					</div>
					<div class="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
						{#each gradReport.norms as n (n.name)}
							<div
								class="flex items-center gap-2 text-[11px]"
								style="font-family: var(--font-mono);"
							>
								<span class="grad-label">{n.name}</span>
								<div
									class="h-1.5 flex-1 overflow-hidden rounded-full"
									style="background: var(--color-surface-hover);"
								>
									<div
										class="h-full rounded-full"
										style="width: {Math.max(
											((Math.log10(Math.max(n.norm, 1e-8)) - gradScale.lo) / gradScale.span) * 100,
											2
										).toFixed(1)}%; background: {normColor(n.name)};"
									></div>
								</div>
								<span style="color: var(--color-text-muted); min-width: 6ch; text-align: right;"
									>{n.norm.toExponential(1)}</span
								>
							</div>
						{/each}
					</div>
					<p class="mt-2 text-[11px]" style="color: var(--color-text-muted);">
						Fresh model? Notice the interior tensors barely move while the output head screams — the
						small-random output initialization means most of the gradient lands there first (Part 7
						tells the war story). Train a while and X-ray again: the gradient spreads inward.
					</p>
				</div>
			{/if}
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
	.lab-btn:hover:not(:disabled) {
		border-color: var(--color-important);
	}
	.lab-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.legend {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.legend i {
		display: inline-block;
		width: 14px;
		height: 3px;
		border-radius: 2px;
	}
	.legend i.dash {
		background: repeating-linear-gradient(
			90deg,
			var(--color-text-muted) 0 3px,
			transparent 3px 6px
		);
	}
	.side-label {
		font-family: var(--font-mono);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-muted);
		margin-bottom: 0.5rem;
	}
	.prompt-input {
		width: 100%;
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
	.peek-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid var(--color-border);
		border-radius: 0.4rem;
		padding: 0.1rem 0.5rem;
		font-size: 10px;
		font-weight: 600;
		text-transform: none;
		letter-spacing: normal;
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
	}
	.peek-btn:hover:not(:disabled) {
		border-color: var(--color-important);
	}
	.dist-label {
		min-width: 5.5rem;
		max-width: 9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: pre;
		color: var(--color-text);
	}
	.grad-label {
		min-width: 5.5rem;
		color: var(--color-text);
	}
</style>
