# LLMVibes — Plan

**LLMVibes** — third site in the vibes family (TerminalVibes, GitVibes). An in-browser
course where the learner raises a modern LLM from raw data through pretraining, SFT,
RLHF/DPO, and RLVR — every stage running locally, most of it on WebGPU.

*v3 — brainstorm → decisions → adversarial review incorporated. This is the commit
version.*

## Locked decisions (2026-07-22)

1. **Title: LLMVibes.** Plain and searchable.
2. **Dual spine — two named models raised in parallel:**
   - **Quill** — a TinyStories-class English storyteller. Leads: tokenization,
     learner-as-annotator RLHF, synthetic data, agents, the story endpoint.
   - **Rook** — a chess-move model. Leads: verifiable rewards, world-model
     interpretability, RLAIF (Stockfish as annotator).
   - Same architecture, two corpora. Thesis: *it's all next-token prediction over
     token streams.* Motif: a rook is a corvid, a quill is a feather — the learner
     raises two birds. Per-lesson throwaway minis are **hatchlings**.
   - **Lead-bird rule:** each chapter has one lead bird and one cameo; full twin
     parity only where the contrast *is* the lesson (chs. 5, 9).
3. **Chess tokenization: UCI move tokens** — one token per move (`e2e4`, `e7e8q`),
   vocab ≈ 2k (1968 geometric moves incl. promotions) + special tokens (BOS, result,
   **Elo-bucket conditioning tokens** — committed, they enable the ch. 7
   conditioning-vs-fine-tuning lesson). Attention is move-to-move (rendered as board
   arrows); every token defines a full board state (clean per-token probes);
   sequences 3–5× shorter than char-PGN. Cost: no reuse of Karvonen checkpoints
   (methodology transfers). Ch. 2 carries the "why not chars? why not FEN?" panel.
4. **Quill tokenization: byte-level BPE** (byte fallback — free-form input never
   OOVs; "why your emoji becomes 4 strange tokens" is a 30-second inspector lesson).
5. **Othello: cut.**
6. **Instruction data: TinyStories-Instruct as-is** + a dedicated synthetic-data
   chapter (8). The endpoint is honestly framed as **single-turn prompt → story**
   (multi-turn only if ch. 8's synthetic pipeline adds traces).
7. **Agents chapter: memory + world-database tools** (ch. 12). Stretch,
   prototype-gated.
8. **Engine: jax-js primary**, hard-gated at M0 with numeric targets.
   **Co-contender: a hand-rolled WGSL fixed-graph trainer seeded from algocell**
   (`/Users/neo/repos/algocell` — Neo's existing, finite-diff-validated WebGPU BPTT
   trainer; see `docs/webgpu-trainer-map.md` there). Its host patterns (single bind
   group, batched pass submission, uniform-driven step control, packed buffers),
   its Adam/clipping/zeroGrad kernels, and above all its validation methodology
   transfer directly; its eleven math kernels do not (CA stencil ≠ transformer).
   Last resort: fork `@genai-fi/nanogpt` (TF.js, maintenance-mode risk). Any
   adopted engine must pass the same M0 gate.
   **Upstream strategy (jax-js):** MIT, actively developed, contributions
   explicitly welcomed — and its named roadmap gaps (fp16, gradient
   checkpointing/remat, fused attention, "fast general transformer engine") are
   exactly what LLMVibes needs. Engage the maintainer early (issue describing the
   use case, during M0); develop against a pinned version so course progress never
   waits on upstream review; PR gaps asynchronously, starting small (bug reports,
   benchmarks, single ops) before big features. LLMVibes doubles as a marquee
   demo for jax-js — mutual benefit, and it de-risks the single-maintainer
   dependency because we end up understanding the internals.
9. **Clone GitVibes now, extract the vibe engine later.** The ~36 byte-identical
   TV/GV files are a frozen informal contract until extraction.
10. **Coffee-break budget.** Live full-parameter training ≤ ~3 min, ≤ ~5M params.
    Flagship post-training is LoRA-only, and flagship-scale anything is gated at M0.
11. **Content authoring: bespoke Svelte components**, as in TV/GV.

## Models & tiers

| Tier | Size | Trained | Role |
|---|---|---|---|
| Hatchlings | ~0.5–2M | live, full params | per-lesson minis (grokking, Countdown, micro-demos) |
| Live pair | ~2–5M | live, full params | the Quill & Rook the learner trains at every stage |
| Flagships | ~15–25M each | offline (PyTorch/JAX ref) | the impressive pair; scrubbable history; **in-browser post-training via LoRA only** |
| Cameo | SmolLM-135M-class | pre-trained (transformers.js) | tutor + ch. 8 generator + ch. 13 comparison (one shared download) |

**LoRA notes (syllabus item + feasibility mechanism, ch. 7):** shrinks optimizer
state and trainable params — **not** forward/backward FLOPs or activation memory.
Flagship LoRA therefore runs at seq ≤ 256, small batches, with rematerialization /
chunked attention (M0 checks op support), and M0 measures a real flagship LoRA step
(ms + peak memory) before Act III depends on it. Demotion path if it fails: all
post-training happens on the live pair; flagships become inference-only showcases.
Bonus mechanism: **adapter-off = the frozen reference policy** — GRPO's
KL-to-reference and every before/after toggle need no second weight copy.

## Download & hosting budget

- **Hosting:** site code on GitHub Pages; **weights + data slices on Hugging Face
  Hub** (long-cache, standard for checkpoints) — GH Pages' bandwidth/size caps can't
  carry ~0.5–1GB of assets.
- **Cold start < 15MB** (site + live-pair inits + starter data slice). Ch. 1 opens
  with the *live pair*; the flagships are a labeled one-click download.
- **Time machine:** dense scrubbing on the live pair — ~12 log-spaced checkpoints
  per bird, int4/int8, target ≤ 40MB per bird, lazy + OPFS-cached (honest worst
  case both birds ≈ 80MB, never up front). Flagship history = a few int4 pretrain
  waypoints behind the explicit flagship download; designated **resume points ship
  fp16** (training atop int-quantized weights with fresh optimizer moments is not
  something we pretend works).
- **Flagship post-training stages ship as base + per-stage LoRA adapter files**
  (~0.5–1MB each), not full checkpoints.
- **Tutor/cameo model (~100MB-class): explicit download**, shared by the AI tutor,
  ch. 8 generation, and ch. 13 comparison; appears in the UI as such.
- **Stockfish:** single-threaded WASM build (no SharedArrayBuffer/COOP-COEP
  headaches on Pages; shallow eval is all the reward signal needs). Revisit
  coi-serviceworker only if eval depth proves insufficient (M1 decision).
- **WebGPU is the course's primary compute path — all training runs on it (via
  jax-js).** Only visitors whose browser lacks WebGPU degrade to a **playback
  tier**: recorded runs + shipped checkpoints + CPU inference of small models. We
  don't pretend WASM/CPU can train the live pair (honest only for hatchlings,
  stated on-screen).

**Parity requirement:** one architecture spec shared by the offline trainer and the
browser; safetensors → typed-array converter; logit-parity test (tolerance-based —
WebGPU float reduction order varies by GPU) built in M0, run in CI forever.
Determinism honestly scoped: seeded init/data/sampling ⇒ same run *shape*; prose
references curve shapes and ranges, never exact loss values.

## Architecture taught

Modern dense decoder core: byte-BPE / designed vocab, RoPE, RMSNorm, SwiGLU,
pre-norm, AdamW + warmup/cosine (WSD mentioned), clipping, mixed precision. Explicit
fundamentals with named homes: **softmax → probabilities, cross-entropy, perplexity
(ch. 4); train/val split, overfitting, memorization (ch. 4, before grokking);
context windows (ch. 3); evals as a topic (ch. 5); chat templates, prompt-loss
masking, EOS handling (ch. 7)**. Post-training: SFT + LoRA → RM/RLHF → DPO →
best-of-N & Goodhart → GRPO/RLVR → rejection sampling → R1-style loop. Frontier
material (MoE + routing viz, MLA, MTP, Muon race, QK-clip, µP, FP8) in ch. 13 with
explicit does-it-help-at-25M verdicts.

## Course arc (4 acts, 14 parts)

**Act I — The Machine**
- **1. Hatch.** *Lead: both.* Cold open: prompt live-Quill, play live-Rook
  (flagships one click away), scrub both back to random init — "you'll raise both."
  Then: what they eat — corpus explorer (TinyStories + Lichess slices), cleaning,
  dedup as a first-class idea.
- **2. Tokens.** *Lead: Quill.* Train byte-BPE live, watch merges; Rook's designed
  UCI vocab as the contrast (learned vs designed vocabularies); why-not-chars/FEN
  panel; the **universal token-stream inspector** debuts — including its
  **per-token loss/entropy heatmap** mode (it will teach perplexity in ch. 4,
  surprise-falling-during-pretraining in ch. 5, loss masking in ch. 7).
- **3. The Transformer.** *Lead: Rook.* Embeddings, residual stream, attention
  (text-span maps for Quill, move-arrow maps for Rook), RoPE + **context windows**,
  SwiGLU, RMSNorm — one sub-layer at a time.
- **4. Learning.** *Lead: hatchlings.* Softmax, **cross-entropy, perplexity**;
  backprop (GradientDescent lineage); AdamW, schedules, clipping; **train/val
  curves, overfitting, a memorized-story demo** (why ch. 1's dedup mattered); then
  the **grokking interlude** — shipped recorded run with scrubber (canonical runs
  need 10k+ steps; live long-run offered as optional background task).

**Act II — Raising a Mind**
- **5. Pretraining.** *Twin parity chapter.* Twin dashboards: loss + sampled
  stories (gibberish → words → grammar) beside loss + legal-move gauge.
  **Temperature/basic sampling taught here** (first sampled output on screen).
  Live coffee-break run on the live pair (numeric targets from M0); time machine on
  flagship waypoints — **induction-head bump shown on the flagship's logged offline
  curve** (a live sighting is a bonus, not a promise); mini scaling-laws lab
  (3 hatchling sizes, one plot). Closes with **"how do we know it's working?" —
  evals as a topic**: val loss vs benchmarks, Rook's clean Elo + **OOD position
  set** (memorized openings vs modeled board), Quill's judge-based scoring
  (TinyStories' own GPT-judge paradigm), benchmark saturation & contamination.
- **6. World Models.** *Lead: Rook.* Linear probes on the residual stream
  (per-token board state, mine/theirs frame); **activation patching** — flip the
  model's belief about one square, watch its move change. "Bag of heuristics"
  critique presented honestly.

**Act III — Alignment**
- **7. SFT + LoRA.** *Lead: Quill.* TinyStories-Instruct; **chat template, special
  tokens, prompt-loss masking (visualized in the inspector), EOS/stopping**. Full
  fine-tune on live pair; **LoRA taught + applied to flagships**. Rook cameo:
  elite-game SFT **vs Elo-token conditioning** — conditioning vs fine-tuning made
  visceral. Before/after story & play tests; distribution shift shown.
- **8. Synthetic Data.** *Lead: Quill.* The reveal: TinyStories itself is synthetic.
  Template + seed-diversity pipelines, self-instruct, verifier filtering,
  dedup/decontamination. Live demo scoped honestly: the tutor model generates ~10
  samples live; the learner **filters a shipped pre-generated pool** with the
  verifier stack and fine-tunes Quill on the result (tiny live-only sets don't move
  models, and we say so).
- **9. Preferences.** *Twin parity chapter.* Learner rates story pairs → reward
  model trained on **their ~100 clicks blended with a shipped preference set**
  (on-screen: "your 100 votes + 5,000 others"; cold-entry learners get the default
  set, labeled). DPO on both birds; **RLHF vs RLAIF** named via the Quill/Rook
  contrast; blind A/B taste test vs the SFT model; **a toy refusal trained via the
  same DPO machinery** (Quill declines scary stories) — the honest hook for
  harmlessness, and why preference training exists historically.
- **10. Reward Hacking.** *Lead: both (double climax).* **Best-of-N against the
  learner's own RM** (no RL needed yet — pure Goodhart): "dragon dragon dragon."
  Naive material reward makes Rook hang its king for a queen. Diagnose; **introduce
  the KL-to-reference fix here**; re-run.
- **11. RLVR & GRPO.** *Lead: Rook.* Opens with the supervised→policy-gradient
  bridge ("upweight every token of high-reward samples" — cf. ch. 4). Three arenas:
  **Rook (legality/mate/win — the safe anchor)**, Quill constraints (include-word /
  sentence-count — Tülu-3 pattern; rhyme demoted to a stretch constraint: TinyStories
  has no verse, all-zero reward groups give zero gradient), and a **Countdown
  hatchling, honestly scoped**: SFT-warm-started on synthetic solution traces, payoff
  promised as "reward rises, outputs lengthen" — *not* a guaranteed R1 aha
  (TinyZero's emerged at 1.5B+). Group advantages, KL, reward curves;
  **user-editable reward-function editor**. Closes with the full R1-style recipe
  (cold-start SFT → RL → rejection sampling → RL) and where DAPO/GSPO fix GRPO at
  scale (conceptual).

**Act IV — The Frontier**
- **12. Agents** *(stretch, M5-gated). Lead: Quill.* Tool calls as special tokens
  (ties to chs. 2, 7). Two tools: **scratchpad memory** (notes across a story longer
  than the context window — the context limit *is* the lesson) and a **story-world
  database** (query character facts — RAG-lite). Trained on ch. 8-style synthetic
  traces, then RLVR with **consistency verifiers** (story vs database
  contradictions). Demotion path: guided demo driven by the tutor model, labeled as
  such.
- **13. Frontier & Inference.** *Lead: both.* Honesty section: MoE toggle +
  expert-routing viz, MTP, Muon vs AdamW race, induce-and-fix an attention-logit
  explosion (QK-clip), µP/FP8 conceptually — with does-it-help-at-25M verdicts.
  Inference section: KV cache, top-k/top-p (temperature was ch. 5), quantization
  (int8/int4 — and what it does to Quill's prose), **speculative decoding with
  live-Quill drafting for flagship-Quill** (draft-model form — reuses assets already
  in memory; no offline MTP-head commitment). SmolLM cameo beside Quill: same
  organism, more scale.
- **14. Epilogue.** The scale map: Quill & Rook → frontier models; what is
  identical, what changes with scale, what's open research; a sober note on safety
  and what tiny models can't teach.

## Signature devices

- **Quill & Rook as persistent artifacts** — stat sheets (params, tokens seen, eval
  scores, stage badges); progress = their lifecycle.
- **Time-machine scrubber** (dense on live pair, waypoints on flagships).
- **You-are-the-annotator RLHF** with blind A/B payoff.
- **Universal token-stream inspector** with per-token loss/entropy heatmap
  (chs. 2→13, one component, spec'd in M1).
- **Twin dashboards** where the contrast is the lesson; lead-bird economy elsewhere.
- **Reward-hacking double climax**; **user-editable reward functions**.
- **Before/after story & play tests** at every stage boundary.

## Engineering skeleton

- Training loop in a **Web Worker** on jax-js; metrics posted to the UI thread; the
  shared TV/GV AI-tutor stack drives the same engine through a bridge.
- **OPFS checkpoints** (IndexedDB fallback); resume across sessions; every chapter
  enterable cold from shipped assets (incl. the default preference set for ch. 9).
- WebGPU detection → tier choice; no-WebGPU = playback mode (stated on-screen).
- **Verifier stack as one module:** chess.js rules, single-threaded Stockfish eval,
  constraint checkers (word/sentence; rhyme via ~1–2MB CMU-dict subset as stretch),
  Countdown checker, ch. 12 consistency checkers. Powers SFT filtering, DPO labels,
  GRPO rewards.
- **Licensing:** TinyStories/-Instruct CDLA-Sharing-1.0 (attribute); Lichess CC0;
  Stockfish GPLv3 (separate attributed asset; site stays MIT); jax-js license
  confirmed in M0.

## Milestones (rough durations; overruns are signals, not shame)

- **M0 — engine go/no-go (1–2 wks).**
  (a) Train ~5M byte-BPE and ~5M UCI models in-browser on real slices;
  (b) tokens/sec on M-series + one mid discrete GPU; **KV-cache sampling tok/s**;
  (c) **one flagship-scale (≥15M) LoRA step: ms/step + peak memory**;
  (d) op coverage: RoPE, gather/embedding, softmax, AdamW state, LoRA compose,
      **rematerialization/chunked attention**, **hooked forward (capture +
      intervene) for interp**, and **embedding-table backward** (a scatter-add —
      the one transformer op WebGPU's missing f32 atomics genuinely complicates;
      check how jax-js handles it, and pick the custom-path strategy:
      per-vocab-row reduction or sort-by-token);
  (e) memory behavior under refcounting in a Worker;
  (f) WebGPU-in-Worker across Chrome/Safari/Firefox (and the
      WebGPU-on-main-thread-only case);
  (g) gradient/logit-parity harness vs a reference, built the algocell way: **the
      CPU reference is finite-difference-checked first; the GPU is validated
      against it, never the other way round** (tolerance-based — algocell achieved
      3e-5 max-relative agreement; expect looser at transformer scale);
  (h) **tiled-matmul microbenchmark in hand-written WGSL** (~1 day): establishes
      the custom path's throughput ceiling on real hardware, since matmul — not
      the stencil-shaped work algocell does — is the whole game for a transformer;
  (i) licenses.
  **Numeric gate (calibrate tokens-to-grammar offline first):** live tier sustains
  ≳30k tok/s on the 5M model and reaches the words→grammar arc within ~3 min
  (≈5–10M tokens). **Contingency order:** if jax-js fails the gate, next is the
  custom WGSL path (algocell-seeded; go/no-go informed by the (h) matmul
  ceiling), then the TF.js fork — each must pass this same gate. If all fail, the
  live tier drops to hatchlings and the course leans harder on the time machine
  (design survives, wow shrinks).
- **M1 — skeleton (2–3 wks).** Clone GitVibes, strip git engine, LLM-engine seam,
  twin playground shells, token-stream inspector (with loss-heatmap mode),
  Stockfish threading decision.
  *Status 2026-07-22: conversion complete — 14-part arc live (76 anchors, stub
  prose, Hero, nav/map/SEO), git engine stripped behind same-path stubs, tutor
  persona rebranded, `LlmEngine` contract at src/lib/llm/engine.ts, jax-js in
  deps. Build ✓, svelte-check 0/0 ✓, 139/139 unit tests ✓. Remaining in M1:
  WorkerEngine implementation, token-stream inspector component, twin playground
  shells, Stockfish decision.*
- **M2 — checkpoint pipeline (3–4 wks).** Offline flagship training (Quill + Rook),
  waypoint export (int4/int8 + fp16 resume points), converter + parity CI, HF Hub
  hosting, time-machine prototype.
- **M3 — vertical slice: ch. 5 (2–3 wks).** Twin dashboards + live run + scrubber +
  evals panel. Proves the core promise; build before writing other content.
- **M4 — Act III prototypes (3–4 wks).** Verifier stack; RM-on-clicks + blend;
  **A/B-test that ch. 9's payoff is perceptible**; DPO; GRPO arenas incl.
  Countdown-with-warm-start viability.
- **M5 — agents prototype (2 wks).** Gate: does a ≤25M model learn the tool grammar
  from synthetic traces? Demote per plan if not.
- **M6+.** Content build-out in act order; art integration; vibe-engine extraction
  once llmvibes stabilizes.

## Known risks (ranked)

1. **jax-js maturity / throughput** — M0 gate, numeric, with validated fallback and
   a named worst case.
2. **Flagship LoRA step cost in-browser** (activation memory, not optimizer state,
   is the constraint) — measured at M0(c); demotion path defined.
3. **GRPO moving the needle on Quill constraints at ≤25M** — M4 prototype before
   ch. 11 prose; chess arena is the anchor; Countdown explicitly speculative.
4. **Perceptibility of the ch. 9 A/B payoff** — M4 test; click-blending is the
   mitigation.
5. **Asset weight / bandwidth** — HF Hub hosting, budget rules, explicit downloads.
6. **Agents chapter** — stretch by construction, M5-gated, demotion path defined.
7. **Offline/online drift** — parity CI from M0 onward.

## Resolved-question log

- Instruct data: TinyStories-Instruct + synthetic-data chapter (8). ✓
- Chess tokenization: UCI move tokens; Elo-conditioning tokens committed. ✓
- Quill tokenization: byte-level BPE. ✓
- Othello: cut; grokking + Countdown stay as hatchlings. ✓
- Agents: memory + world-DB tools, consistency-verified; stretch. ✓
- Title: LLMVibes. Models: **Quill & Rook**; minis are hatchlings. ✓
- Authoring: bespoke Svelte. ✓
- Arc size: 14 parts (was 17; merged per review — cold-open→ch. 1, evals→ch. 5,
  recipe→ch. 11, tricks→ch. 13). ✓
