# The Vibe Engine, Chapter 3: How to Build an In-Browser "Train an LLM From Scratch" Course

## TL;DR

- **Build the course around a chess-move transformer ("ChessVibes") as the primary toy problem, with Othello-GPT as the fallback and TinyStories as the "natural-language" cameo.** Chess is the rare toy that gives you a real pretraining corpus (Lichess PGNs, or infinite procedurally-generated games), a trivially-constructed SFT set, natural preference pairs (engine eval deltas), and a bulletproof programmatic verifier (legal-move / mate / eval reward) that runs in pure JS — so every modern training stage (pretraining → SFT → DPO → RLVR) demonstrably improves a _measurable, visible_ thing. The user's own instinct is correct; it is the best idea, not merely a good one.
- **Target ~5–25M parameters as the "real" model, with a 1–2M-param default that trains in minutes.** In-browser WebGPU training is real today (TensorFlow.js WebGPU/WebGL, webgpu-torch, Burn-wgpu) but runs roughly 2–10× slower than native CUDA and has no tensor-core access, so keep the flagship model tiny and ship pre-trained checkpoints so nobody waits. 100–500M is technically possible but pedagogically unnecessary and painful in-browser.
- **Copy the modern recipe selectively and label it honestly:** RMSNorm + RoPE + SwiGLU + pre-norm decoder-only GPT is the demonstrable, worth-it core; GRPO is the right RLVR algorithm to teach; MoE, MLA, MTP, Muon, µP, and FP8 should appear as "here's what the frontier does and why," shown at toy scale where honest but flagged as effects that mostly _don't_ reproduce cleanly at 10M params. Do not cargo-cult.

## Key Findings

**1. The toy problem: chess wins on the one axis that matters most — every training stage adds measurable, visible value.** The user asked for a task where SFT, DPO, and RLVR each _demonstrably improve something measurable_. Chess is essentially the only candidate that scores maximally on all of: real pretraining corpus, easy SFT construction, natural preference data, and a trivial in-browser verifier. Adam Karvonen's Chess-GPT (character-level GPTs trained on 16 million games from the Lichess public database) demonstrates this vividly: in his write-up "Chess-GPT's Internal World Model" (adamkarvonen.github.io, Jan 3 2024), his 50M-parameter model "played at 1300 Elo with 99.8% of its moves being legal within one day of training," and "the linear probe accurately classified 99.2% of squares over 10,000 games." The companion arXiv paper (2403.15498) reports 99.8% legal-move rate for the 16-layer model and 99.6% for the 8-layer. This means you can literally _draw what the model is thinking_ on a chessboard — exactly the "see things happen when you press buttons" aesthetic of the user's prior sites. The interpretability story (linear "my/their" board representation, causal interventions by editing activations) is published, reproducible, and visually spectacular, and Karvonen's models and datasets are open on HuggingFace (adamkarvonen/chess_llms, adamkarvonen/chess_games).

**2. Othello-GPT is the strongest runner-up and the better _interpretability_ demo, but a weaker _full-pipeline_ demo.** The original Emergent World Representations work (Li et al., ICLR 2023) trained a ~25M-param GPT to predict legal Othello moves with no knowledge of rules; Neel Nanda's follow-up showed the world model is _linearly_ represented and causally editable — using a player-relative {MINE, YOURS, EMPTY} probe that "achieved a remarkable accuracy exceeding 99% from the end of layer four onwards," where "intervening on these probe directions led to causal changes in model behavior." Othello's board (8×8, discs flip on every move) is arguably more visually dramatic than chess, and synthetic-uniform data trains cleaner world models than human games. But Othello has a thinner "preference/quality" story (games are short; skill is less legible than chess Elo), so SFT and DPO feel more contrived. Use it as the fallback / a bonus chapter.

**3. TinyStories is the best _language_ option and the right way to show the pipeline generalizes beyond games.** TinyStories (Eldan & Li, Microsoft, 2023; dataset `roneneldan/TinyStories` on HuggingFace, CDLA-Sharing-1.0 license) is a synthetic corpus of short children's stories — 2,141,709 stories split into 2,119,719 train / 21,990 validation, using a vocabulary "limited to approximately 1,500 basic words" — and famously lets sub-10M-param models produce fluent, grammatical, coherent multi-paragraph English. It has a ready-made instruction variant (TinyStories-Instruct) for SFT and a GPT-4-as-judge grading paradigm. Its weakness for _this_ course is the verifier: there is no crisp programmatic reward, so RLVR is awkward (you'd need format/length heuristics or a learned reward model). Recommend it as a "Chapter 0 / victory lap" cameo so users see real English emerge, not the RLVR backbone.

**4. Countdown / 24-game arithmetic is the canonical RLVR toy and belongs in the RL chapters.** TinyZero (Jiayi Pan, Junjie Zhang, Xingyao Wang, Lifan Yuan, Hao Peng, Alane Suhr; UC Berkeley, 2025) reproduced DeepSeek R1-Zero's "aha moment": per Pan's X thread (Jan 24 2025) and the Jiayi-Pan/TinyZero repo, "We reproduced DeepSeek R1-Zero in the CountDown game, and it just works… You can experience the Ahah moment yourself for < $30" (built on veRL with a 3B base LM). The verifier is trivial (does the arithmetic expression hit the target using each number once?). Its weakness: pretraining on Countdown alone is boring and the "world model" isn't visual. Fold a Countdown mini-environment into the RLVR chapter as a _second_ verifiable task so users see RLVR on something other than chess.

**5. Grokking on modular arithmetic is the single best _visualization_ set-piece in all of ML pedagogy — include it as a dedicated interlude.** Training a tiny transformer on `a∘b mod p` (p=97 or 113) produces the famous delayed-generalization curve, and the learned embeddings arrange into literal circles/cylinders (Fourier features). This is cheap (0.8–1M params), fast, deterministic, and the payoff is a jaw-dropping animation of embeddings snapping into rings. It needs no SFT/DPO/RLVR, so it's an interlude, not the spine — but it's too good to omit. (PAIR's "Do Machine Learning Models Memorize or Generalize?" explorable is a good reference for the interaction design.)

**6. In-browser training is feasible but you must engineer around it, not fight it.** The single most important architecture decision is to keep the flagship model in the 1–25M range and ship pre-trained checkpoints. WebGPU training reality (2026): TensorFlow.js (WebGPU/WebGL backend) and webgpu-torch genuinely do forward+backward+optimizer in-browser; ONNX Runtime Web training is CPU/WASM-only; transformers.js and tinygrad-WebGPU are inference-only. WebGPU runs ~2–10× slower than native CUDA (no cooperative-matrix / tensor-core access); FP16 shipped in Chrome 120, subgroups in Chrome 134. A 10M-param char-GPT trains in ~3 min on an A100 natively; budget tens of minutes to a couple hours in-browser on an M-series Mac or mid-range discrete GPU, and provide a CPU/WASM fallback for a 1M "toy" model.

## Details

### Comparison table: candidate toy problems

Scored 1–5 (5 = best). "Verifier" = ease of a pure-JS programmatic reward for RLVR. "Every-stage value" = does SFT + DPO + RLVR each add a measurable win.

| Candidate                            | Pretrain data            | SFT easy?            | Preference data     | Verifier (RLVR)        | Visualizable        | Every-stage value | In-browser size | Overall        |
| ------------------------------------ | ------------------------ | -------------------- | ------------------- | ---------------------- | ------------------- | ----------------- | --------------- | -------------- |
| **Chess (move transformer)**         | 5 (Lichess + procedural) | 5                    | 5 (engine eval Δ)   | 5 (legality/mate/eval) | 5 (board probes)    | 5                 | 4 (~5–25M)      | **★ Top pick** |
| **Othello-GPT**                      | 5 (procedural uniform)   | 3                    | 3                   | 5 (legality/flips)     | 5 (board flips)     | 3                 | 5 (~5–25M)      | Runner-up      |
| **TinyStories**                      | 4 (2.1M stories)         | 5 (Instruct variant) | 3 (judge/heuristic) | 2 (no crisp reward)    | 3 (attention/text)  | 3                 | 5 (<10M)        | Language cameo |
| **Countdown / 24**                   | 2 (dull corpus)          | 4                    | 3                   | 5 (arithmetic check)   | 2                   | 4                 | 5 (tiny)        | RLVR chapter   |
| **Modular arithmetic (grokking)**    | 5 (procedural)           | 1                    | 1                   | 5 (mod check)          | 5 (embedding rings) | 1                 | 5 (~1M)         | Viz interlude  |
| **Sudoku / logic**                   | 3 (procedural)           | 3                    | 2                   | 5 (constraint check)   | 4 (grid)            | 3                 | 4               | Alt verifier   |
| **Tiny code / DSL (BF, arithmetic)** | 3                        | 4                    | 3                   | 5 (run & compare)      | 2                   | 4                 | 4               | Alt RLVR       |
| **Sokoban / gridworld**              | 2                        | 3                    | 3                   | 4 (solver check)       | 4 (grid anim)       | 3                 | 4               | Alt            |
| **ARC puzzles**                      | 1 (scarce)               | 2                    | 2                   | 3                      | 4                   | 2                 | 3               | Too hard       |
| **Rubik's / permutation**            | 3 (procedural)           | 3                    | 3                   | 5 (solved check)       | 3                   | 3                 | 4               | Alt            |
| **Go on 9×9**                        | 4                        | 3                    | 4                   | 4 (legality/score)     | 4                   | 4                 | 3 (bigger)      | Heavier chess  |

### Why chess is the top pick, stage by stage

- **Pretraining (next-token prediction).** Two data paths — offer both. (1) **Procedural**: generate random-legal or engine-vs-engine games _in the browser_ with a JS chess library (chess.js) — infinite data, zero download, pedagogically honest (this is how Othello-GPT's clean world models were trained). (2) **Real**: Lichess monthly PGN dumps (database.lichess.org) — a single month is tens of millions of games (the Oct 2018 file alone is ~25M games / ~53 GB uncompressed), so you ship a _tiny filtered slice_ (a few MB of PGN, or pre-tokenized `.bin`), or use Karvonen's HuggingFace datasets directly. Visible "it's working" signal: legal-move rate climbing toward ~99% as loss drops.
- **SFT.** Trivial to construct: take strong-player games (filter Lichess by Elo, or use the Lichess Elite DB at database.nikonoel.fr) and format as instruction/response — prompt = position (PGN prefix or FEN), response = the move a >2000-Elo player made. Measurable win: move-match accuracy vs. strong players rises; illegal-move rate drops.
- **Preference / DPO.** Natural and beautiful: for a given position generate two candidate continuations, score each with a small Stockfish-WASM engine — higher eval is "chosen," lower is "rejected." No human labeling. Measurable win: average centipawn loss decreases; the model prefers engine-approved moves.
- **RLVR (GRPO).** The cleanest verifier in toy-ML: sample K moves/games, reward = legal (+small) + doesn't-hang-material + checkmate (+large) / gets-mated (−large), all in JS. Exactly the DeepSeek-R1 / TinyZero pattern with a domain-specific reward. Measurable win: win-rate vs. a fixed weak opponent climbs; you can _watch_ the KL-to-reference and reward curves.

The crux: **on chess, each of the four stages moves a different, visible needle** — legality (pretrain), strong-move imitation (SFT), eval-preference (DPO), win-rate/no-blunders (RLVR). That is precisely the "benefits from every step modern LLM training benefits from" property the user wanted, and almost nothing else has it all.

### In-browser training feasibility (2026 state of the art)

**Libraries that actually train in-browser on GPU:**

- **TensorFlow.js (WebGPU/WebGL backend)** — the mature, first-class option for browser training (autograd, optimizers). The `@genai-fi/nanogpt` npm package (Finnish "Generation AI" project) is a browser-native GPT built on TF.js that trains from scratch in-browser with CPU/WebGL/WebGPU auto-selection, char & BPE tokenizers, RoPE, and built-in attention/gradient visualization — essentially a ready-made "vibe engine" core. Oleksii Trekhleb's Homemade GPT JS (trekhleb.dev/homemade-gpt-js) and zemlyansky's gpt-tfjs are similar, minGPT-style, trainable-in-browser references.
- **webgpu-torch** (praeclarum) — a PyTorch-like TS library with full autograd on WebGPU; correct but appears dormant (last publish ~3 years ago). Good to study, risky to depend on.
- **Burn-wgpu** (Rust → WASM+WebGPU) — full autodiff, compiles to browser; published demos are inference, but training is possible. A candidate if the user wants a Rust core.

**Libraries that do NOT train in-browser:** transformers.js (inference-only), tinygrad WebGPU export (inference deployment only), ONNX Runtime Web (training exists but is CPU/WASM single-thread only — no WebGPU training). Note: transformers.js is still the right tool for the _final inference demo_ (KV-cache, sampling, WebGPU acceleration).

**Performance envelope:**

- Native anchor: nanoGPT char-Shakespeare, **10.65M params**, 6L/6H/384-d, ctx 256 → **~3 min on an A100**; a CPU-only run logged ~7.4 s/iter (≈1000× slower) — GPU is mandatory for anything non-trivial.
- WebGPU is roughly **2–10× slower than native CUDA** (inference-measured; training worse), chiefly because WebGPU exposes no cooperative-matrix / tensor-core primitives.
- **Practical planning table (order-of-magnitude, not measured):**

| Model size            | M-series Mac (WebGPU) | Mid-range discrete GPU | Integrated GPU |
| --------------------- | --------------------- | ---------------------- | -------------- |
| ~1M (default toy)     | ~2–10 min             | ~1–5 min               | ~10–30 min     |
| ~10M (chess/Othello)  | ~15–45 min            | ~10–30 min             | 1–3+ hrs       |
| ~25M (Karvonen-class) | 1–2+ hrs              | 30–90 min              | impractical    |
| ~50M+                 | several hrs           | 1.5–4 hrs              | impractical    |

**Verdict:** flagship at ~1–10M params (trainable live in a coffee break), an optional ~25M "full" checkpoint for the patient, and pre-trained checkpoints for everyone else. FP16 (Chrome 120+) and subgroups (Chrome 134+) are broadly available and worth using. Respect WebGPU memory limits: default `maxStorageBufferBindingSize` is 128 MB and `maxBufferSize` is 256 MB, though desktops allow raising these toward 1–2 GB via `requiredLimits`; tile large matmuls, stream data to stay under caps, and detect limits at runtime with a graceful WASM/CPU fallback.

### Modern architecture & training recipe — what to include, and what's honest at toy scale

**Core (demonstrable and worth it at 1–25M):**

- **Tokenization.** Teach character-level first (chess: one token per square/piece char, ~32-token vocab — what Karvonen used), then a BPE chapter (train a tiny BPE in-browser, show merges) using TinyStories to contrast. For scale reference, nanochat uses a 65,536-vocab Rust BPE; yours will be far smaller.
- **Architecture.** Pre-norm decoder-only GPT with **RMSNorm, RoPE, SwiGLU** — the current Llama/Qwen/nanochat-standard trio, all cheap and demonstrable at toy scale. Show attention maps and the residual stream directly.
- **Optimizer.** AdamW baseline; add a **Muon** chapter (the nanoGPT-speedrun optimizer, and the basis of Kimi K2's MuonClip). Muon shows _measurable_ token-efficiency gains even at small scale, so this is honest to include; you can also demo MuonClip's QK-clip as a stability fix.
- **Sampling.** Temperature, top-k, top-p — trivially visualizable on the move-probability distribution (borrow Transformer Explainer's temperature slider).

**Post-training (the differentiator — no existing explainer does this end-to-end):**

- **SFT** → **rejection sampling / STaR** (generate, keep correct, retrain — natural in chess: keep games the model won) → **DPO** (the modern default; simpler than PPO, no reward model, learns from static preference pairs) → **RLVR with GRPO** (DeepSeekMath/R1's critic-free group-relative method — the right one to teach; mention DAPO's Clip-Higher/dynamic-sampling and GSPO's sequence-level ratios as "what fixes GRPO's instabilities at scale"). Show the DeepSeek-R1 loop: cold-start SFT → RL → rejection-sampling SFT → RL again.
- **Reward-hacking demo** (a highlight): give a naive reward (e.g., "maximize material") and _watch the model learn to hang its king for a free queen_ or shuffle pieces — then fix the reward. The most memorable possible lesson, and chess makes it concrete.

**Frontier tricks — show, but label as "mostly not beneficial at 10M params" (anti-cargo-cult section):**

- **MoE (MLA/DeepSeekMoE, aux-loss-free bias-based balancing).** Evidence is mixed and scale-dependent: MoE helps _memorization/knowledge_ tasks but reasoning "saturates and lags dense models at equal total params," and recent work shows MoE beating dense only within an "optimal activation-rate region." At 10M on chess, expect **no clean win** — present the router mechanism, visualize expert routing, but don't claim a benefit you can't show. (There is active 2026 work on "dense vs sparse at tiny scale" on TinyStories.)
- **MTP (multi-token prediction).** DeepSeek-V3 shows gains at scale and enables speculative decoding; at toy scale treat as "bonus objective, marginal effect — but great for the speculative-decoding inference demo."
- **µP / µTransfer.** Beautiful idea (transfer HPs across widths) but the payoff is only visible when scaling to models you _won't_ train in a browser; show the coordinate-check plot conceptually.
- **FP8 mixed precision.** DeepSeek-V3 pioneered it at scale; WebGPU doesn't expose FP8 training paths cleanly. Explain it, don't attempt it.
- **QK-norm / QK-clip, z-loss, weight decay.** Stability tricks — worth a short "why training diverges and how to stop it" chapter; you can _induce_ an attention-logit explosion (à la Kimi K2's pre-MuonClip runs, where logits exceeded 1000) at toy scale and show the fix, which is honest and fun.

### Prior art and the gap you fill

- **Transformer Explainer** (poloclub.github.io/transformer-explainer) — live GPT-2 (124M) in-browser, interactive attention/temperature/sampling. _Inference only._
- **Brendan Bycroft's LLM Visualization** (bbycroft.net/llm) — gorgeous 3D walkthrough of one inference pass. _Inference only, no training._
- **Jay Alammar's Illustrated Transformer**, **3Blue1Brown's series**, **FT/Nvidia visual explainers** — static/video, conceptual, no live model.
- **Karpathy's nanoGPT / makemore / Zero-to-Hero / nanochat** — the gold standard for _code_, but Python/CUDA, not a browser playground; the full nanochat pipeline (tokenizer → pretrain → mid-train → SFT → RL on GSM8K → serve) needs an 8×H100 node (~$100, ~4 hrs; ~560M-param depth-20 model).
- **PAIR "Grokking" explorable**, **Othello-GPT / Chess-GPT interpretability** — great narrow visualizations.
- **TinyZero** — minimal RLVR reproduction, but a research repo, not a course.

**The gap (your entire value proposition):** _No one has an end-to-end, in-browser, actually-trains-a-real-model course that covers post-training (SFT, DPO, RLVR) — not just pretraining or inference._ Every explainer stops at "watch a trained model do a forward pass." You will be the first to let someone press a button and watch a model go from random → legal chess → strong chess → RL-polished chess, seeing tokenization, attention, loss curves, preference pairs, KL divergence, reward curves, and reward hacking along the way.

### Proposed chapter structure (mapped to playgrounds)

0. **Cold open — "watch a mind appear."** Load a pre-trained ChessVibes checkpoint; user plays it; then scrub a slider back through training checkpoints and watch it get dumber until random. Hooks the "see it happen" instinct immediately.
1. **Data & tokenization.** Playground: generate chess games; watch PGN → tokens; build a char vocab; train a tiny BPE and watch merges. Viz: token stream, vocab table.
2. **The transformer, one block at a time.** Live heatmaps for embeddings → RoPE → attention → SwiGLU → RMSNorm. Transformer-Explainer-style attention maps, but on chess moves.
3. **Pretraining.** Big red "Train" button; live loss curve, legal-move-rate gauge, and the **board-probe heatmap** (where the model "thinks" pieces are) updating every N steps. Deterministic seed. Checkpoint to IndexedDB/OPFS.
4. **Interpretability interlude.** Linear probe for board state; causal intervention (delete a piece from the model's mind, watch its move change). Optional grokking mini-demo on modular arithmetic with embedding-ring animation.
5. **SFT.** Feed strong-player games; watch move-match accuracy rise and illegal rate fall; side-by-side base-vs-SFT move suggestions.
6. **Preference optimization (DPO).** For each position show two candidate moves + engine eval; user can _be the labeler_ or let the engine label; watch the DPO loss and the win/eval curve. Visualize chosen/rejected logprob margins.
7. **RLVR (GRPO).** Sample K games; show each reward, the group-relative advantage, and KL-to-reference. Live win-rate vs. a weak bot. Countdown mini-env as a second verifiable task.
8. **Reward hacking (the showstopper).** Naive reward → model exploits it hilariously → diagnose → fix.
9. **Frontier tricks, honestly.** Toggle MoE (visualize routing), MTP, a Muon-vs-AdamW race, induce & fix an instability. Clear "does this help at our scale?" verdicts.
10. **Deployment & inference.** KV-cache, speculative decoding (using the MTP head), quantization; ship the final model as a playable bot. Optionally hand off to transformers.js for fast WebGPU inference.

### Engineering the "vibe engine"

- **Training in a Web Worker**, never the main thread — post loss/metric updates to the UI thread for smooth 60fps viz. Non-negotiable for the "scroll while it trains" feel.
- **Checkpoint to OPFS** (Origin Private File System — faster/larger than IndexedDB for big blobs) with IndexedDB fallback; stream weights so a user can close the tab and resume. Checkpoint at every chapter boundary.
- **Ship pre-trained checkpoints** as static assets (safetensors or raw Float32/16 buffers) so users can skip to any chapter — this is what makes a _course_ rather than a _training script_.
- **Deterministic seeding** end-to-end (seeded RNG for data order, init, sampling) so everyone sees the same loss curve and the narrative lines up.
- **Progressive fallback:** WebGPU (flagship ~10M) → WebGL (TF.js) → WASM/CPU (1M toy). Detect `maxStorageBufferBindingSize`/`maxBufferSize` at runtime and pick the model tier accordingly.
- **Static-hostable on GitHub Pages:** everything is client-side; datasets are procedurally generated (chess.js / Othello engine in JS) or shipped as small static files. Keep total download in the low tens of MB. Reuse the Svelte + playground architecture from terminalvibes/gitvibes.
- **Stack recommendation:** Svelte (matches prior sites) + a TF.js-WebGPU training core (or fork `@genai-fi/nanogpt`, which already implements the hard parts) + chess.js for rules/verification + a small Stockfish-WASM for the DPO/RLVR reward signal + transformers.js for the final inference demo.

## Recommendations

1. **Commit to chess as the spine now.** It is the only toy where all four stages produce a distinct, visible improvement, and the board-state-probe payoff is unmatched. Prototype Chapter 3 (pretraining + board probe) first — if the probe heatmap "lights up" as loss drops, you've validated the course's core promise. **Threshold to change course:** if a ~5–10M char-GPT can't exceed ~95% legal-move rate in-browser within ~30 min on your dev machine, drop to Othello (simpler rules, cleaner world model, smaller board) as the spine.
2. **Fork `@genai-fi/nanogpt` as the vibe-engine training core** rather than writing autograd from scratch. It already does in-browser training with backend fallback, RoPE, and attention viz. Wrap it in your Svelte playground shell. Fall back to webgpu-torch only if you need lower-level control.
3. **Ship three model tiers + checkpoints:** 1M (CPU/WASM, trains live everywhere), ~10M (WebGPU flagship), ~25M (optional, matches Karvonen so you can reuse his probes/analysis). Pre-train all three offline and host the checkpoints.
4. **Build the verifier stack early:** chess.js for legality/mate + a small Stockfish-WASM for eval-based preference/RLVR rewards. This one component powers SFT filtering, DPO labels, and GRPO rewards — get it solid.
5. **Sequence the post-training chapters SFT → rejection-sampling → DPO → GRPO**, and make the **reward-hacking chapter** the emotional climax — the most memorable and trivially demonstrable in chess.
6. **Treat MoE/MTP/µP/FP8 as an honesty chapter, not features.** Show the mechanism and routing viz; state plainly where the benefit does/doesn't appear at 10M params, citing the tiny-scale MoE literature. This differentiates you from hype content and builds trust.
7. **Include the grokking modular-arithmetic interlude** for the embedding-ring animation — highest visual-payoff-per-line-of-code in the whole course.

## Caveats

- **No one publishes clean in-browser _training_ throughput numbers.** The performance table is extrapolated from native nanoGPT benchmarks and measured WebGPU-vs-CUDA _inference_ ratios; validate on your own hardware before promising wall-clock times. This is the biggest execution risk.
- **WebGPU browser coverage is good but not universal** (Chrome/Edge solid; Firefox and Safari caught up over 2025). The WASM/CPU fallback path is mandatory, and the 1M toy model must be genuinely usable on it.
- **MoE at toy scale is genuinely uncertain** — the literature conflicts (some show MoE beating dense only in a narrow optimal-activation regime; others show reasoning tasks lagging). Don't promise a win; frame it as an experiment the user runs.
- **Chess-GPT's board representation is "reconstructable," not proven to "exist" as an object.** As Nico Westerdale puts it ("Why LLMs Can't Play Chess"): "reconstructability is not the same as existence… There is no Board object… Karvonen's model still fails on edge cases like pinned pieces, with an illegal move rate of 0.2% to 0.4%." Present the world-model story with this nuance, not as settled fact.
- **Frontier-recipe details move fast.** GRPO→DAPO→GSPO and the optimizer landscape (Muon/MuonClip and newer variants) are evolving through 2025–2026; teach the durable concepts (critic-free group-relative RL, verifiable rewards, orthogonalized updates) rather than betting the curriculum on one algorithm name.
- **Licensing:** Lichess standard dumps are open; TinyStories is CDLA-Sharing-1.0; check and attribute per-dataset before redistributing any shipped slice.
