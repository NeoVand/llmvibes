<script lang="ts">
	// A real jax-js REPL, in the page. The code box runs ACTUAL @jax-js/jax —
	// the same library the training worker uses — on your WebGPU device (wasm
	// fallback). Each chapter embeds one with a snippet about the idea at hand;
	// everything is editable and re-runnable. The editor is the classic
	// transparent-textarea-over-highlighted-pre trick: zero dependencies.
	import { Play, RotateCcw, Loader2, Braces } from 'lucide-svelte';

	let {
		code: initialCode,
		title = 'jax-js playground',
		height = 'auto'
	}: {
		code: string;
		title?: string;
		height?: string;
	} = $props();

	let code = $state('');
	$effect.pre(() => {
		// initialize once from the prop (edits shouldn't be clobbered by HMR reruns)
		if (code === '') code = initialCode.replace(/^\n+/, '').trimEnd();
	});

	type Entry = { kind: 'log' | 'error' | 'note'; text: string };
	let outputs = $state<Entry[]>([]);
	let running = $state(false);
	let device = $state<string | null>(null);
	let textareaEl: HTMLTextAreaElement | undefined = $state();
	let preEl: HTMLElement | undefined = $state();

	/* eslint-disable @typescript-eslint/no-explicit-any */
	let jaxMod: any = null;
	async function loadJax(): Promise<any> {
		if (jaxMod) return jaxMod;
		const jax = await import('@jax-js/jax');
		const devices = await jax.init();
		jax.defaultDevice(devices.includes('webgpu') ? 'webgpu' : devices[0]);
		device = devices.includes('webgpu') ? 'webgpu' : devices[0];
		jaxMod = jax;
		return jax;
	}

	function sig(x: number): string {
		if (!Number.isFinite(x)) return String(x);
		if (x === 0) return '0';
		const a = Math.abs(x);
		if (a >= 1e5 || a < 1e-4) return x.toExponential(3);
		return String(Number(x.toPrecision(4)));
	}

	async function fmt(v: any): Promise<string> {
		if (v === null || v === undefined) return String(v);
		// duck-type a jax array: has shape + data()
		if (typeof v === 'object' && Array.isArray(v.shape) && typeof v.data === 'function') {
			const shape: number[] = v.shape;
			const flat: number[] = Array.from(await v.data());
			const head = `${v.dtype ?? 'f32'}[${shape.join('×') || 'scalar'}]`;
			if (shape.length === 0 || flat.length === 1) return `${head} ${sig(flat[0])}`;
			if (shape.length === 1) {
				const shown = flat.slice(0, 10).map(sig).join(', ');
				return `${head} [${shown}${flat.length > 10 ? ', …' : ''}]`;
			}
			if (shape.length === 2) {
				const [r, c] = shape;
				const rows: string[] = [];
				for (let i = 0; i < Math.min(r, 6); i++) {
					const row = flat.slice(i * c, i * c + Math.min(c, 8)).map(sig);
					rows.push(` [${row.join(', ')}${c > 8 ? ', …' : ''}]`);
				}
				if (r > 6) rows.push(' …');
				return `${head}\n${rows.join('\n')}`;
			}
			return `${head} [${flat.slice(0, 8).map(sig).join(', ')}, …]`;
		}
		if (typeof v === 'number') return sig(v);
		if (typeof v === 'string') return v;
		try {
			return JSON.stringify(v);
		} catch {
			return String(v);
		}
	}

	async function run() {
		if (running) return;
		running = true;
		outputs = [];
		try {
			const jax = await loadJax();
			const raw: any[][] = [];
			const log = (...vals: any[]) => {
				raw.push(vals);
			};
			const body = `"use strict";\nreturn (async () => {\n${code}\n})();`;
			const fn = new Function(
				'jax',
				'np',
				'nn',
				'jit',
				'grad',
				'valueAndGrad',
				'random',
				'tree',
				'log',
				body
			);
			const result = await fn(
				jax,
				jax.numpy,
				jax.nn,
				jax.jit,
				jax.grad,
				jax.valueAndGrad,
				jax.random,
				jax.tree,
				log
			);
			const entries: Entry[] = [];
			for (const vals of raw) {
				const parts: string[] = [];
				for (const v of vals) parts.push(await fmt(v));
				entries.push({ kind: 'log', text: parts.join(' ') });
			}
			if (result !== undefined) entries.push({ kind: 'log', text: await fmt(result) });
			if (entries.length === 0)
				entries.push({ kind: 'note', text: '(ran clean — use log(…) to print values)' });
			outputs = entries;
		} catch (e) {
			outputs = [
				...outputs,
				{ kind: 'error', text: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }
			];
		} finally {
			running = false;
		}
	}

	function reset() {
		code = initialCode.replace(/^\n+/, '').trimEnd();
		outputs = [];
	}

	// ── highlighting (tiny JS tokenizer; good enough for snippets) ────────────
	function esc(s: string): string {
		return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	}
	const KW =
		/\b(const|let|var|function|return|await|async|for|while|if|else|new|of|in|typeof|class|import|from|export|try|catch|throw)\b/;
	const highlighted = $derived.by(() => {
		const src = code;
		let out = '';
		let i = 0;
		const push = (cls: string | null, text: string) => {
			out += cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text);
		};
		while (i < src.length) {
			const rest = src.slice(i);
			let m: RegExpMatchArray | null;
			if ((m = rest.match(/^\/\/[^\n]*/))) {
				push('c', m[0]);
			} else if ((m = rest.match(/^(['"`])(?:\\.|(?!\1)[^\\\n])*\1?/))) {
				push('s', m[0]);
			} else if ((m = rest.match(/^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i))) {
				push('n', m[0]);
			} else if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) {
				push(KW.test(m[0]) ? 'k' : null, m[0]);
			} else {
				m = [rest[0]] as unknown as RegExpMatchArray;
				push(null, rest[0]);
			}
			i += m[0].length;
		}
		return out + '\n';
	});

	function syncScroll() {
		if (preEl && textareaEl) {
			preEl.scrollTop = textareaEl.scrollTop;
			preEl.scrollLeft = textareaEl.scrollLeft;
		}
	}

	function keydown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const el = textareaEl!;
			const { selectionStart: s, selectionEnd: en } = el;
			code = code.slice(0, s) + '  ' + code.slice(en);
			requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
		} else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			void run();
		}
	}

	const lineCount = $derived(code.split('\n').length);
	const editorH = $derived(height === 'auto' ? `${Math.min(lineCount, 22) * 1.5 + 1.6}em` : height);
</script>

<!-- eslint-disable svelte/no-at-html-tags — the single @html below renders spans from our own escaping tokenizer -->
<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
			style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
		>
			<Braces size={16} strokeWidth={2.5} />
			<span>{title}</span>
		</div>
		<div class="flex items-center gap-2">
			{#if device}
				<span class="device-chip">{device}</span>
			{/if}
			<button class="lab-btn" onclick={reset} title="restore the original snippet">
				<RotateCcw size={13} />
			</button>
			<button class="lab-btn run" disabled={running} onclick={run} title="run (⌘⏎)">
				{#if running}<Loader2 size={14} class="animate-spin" />{:else}<Play size={14} />{/if}
				Run
			</button>
		</div>
	</div>

	<div class="editor" style="height: {editorH};">
		<pre bind:this={preEl} aria-hidden="true"><code>{@html highlighted}</code></pre>
		<textarea
			bind:this={textareaEl}
			bind:value={code}
			onscroll={syncScroll}
			onkeydown={keydown}
			spellcheck="false"
			autocapitalize="off"
			autocomplete="off"
			aria-label="editable jax-js code"
		></textarea>
	</div>

	{#if outputs.length > 0}
		<div class="output">
			{#each outputs as o, i (i)}
				<pre
					class="entry"
					class:err={o.kind === 'error'}
					class:note={o.kind === 'note'}>{o.text}</pre>
			{/each}
		</div>
	{/if}
	<p class="mt-2 text-[11px]" style="color: var(--color-text-muted);">
		This is the real <span style="font-family: var(--font-mono);">@jax-js/jax</span> — the exact
		library the training labs run — executing in your tab. In scope:
		<span style="font-family: var(--font-mono);"
			>np, nn, jit, grad, valueAndGrad, random, tree, log(…)</span
		>. One jax-js house rule: an op <em>consumes</em> its inputs — pass
		<span style="font-family: var(--font-mono);">x.ref</span> when you want to keep using x (the training
		chapters live by this).
	</p>
</div>

<style>
	.lab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 0.3rem 0.7rem;
		font-size: 0.78rem;
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
	.lab-btn.run {
		background: color-mix(in srgb, var(--color-important) 14%, transparent);
		border-color: color-mix(in srgb, var(--color-important) 40%, var(--color-border));
	}
	.device-chip {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-tip) 15%, transparent);
		color: var(--color-tip);
	}

	.editor {
		position: relative;
		border: 1px solid var(--color-border-light);
		border-radius: 0.6rem;
		overflow: hidden;
		background: color-mix(in srgb, var(--color-text) 4%, transparent);
	}
	.editor pre,
	.editor textarea {
		margin: 0;
		padding: 0.8rem 1rem;
		font-family: var(--font-mono);
		font-size: 12.5px;
		line-height: 1.5;
		tab-size: 2;
		white-space: pre;
		overflow: auto;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
	}
	.editor pre {
		position: absolute;
		inset: 0;
		pointer-events: none;
		color: var(--color-text);
	}
	.editor textarea {
		position: relative;
		background: transparent;
		color: transparent;
		caret-color: var(--color-text);
		border: none;
		resize: none;
		outline: none;
	}
	.editor textarea::selection {
		background: color-mix(in srgb, var(--color-important) 30%, transparent);
	}
	.editor :global(.k) {
		color: #a855f7;
	}
	.editor :global(.s) {
		color: #14b8a6;
	}
	.editor :global(.n) {
		color: #f59e0b;
	}
	.editor :global(.c) {
		color: var(--color-text-muted);
		font-style: italic;
	}

	.output {
		margin-top: 0.6rem;
		border: 1px solid var(--color-border-light);
		border-radius: 0.6rem;
		padding: 0.6rem 1rem;
		max-height: 16rem;
		overflow: auto;
	}
	.entry {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-text);
		white-space: pre-wrap;
	}
	.entry.err {
		color: var(--color-challenge);
	}
	.entry.note {
		color: var(--color-text-muted);
		font-style: italic;
	}
	.entry + .entry {
		border-top: 1px dashed var(--color-border-light);
		margin-top: 0.35rem;
		padding-top: 0.35rem;
	}
</style>
