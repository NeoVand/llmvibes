# M0 spike — first-pass results (2026-07-22)

Machine: **Apple M4 (base, 10-core GPU)**, macOS, in-app Chromium pane
(Electron 42 / Chrome 148). WebGPU adapter: `apple metal-3`, **f16 ✓,
subgroups ✓**, maxBuffer/maxBinding ≈ 4.29 GB. jax-js 0.1.18 + optax 0.1.2.
Harness: `spikes/m0` (vite; auto-runs on load, JSON results in console as
`M0RESULT` lines).

## Matmul throughput (jax-js, chained square matmuls)

| n    | f32 GFLOP/s | f16 GFLOP/s |
| ---- | ----------- | ----------- |
| 512  | 291         | —           |
| 1024 | **1122**    | 834         |
| 2048 | 1095        | 726–989     |
| 4096 | 426         | —           |

Peak ≈ **1.1 TFLOP/s** — consistent with ~1/6 of the M4 Max numbers jax-js
advertises (10 vs 40 GPU cores), so the codegen claim is credible. f16 gives no
speed win (no native f16 accumulate path) but halves memory.

## Op coverage

| op                                        | status                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `np.take` (gather) backward               | **✗ missing** — `Gather transpose rule is not yet implemented, requires complex Scatter sum operation` |
| take-along-inner-axis backward            | ✗ same rule                                                                                            |
| range-slice grad (`x.slice([], [lo,hi])`) | ✓ (`[]` = keep axis; `null` = newaxis)                                                                 |
| concat grad, trig grad                    | ✓                                                                                                      |
| f16 dtype                                 | ✓                                                                                                      |
| `jit(valueAndGrad(f))` composition        | ✓                                                                                                      |

⇒ RoPE is implementable (slice/concat/trig all differentiate). Embeddings must
use oneHot-matmul until gather backward exists (quectoGPT does the same).

## The eager dot-backward pathology (root-caused)

`grad` of `sum(X@W)` in **eager** mode materializes the full `[M,K,N]` product
before reducing:

| M×K×N         | elems | eager dW time                         | effective GFLOP/s |
| ------------- | ----- | ------------------------------------- | ----------------- |
| 2048×256×512  | 268M  | 76 ms                                 | 7                 |
| 2048×256×1024 | 537M  | 182 ms                                | 6                 |
| 2048×256×4096 | 2³¹   | **8 GiB CreateBuffer → device error** | —                 |

Under **jit**, fusion avoids the materialization: the same shapes train fine.
Consequences: (1) all training must run jitted — eager loops (quectoGPT-style)
are not viable at real vocab sizes; (2) this is upstream-issue material, with a
crisp repro.

## Training step (~5M GPT, jit, 2-D shape discipline, B=8, S=256)

| config                     | params | ms/step (synced) | tok/s     | loss trajectory |
| -------------------------- | ------ | ---------------- | --------- | --------------- |
| L2 d64 V512 (tiny)         | 168k   | 59               | ~8.7k†    | 6.24→6.11 ✓     |
| L6 d256 V1024              | 5.3M   | **462**          | **~4.4k** | 6.93→6.32 ✓     |
| L6 d256 V4096 (course cfg) | 6.9M   | **502**          | **~4.1k** | 8.32→7.96 ✓     |

† tiny number is dispatch-bound, not representative.
Loss curves are sane (start ≈ ln V exactly; fall monotonically) — the training
math is correct end-to-end, including optax Adam.

Anomaly worth an upstream question: the **pipelined** loop (no per-step sync) is
consistently ~2× _slower_ per step than syncing every step (e.g. 1040 vs 462
ms) — allocator/queue-depth behavior, not measurement noise.

Efficiency: 6·N·tokens ⇒ ~65 GFLOP/step ÷ 0.46 s ≈ **140 GFLOP/s ≈ 13% of this
GPU's own matmul peak**. The shortfall is unfused non-matmul work, not hardware.

## Gate assessment (preliminary)

- Gate target: ~30k tok/s on the 5M live model (words→grammar in ~3 min).
- Today: **~4.4k tok/s on base M4** (≈15% of gate). Scaled to an M4-Max-class
  GPU: ~15–18k (≈60% of gate). Efficiency work (fused attention, fewer
  elementwise kernels, gather instead of oneHot) has ~7× of headroom to find.
- **Not a fail — an "optimize or adjust" verdict.** Paths, non-exclusive:
  (a) upstream kernel/fusion contributions (aligns with our contribution plan);
  (b) drop live-tier to ~2M params (~2.5× faster) and/or stretch the coffee
  break definition; (c) hand-WGSL custom path if (a) stalls.
- The **course config trains correctly in-browser today**, which already
  validates the plan's core mechanism.

## Session 2 additions (same day)

### Flagship (29M: L8 d512 V4096, B=8, S=256), jit, 2-D shapes

| mode                                      | ms/step      | tok/s     | notes                                                                       |
| ----------------------------------------- | ------------ | --------- | --------------------------------------------------------------------------- |
| full-param                                | 758 (synced) | ~2.7k     | loss 8.32→7.92, zero device errors — **no OOM, no remat needed** at B8/S256 |
| LoRA r=8 (frozen base, adapters on wq/wv) | **525**      | **~3.9k** | adapter grads verified nonzero; loss moves                                  |

Scaling is sublinear (4.3× params over the 5M config costs only ~1.5× time) —
the GPU has idle capacity at these sizes; bigger batches would raise MFU.

### Web Worker (M0e) — pass, with a bonus

Training inside a module Worker: **343 ms/step (~6.0k tok/s) — faster than the
main thread's 502 ms** — while the main thread stayed responsive (70 of 74
expected 50 ms ticks). Training-in-Worker is confirmed as the course
architecture, and it's the _fast_ path, not a compromise.

### Parity harness (M0g) — built and passing

`spikes/m0/parity/`: PyTorch reference (float64 finite-diff-checked, max rel
err 1.8e-5) + `fixture.json` (L2 d64 h4 S64 V512 B2, seeded) + `compare.mjs`
(jax-js in Node). **All 15 gradient tensors match torch on wasm and cpu
backends; worst max-rel 3.7e-4; logits max-abs 1.5e-8.** Follow-up: wire
fixture.json into the spike page to run the same comparison on the webgpu
backend in-browser.

### The zero-gradient scare (postmortem — worth remembering)

A LoRA probe showed exactly-zero adapter gradients, and per-leaf inspection
showed wq/wk/wv/mlpFc1 all at zero grad — looking like a major WebGPU autodiff
bug. It wasn't. Three compounding self-inflicted causes:

1. **GPT-convention zero-init of output projections (wo/mlpFc2)** makes those
   grads _mathematically_ zero at step 0 (dPre = dOut @ 0ᵀ).
2. A **frozen** zero-init base blocks the attention block _forever_ — so LoRA
   adapters on q/v can never receive gradient (bench artifact; real LoRA runs
   on pretrained bases).
3. The attention micro-test used **constant v**, for which the softmax backward
   is analytically exactly zero — a degenerate test "confirming" the bug.

After fixing all three: attention backward correct (eager = jit), all leaves
receive gradient, LoRA learns. **jax-js WebGPU autodiff passed every
correctness probe we have.** Keep the probe suite (`?run=chain`) — it's a
regression net and, frankly, course material ("why is my model not learning?").

## M0 checklist status

- (a,b) train benchmarks ✓ (V1024/V4096 ≈ byte-BPE and UCI vocab classes)
- (c) flagship LoRA ✓ — 525 ms/step, no OOM; full-param 29M also fits
- (d) op coverage ✓ with one gap (gather backward → oneHot workaround; RoPE ok)
- (e) Worker ✓ (faster than main thread)
- (f) cross-browser — OPEN (Electron pane ≈ Chromium done; Safari/Firefox TBD;
  note upstream issue #123: Firefox WebGPU is slow per-op)
- (g) parity ✓ on wasm/cpu; webgpu-vs-fixture in-browser wiring TBD
- (h) matmul microbenchmark ✓ (~1.1 TFLOP/s f32 peak on base M4)
- (i) licenses ✓ (jax-js MIT)
- KV-cache sampling throughput — OPEN
- Upstream: #79 comment (gather), #150 (eager dot-backward), #151 (pipelining)

## Gate verdict (proposed)

**Conditional pass — proceed to M1 while perf work continues in parallel.**
Everything is _correct_; only throughput misses the aspirational gate (~4.4k
vs 30k tok/s on a base M4; ~4× better expected on M-Max-class GPUs). Concrete
adjustments: live-tier model ~2M params for the "press train" moments (≈2.5×
faster), lean on the time-machine for scale, treat 5M+ live runs as opt-in
extended runs. Revisit the gate when upstream fusion/kernel work (ours or
Eric's) lands. The course's core mechanism — real training, in-browser, on
WebGPU, in a Worker, with correct gradients — is validated.
