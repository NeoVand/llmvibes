# LLMVibes — Build an LLM in Your Browser

The third site in the vibes family ([TerminalVibes](https://neovand.github.io/terminalvibes/), [GitVibes](https://neovand.github.io/gitvibes/)): an interactive course where you raise two tiny language models — **Quill** (a storyteller) and **Rook** (a chess player) — from raw data to aligned, reasoning models, entirely in your browser.

Pretraining → SFT/LoRA → RLHF/DPO → RLVR, with every stage running locally on WebGPU (via [jax-js](https://github.com/ekzhang/jax-js)), visualized as it happens.

**Status: early construction (M1).** The 14-part course structure is in place; the training playgrounds arrive milestone by milestone. `PLAN.md` is the design source of truth; `spikes/m0/` holds the engine feasibility benchmarks.

## Develop

```bash
npm install
npm run dev
```

## Structure

- `src/lib/llm/engine.ts` — the lab-engine seam (Worker-backed jax-js training)
- `src/lib/components/sections/` — the 14 course parts
- `src/lib/data/sections.ts` — course anchor taxonomy
- `spikes/m0/` — standalone jax-js benchmark harness (`npm run dev --prefix spikes/m0`)
- `PLAN.md` — course design, milestones, decisions
