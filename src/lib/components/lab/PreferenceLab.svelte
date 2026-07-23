<script lang="ts">
	// The annotation screen from 9.1, live: pretrain a fresh Quill in the
	// browser, then repeatedly sample TWO continuations of the same prompt and
	// let the learner click the better one. Every vote feeds a running "your
	// taste as statistics" panel — avg length and distinct-word ratio of chosen
	// vs rejected — which is exactly the kind of observable regularity a reward
	// model would learn from thousands of such pairs.
	import { onDestroy } from 'svelte';
	import { Play, Loader2, ThumbsUp, Scale, Check } from 'lucide-svelte';
	import { detectCapability, type ModelConfig } from '$lib/llm/engine';
	import { WorkerEngine } from '$lib/llm/worker-engine';
	import { BpeTokenizer, type BpeVocab } from '$lib/llm/bpe';
	import { base } from '$app/paths';

	const TRAIN_STEPS = 200;
	const PROMPT = 'Once upon a time';

	type Phase = 'idle' | 'preparing' | 'vote' | 'error' | 'no-webgpu';
	let phase = $state<Phase>('idle');
	let error = $state('');
	let prepStage = $state('');
	let prepStep = $state(0);
	let prepLoss = $state<number | null>(null);

	let engine: WorkerEngine | null = null;
	let tok: BpeTokenizer | null = null;

	interface Candidate {
		text: string;
		tokens: number[];
	}
	let pair = $state<[Candidate, Candidate] | null>(null);
	let sampling = $state(false);
	/** Card index that was just chosen — drives the highlight pulse. */
	let justChose = $state<0 | 1 | null>(null);

	interface Vote {
		kind: 'a' | 'b' | 'tie';
		chosen?: Candidate;
		rejected?: Candidate;
	}
	let votes = $state<Vote[]>([]);
	const decisive = $derived(votes.filter((v) => v.kind !== 'tie'));
	const ties = $derived(votes.length - decisive.length);

	function words(text: string): string[] {
		return text
			.toLowerCase()
			.split(/[^a-z']+/)
			.filter(Boolean);
	}
	function distinctRatio(text: string): number {
		const w = words(text);
		return w.length > 0 ? new Set(w).size / w.length : 0;
	}
	const stats = $derived.by(() => {
		if (decisive.length === 0) return null;
		const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
		return {
			chosenLen: avg(decisive.map((v) => words(v.chosen!.text).length)),
			rejectedLen: avg(decisive.map((v) => words(v.rejected!.text).length)),
			chosenDistinct: avg(decisive.map((v) => distinctRatio(v.chosen!.text))),
			rejectedDistinct: avg(decisive.map((v) => distinctRatio(v.rejected!.text)))
		};
	});

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
			phase = 'vote';
			await samplePair();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	async function samplePair() {
		if (!engine || !tok || sampling) return;
		sampling = true;
		try {
			const prompt = tok.encode(PROMPT);
			const a = await engine.sample([...prompt], { temperature: 0.9, topK: 40, maxTokens: 60 });
			const b = await engine.sample([...prompt], { temperature: 0.9, topK: 40, maxTokens: 60 });
			pair = [
				{ text: a.text, tokens: [...a.tokens] },
				{ text: b.text, tokens: [...b.tokens] }
			];
			justChose = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'error';
		} finally {
			sampling = false;
		}
	}

	function vote(kind: 'a' | 'b' | 'tie') {
		if (!pair || sampling) return;
		if (kind === 'tie') {
			votes = [...votes, { kind }];
		} else {
			const chosen = kind === 'a' ? pair[0] : pair[1];
			const rejected = kind === 'a' ? pair[1] : pair[0];
			votes = [...votes, { kind, chosen, rejected }];
			justChose = kind === 'a' ? 0 : 1;
		}
		// Let the pulse land before the next pair replaces the cards.
		setTimeout(() => void samplePair(), kind === 'tie' ? 150 : 550);
	}

	function barPct(v: number, other: number): number {
		const hi = Math.max(v, other, 1e-6);
		return (v / hi) * 100;
	}

	// SVG bar geometry (viewBox units): label column, bar span, value column.
	const BAR_X = 130;
	const BAR_W = 430;

	onDestroy(() => {
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
			<ThumbsUp size={16} strokeWidth={2.5} />
			<span>You are the annotator — live</span>
		</div>
		{#if votes.length > 0}
			<div class="text-xs" style="color: var(--color-text-muted); font-family: var(--font-mono);">
				your preferences so far: {votes.length}
				{votes.length === 1 ? 'vote' : 'votes'}{ties > 0
					? ` (${ties} tie${ties === 1 ? '' : 's'})`
					: ''}
			</div>
		{/if}
	</div>

	{#if phase === 'idle'}
		<button class="lab-btn" onclick={prepare}><Play size={14} /> Prepare Quill</button>
		<p class="mt-2 text-xs" style="color: var(--color-text-muted);">
			Downloads the corpus (~1 MB), pretrains a fresh Quill for {TRAIN_STEPS} steps on your GPU, then
			puts you in the annotator's chair.
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
		<p class="mb-3 text-xs" style="color: var(--color-text-muted);">
			Same prompt, two samples: <span
				style="color: var(--color-text-secondary); font-style: italic;">"{PROMPT}…"</span
			> — click the story you'd rather read.
		</p>

		{#if pair}
			<div class="grid gap-4 sm:grid-cols-2" class:opacity-60={sampling}>
				{#each pair as candidate, i (i)}
					<button
						class="vote-card"
						class:chosen={justChose === i}
						disabled={sampling}
						onclick={() => vote(i === 0 ? 'a' : 'b')}
					>
						<div class="mb-2.5 flex items-center justify-between">
							<span class="badge">{i === 0 ? 'A' : 'B'}</span>
							{#if justChose === i}
								<span class="check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
							{/if}
						</div>
						<div class="story">{candidate.text}</div>
					</button>
				{/each}
			</div>
			<div class="mt-3 flex items-center justify-center">
				<button class="ghost-btn" disabled={sampling} onclick={() => vote('tie')}>
					{#if sampling}<Loader2 size={14} class="animate-spin" />{:else}<Scale size={14} />{/if}
					{sampling ? 'sampling the next pair…' : "Tie — can't decide"}
				</button>
			</div>
		{:else}
			<div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
				<Loader2 size={16} class="animate-spin" /> Sampling two fresh stories…
			</div>
		{/if}

		{#if stats}
			<div class="mt-4 rounded-lg border p-4" style="border-color: var(--color-border-light);">
				<div
					class="mb-3 text-[11px] font-bold tracking-wide uppercase"
					style="color: var(--color-text-muted); letter-spacing: 0.08em;"
				>
					What you preferred — {decisive.length}
					{decisive.length === 1 ? 'comparison' : 'comparisons'}
				</div>
				{#each [{ label: 'avg length (words)', c: stats.chosenLen, r: stats.rejectedLen, fmt: (v: number) => v.toFixed(1) }, { label: 'distinct-word ratio', c: stats.chosenDistinct, r: stats.rejectedDistinct, fmt: (v: number) => v.toFixed(2) }] as row (row.label)}
					<div class="mb-3 last:mb-0">
						<div
							class="mb-1 text-[11px]"
							style="color: var(--color-text-secondary); font-family: var(--font-mono);"
						>
							{row.label}
						</div>
						<svg
							viewBox="0 0 640 62"
							class="stat-svg"
							role="img"
							aria-label="{row.label}: chosen {row.fmt(row.c)}, rejected {row.fmt(row.r)}"
						>
							<text x="0" y="17" class="svg-lbl chosen">chosen</text>
							<rect x={BAR_X} y="6" width={BAR_W} height="14" rx="7" class="track" />
							<rect
								x={BAR_X}
								y="6"
								height="14"
								rx="7"
								class="bar chosen"
								style="width: {((barPct(row.c, row.r) / 100) * BAR_W).toFixed(1)}px;"
							/>
							<text x="640" y="17" text-anchor="end" class="svg-val">{row.fmt(row.c)}</text>

							<text x="0" y="53" class="svg-lbl rejected">rejected</text>
							<rect x={BAR_X} y="42" width={BAR_W} height="14" rx="7" class="track" />
							<rect
								x={BAR_X}
								y="42"
								height="14"
								rx="7"
								class="bar rejected"
								style="width: {((barPct(row.r, row.c) / 100) * BAR_W).toFixed(1)}px;"
							/>
							<text x="640" y="53" text-anchor="end" class="svg-val">{row.fmt(row.r)}</text>
						</svg>
					</div>
				{/each}
				<p class="mt-3 text-[11px] italic" style="color: var(--color-text-muted);">
					A real reward model trains a network on thousands of these pairs; here you can already see
					your taste becoming measurable statistics.
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

	/* ---- candidate cards -------------------------------------------------- */
	.vote-card {
		position: relative;
		display: block;
		width: 100%;
		text-align: left;
		border: 1px solid var(--color-border-light);
		border-radius: 0.85rem;
		padding: 1.1rem 1.3rem 1.25rem;
		background: color-mix(in srgb, var(--color-surface-hover) 50%, var(--color-surface));
		cursor: pointer;
		transition:
			border-color 140ms ease,
			transform 140ms ease,
			box-shadow 140ms ease;
	}
	.vote-card:hover:not(:disabled) {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--color-important) 60%, var(--color-border));
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--color-important) 14%, transparent),
			0 6px 16px rgb(0 0 0 / 0.07);
	}
	.vote-card:focus-visible {
		outline: none;
		border-color: var(--color-important);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-important) 25%, transparent);
	}
	.vote-card:disabled {
		cursor: default;
	}
	.vote-card.chosen {
		border-color: var(--color-important);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-important) 18%, transparent);
		animation: chosen-pulse 450ms ease;
	}
	@keyframes chosen-pulse {
		0% {
			transform: scale(1);
		}
		40% {
			transform: scale(1.02);
		}
		100% {
			transform: scale(1);
		}
	}
	.story {
		font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
		font-size: 0.92rem;
		line-height: 1.65;
		color: var(--color-text);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--color-important);
		background: color-mix(in srgb, var(--color-important) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-important) 32%, transparent);
	}
	.check {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 999px;
		color: var(--color-surface);
		background: var(--color-important);
		animation: check-in 220ms ease;
	}
	@keyframes check-in {
		from {
			transform: scale(0.4);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* ---- tie button: subtle ghost ---------------------------------------- */
	.ghost-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: transparent;
		border: 1px dashed var(--color-border);
		border-radius: 0.5rem;
		padding: 0.3rem 0.85rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		transition:
			color 120ms ease,
			border-color 120ms ease,
			background 120ms ease;
	}
	.ghost-btn:hover:not(:disabled) {
		color: var(--color-text-secondary);
		border-color: color-mix(in srgb, var(--color-text-muted) 50%, var(--color-border));
		background: var(--color-surface-hover);
	}
	.ghost-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	/* ---- stats: SVG bar pairs --------------------------------------------- */
	.stat-svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.stat-svg .track {
		fill: var(--color-surface-hover);
	}
	.stat-svg .bar {
		transition: width 300ms ease;
	}
	.stat-svg .bar.chosen {
		fill: var(--color-important);
	}
	.stat-svg .bar.rejected {
		fill: var(--color-text-muted);
	}
	.stat-svg .svg-lbl {
		font-family: var(--font-mono);
		font-size: 15px;
		font-weight: 600;
	}
	.stat-svg .svg-lbl.chosen {
		fill: var(--color-important);
	}
	.stat-svg .svg-lbl.rejected {
		fill: var(--color-text-muted);
	}
	.stat-svg .svg-val {
		font-family: var(--font-mono);
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		fill: var(--color-text);
	}
</style>
