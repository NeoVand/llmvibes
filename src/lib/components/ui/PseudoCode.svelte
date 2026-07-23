<script lang="ts">
	// LaTeX-style algorithm blocks (the algorithmic-package look): ruled header,
	// numbered lines, bold keywords, real KaTeX for math spans, ▷-comments.
	//
	// Author lines as plain text with two-space indents. Inside a line:
	//   $...$   → rendered by KaTeX
	//   // ...  → right-hand comment, muted, prefixed ▷
	// Keywords (for, while, if, return, …) embolden automatically.
	import katex from 'katex';
	import 'katex/dist/katex.min.css';

	let {
		title,
		number,
		code,
		caption
	}: {
		title: string;
		number?: number;
		code: string;
		caption?: string;
	} = $props();

	const KEYWORDS = new Set([
		'for',
		'while',
		'if',
		'else',
		'end',
		'return',
		'repeat',
		'until',
		'do',
		'then',
		'function',
		'procedure',
		'in',
		'to',
		'each',
		'break',
		'continue',
		'all',
		'sample',
		'output',
		'input',
		'require'
	]);

	interface Seg {
		kind: 'text' | 'kw' | 'math';
		html: string;
	}
	interface Line {
		indent: number;
		segs: Seg[];
		comment: string;
	}

	function esc(s: string): string {
		return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	}

	function renderMath(tex: string): string {
		return katex.renderToString(tex, { throwOnError: false, strict: false });
	}

	function parseLine(raw: string): Line {
		const indent = Math.floor((raw.match(/^ */)?.[0].length ?? 0) / 2);
		let body = raw.trim();
		let comment = '';
		// split off a trailing // comment (not inside $…$)
		let depth = false;
		for (let i = 0; i < body.length - 1; i++) {
			if (body[i] === '$') depth = !depth;
			else if (!depth && body[i] === '/' && body[i + 1] === '/') {
				comment = body.slice(i + 2).trim();
				body = body.slice(0, i).trim();
				break;
			}
		}
		const segs: Seg[] = [];
		const parts = body.split(/(\$[^$]+\$)/);
		for (const part of parts) {
			if (part === '') continue;
			if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
				segs.push({ kind: 'math', html: renderMath(part.slice(1, -1)) });
			} else {
				// tokenize words to embolden keywords
				for (const tok of part.split(/(\b[a-zA-Z]+\b)/)) {
					if (tok === '') continue;
					if (KEYWORDS.has(tok)) segs.push({ kind: 'kw', html: esc(tok) });
					else segs.push({ kind: 'text', html: esc(tok) });
				}
			}
		}
		return { indent, segs, comment };
	}

	const lines = $derived(
		code
			.replace(/^\n+|\n+$/g, '')
			.split('\n')
			.map(parseLine)
	);
</script>

<figure class="algo my-5">
	<div class="head">
		<span class="algo-name">Algorithm{number !== undefined ? ` ${number}` : ''}</span>
		<span class="algo-title">{title}</span>
	</div>
	<ol class="body">
		{#each lines as line, i (i)}
			<li class="line">
				<span class="num">{i + 1}</span>
				<span class="content" style="padding-left: {line.indent * 1.4}em">
					{#each line.segs as seg, j (j)}
						{#if seg.kind === 'math'}
							<!-- eslint-disable-next-line svelte/no-at-html-tags — KaTeX output from course-authored TeX only -->
							<span class="m">{@html seg.html}</span>
						{:else if seg.kind === 'kw'}
							<span class="kw">{seg.html}</span>
						{:else}
							<!-- eslint-disable-next-line svelte/no-at-html-tags — escaped above -->
							<span>{@html seg.html}</span>
						{/if}
					{/each}
				</span>
				{#if line.comment}
					<span class="comment">▷ {line.comment}</span>
				{/if}
			</li>
		{/each}
	</ol>
	{#if caption}
		<figcaption class="cap">{caption}</figcaption>
	{/if}
</figure>

<style>
	.algo {
		border-top: 2.5px solid color-mix(in srgb, var(--color-text) 75%, transparent);
		border-bottom: 2.5px solid color-mix(in srgb, var(--color-text) 75%, transparent);
		padding: 0;
		font-size: 0.92rem;
		max-width: 46rem;
	}
	.head {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		padding: 0.45rem 0.25rem;
		border-bottom: 1px solid color-mix(in srgb, var(--color-text) 45%, transparent);
	}
	.algo-name {
		font-family: var(--font-heading, Georgia, serif);
		font-weight: 700;
		font-size: 0.86rem;
		color: var(--color-text);
	}
	.algo-title {
		font-family: Georgia, 'Times New Roman', serif;
		font-style: italic;
		font-size: 0.88rem;
		color: var(--color-text-secondary);
	}
	.body {
		list-style: none;
		margin: 0;
		padding: 0.5rem 0.25rem 0.55rem;
	}
	.line {
		display: flex;
		align-items: baseline;
		gap: 0.7rem;
		padding: 0.14rem 0;
		line-height: 1.55;
	}
	.num {
		flex: 0 0 1.4em;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--color-text-muted);
		user-select: none;
	}
	.content {
		font-family: Georgia, 'Times New Roman', serif;
		color: var(--color-text);
		white-space: pre-wrap;
	}
	.kw {
		font-weight: 700;
		font-family: Georgia, 'Times New Roman', serif;
	}
	.m :global(.katex) {
		font-size: 1em;
	}
	.comment {
		margin-left: auto;
		padding-left: 1rem;
		font-family: Georgia, 'Times New Roman', serif;
		font-style: italic;
		font-size: 0.8rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}
	.cap {
		padding: 0.4rem 0.25rem 0.5rem;
		font-size: 0.78rem;
		color: var(--color-text-muted);
		border-top: 1px solid var(--color-border-light);
	}
	@media (max-width: 640px) {
		.comment {
			display: none;
		}
	}
</style>
