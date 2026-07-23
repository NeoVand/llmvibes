<script lang="ts">
	// Ch. 7 prompt lab: talk to BASE Quill and watch it NOT talk back. The
	// learner types any prompt; pretrained-only Quill continues it as if it were
	// the opening of a story — which is the whole completer-vs-assistant lesson.
	// Engine flow mirrors TrainingLab: detectCapability → fetch corpus + vocab →
	// WorkerEngine → init, plus a required first-run "Prepare Quill" phase that
	// pretrains ~200 steps so the continuations are English rather than bytes.
	import { onDestroy } from 'svelte';
	import { Feather, Loader2, MessageCircle, Play, RefreshCw, Send } from 'lucide-svelte';
	import Slider from '../ui/Slider.svelte';
	import { detectCapability, type ModelConfig } from '$lib/llm/engine';
	import { WorkerEngine } from '$lib/llm/worker-engine';
	import { BpeTokenizer, type BpeVocab } from '$lib/llm/bpe';
	import { base } from '$app/paths';

	const TRAIN_STEPS = 200;
	const REVEAL_CHARS = 30;
	const REVEAL_MS = 110;
	const TRIES = [
		'Once upon a time',
		'The recipe for happiness is',
		'Q: What is the capital of France? A:'
	];

	type Phase = 'idle' | 'loading' | 'trainable' | 'training' | 'ready' | 'error' | 'no-webgpu';
	let phase = $state<Phase>('idle');
	let error = $state('');
	let engine: WorkerEngine | null = null;
	let tok: BpeTokenizer | null = null;
	let paramCountM = $state(0);
	let corpusTokens = $state(0);

	let trainStep = $state(0);
	let trainLoss = $state(0);

	let temperature = $state(0.8);
	let promptText = $state('Once upon a time');
	let generating = $state(false);

	interface Exchange {
		prompt: string;
		shown: string;
		temp: number;
		done: boolean;
	}
	let exchanges = $state<Exchange[]>([]);
	let revealTimer: ReturnType<typeof setInterval> | null = null;
	let chatEl = $state<HTMLDivElement | undefined>();

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
				fetch(`${base}/data/quill-tokens.bin`),
				fetch(`${base}/data/quill-vocab.json`)
			]);
			if (!binRes.ok || !vocabRes.ok) throw new Error('corpus download failed');
			const tokenData = new Uint16Array(await binRes.arrayBuffer());
			corpusTokens = tokenData.length;
			const vocab = (await vocabRes.json()) as BpeVocab;
			tok = new BpeTokenizer(vocab);

			engine = new WorkerEngine({
				tokenData,
				decode: (ids) => tok!.decode(ids),
				decodeOne: (id) => tok!.decodeOne(id),
				seed: 42
			});
			const modelConfig: ModelConfig = { bird: 'quill', vocab: vocab.vocabSize, ...config };
			await engine.init(modelConfig);
			paramCountM = countParams(modelConfig) / 1e6;
			phase = 'trainable';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	function countParams(c: ModelConfig): number {
		const d = c.nEmbd;
		return c.vocab * d + c.blockSize * d + d * c.vocab + c.nLayer * (4 * d * d + 8 * d * d);
	}

	async function prepare() {
		if (!engine) return;
		phase = 'training';
		try {
			await engine.train(TRAIN_STEPS, (m) => {
				trainStep = m.step;
				trainLoss = m.loss;
			});
			phase = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	async function generate(prompt: string) {
		if (!engine || !tok || generating || phase !== 'ready') return;
		const text = prompt.trim();
		if (!text) return;
		generating = true;
		error = '';
		exchanges = [...exchanges, { prompt: text, shown: '', temp: temperature, done: false }];
		// Grab the proxied copy out of the $state array — mutating the raw
		// literal above would bypass Svelte's deep reactivity.
		const live = exchanges[exchanges.length - 1];
		try {
			const ids = tok.encode(text);
			// Spread before crossing the worker boundary — proxied arrays don't
			// structured-clone (the engine also spreads, but don't rely on it).
			const r = await engine.sample([...ids], { temperature, topK: 40, maxTokens: 100 });
			await reveal(live, r.text);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			live.done = true;
		} finally {
			generating = false;
		}
	}

	/** sample() returns the whole continuation at once; type it out in
	 * ~REVEAL_CHARS-character beats so it reads like the model is writing. */
	function reveal(ex: Exchange, full: string): Promise<void> {
		return new Promise((resolve) => {
			revealTimer = setInterval(() => {
				ex.shown = full.slice(0, ex.shown.length + REVEAL_CHARS);
				if (ex.shown.length >= full.length) {
					if (revealTimer) clearInterval(revealTimer);
					revealTimer = null;
					ex.done = true;
					resolve();
				}
			}, REVEAL_MS);
		});
	}

	function continueAgain() {
		const last = exchanges[exchanges.length - 1];
		if (last) generate(last.prompt);
	}

	// Keep the chat pane pinned to the newest text as it types out.
	$effect(() => {
		void exchanges.reduce((n, e) => n + e.shown.length, 0);
		if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
	});

	onDestroy(() => {
		if (revealTimer) clearInterval(revealTimer);
		engine?.dispose();
	});
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
			style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
		>
			<MessageCircle size={16} strokeWidth={2.5} />
			<span>Prompt base Quill yourself</span>
		</div>
		{#if phase === 'ready' || phase === 'training'}
			<div class="text-xs" style="color: var(--color-text-muted);">
				{paramCountM.toFixed(1)}M params · {(corpusTokens / 1000).toFixed(0)}k corpus tokens
				{#if phase === 'ready'}· {TRAIN_STEPS} steps pretrained{/if}
			</div>
		{/if}
	</div>

	<div
		class="mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed"
		style="background: var(--color-note-bg); border-color: var(--color-note-border); color: var(--color-text-secondary);"
	>
		<span class="mt-0.5 flex-shrink-0" style="color: var(--color-note);">
			<Feather size={14} />
		</span>
		<span>
			<strong style="color: var(--color-note);">This is BASE Quill</strong> — no instructions, no chat
			training. It continues; it does not answer.
		</span>
	</div>

	{#if phase === 'idle'}
		<button class="lab-btn" onclick={setup}><Play size={14} /> Load base Quill</button>
		<p class="mt-2 text-xs" style="color: var(--color-text-muted);">
			Downloads the story corpus (~2 MB) and initializes a fresh model on your GPU.
		</p>
	{:else if phase === 'loading'}
		<div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> Preparing the lab — corpus, tokenizer, fresh weights…
		</div>
	{:else if phase === 'no-webgpu'}
		<p class="text-sm" style="color: var(--color-text-secondary);">
			This browser doesn't expose WebGPU, which the live model needs. Chrome or Edge (or Safari 26+)
			will run this lab; the rest of the course works fine without it.
		</p>
	{:else if phase === 'error'}
		<p class="text-sm" style="color: var(--color-challenge);">Lab error: {error}</p>
		<button class="lab-btn mt-2" onclick={setup}>Retry</button>
	{:else if phase === 'trainable'}
		<button class="lab-btn" onclick={prepare}>
			<Play size={14} /> Prepare Quill (trains ~200 steps, ~20s)
		</button>
		<p class="mt-2 text-xs" style="color: var(--color-text-muted);">
			A fresh model babbles random bytes. Two hundred quick pretraining steps on TinyStories give it
			enough English to make the point — then the prompt box unlocks.
		</p>
	{:else if phase === 'training'}
		<div class="rounded-lg border p-3" style="border-color: var(--color-border-light);">
			<div
				class="mb-2 flex items-center justify-between text-xs"
				style="color: var(--color-text-muted);"
			>
				<span class="flex items-center gap-2">
					<Loader2 size={14} class="animate-spin" /> pretraining base Quill…
				</span>
				<span style="font-family: var(--font-mono);">
					step {trainStep} / {TRAIN_STEPS}{trainStep > 0 ? ` · loss ${trainLoss.toFixed(2)}` : ''}
				</span>
			</div>
			<div class="h-2 overflow-hidden rounded-full" style="background: var(--color-surface-hover);">
				<div
					class="h-full rounded-full"
					style="width: {((trainStep / TRAIN_STEPS) * 100).toFixed(
						1
					)}%; background: var(--color-important); transition: width 200ms ease;"
				></div>
			</div>
		</div>
	{:else}
		{#if exchanges.length === 0}
			<p class="mb-3 text-xs italic" style="color: var(--color-text-muted);">
				Type an opening — or grab a chip below — and watch what a pretrained model actually does
				with it.
			</p>
		{:else}
			<div bind:this={chatEl} class="mb-3 max-h-80 space-y-2 overflow-y-auto pr-1">
				{#each exchanges as ex, i (i)}
					<div class="flex justify-end">
						<div
							class="max-w-[85%] rounded-2xl rounded-br-md border px-3 py-2 text-[13px]"
							style="background: var(--color-primary-dim); border-color: var(--color-border); color: var(--color-text);"
						>
							<div
								class="mb-0.5 text-[10px] tracking-wide uppercase"
								style="color: var(--color-text-muted);"
							>
								you
							</div>
							{ex.prompt}
						</div>
					</div>
					<div class="flex justify-start">
						<div
							class="max-w-[92%] rounded-2xl rounded-bl-md border px-3 py-2 text-[13px] leading-relaxed"
							style="background: var(--color-surface-hover); border-color: var(--color-border-light); color: var(--color-text);"
						>
							<div
								class="mb-0.5 text-[10px] tracking-wide uppercase"
								style="color: var(--color-text-muted);"
							>
								base Quill · T={ex.temp.toFixed(1)}
							</div>
							<span style="white-space: pre-wrap;"
								><span style="color: var(--color-text-muted);">{ex.prompt}</span>{ex.shown}</span
							>{#if !ex.done}<span class="caret" style="color: var(--color-important);">▍</span
								>{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="flex gap-2">
			<input
				type="text"
				bind:value={promptText}
				disabled={generating}
				placeholder="Type any opening — Quill will continue it"
				aria-label="prompt for base Quill"
				class="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
				style="border-color: var(--color-border); background: var(--color-surface-hover); color: var(--color-text);"
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						generate(promptText);
					}
				}}
			/>
			<button
				class="lab-btn"
				disabled={generating || !promptText.trim()}
				onclick={() => generate(promptText)}
			>
				{#if generating}<Loader2 size={14} class="animate-spin" />{:else}<Send size={14} />{/if}
				Continue
			</button>
		</div>

		<div class="mt-2 flex flex-wrap items-center gap-2">
			{#each TRIES as t (t)}
				<button
					class="try-chip"
					disabled={generating}
					onclick={() => (promptText = t)}
					title="put this prompt in the box"
				>
					{t}
				</button>
			{/each}
			<span class="ml-auto flex items-center gap-2">
				<button
					class="lab-btn"
					disabled={generating || exchanges.length === 0}
					onclick={continueAgain}
					title="same prompt, fresh dice"
				>
					<RefreshCw size={14} /> Continue again
				</button>
				<div class="w-32">
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
			</span>
		</div>
		{#if error}
			<p class="mt-2 text-xs" style="color: var(--color-challenge);">Sampling error: {error}</p>
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
	.try-chip {
		border: 1px dashed var(--color-border);
		border-radius: 9999px;
		padding: 0.2rem 0.7rem;
		font-size: 11.5px;
		color: var(--color-text-secondary);
		background: transparent;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			color 120ms ease;
	}
	.try-chip:hover:not(:disabled) {
		border-color: var(--color-important);
		color: var(--color-text);
	}
	.try-chip:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.caret {
		animation: blink 1s steps(2, start) infinite;
	}
	@keyframes blink {
		to {
			visibility: hidden;
		}
	}
</style>
