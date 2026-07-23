<script lang="ts">
	// An equation that explains itself: the display KaTeX up top (terms tagged
	// with \textcolor), a legend of color-keyed chips below translating each
	// term into plain English, and optionally the whole line read aloud as one
	// sentence. Every dissected equation in the course goes through this
	// component so the color language stays consistent across chapters.
	import Math from './Math.svelte';

	interface Term {
		color: string;
		label: string;
		note: string;
	}

	let {
		tex,
		terms,
		read = '',
		caption = ''
	}: { tex: string; terms: Term[]; read?: string; caption?: string } = $props();
</script>

<figure class="my-5">
	{#if caption}
		<figcaption class="mb-1 text-[12px] font-medium" style="color: var(--color-text-muted);">
			{caption}
		</figcaption>
	{/if}

	<Math {tex} display />

	{#if read}
		<p class="mt-1 text-center text-[13px] italic" style="color: var(--color-text-secondary);">
			<span style="color: var(--color-text-muted);">read it aloud:</span>
			{read}
		</p>
	{/if}

	<div class="terms mt-3">
		{#each terms as term, i (i)}
			<div
				class="rounded-md border px-3 py-2"
				style="border-color: var(--color-border-light); background: var(--color-surface);"
			>
				<div class="flex gap-2">
					<span
						class="mt-[5px] inline-block h-2 w-2 shrink-0 rounded-full"
						style="background: {term.color};"
					></span>
					<span class="text-[13px]" style="color: var(--color-text);">
						<Math tex={term.label} />
					</span>
				</div>
				<p class="mt-1 text-[12.5px] leading-snug" style="color: var(--color-text-secondary);">
					{term.note}
				</p>
			</div>
		{/each}
	</div>
</figure>

<style>
	.terms {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.5rem;
	}
</style>
