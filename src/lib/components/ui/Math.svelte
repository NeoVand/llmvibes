<script lang="ts">
	// KaTeX rendering for course math. Inline by default; display mode for
	// centered block equations. Rendered server-side too (katex.renderToString
	// is pure), so prerendered pages carry the math with no flash.
	import katex from 'katex';
	import 'katex/dist/katex.min.css';

	let { tex, display = false }: { tex: string; display?: boolean } = $props();

	const html = $derived(
		katex.renderToString(tex, {
			displayMode: display,
			throwOnError: false,
			strict: false
		})
	);
</script>

{#if display}
	<div class="math-display my-4 overflow-x-auto">
		<!-- eslint-disable-next-line svelte/no-at-html-tags — KaTeX output from course-authored TeX only -->
		{@html html}
	</div>
{:else}
	<!-- eslint-disable-next-line svelte/no-at-html-tags — KaTeX output from course-authored TeX only -->
	<span class="math-inline">{@html html}</span>
{/if}

<style>
	.math-display :global(.katex-display) {
		margin: 0;
	}
	.math-display,
	.math-inline {
		color: var(--color-text);
	}
	/* KaTeX sizes relative to surrounding font; nudge display math up a touch */
	.math-display :global(.katex) {
		font-size: 1.15em;
	}
</style>
