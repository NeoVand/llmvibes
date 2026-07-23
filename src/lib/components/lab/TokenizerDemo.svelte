<script lang="ts">
	// Ch. 2 live tokenizer: type text, watch Quill's actual byte-BPE (trained on
	// the shipped TinyStories slice) cut it into tokens. Runs entirely client-side.
	import { onMount } from 'svelte';
	import { Loader2 } from 'lucide-svelte';
	import { base } from '$app/paths';
	import { loadBpe, type BpeTokenizer } from '$lib/llm/bpe';
	import type { PerTokenInfo } from '$lib/llm/engine';
	import TokenStream from './TokenStream.svelte';

	let tok = $state<BpeTokenizer | null>(null);
	let error = $state('');
	let text = $state('Once upon a time, there was a little robot who loved to read.');

	onMount(async () => {
		try {
			tok = await loadBpe(`${base}/data/quill-vocab.json`);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	const tokens = $derived.by<PerTokenInfo[]>(() => {
		if (!tok) return [];
		return tok.encode(text).map((id) => ({ id, text: tok!.decodeOne(id) }));
	});
</script>

<div class="my-6 rounded-xl border p-5" style="border-color: var(--color-border); background: var(--color-surface);">
	<div class="mb-2 text-sm font-bold tracking-wide uppercase" style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;">
		Tokenize it yourself
	</div>
	{#if error}
		<p class="text-sm" style="color: var(--color-challenge);">Couldn't load the vocabulary: {error}</p>
	{:else if !tok}
		<div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
			<Loader2 size={16} class="animate-spin" /> Loading Quill's vocabulary…
		</div>
	{:else}
		<textarea
			bind:value={text}
			rows="2"
			class="mb-3 w-full rounded-lg border p-2 text-sm"
			style="border-color: var(--color-border); background: var(--color-surface-hover); color: var(--color-text);"
		></textarea>
		<TokenStream {tokens} mode="plain" />
		<p class="mt-2 text-xs" style="color: var(--color-text-muted);">
			{text.length} characters → {tokens.length} tokens ({(text.length / Math.max(tokens.length, 1)).toFixed(2)} chars/token).
			This is the real vocabulary Quill trains with — {tok.vocabSize} tokens, learned from the
			same stories you'll pretrain on in Part 5.
		</p>
	{/if}
</div>
