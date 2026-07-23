<script lang="ts">
	// The TinyStories diversity engine, live. Three ingredient pools with
	// checkbox chips; every generation prompt is one random pick per column, so
	// the pattern space is the PRODUCT of what you leave checked — the readout
	// updates as you toggle. Then the other half of the pipeline: three canned
	// raw generations run through toggleable verifier filters, pass/fail badges
	// animating as the gate opens and closes. Temperature varies wording; the
	// prompt distribution varies content; the verifier decides what survives.
	import { Check, Dices, Funnel, X } from 'lucide-svelte';

	// ── ingredient pools ──
	const CHARACTERS = [
		'a girl named Lily',
		'a robot named Max',
		'an old turtle',
		'a small dragon',
		'a boy named Tim',
		'a lost puppy',
		'a kind witch',
		'a talking cloud'
	];
	const VERBS = ['finds', 'loses', 'builds', 'shares', 'fixes', 'hides'];
	const FEATURES = [
		'must include "moon"',
		'must include "brave"',
		'must include "lost"',
		'has a moral',
		'has a dialogue',
		'has a sad ending'
	];
	const FEATURE_CLAUSES = [
		'The story must include the word "moon".',
		'The story must include the word "brave".',
		'The story must include the word "lost".',
		'The story should have a moral value.',
		'The story should contain a dialogue.',
		'The story should have a sad ending.'
	];

	const POOLS = [
		{ name: 'character', color: 'var(--color-note)', items: CHARACTERS },
		{ name: 'verb', color: 'var(--color-vibe)', items: VERBS },
		{ name: 'required feature', color: 'var(--color-important)', items: FEATURES }
	];

	let on = $state<boolean[][]>(POOLS.map((p) => p.items.map(() => true)));

	const checkedIdx = $derived(on.map((col) => col.flatMap((v, i) => (v ? [i] : []))));
	const counts = $derived(checkedIdx.map((c) => c.length));
	const total = $derived(counts[0] * counts[1] * counts[2]);

	// ── seeded sampling: a fresh deterministic seed per click ──
	interface GenPrompt {
		key: string;
		char: string;
		verb: string;
		clause: string;
	}

	let clicks = $state(0);
	let prompts = $state<GenPrompt[]>([]);

	function mulberry32(seed: number): () => number {
		let a = seed >>> 0;
		return () => {
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	function generate() {
		clicks += 1;
		const rand = mulberry32(0x9e3779b9 ^ Math.imul(clicks, 2654435761));
		const pick = (col: number) => checkedIdx[col][Math.floor(rand() * checkedIdx[col].length)];
		const out: GenPrompt[] = [];
		const want = Math.min(5, total);
		let guard = 0;
		while (out.length < want && guard < 400) {
			guard += 1;
			const ci = pick(0);
			const vi = pick(1);
			const fi = pick(2);
			const key = `${ci}-${vi}-${fi}`;
			if (out.some((g) => g.key === key)) continue;
			out.push({ key, char: CHARACTERS[ci], verb: VERBS[vi], clause: FEATURE_CLAUSES[fi] });
		}
		prompts = out;
	}

	// ── the verifier gate: three canned raw generations, checked mechanically ──
	const SAMPLES = [
		{
			name: 'generation #1',
			text: `Lily found a round white stone that looked just like the moon. "Look, Max!" she said. "It fell down from the sky!" Max the robot beeped happily, and together they carried it up the big hill. That night they watched the real moon rise, and Lily shared her stone with Max. Sharing made the sky feel twice as big.`
		},
		{
			name: 'generation #2',
			text: `Tim found a small star lying in the wet grass. He picked it up, and it glowed in his little hand. "You are far from home," he said. So he climbed the tallest tree in town and set the star back into the sky. His mom hugged him, and the whole night felt warm and bright.`
		},
		{
			name: 'generation #3',
			text: `The dragon was sad. The dragon looked at the moon. The dragon was sad. The moon was too far away.`
		}
	];

	function wordCount(t: string): number {
		return t.trim().split(/\s+/).length;
	}
	function hasRepeatedSentence(t: string): boolean {
		const sents = t
			.split(/[.!?]+/)
			.map((s) => s.trim().toLowerCase())
			.filter((s) => s.length > 0);
		return new Set(sents).size < sents.length;
	}

	const CHECKS = SAMPLES.map((s) => ({
		...s,
		words: wordCount(s.text),
		hasWord: /\bmoon\b/i.test(s.text),
		repeated: hasRepeatedSentence(s.text)
	}));

	const FILTERS: { label: string; pass: (c: (typeof CHECKS)[number]) => boolean }[] = [
		{ label: 'length ≥ 40 words', pass: (c) => c.words >= 40 },
		{ label: 'contains "moon"', pass: (c) => c.hasWord },
		{ label: 'no repeated sentence', pass: (c) => !c.repeated }
	];

	let filterOn = $state([true, true, true]);
	const filterKey = $derived(filterOn.join(''));
	const nFiltersOn = $derived(filterOn.filter(Boolean).length);

	function kept(c: (typeof CHECKS)[number]): boolean {
		return FILTERS.every((f, i) => !filterOn[i] || f.pass(c));
	}
	const keptCount = $derived(CHECKS.filter((c) => kept(c)).length);

	const fmt = new Intl.NumberFormat('en-US');
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
			style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
		>
			<Dices size={16} strokeWidth={2.5} />
			<span>The diversity engine — build a prompt space</span>
		</div>
		<span class="text-xs" style="color: var(--color-text-muted); font-family: var(--font-mono);">
			TinyStories-style
		</span>
	</div>
	<p class="mb-4 text-xs" style="color: var(--color-text-muted);">
		Every generation prompt draws one random pick per column. Toggle chips to widen or starve the
		pools, then sample the space — the ingredients are randomized <em>before</em> the generator writes
		a word.
	</p>

	<!-- ── ingredient pools ── -->
	<div class="mb-4 grid gap-4 sm:grid-cols-3">
		{#each POOLS as pool, p (pool.name)}
			<div>
				<div
					class="mb-2 flex items-baseline justify-between text-[11px] tracking-wide uppercase"
					style="font-family: var(--font-mono); color: var(--color-text-secondary);"
				>
					<span style="color: {pool.color};">{pool.name}</span>
					<span style="color: var(--color-text-muted);">{counts[p]}/{pool.items.length}</span>
				</div>
				<div class="flex flex-wrap gap-1.5">
					{#each pool.items as item, i (item)}
						<button
							class="chip"
							class:on={on[p][i]}
							style="--chip-color: {pool.color};"
							aria-pressed={on[p][i]}
							onclick={() => (on[p][i] = !on[p][i])}
						>
							{#if on[p][i]}<Check size={11} strokeWidth={3} />{/if}
							{item}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<!-- ── combinatorics readout + generate ── -->
	<div
		class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2.5"
		style="border-color: var(--color-border-light); background: var(--color-bg-secondary);"
	>
		<span class="text-[13px]" style="font-family: var(--font-mono); color: var(--color-text);">
			<span style="color: var(--color-note);">{counts[0]}</span>
			<span style="color: var(--color-text-muted);">×</span>
			<span style="color: var(--color-vibe);">{counts[1]}</span>
			<span style="color: var(--color-text-muted);">×</span>
			<span style="color: var(--color-important);">{counts[2]}</span>
			<span style="color: var(--color-text-muted);">=</span>
		</span>
		{#key total}
			<span
				class="pop text-xl font-bold"
				style="font-family: var(--font-mono); color: var(--color-text);">{fmt.format(total)}</span
			>
		{/key}
		<span class="text-xs" style="color: var(--color-text-secondary);">distinct prompts</span>
		<button class="gen-btn ml-auto" onclick={generate} disabled={total === 0}>
			<Dices size={13} strokeWidth={2.5} /> Generate 5 prompts
		</button>
	</div>

	{#if total === 0}
		<p class="mb-4 text-xs italic" style="color: var(--color-challenge);">
			A column is empty — with zero choices somewhere, the product is zero and the generator has
			nothing to ask for. Check at least one chip per column.
		</p>
	{/if}

	<!-- ── sampled prompt cards ── -->
	{#if prompts.length > 0}
		{#key clicks}
			<div class="mb-2 grid gap-2">
				{#each prompts as pr, i (pr.key)}
					<div
						class="card rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed"
						style="border-color: var(--color-border-light); color: var(--color-text-secondary); animation-delay: {i *
							70}ms;"
					>
						<span
							class="mr-2 text-[10px] tracking-wide uppercase"
							style="font-family: var(--font-mono); color: var(--color-text-muted);"
							>prompt {i + 1}</span
						>
						Write a short story (3–4 paragraphs) using only very simple words that a 3-year-old would
						likely understand. The story is about
						<strong style="color: var(--color-note);">{pr.char}</strong>
						who
						<strong style="color: var(--color-vibe);">{pr.verb}</strong>
						something special.
						<strong style="color: var(--color-important);">{pr.clause}</strong>
						Remember: only simple words!
					</div>
				{/each}
			</div>
		{/key}
		<p class="mb-4 text-[11.5px]" style="color: var(--color-text-muted);">
			Same template every time — only the colored slots move. Temperature would vary the <em
				>wording</em
			>
			of one prompt's stories; this grid varies what the stories are <em>about</em>. Diversity is
			engineered in the prompt distribution. (TinyStories crossed ~1,500 words plus feature subsets
			— a space in the billions.)
		</p>
	{/if}

	<!-- ── the verifier gate ── -->
	<div class="mt-2 border-t pt-4" style="border-color: var(--color-border-light);">
		<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
			<div
				class="flex items-center gap-2 text-[12px] font-bold tracking-wide uppercase"
				style="color: var(--color-tip); font-family: var(--font-heading); letter-spacing: 0.08em;"
			>
				<Funnel size={14} strokeWidth={2.5} />
				<span>Then the gate: verifier filters</span>
			</div>
			{#key filterKey}
				<span
					class="pop text-xs font-semibold"
					style="font-family: var(--font-mono); color: {keptCount === CHECKS.length
						? 'var(--color-text-muted)'
						: 'var(--color-text)'};"
				>
					kept {keptCount} / {CHECKS.length}
				</span>
			{/key}
		</div>
		<p class="mb-3 text-xs" style="color: var(--color-text-muted);">
			Three raw generations answering a prompt that required the word "moon". Toggle a filter and
			watch the verdicts flip — each check is cheap, mechanical, and unarguable.
		</p>

		<div class="mb-3 flex flex-wrap gap-1.5">
			{#each FILTERS as f, i (f.label)}
				<button
					class="chip"
					class:on={filterOn[i]}
					style="--chip-color: var(--color-tip);"
					aria-pressed={filterOn[i]}
					onclick={() => (filterOn[i] = !filterOn[i])}
				>
					{#if filterOn[i]}<Check size={11} strokeWidth={3} />{/if}
					{f.label}
				</button>
			{/each}
		</div>

		<div class="grid gap-2">
			{#each CHECKS as c (c.name)}
				{@const pass = kept(c)}
				<div
					class="rounded-lg border px-3 py-2"
					style="border-color: {pass
						? 'var(--color-border-light)'
						: 'color-mix(in srgb, var(--color-challenge) 40%, var(--color-border-light))'}; opacity: {pass
						? 1
						: 0.75}; transition: border-color 160ms ease, opacity 160ms ease;"
				>
					<div class="mb-1 flex flex-wrap items-center gap-1.5">
						<span
							class="text-[10px] tracking-wide uppercase"
							style="font-family: var(--font-mono); color: var(--color-text-muted);">{c.name}</span
						>
						<span
							class="text-[10px]"
							style="font-family: var(--font-mono); color: var(--color-text-muted);"
							>· {c.words} words</span
						>
						{#key filterKey}
							<span class="pop verdict ml-auto" class:ok={pass} class:bad={!pass}>
								{#if pass}<Check size={11} strokeWidth={3} /> kept{:else}<X
										size={11}
										strokeWidth={3}
									/> rejected{/if}
							</span>
						{/key}
					</div>
					<p class="mb-1.5 text-[12px] leading-relaxed" style="color: var(--color-text-secondary);">
						{c.text}
					</p>
					{#if nFiltersOn > 0}
						<div class="flex flex-wrap gap-1.5">
							{#each FILTERS as f, i (f.label)}
								{#if filterOn[i]}
									{@const ok = f.pass(c)}
									{#key filterKey}
										<span class="pop badge" class:ok class:bad={!ok}>
											{#if ok}<Check size={10} strokeWidth={3} />{:else}<X
													size={10}
													strokeWidth={3}
												/>{/if}
											{f.label}
										</span>
									{/key}
								{/if}
							{/each}
						</div>
					{:else}
						<p class="text-[11px] italic" style="color: var(--color-challenge);">
							No filters on — everything reaches training, including the junk above.
						</p>
					{/if}
				</div>
			{/each}
		</div>

		<p class="mt-3 text-[11.5px]" style="color: var(--color-text-muted);">
			Generation is cheap; the value is in what the gate throws away. A weak generator plus a strict
			verifier yields strong data — only the kept samples become the training set.
		</p>
	</div>
</div>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		padding: 0.15rem 0.6rem;
		font-size: 11.5px;
		color: var(--color-text-muted);
		background: transparent;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease,
			color 120ms ease;
	}
	.chip:hover {
		border-color: var(--chip-color);
	}
	.chip.on {
		border-color: color-mix(in srgb, var(--chip-color) 55%, var(--color-border));
		background: color-mix(in srgb, var(--chip-color) 10%, transparent);
		color: var(--color-text);
	}

	.gen-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid color-mix(in srgb, var(--color-important) 55%, var(--color-border));
		border-radius: 0.5rem;
		padding: 0.3rem 0.75rem;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-important);
		background: color-mix(in srgb, var(--color-important) 8%, transparent);
		cursor: pointer;
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}
	.gen-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-important) 15%, transparent);
	}
	.gen-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.card {
		animation: slide-in 260ms ease-out both;
	}
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.verdict {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		border-radius: 999px;
		padding: 1px 8px;
		font-size: 10.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		border-radius: 999px;
		padding: 1px 7px;
		font-size: 10px;
		font-weight: 600;
	}
	.ok {
		color: var(--color-tip);
		background: color-mix(in srgb, var(--color-tip) 12%, transparent);
	}
	.bad {
		color: var(--color-challenge);
		background: color-mix(in srgb, var(--color-challenge) 12%, transparent);
	}

	.pop {
		animation: pop 240ms ease-out;
	}
	@keyframes pop {
		0% {
			transform: scale(0.7);
		}
		60% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
		}
	}
</style>
