# LLMVibes

Browser-based course teaching how modern LLMs are built. Learners raise two models in parallel — **Quill** (TinyStories-class storyteller, byte-BPE) and **Rook** (chess, UCI move tokens) — through pretraining → SFT/LoRA → RLHF/DPO → RLVR, all in-browser on WebGPU via jax-js.

**PLAN.md is the design source of truth.** Read it before making course-structure decisions. `spikes/m0/RESULTS.md` records the engine feasibility numbers and hard-won jax-js facts (training must be jitted; gather backward missing → oneHot embeddings; zero-init output projections mean zero grads at step 0 — not a bug).

## State (M1, skeleton phase)

This app is a clone of GitVibes being converted. What's real: 14-part course structure, data modules, shared shell (Sidebar/ThreadRail/AgentPanel/theme/progress). What's stubbed:

- `src/lib/playground/{scenarios,challenges,exercise-commands}.ts` — empty registries keeping the shared shell compiling; real lab scenarios come with M3+
- `src/lib/ai/git-bridge.ts` — under-construction bridge stub (rename to llm-bridge when the real engine lands)
- `src/lib/llm/engine.ts` — the lab-engine contract (no implementation yet; WorkerEngine + PlaybackEngine come with M2/M3)
- `src/lib/data/git-syntax.ts` — kept as-is (generic shell highlighter used by Code/CodeBlock/Search); rename when touched

## Conventions

- SvelteKit 2 + Svelte 5 runes, Tailwind 4, adapter-static → GitHub Pages
- Content is bespoke Svelte components in `src/lib/components/sections/PartN.svelte`, anchored via `src/lib/data/sections.ts` (`part-N` / `section-N-M` ids); sections.ts order is load-bearing (progress migrations, timeline, sidebar all key off it)
- Course prose voice: matches TerminalVibes/GitVibes — direct, visual-first, no filler
- Training code: everything jitted, 2-D matmul shapes (see spikes/m0/src/main.ts for the idioms), train in a Worker, sync per step

## Commands

- `npm run dev` / `npm run build` / `npm run check` (svelte-check)
- `npm run test:unit` (vitest) — the e2e suite was removed in the conversion; rebuild as features land
- M0 benchmark harness: `npm run dev --prefix spikes/m0` → localhost:5180 (`?run=chain` = autodiff regression probes)

## Svelte MCP server

A Svelte MCP server may be available with Svelte 5 / SvelteKit documentation tools: `list-sections` (call first to discover docs), `get-documentation` (fetch relevant sections), `svelte-autofixer` (run on Svelte code you write until clean), `playground-link` (generate playground links when useful).
