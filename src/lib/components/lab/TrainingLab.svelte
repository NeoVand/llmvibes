<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Play, Square, Sparkles, Cpu, Loader2 } from 'lucide-svelte';
	import { detectCapability, type ModelConfig, type TrainStepMetrics, type PerTokenInfo } from '$lib/llm/engine';
	import { WorkerEngine } from '$lib/llm/worker-engine';
	import { BpeTokenizer, type BpeVocab } from '$lib/llm/bpe';
	import { base } from '$app/paths';
	import TokenStream from './TokenStream.svelte';

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
	let lastMetrics = $state<TrainStepMetrics | null>(null);
	let totalSteps = $state(0);

	let samples = $state<string[]>([]);
	let sampling = $state(false);
	let inspected = $state<PerTokenInfo[] | null>(null);

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

			engine = new WorkerEngine({ tokenData, decode, decodeOne, seed: 42 });
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

	async function train() {
		if (!engine) return;
		phase = 'training';
		try {
			await engine.train(steps, (m) => {
				losses = [...losses, m.loss];
				lastMetrics = m;
				totalSteps = m.step;
			});
			phase = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	async function stopTraining() {
		await engine?.stop();
	}

	async function sample() {
		if (!engine || sampling) return;
		sampling = true;
		try {
			const prompt = bird === 'quill' ? quillTok!.encode('Once upon a time') : [0];
			const r = await engine.sample(prompt, { temperature: 0.8, topK: 40, maxTokens: 100 });
			samples = [r.text, ...samples].slice(0, 3);
			const promptAndSample = [...prompt, ...r.tokens].slice(0, config.blockSize);
			inspected = await engine.inspect(promptAndSample);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			sampling = false;
		}
	}

	// Loss sparkline geometry
	const W = 560;
	const H = 120;
	const path = $derived.by(() => {
		if (losses.length < 2) return '';
		const lo = Math.min(...losses);
		const hi = Math.max(...losses, lnV || Math.max(...losses));
		const span = Math.max(hi - lo, 1e-6);
		return losses
			.map((l, i) => {
				const x = (i / (losses.length - 1)) * W;
				const y = H - ((l - lo) / span) * (H - 8) - 4;
				return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	});
	const lnVy = $derived.by(() => {
		if (losses.length < 2 || !lnV) return null;
		const lo = Math.min(...losses);
		const hi = Math.max(...losses, lnV);
		const span = Math.max(hi - lo, 1e-6);
		return H - ((lnV - lo) / span) * (H - 8) - 4;
	});

	onDestroy(() => {
		engine?.dispose();
	});
</script>

<div class="lab my-6 rounded-xl border p-5" style="border-color: var(--color-border); background: var(--color-surface);">
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<div class="flex items-center gap-2 text-sm font-bold tracking-wide uppercase" style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;">
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
			Downloads the corpus (~{bird === 'quill' ? '1' : '1'} MB) and initializes a fresh model on your GPU.
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
		<div class="mb-3 flex flex-wrap gap-2">
			{#if phase === 'training'}
				<button class="lab-btn" onclick={stopTraining}><Square size={14} /> Stop</button>
			{:else}
				<button class="lab-btn" onclick={train}><Play size={14} /> Train {steps} steps</button>
			{/if}
			<button class="lab-btn" disabled={sampling || totalSteps === 0} onclick={sample}>
				{#if sampling}<Loader2 size={14} class="animate-spin" />{:else}<Sparkles size={14} />{/if}
				Sample
			</button>
		</div>

		<div class="rounded-lg border p-3" style="border-color: var(--color-border-light);">
			<div class="mb-1 flex items-baseline justify-between text-xs" style="color: var(--color-text-muted);">
				<span>loss (cross-entropy)</span>
				{#if lastMetrics}
					<span style="color: var(--color-text-secondary); font-weight: 600;">{lastMetrics.loss.toFixed(3)}</span>
				{/if}
			</div>
			<svg viewBox="0 0 {W} {H}" class="h-28 w-full" preserveAspectRatio="none" role="img" aria-label="training loss curve">
				{#if lnVy !== null}
					<line x1="0" y1={lnVy} x2={W} y2={lnVy} stroke="var(--color-text-muted)" stroke-dasharray="4 4" stroke-width="1" opacity="0.5" />
					<text x="4" y={lnVy - 4} font-size="10" fill="var(--color-text-muted)">ln(V) = {lnV.toFixed(2)} — a uniform guess</text>
				{/if}
				{#if path}
					<path d={path} fill="none" stroke="var(--color-important)" stroke-width="2" />
				{:else}
					<text x={W / 2} y={H / 2} text-anchor="middle" font-size="12" fill="var(--color-text-muted)">press Train — the curve draws itself</text>
				{/if}
			</svg>
		</div>

		{#if samples.length > 0}
			<div class="mt-3 space-y-2">
				{#each samples as s, i (i)}
					<div class="rounded-lg border p-3 text-[13px] leading-relaxed" style="border-color: var(--color-border-light); color: var(--color-text); font-family: {bird === 'rook' ? 'var(--font-mono)' : 'inherit'};">
						{s}
					</div>
				{/each}
			</div>
		{/if}

		{#if inspected}
			<div class="mt-3">
				<div class="mb-1 text-xs" style="color: var(--color-text-muted);">
					token-stream inspector — color = per-token loss (how surprised the model was)
				</div>
				<TokenStream tokens={inspected} mode="loss" />
			</div>
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
</style>
