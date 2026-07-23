<script lang="ts">
	// Interactive architecture explorer: the pocket model's exact stack, stage by
	// stage. Click any stage to see what it does, its tensor shapes (computed
	// from the REAL lab config), its parameter count, and its math. The residual
	// stream is drawn as the spine it actually is; attention and MLP branch off
	// and merge back — reading the diagram teaches the pre-norm block.
	import Math from '../ui/Math.svelte';

	let {
		nLayer = 4,
		nEmbd = 128,
		nHead = 4,
		blockSize = 128,
		vocab = 512
	}: {
		nLayer?: number;
		nEmbd?: number;
		nHead?: number;
		blockSize?: number;
		vocab?: number;
	} = $props();

	const hd = $derived(nEmbd / nHead);

	interface Stage {
		id: string;
		label: string;
		kind: 'io' | 'embed' | 'norm' | 'attn' | 'mlp' | 'head';
		shape: string;
		params: number;
		what: string;
		math?: string;
		note?: string;
	}

	const stages = $derived.by<Stage[]>(() => [
		{
			id: 'tokens',
			label: 'Token IDs',
			kind: 'io',
			shape: `S = ${blockSize} integers`,
			params: 0,
			what: `The input is just integers from Part 2 — one ID per token, up to ${blockSize} of them (the context window). No meaning yet; meaning is assigned by the very next stage.`
		},
		{
			id: 'embed',
			label: 'Token + Position Embeddings',
			kind: 'embed',
			shape: `S×${nEmbd}`,
			params: vocab * nEmbd + blockSize * nEmbd,
			what: `Each ID indexes a learned row of the embedding table; each position adds its own learned vector. From here on, every token is a point in ${nEmbd}-dimensional space, and everything the model "knows" about a token starts as coordinates.`,
			math: `x_i = E_{\\text{tok}}[t_i] + E_{\\text{pos}}[i]`,
			note: 'The pocket model uses learned absolute positions; the flagship swaps these for RoPE.'
		},
		{
			id: 'norm1',
			label: 'RMSNorm',
			kind: 'norm',
			shape: `S×${nEmbd}`,
			params: 0,
			what: 'Rescales each token vector to unit RMS before attention reads it — pre-norm keeps activations in a stable range so deep stacks train without exploding.',
			math: `\\operatorname{RMSNorm}(x) = \\frac{x}{\\sqrt{\\tfrac{1}{d}\\sum_j x_j^2 + \\varepsilon}}`
		},
		{
			id: 'attn',
			label: `Attention (${nHead} heads)`,
			kind: 'attn',
			shape: `Q,K,V: S×${nHead}×${hd}`,
			params: 4 * nEmbd * nEmbd,
			what: `The only stage where tokens talk to each other. Each token asks a question (Q), offers a label (K) and a payload (V); scores Q·Kᵀ decide, per head, how much of every earlier token's payload to mix in. ${nHead} heads = ${nHead} different kinds of relationship, attended in parallel.`,
			math: `\\operatorname{Attn}(Q,K,V) = \\operatorname{softmax}\\!\\left(\\frac{QK^{\\top}}{\\sqrt{d_h}} + M\\right)V`,
			note: 'M is the causal mask: −∞ above the diagonal, so no token sees the future.'
		},
		{
			id: 'res1',
			label: '+ residual',
			kind: 'io',
			shape: `S×${nEmbd}`,
			params: 0,
			what: "Attention's output is ADDED to the stream, not substituted for it. The residual spine is why gradients reach layer 1 and why a block can safely learn nothing at first (add ≈ 0) and refine later."
		},
		{
			id: 'norm2',
			label: 'RMSNorm',
			kind: 'norm',
			shape: `S×${nEmbd}`,
			params: 0,
			what: 'Same normalization again, guarding the MLP the way the first one guarded attention.'
		},
		{
			id: 'mlp',
			label: 'MLP (4× wide)',
			kind: 'mlp',
			shape: `S×${4 * nEmbd} → S×${nEmbd}`,
			params: nEmbd * 4 * nEmbd + 4 * nEmbd * nEmbd,
			what: `Per-token computation: expand to ${4 * nEmbd} dims, apply a nonlinearity, project back. No token-to-token mixing here — this is where facts and features get computed on each position independently. Most of a transformer's parameters live in these MLPs.`,
			math: `\\operatorname{MLP}(x) = W_2\\,\\phi(W_1 x)`,
			note: 'The pocket model uses φ = ReLU; the flagship uses SwiGLU (a gated φ).'
		},
		{
			id: 'res2',
			label: '+ residual',
			kind: 'io',
			shape: `S×${nEmbd}`,
			params: 0,
			what: `Merge back into the spine. That's one full block — the model stacks ${nLayer} of them, identical in shape, different in learned weights.`
		},
		{
			id: 'head',
			label: 'LM Head → softmax',
			kind: 'head',
			shape: `S×${vocab}`,
			params: nEmbd * vocab,
			what: `One last matrix turns each ${nEmbd}-dim vector into ${vocab} scores — one per vocabulary entry — and softmax turns scores into next-token probabilities. Every stage above exists to make this distribution sharp.`,
			math: `p(t_{i+1}\\mid t_{\\le i}) = \\operatorname{softmax}(x_i W_{\\text{head}})`
		}
	]);

	let selectedId = $state('attn');
	const selected = $derived(stages.find((s) => s.id === selectedId) ?? stages[0]);
	const totalParams = $derived(
		vocab * nEmbd + blockSize * nEmbd + nEmbd * vocab + nLayer * 12 * nEmbd * nEmbd
	);
	const blockStages = ['norm1', 'attn', 'res1', 'norm2', 'mlp', 'res2'];

	const COLOR: Record<Stage['kind'], string> = {
		io: 'var(--color-text-muted)',
		embed: 'var(--color-tip)',
		norm: 'var(--color-note)',
		attn: 'var(--color-important)',
		mlp: 'var(--color-vibe)',
		head: 'var(--color-challenge)'
	};

	function fmtParams(n: number): string {
		if (n === 0) return '—';
		return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : (n / 1e3).toFixed(1) + 'k';
	}
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-3 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		The pocket model, stage by stage
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		This is the exact architecture you train in Part 5 — {nLayer} blocks, d={nEmbd}, {nHead} heads,
		{fmtParams(totalParams)} parameters. Click any stage.
	</p>

	<div class="flex flex-wrap gap-5">
		<div class="min-w-[230px] flex-shrink-0">
			<div class="flex flex-col items-stretch">
				{#each stages as s, i (s.id)}
					{#if s.id === 'norm1'}
						<div
							class="mt-1 mb-1 rounded-t-lg border border-b-0 border-dashed px-2 pt-1 text-[10px] uppercase"
							style="border-color: var(--color-border); color: var(--color-text-muted);"
						>
							× {nLayer} blocks
						</div>
					{/if}
					<div class="flex items-stretch" class:pl-3={blockStages.includes(s.id)}>
						<!-- residual spine -->
						{#if blockStages.includes(s.id)}
							<div class="w-1 flex-shrink-0 rounded" style="background: var(--color-border);"></div>
						{/if}
						<button
							class="stage-btn my-0.5 flex-1 rounded-md border px-3 py-1.5 text-left text-[12.5px]"
							class:ml-2={blockStages.includes(s.id)}
							style="border-color: {selectedId === s.id
								? COLOR[s.kind]
								: 'var(--color-border-light)'}; color: var(--color-text); background: {selectedId ===
							s.id
								? 'color-mix(in srgb, ' + COLOR[s.kind] + ' 12%, transparent)'
								: 'transparent'};"
							onclick={() => (selectedId = s.id)}
						>
							<span class="font-semibold" style="color: {COLOR[s.kind]};">{s.label}</span>
							<span
								class="ml-1 text-[10.5px]"
								style="color: var(--color-text-muted); font-family: var(--font-mono);"
								>{s.shape}</span
							>
						</button>
					</div>
					{#if s.id === 'res2'}
						<div
							class="mb-1 rounded-b-lg border border-t-0 border-dashed px-2 pb-1 text-[10px]"
							style="border-color: var(--color-border); color: transparent;"
						>
							.
						</div>
					{/if}
					{#if i < stages.length - 1 && !blockStages.includes(s.id) && s.id !== 'embed'}
						<div class="mx-auto h-2 w-px" style="background: var(--color-border);"></div>
					{/if}
				{/each}
			</div>
		</div>

		<div class="min-w-[240px] flex-1">
			<div class="mb-1 flex items-baseline justify-between">
				<span class="text-sm font-bold" style="color: {COLOR[selected.kind]};"
					>{selected.label}</span
				>
				<span
					class="text-[11px]"
					style="color: var(--color-text-muted); font-family: var(--font-mono);"
				>
					{fmtParams(selected.params)} params{selected.params > 0 &&
					blockStages.includes(selected.id)
						? ' / block'
						: ''}
				</span>
			</div>
			<p class="mb-3 text-[13.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				{selected.what}
			</p>
			{#if selected.math}
				<Math tex={selected.math} display />
			{/if}
			{#if selected.note}
				<p class="mt-2 text-[11.5px] italic" style="color: var(--color-text-muted);">
					{selected.note}
				</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.stage-btn {
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease;
	}
	.stage-btn:hover {
		border-color: var(--color-text-muted);
	}
</style>
