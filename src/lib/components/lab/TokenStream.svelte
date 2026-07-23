<script lang="ts">
	// The universal token-stream inspector (PLAN.md signature device): renders a
	// PerTokenInfo[] as chips, heat-colored by per-token loss or entropy. The
	// same component serves ch. 2 (plain ids), ch. 5 (surprise falling during
	// pretraining) and ch. 7 (loss masking) — one component, many chapters.
	import type { PerTokenInfo } from '$lib/llm/engine';

	let {
		tokens,
		mode = 'plain'
	}: {
		tokens: PerTokenInfo[];
		mode?: 'plain' | 'loss' | 'entropy';
	} = $props();

	const values = $derived(
		tokens.map((t) =>
			mode === 'loss' ? (t.loss ?? null) : mode === 'entropy' ? (t.entropy ?? null) : null
		)
	);
	const maxV = $derived(Math.max(...values.filter((v): v is number => v !== null), 1e-6));

	function heat(v: number | null): string {
		if (v === null || mode === 'plain') return 'transparent';
		const a = Math.min(v / maxV, 1);
		return `color-mix(in srgb, var(--color-challenge) ${Math.round(a * 55)}%, transparent)`;
	}

	let hover = $state<number | null>(null);
</script>

<div
	class="flex flex-wrap gap-0.5 rounded-lg border p-2"
	style="border-color: var(--color-border-light); font-family: var(--font-mono); font-size: 12px;"
>
	{#each tokens as t, i (i)}
		<span
			class="relative cursor-default rounded px-1 py-0.5"
			style="background: {heat(values[i])}; color: var(--color-text);"
			onmouseenter={() => (hover = i)}
			onmouseleave={() => (hover = null)}
			role="note"
		>
			{t.text || '·'}
			{#if hover === i}
				<span
					class="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md border px-2 py-1 text-[11px] whitespace-nowrap"
					style="background: var(--color-surface); border-color: var(--color-border); color: var(--color-text-secondary); box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);"
				>
					id {t.id}{#if t.loss !== undefined}&nbsp;· loss {t.loss.toFixed(
							2
						)}{/if}{#if t.entropy !== undefined}&nbsp;· H {t.entropy.toFixed(2)}{/if}
				</span>
			{/if}
		</span>
	{/each}
</div>
