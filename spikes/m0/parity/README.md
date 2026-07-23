# M0 parity harness

PyTorch reference (algocell discipline: CPU reference finite-diff-checked first) for the
tiny GPT in `../src/main.ts` (`lossFn`, flat=true variant), plus a jax-js comparison.
To regenerate the fixture: `.venv/bin/python ref.py` — it first runs a float64
central-finite-difference gradient check at a micro config (L1 d16 h2 S8 V32 B2; must be
< 1e-4, observed ~2e-5), then writes `fixture.json` (weights, ids, logits, loss, grads;
float32) at the parity config (L2 d64 h4 S64 V512 B2), seeded numpy RNG (seed and draw
order documented in `ref.py`'s docstring). To compare: `node compare.mjs` from inside
this directory (resolves `@jax-js/jax` from `../node_modules`; Node 24 works, wasm
backend by default, `JAX_BACKEND=cpu` to override) — it rebuilds the params tree from
the fixture, runs the same lossFn via `valueAndGrad`, prints max-abs/max-rel per tensor,
and exits nonzero if any max-rel > 1e-3 (observed: everything ≤ ~4e-4).
If the venv is missing: `uv venv .venv && uv pip install torch numpy --index-url
https://download.pytorch.org/whl/cpu`.
