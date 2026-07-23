<script lang="ts">
	// The universal token-stream inspector (PLAN.md signature device).
	// Tokens are chips with real whitespace inside them — boundaries come from
	// a cycling wash of pastel tints (the OpenAI-tokenizer idiom), never from
	// ␣/⏎ placeholder glyphs. Heat mode overrides the cycle with a loss/entropy
	// ramp. Newline tokens show a soft ↵ mark and actually break the line.
	import type { PerTokenInfo } from '$lib/llm/engine';

	let {
		tokens,
		mode = 'plain'
	}: {
		tokens: PerTokenInfo[];
		mode?: 'plain' | 'loss' | 'entropy';
	} = $props();

	// five house pastels (neocalculus plot series), cycled by token index
	const WASHES = [
		'color-mix(in srgb, #a855f7 16%, transparent)',
		'color-mix(in srgb, #2563eb 14%, transparent)',
		'color-mix(in srgb, #14b8a6 16%, transparent)',
		'color-mix(in srgb, #f59e0b 18%, transparent)',
		'color-mix(in srgb, #fb7185 16%, transparent)'
	];

	const values = $derived(
		tokens.map((t) =>
			mode === 'loss' ? (t.loss ?? null) : mode === 'entropy' ? (t.entropy ?? null) : null
		)
	);
	const maxV = $derived(Math.max(...values.filter((v): v is number => v !== null), 1e-6));

	function bg(i: number): string {
		const v = values[i];
		if (mode === 'plain' || v === null) return WASHES[i % WASHES.length];
		const a = Math.min(v / maxV, 1);
		return `color-mix(in srgb, var(--color-challenge) ${Math.round(a * 60)}%, transparent)`;
	}

	// de-glyph: display layer undoes decodeOne's ␣/⏎ substitutions
	function pretty(text: string): { body: string; newlines: number } {
		const raw = text.replaceAll('␣', ' ').replaceAll('⏎', '\n');
		const body = raw.replaceAll('\n', '');
		const newlines = raw.length - body.length;
		return { body, newlines };
	}

	let hover = $state<number | null>(null);
</script>

<div
	class="flex flex-wrap items-center gap-y-1 rounded-lg border p-2.5"
	style="border-color: var(--color-border-light); font-family: var(--font-mono); font-size: 12.5px; line-height: 1.35;"
>
	{#each tokens as t, i (i)}
		{@const p = pretty(t.text)}
		<span
			class="tok relative cursor-default"
			style="background: {bg(i)};"
			onmouseenter={() => (hover = i)}
			onmouseleave={() => (hover = null)}
			role="note"
		>
			{#if p.body}{p.body}{/if}{#if p.newlines > 0}<span class="nl" aria-label="newline">↵</span
				>{/if}{#if !p.body && p.newlines === 0}<span class="nl">∅</span>{/if}
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
		{#if p.newlines > 0}
			<span class="break" aria-hidden="true"></span>
		{/if}
	{/each}
</div>

<style>
	.tok {
		border-radius: 0.3rem;
		padding: 0.1rem 0.18rem;
		margin: 0 0.5px;
		color: var(--color-text);
		white-space: pre;
	}
	.nl {
		opacity: 0.45;
		font-size: 0.85em;
		user-select: none;
	}
	.break {
		flex-basis: 100%;
		height: 0;
	}
</style>
