<script lang="ts">
	import { onMount } from 'svelte';
	import BackgroundPixels from '$lib/components/layout/BackgroundPixels.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import CheatSheet from '$lib/components/layout/CheatSheet.svelte';
	import AgentPanel from '$lib/components/layout/AgentPanel.svelte';
	import Hero from '$lib/components/sections/Hero.svelte';
	import Part1 from '$lib/components/sections/Part1.svelte';
	import Part2 from '$lib/components/sections/Part2.svelte';
	import Part3 from '$lib/components/sections/Part3.svelte';
	import Part4 from '$lib/components/sections/Part4.svelte';
	import Part5 from '$lib/components/sections/Part5.svelte';
	import Part6 from '$lib/components/sections/Part6.svelte';
	import Part7 from '$lib/components/sections/Part7.svelte';
	import Part8 from '$lib/components/sections/Part8.svelte';
	import Part9 from '$lib/components/sections/Part9.svelte';
	import Part10 from '$lib/components/sections/Part10.svelte';
	import Part11 from '$lib/components/sections/Part11.svelte';
	import Part12 from '$lib/components/sections/Part12.svelte';
	import Part13 from '$lib/components/sections/Part13.svelte';
	import Part14 from '$lib/components/sections/Part14.svelte';
	import { resolve } from '$app/paths';
	import { anchorIds } from '$lib/data/sections';
	import { partPages } from '$lib/data/part-pages';
	import { courseEntry } from '$lib/data/sidebar-nav';
	import { markSectionVisited } from '$lib/data/progress';
	import { createProgressSets, timelineManifest } from '$lib/timeline/state.svelte';
	import { createReflowWatcher, measureOffsets, scrollFraction } from '$lib/timeline/measure';
	import type { PlacedItem } from '$lib/timeline/mapping';
	import { readingContext } from '$lib/ai/reading-context.svelte';
	import {
		loadThemePreference,
		saveThemePreference,
		getEffectiveTheme,
		applyTheme,
		type ThemePreference
	} from '$lib/theme';

	let sidebarOpen = $state(false);
	let cheatSheetOpen = $state(false);
	let agentOpen = $state(false);
	let activeSection = $state('hero');
	let theme = $state<ThemePreference>('system');
	let navClickActive = false;

	/* ---- the header's Thread rail --------------------------------------
	   Three small additions, no restructuring. `activeSection` is a DISCRETE
	   id and is not enough for the rail: its reading head and its per-bar
	   fill are continuous, so it needs the scroll FRACTION as well. That is
	   computed inside the existing rAF-throttled scroll handler — there is
	   no second scroll listener. */
	let scrollPosition = $state(0);
	let timelineItems = $state<PlacedItem[]>([]);
	const progressSets = createProgressSets();
	const manifestIds = timelineManifest.map((it) => it.id);

	function remeasureTimeline() {
		const { f } = measureOffsets(manifestIds);
		timelineItems = timelineManifest
			.filter((it) => f.has(it.id))
			.map((it) => ({ ...it, f: f.get(it.id)! }));
		scrollPosition = scrollFraction();
	}

	// Where the learner is reading — the agent's contextual suggestions
	// mirror the existing scroll-spy value, no second observer.
	$effect(() => {
		readingContext.sectionId = activeSection;
	});

	function getEffectiveThemeLocal(): 'light' | 'dark' {
		return getEffectiveTheme(theme);
	}

	function toggleTheme() {
		const effective = getEffectiveThemeLocal();
		theme = effective === 'dark' ? 'light' : 'dark';
		saveThemePreference(theme);
		applyTheme(theme);
	}

	function sectionScrollTop(el: HTMLElement): number {
		const headerHeight =
			parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) ||
			48;
		return el.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
	}

	function scrollToSection(id: string, behavior: ScrollBehavior = 'smooth') {
		const el = document.getElementById(id);
		if (el) {
			window.scrollTo({ top: sectionScrollTop(el), behavior });
		}
		if (typeof window !== 'undefined') {
			const url = `${window.location.pathname}${window.location.search}#${id}`;
			history.replaceState(null, '', url);
		}
	}

	// Images above a deep-linked section load lazily and shift the layout after
	// the initial scroll lands, so keep re-aligning until things settle. A
	// layout shift moves the section's desired position; any other viewport
	// movement (scrollbar drag, keyboard, script) means someone else is
	// scrolling — they win and the loop stops.
	function keepSectionAligned(id: string, duration = 1500) {
		const started = performance.now();
		let lastDesired = -1;
		function tick() {
			if (!navClickActive) return;
			const el = document.getElementById(id);
			if (el) {
				const desired = sectionScrollTop(el);
				const layoutShifted = lastDesired === -1 || Math.abs(desired - lastDesired) > 2;
				if (!layoutShifted && Math.abs(window.scrollY - desired) > 2) {
					return;
				}
				if (Math.abs(window.scrollY - desired) > 2) {
					window.scrollTo({ top: desired, behavior: 'instant' });
				}
				lastDesired = desired;
			}
			if (performance.now() - started < duration) {
				requestAnimationFrame(tick);
			}
		}
		requestAnimationFrame(tick);
	}

	onMount(() => {
		theme = loadThemePreference();
		applyTheme(theme);

		const hash = window.location.hash.slice(1);
		if (hash && anchorIds.includes(hash)) {
			activeSection = hash;
			navClickActive = true;
			requestAnimationFrame(() => {
				scrollToSection(hash, 'instant');
				keepSectionAligned(hash);
			});
		}

		// `anchorIds` is sectionIds ++ activity anchors, which is NOT guaranteed
		// to be document order. The scan below walks forward and breaks at the
		// first anchor still below the fold, which is only correct on a
		// document-ordered list — so sort by document position first.
		const sectionEls = anchorIds
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null)
			.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

		function updateActiveSection() {
			// The rail's reading head is continuous and must track the scroll even
			// while a nav click is settling, so it updates before the early return.
			scrollPosition = scrollFraction();
			if (navClickActive) return;
			const offset = window.innerHeight * 0.2;
			let best: string | null = null;
			for (const el of sectionEls) {
				if (el.getBoundingClientRect().top <= offset) {
					best = el.id;
				} else {
					break;
				}
			}
			if (best) {
				activeSection = best;
				markSectionVisited(best);
			}
		}

		let rafId = 0;
		let scrollbarTimer: ReturnType<typeof setTimeout> | undefined;
		function onScroll() {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(updateActiveSection);
			// Reveal the root scrollbar while scrolling; hide it after idle
			document.documentElement.classList.add('is-scrolling');
			clearTimeout(scrollbarTimer);
			scrollbarTimer = setTimeout(
				() => document.documentElement.classList.remove('is-scrolling'),
				800
			);
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		updateActiveSection();

		if (window.innerWidth >= 1024) {
			sidebarOpen = true;
		}

		const clearNavClick = () => {
			navClickActive = false;
		};
		window.addEventListener('wheel', clearNavClick, { passive: true });
		window.addEventListener('touchmove', clearNavClick, { passive: true });

		// Decorate every section anchor's heading with a copy-permalink button.
		for (const el of sectionEls) {
			const heading = el.querySelector('h2, h3, h4') ?? (/^H[2-4]$/.test(el.tagName) ? el : null);
			if (!heading || heading.querySelector('.heading-anchor')) continue;
			const anchor = document.createElement('a');
			anchor.className = 'heading-anchor';
			anchor.href = `#${el.id}`;
			anchor.textContent = '#';
			anchor.setAttribute('aria-label', 'Copy link to this section');
			anchor.addEventListener('click', (event) => {
				event.preventDefault();
				const url = `${location.origin}${location.pathname}#${el.id}`;
				history.replaceState(null, '', `#${el.id}`);
				navigator.clipboard?.writeText(url).catch(() => {});
			});
			heading.appendChild(anchor);
		}

		// Measure the rail's anchors after the first paint, then keep them honest.
		// This page reflows for the whole session — lazily rendered content grows
		// it as the reader scrolls, not just at load. createReflowWatcher
		// debounces all of it behind one ResizeObserver on <main>.
		requestAnimationFrame(remeasureTimeline);
		const stopWatcher = createReflowWatcher({
			target: document.getElementById('main-content'),
			onReflow: remeasureTimeline,
			onResize: remeasureTimeline
		});

		return () => {
			window.removeEventListener('scroll', onScroll);
			cancelAnimationFrame(rafId);
			clearTimeout(scrollbarTimer);
			window.removeEventListener('wheel', clearNavClick);
			window.removeEventListener('touchmove', clearNavClick);
			stopWatcher();
			progressSets.destroy();
		};
	});

	function handleNavigate(id: string) {
		activeSection = id;
		navClickActive = true;
		// Jump instantly: a smooth scroll across a page this tall takes long
		// enough that lazy content materializes mid-flight and the target
		// drifts. The alignment loop absorbs any shifts that land afterwards.
		scrollToSection(id, 'instant');
		keepSectionAligned(id, 2500);
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	// The header panels are mutually exclusive: opening one closes the
	// others. Each enters desktop "reading mode": the sidebar auto-collapses
	// and the content reflows beside the panel — the sidebar's prior state is
	// restored when all of them are closed. (The playground panel is gone
	// with the git engine; the LLM training panels will re-enter this scheme
	// in a later milestone.)
	let sidebarBeforePanel = false;

	/** Call BEFORE mutating any open flags when a side panel is opening. */
	function enterReadingMode() {
		if (!agentOpen && !cheatSheetOpen) {
			sidebarBeforePanel = sidebarOpen;
			sidebarOpen = false;
		}
	}

	/** Call AFTER mutating flags — restores the sidebar once all are closed. */
	function maybeLeaveReadingMode() {
		if (!agentOpen && !cheatSheetOpen) {
			sidebarOpen = sidebarBeforePanel;
		}
	}

	function toggleCheatSheet() {
		if (!cheatSheetOpen) {
			enterReadingMode();
			agentOpen = false;
			cheatSheetOpen = true;
		} else {
			cheatSheetOpen = false;
			maybeLeaveReadingMode();
		}
	}

	function toggleAgent() {
		if (!agentOpen) {
			enterReadingMode();
			cheatSheetOpen = false;
			agentOpen = true;
		} else {
			agentOpen = false;
			maybeLeaveReadingMode();
		}
	}

	/** Open the tutor from the prose, without closing it if it is already up. */
	function openAgent() {
		if (!agentOpen) toggleAgent();
	}
</script>

<svelte:head>
	<title>LLMVibes -- How Modern LLMs Are Built</title>
	<meta
		name="description"
		content="An interactive course on how modern LLMs are built. Raise two tiny models — a storyteller and a chess player — from raw data through pretraining, SFT, RLHF/DPO, and RLVR, entirely in your browser."
	/>
	<link rel="canonical" href="https://neovand.github.io/llmvibes/" />
	<!-- The social card lives here rather than in app.html: a crawler honours
	     the first og:* it meets, and the fourteen part pages each need their own. -->
	<meta property="og:title" content="LLMVibes — How Modern LLMs Are Built" />
	<meta
		property="og:description"
		content="Raise two tiny language models from raw data to aligned, reasoning models — pretraining, SFT, RLHF/DPO, and RLVR, live in your browser on WebGPU."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://neovand.github.io/llmvibes/" />
	<meta property="og:image" content="https://neovand.github.io/llmvibes/og-image.png" />
	<meta
		property="og:image:alt"
		content="LLMVibes — raise two tiny language models in your browser"
	/>
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="LLMVibes — How Modern LLMs Are Built" />
	<meta
		name="twitter:description"
		content="An interactive, visual course on how modern LLMs are built — trained live in your browser."
	/>
	<meta name="twitter:image" content="https://neovand.github.io/llmvibes/og-image.png" />
	<meta
		name="twitter:image:alt"
		content="LLMVibes — raise two tiny language models in your browser"
	/>
	<!-- Safe {@html}: the payload is JSON.stringify of a static literal — no
	     user input can reach it. It exists only to emit the JSON-LD script tag,
	     which Svelte cannot render any other way. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'Course',
		name: 'LLMVibes — How Modern LLMs Are Built',
		description:
			'A free, interactive course on how modern large language models are built. Raise two tiny models — Quill the storyteller and Rook the chess player — from raw data through tokenization, the transformer, pretraining, interpretability, SFT and LoRA, synthetic data, preference optimization, reward hacking, RLVR/GRPO, agents, and frontier inference tricks, with training running live in the browser on WebGPU.',
		url: 'https://neovand.github.io/llmvibes/',
		provider: {
			'@type': 'Organization',
			name: 'LLMVibes',
			url: 'https://neovand.github.io/llmvibes/'
		},
		isAccessibleForFree: true,
		educationalLevel: 'Beginner',
		teaches: [
			'Training data, cleaning, and deduplication',
			'Tokenization: byte-level BPE and designed vocabularies',
			'The transformer architecture (attention, RoPE, SwiGLU, RMSNorm)',
			'Cross-entropy, backpropagation, AdamW, and generalization',
			'Pretraining, sampling, scaling laws, and evals',
			'Interpretability: linear probes and activation patching',
			'SFT, chat templates, and LoRA fine-tuning',
			'Synthetic data pipelines and verifier filtering',
			'Reward models, DPO, RLHF vs RLAIF, and reward hacking',
			'RLVR and GRPO, up to the full R1-style recipe',
			'Tool-using agents, and inference: KV cache, quantization, speculative decoding'
		],
		hasCourseInstance: {
			'@type': 'CourseInstance',
			courseMode: 'Online',
			courseWorkload: 'PT8H'
		},
		offers: {
			'@type': 'Offer',
			price: 0,
			priceCurrency: 'USD',
			category: 'Free'
		}
	})}</scr${''}ipt>`}
</svelte:head>

<a href="#main-content" class="skip-link">Skip to content</a>

<BackgroundPixels />

<Header
	theme={getEffectiveThemeLocal()}
	onToggleTheme={toggleTheme}
	onToggleCheatSheet={toggleCheatSheet}
	onTogglePlayground={() => {}}
	onToggleAgent={toggleAgent}
	onNavigate={handleNavigate}
	{timelineItems}
	{scrollPosition}
	readIds={progressSets.readIds}
	doneIds={progressSets.doneIds}
	{cheatSheetOpen}
	playgroundOpen={false}
	{agentOpen}
/>
<Sidebar open={sidebarOpen} {activeSection} onToggle={toggleSidebar} onNavigate={handleNavigate} />
<CheatSheet open={cheatSheetOpen} onToggle={toggleCheatSheet} />
<AgentPanel open={agentOpen} onToggle={toggleAgent} onNavigate={handleNavigate} />

<!-- duration-200 is MORPH_MS in Sidebar.svelte: the sidebar's right edge and
     this margin are the same moving line, so they share one clock — change
     one and the page body visibly lags the panel. -->
<main
	id="main-content"
	class="main-content transition-[margin] duration-200 ease-out"
	class:reading-mode={agentOpen || cheatSheetOpen}
	class:agent-mode={agentOpen}
	class:cheat-mode={cheatSheetOpen}
	style="padding-top: var(--header-height); margin-left: {sidebarOpen
		? 'var(--sidebar-width)'
		: 'var(--sidebar-collapsed-width)'};"
>
	<Hero onOpenAgent={openAgent} />
	<Part1 />
	<Part2 />
	<Part3 />
	<Part4 />
	<Part5 />
	<Part6 />
	<Part7 />
	<Part8 />
	<Part9 />
	<Part10 />
	<Part11 />
	<Part12 />
	<Part13 />
	<Part14 />

	<footer class="py-10" style="border-top: 1px solid var(--color-border);">
		<!-- Every part also stands alone at its own URL. This index is how those
		     pages are reachable — by a reader who wants to link one chapter to a
		     colleague, and by a crawler, which will not find a page nothing
		     links to. -->
		<nav class="mx-auto max-w-4xl px-6" aria-label="Parts of this course">
			<h2
				class="mb-3 text-xs font-bold tracking-widest uppercase"
				style="color: var(--color-text-muted); font-family: var(--font-heading); letter-spacing: 0.14em;"
			>
				Every part, on its own page
			</h2>
			<ul class="part-index grid gap-1.5">
				{#each partPages as part (part.id)}
					{@const entry = courseEntry(part.id)}
					{@const Icon = entry?.icon}
					<li>
						<a
							href={resolve('/parts/[slug]', { slug: part.slug })}
							class="part-index-link flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]"
							style="color: var(--color-text-secondary);"
						>
							{#if Icon}
								<Icon size={14} style="color: var(--color-primary); flex-shrink: 0;" />
							{/if}
							<span class="truncate">{entry?.label ?? part.title}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<p class="mt-8 text-center text-xs" style="color: var(--color-text-muted);">
			Built for the vibe coding generation.
		</p>
	</footer>
</main>
