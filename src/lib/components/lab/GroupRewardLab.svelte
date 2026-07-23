<script lang="ts">
	// GRPO's scoring half, live: pretrain a fresh Quill, pick a verifiable
	// constraint, sample a group of G=8 continuations, score each r ∈ {0,1}
	// with a plain JS verifier, and standardize within the group into
	// advantages Â_i = (r_i − mean)/std — signed bars from a center axis. The
	// all-same-reward group (std = 0 → every advantage 0 → no gradient) is
	// rendered prominently: it is 11.2's all-zero-group trap, met for real.
	import { onDestroy } from 'svelte';
	import { Play, Loader2, Boxes } from 'lucide-svelte';
	import { detectCapability, type ModelConfig } from '$lib/llm/engine';
	import { WorkerEngine } from '$lib/llm/worker-engine';
	import { BpeTokenizer, type BpeVocab } from '$lib/llm/bpe';
	import { base } from '$app/paths';
	import Math from '../ui/Math.svelte';

	const TRAIN_STEPS = 200;
	const PROMPT = 'Once upon a time';
	const G = 8;

	type Phase = 'idle' | 'preparing' | 'ready' | 'error' | 'no-webgpu';
	let phase = $state<Phase>('idle');
	let error = $state('');
	let prepStage = $state('');
	let prepStep = $state(0);
	let prepLoss = $state<number | null>(null);

	let engine: WorkerEngine | null = null;
	let tok: BpeTokenizer | null = null;

	interface Constraint {
		id: string;
		label: string;
		check: (text: string, tokens: number[]) => boolean;
	}
	// The verifier: a program, not a judge. Substring search is case-insensitive;
	// sentences are counted as '.', '!' and '?' characters; length is in tokens.
	const CONSTRAINTS: Constraint[] = [
		{
			id: 'dragon',
			label: 'must include “dragon”',
			check: (text) => text.toLowerCase().includes('dragon')
		},
		{
			id: 'happy',
			label: 'must include “happy”',
			check: (text) => text.toLowerCase().includes('happy')
		},
		{
			id: 'sentences',
			label: 'exactly 3 sentences',
			check: (text) => (text.match(/[.!?]/g) ?? []).length === 3
		},
		{
			id: 'length',
			label: 'under 40 tokens',
			check: (_text, tokens) => tokens.length < 40
		}
	];
	let constraintId = $state('dragon');

	interface Member {
		text: string;
		tokens: number[];
		reward: number;
		adv: number;
	}
	let group = $state<Member[]>([]);
	let groupStats = $state<{ mean: number; std: number } | null>(null);
	let sampling = $state(false);
	let sampledCount = $state(0);
	// NB: `Math` is the KaTeX component here — the JS builtin is globalThis.Math.
	const maxAbsAdv = $derived(
		group.length > 0
			? globalThis.Math.max(...group.map((m) => globalThis.Math.abs(m.adv)), 1e-6)
			: 1
	);

	async function prepare() {
		phase = 'preparing';
		error = '';
		try {
			if ((await detectCapability()) !== 'webgpu') {
				phase = 'no-webgpu';
				return;
			}
			prepStage = 'downloading corpus + tokenizer';
			const [binRes, vocabRes] = await Promise.all([
				fetch(`${base}/data/quill-tokens.bin`),
				fetch(`${base}/data/quill-vocab.json`)
			]);
			if (!binRes.ok || !vocabRes.ok) throw new Error('corpus download failed');
			const tokenData = new Uint16Array(await binRes.arrayBuffer());
			const vocab = (await vocabRes.json()) as BpeVocab;
			tok = new BpeTokenizer(vocab);

			engine = new WorkerEngine({
				tokenData,
				decode: (ids) => tok!.decode(ids),
				decodeOne: (id) => tok!.decodeOne(id),
				seed: 42
			});
			prepStage = 'initializing fresh weights';
			const config: ModelConfig = {
				bird: 'quill',
				vocab: vocab.vocabSize,
				nLayer: 4,
				nEmbd: 128,
				nHead: 4,
				blockSize: 128
			};
			await engine.init(config);
			prepStage = 'pretraining';
			await engine.train(TRAIN_STEPS, (m) => {
				prepStep = m.step;
				prepLoss = m.loss;
			});
			phase = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	async function sampleGroup() {
		if (!engine || !tok || sampling) return;
		sampling = true;
		sampledCount = 0;
		group = [];
		groupStats = null;
		try {
			const constraint = CONSTRAINTS.find((c) => c.id === constraintId)!;
			const prompt = tok.encode(PROMPT);
			const raw: Array<{ text: string; tokens: number[] }> = [];
			for (let i = 0; i < G; i++) {
				const r = await engine.sample([...prompt], { temperature: 1.0, topK: 40, maxTokens: 50 });
				raw.push({ text: r.text, tokens: [...r.tokens] });
				sampledCount = i + 1;
			}
			const rewards: number[] = raw.map((s) => (constraint.check(s.text, s.tokens) ? 1 : 0));
			const mean = rewards.reduce((a, b) => a + b, 0) / G;
			const std = globalThis.Math.sqrt(
				rewards.reduce((s, r) => s + (r - mean) * (r - mean), 0) / G
			);
			groupStats = { mean, std };
			group = raw.map((s, i) => ({
				...s,
				reward: rewards[i],
				adv: std > 0 ? (rewards[i] - mean) / std : 0
			}));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		} finally {
			sampling = false;
		}
	}

	onDestroy(() => {
		engine?.dispose();
	});
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<Boxes size={16} strokeWidth={2.5} />
		<span>One GRPO group, scored live</span>
	</div>

	{#if phase === 'idle'}
		<button class="lab-btn" onclick={prepare}><Play size={14} /> Prepare Quill</button>
		<p class="mt-2 text-xs" style="color: var(--color-text-muted);">
			Downloads the corpus (~1 MB) and pretrains a fresh Quill for {TRAIN_STEPS} steps on your GPU — then
			you play verifier-and-advantage on its samples.
		</p>
	{:else if phase === 'preparing'}
		<div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" />
			Preparing Quill — {prepStage}…
			{#if prepStage === 'pretraining'}
				step {prepStep}/{TRAIN_STEPS}{prepLoss !== null ? ` · loss ${prepLoss.toFixed(2)}` : ''}
			{/if}
		</div>
		<div
			class="mt-3 h-2 overflow-hidden rounded-full"
			style="background: var(--color-surface-hover);"
		>
			<div
				class="h-full rounded-full"
				style="width: {((prepStep / TRAIN_STEPS) * 100).toFixed(
					0
				)}%; background: var(--color-important); transition: width 300ms ease;"
			></div>
		</div>
	{:else if phase === 'no-webgpu'}
		<p class="text-sm" style="color: var(--color-text-secondary);">
			This browser doesn't expose WebGPU, which live training needs. Chrome or Edge (or Safari 26+)
			will run this lab; the rest of the course works fine without it.
		</p>
	{:else if phase === 'error'}
		<p class="text-sm" style="color: var(--color-challenge);">Lab error: {error}</p>
		<button class="lab-btn mt-2" onclick={prepare}>Retry</button>
	{:else}
		<div class="mb-3 flex flex-wrap items-center gap-2">
			<span class="text-xs" style="color: var(--color-text-muted);">constraint:</span>
			{#each CONSTRAINTS as c (c.id)}
				<button
					class="chip rounded-full border px-3 py-1 text-xs font-semibold"
					style="border-color: {constraintId === c.id
						? 'var(--color-important)'
						: 'var(--color-border)'}; color: {constraintId === c.id
						? 'var(--color-important)'
						: 'var(--color-text-secondary)'}; background: {constraintId === c.id
						? 'color-mix(in srgb, var(--color-important) 10%, transparent)'
						: 'transparent'};"
					disabled={sampling}
					onclick={() => (constraintId = c.id)}
				>
					{c.label}
				</button>
			{/each}
		</div>

		<button class="lab-btn" disabled={sampling} onclick={sampleGroup}>
			{#if sampling}<Loader2 size={14} class="animate-spin" />{:else}<Play size={14} />{/if}
			{sampling ? `sampling ${sampledCount}/${G}…` : `Sample a group of ${G}`}
		</button>

		{#if group.length > 0 && groupStats}
			<div class="mt-4 space-y-1">
				{#each group as m, i (i)}
					<div
						class="flex items-center gap-3 rounded-lg border px-3 py-2"
						style="border-color: var(--color-border-light);"
					>
						<span
							class="w-5 flex-shrink-0 text-center text-sm font-bold"
							style="color: {m.reward === 1 ? 'var(--color-tip)' : 'var(--color-challenge)'};"
							title="reward r = {m.reward}">{m.reward === 1 ? '✓' : '✗'}</span
						>
						<span
							class="line-clamp-2 min-w-0 flex-1 text-xs leading-snug"
							style="color: var(--color-text-secondary);">{m.text}</span
						>
						<div class="relative h-3 w-24 flex-shrink-0 sm:w-32">
							<div
								class="absolute top-0 bottom-0 left-1/2 w-px"
								style="background: var(--color-border);"
							></div>
							{#if m.adv >= 0}
								<div
									class="absolute top-0 bottom-0 left-1/2 rounded-r-sm"
									style="width: {((m.adv / maxAbsAdv) * 50).toFixed(
										0
									)}%; background: var(--color-tip); transition: width 400ms ease;"
								></div>
							{:else}
								<div
									class="absolute top-0 right-1/2 bottom-0 rounded-l-sm"
									style="width: {((-m.adv / maxAbsAdv) * 50).toFixed(
										0
									)}%; background: var(--color-challenge); transition: width 400ms ease;"
								></div>
							{/if}
						</div>
						<span
							class="w-12 flex-shrink-0 text-right text-[11px] font-semibold"
							style="color: var(--color-text); font-family: var(--font-mono);"
							>{m.adv >= 0 ? '+' : ''}{m.adv.toFixed(2)}</span
						>
					</div>
				{/each}
			</div>

			{#if groupStats.std === 0}
				<div
					class="mt-3 rounded-lg border p-3"
					style="border-color: var(--color-warning-border); background: var(--color-warning-bg);"
				>
					<div class="text-sm font-bold" style="color: var(--color-warning);">
						Zero advantage, zero gradient
					</div>
					<p class="mt-1 text-xs leading-relaxed" style="color: var(--color-text-secondary);">
						All {G} samples earned reward {groupStats.mean === 1 ? '1' : '0'}, so std = 0 and every
						advantage is exactly 0 — GRPO learns nothing from this group. This is 11.2's all-{groupStats.mean ===
						1
							? 'one'
							: 'zero'}-group trap, live: no differences within the group, no signal. Try a
						constraint the model sometimes satisfies and sometimes doesn't.
					</p>
				</div>
			{/if}

			<div class="mt-3 rounded-lg border p-3" style="border-color: var(--color-border-light);">
				<div class="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
					<span style="color: var(--color-text-muted);"
						>mean reward
						<span
							class="font-semibold"
							style="color: var(--color-text); font-family: var(--font-mono);"
							>{groupStats.mean.toFixed(3)}</span
						></span
					>
					<span style="color: var(--color-text-muted);"
						>std
						<span
							class="font-semibold"
							style="color: var(--color-text); font-family: var(--font-mono);"
							>{groupStats.std.toFixed(3)}</span
						></span
					>
					<span style="color: var(--color-text-muted);"
						>passed
						<span
							class="font-semibold"
							style="color: var(--color-text); font-family: var(--font-mono);"
							>{group.filter((m) => m.reward === 1).length}/{G}</span
						></span
					>
				</div>
				<Math
					tex={String.raw`\hat{A}_i = \frac{r_i - \operatorname{mean}(r_1,\dots,r_G)}{\operatorname{std}(r_1,\dots,r_G)}`}
					display
				/>
				<p class="text-[11px] italic" style="color: var(--color-text-muted);">
					GRPO would now upweight every token of the green rows and downweight the red — the live RL
					update lands in a later milestone.
				</p>
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
	.chip {
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}
	.chip:hover:not(:disabled) {
		border-color: var(--color-important);
	}
	.chip:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
