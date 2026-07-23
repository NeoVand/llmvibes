#!/usr/bin/env python3
"""PyTorch reference for the LLMVibes M0 jax-js tiny GPT (spikes/m0/src/main.ts).

Replicates lossFn(..., flat=true) exactly:
  - weights stored [inDim, outDim], forward is x @ W (no transposes)
  - tokEmb = oneHot(ids,V) @ wte  (== gather, exact), posEmb = oneHot(pos,S) @ wpe
  - x = rmsnorm(tokEmb + posEmb);  rmsnorm(x) = x / sqrt(mean(x^2, -1, keepdims) + 1e-5)
    (no learnable scale)
  - per layer (pre-norm):
      xRes = x; x = rmsnorm(x)
      q,k,v = x@wq, x@wk, x@wv          # [B*S, D]
      reshape to [B, S, H, hd]
      attention (jax-js nn.dotProductAttention semantics, verified against
      node_modules/@jax-js/jax/dist/index.js):
        scores = einsum('BLNH,BSNH->BNLS', q, k) * (1/sqrt(hd))
        isCausal: scores = where(tril_ones(L,S), scores, -inf)   # diagonal kept
        probs  = softmax(scores, axis=-1)                        # max-subtracted
        out    = einsum('BNLS,BSNH->BLNH', probs, v)
      x = out.reshape(B*S, D) @ wo + xRes
      mlpRes = x; x = rmsnorm(x)
      x = relu(x @ mlpFc1) @ mlpFc2 + mlpRes                     # mlpFc1: [D, 4D]
  - logits = x @ lmHead                                          # [D, V]
  - loss = mean over all B*S positions of -logSoftmax(logits)[target]

Self-check: central finite differences vs autograd in float64 at a micro config.
Fixture: float32 forward/backward at the parity config, written to fixture.json.

Weight generation (documented order, SEED below, numpy default_rng):
  1. wte    [V, D]  = rng.standard_normal * 0.02
  2. wpe    [S, D]  = rng.standard_normal * 0.02
  3. lmHead [D, V]  = rng.standard_normal * 0.001
  4. for each layer i in 0..L-1, with s = sqrt(3 / D):
       wq, wk, wv [D, D]   = rng.uniform(-s, s)
       wo         [D, D]   = rng.uniform(-s, s)        # random (main.ts inits wo
       mlpFc1     [D, 4D]  = rng.uniform(-0.4s, 0.4s)  #  as zeros; random weights
       mlpFc2     [4D, D]  = rng.uniform(-0.4s, 0.4s)  #  make grads informative)
  5. inputIds  [B*S] = rng.integers(0, V)
  6. targetIds [B*S] = rng.integers(0, V)

Run: .venv/bin/python ref.py
"""

import json
import math

import numpy as np
import torch

SEED = 20260722

MICRO = dict(nLayer=1, nEmbd=16, nHead=2, blockSize=8, vocab=32, batch=2)
PARITY = dict(nLayer=2, nEmbd=64, nHead=4, blockSize=64, vocab=512, batch=2)


def weight_specs(cfg):
    """Ordered (name, shape, kind) list; order == RNG draw order."""
    V, D, S, L = cfg["vocab"], cfg["nEmbd"], cfg["blockSize"], cfg["nLayer"]
    s = math.sqrt(3.0 / D)
    specs = [
        ("wte", (V, D), ("normal", 0.02)),
        ("wpe", (S, D), ("normal", 0.02)),
        ("lmHead", (D, V), ("normal", 0.001)),
    ]
    for i in range(L):
        specs += [
            (f"layers.{i}.wq", (D, D), ("uniform", s)),
            (f"layers.{i}.wk", (D, D), ("uniform", s)),
            (f"layers.{i}.wv", (D, D), ("uniform", s)),
            (f"layers.{i}.wo", (D, D), ("uniform", s)),
            (f"layers.{i}.mlpFc1", (D, 4 * D), ("uniform", 0.4 * s)),
            (f"layers.{i}.mlpFc2", (4 * D, D), ("uniform", 0.4 * s)),
        ]
    return specs


def gen_data(cfg, seed):
    """Seeded weights (float64 numpy) + input/target ids. Draw order is fixed."""
    rng = np.random.default_rng(seed)
    weights = {}
    for name, shape, (kind, scale) in weight_specs(cfg):
        if kind == "normal":
            weights[name] = rng.standard_normal(shape) * scale
        else:
            weights[name] = rng.uniform(-scale, scale, shape)
    n_tok = cfg["batch"] * cfg["blockSize"]
    input_ids = rng.integers(0, cfg["vocab"], n_tok)
    target_ids = rng.integers(0, cfg["vocab"], n_tok)
    return weights, input_ids, target_ids


def to_torch(weights, dtype):
    return {
        name: torch.tensor(w, dtype=dtype, requires_grad=True)
        for name, w in weights.items()
    }


def rmsnorm(x):
    ms = (x * x).mean(dim=-1, keepdim=True)
    return x / torch.sqrt(ms + 1e-5)


def forward_logits(params, cfg, input_ids):
    """Exact port of main.ts lossFn (flat=true) up to logits. [B*S, V]."""
    B, S, D = cfg["batch"], cfg["blockSize"], cfg["nEmbd"]
    H = cfg["nHead"]
    hd = D // H
    ids = torch.as_tensor(input_ids, dtype=torch.long)
    pos = torch.arange(S, dtype=torch.long).repeat(B)  # tiled [B, S], flattened
    # oneHot @ W == row gather (exact in float: sums of exact zeros plus one row)
    x = params["wte"][ids] + params["wpe"][pos]  # [B*S, D]
    x = rmsnorm(x)
    for i in range(cfg["nLayer"]):
        wq, wk, wv, wo, fc1, fc2 = (
            params[f"layers.{i}.{n}"] for n in ("wq", "wk", "wv", "wo", "mlpFc1", "mlpFc2")
        )
        x_res = x
        x = rmsnorm(x)
        q = (x @ wq).reshape(B, S, H, hd)
        k = (x @ wk).reshape(B, S, H, hd)
        v = (x @ wv).reshape(B, S, H, hd)
        # jax-js nn.dotProductAttention({isCausal: true}); scale applied AFTER QK^T
        scores = torch.einsum("blnh,bsnh->bnls", q, k) * (1.0 / math.sqrt(hd))
        causal = torch.ones(S, S, dtype=torch.bool).tril()  # keep j <= i
        scores = scores.masked_fill(~causal, float("-inf"))
        probs = torch.softmax(scores, dim=-1)
        attn = torch.einsum("bnls,bsnh->blnh", probs, v).reshape(B * S, D)
        x = attn @ wo + x_res
        mlp_res = x
        x = rmsnorm(x)
        x = torch.relu(x @ fc1) @ fc2 + mlp_res
    return x @ params["lmHead"]  # [B*S, V]


def loss_fn(params, cfg, input_ids, target_ids):
    logits = forward_logits(params, cfg, input_ids)
    logprobs = torch.log_softmax(logits, dim=-1)
    tgt = torch.as_tensor(target_ids, dtype=torch.long)
    # mean over all B*S positions of -logprob[target]
    return -logprobs[torch.arange(len(tgt)), tgt].mean(), logits


def finite_diff_check(cfg, seed, n_per_tensor=4, eps=1e-5):
    """Central-difference check of autograd grads, float64. Returns max rel err."""
    weights, input_ids, target_ids = gen_data(cfg, seed)
    params = to_torch(weights, torch.float64)
    loss, _ = loss_fn(params, cfg, input_ids, target_ids)
    loss.backward()
    rng = np.random.default_rng(seed + 1)
    max_rel, n_checked = 0.0, 0
    for name, p in params.items():
        flat = p.detach().reshape(-1)
        g_flat = p.grad.reshape(-1)
        idxs = rng.choice(flat.numel(), size=min(n_per_tensor, flat.numel()), replace=False)
        for idx in idxs:
            orig = flat[idx].item()
            with torch.no_grad():
                flat[idx] = orig + eps
                lp, _ = loss_fn(params, cfg, input_ids, target_ids)
                flat[idx] = orig - eps
                lm, _ = loss_fn(params, cfg, input_ids, target_ids)
                flat[idx] = orig
            fd = (lp.item() - lm.item()) / (2 * eps)
            ag = g_flat[idx].item()
            rel = abs(fd - ag) / max(abs(fd), abs(ag), 1e-8)
            max_rel = max(max_rel, rel)
            n_checked += 1
    return max_rel, n_checked, loss.item()


def fmt_arr(t):
    """Tensor -> list of floats rounded to 9 significant digits (round-trips f32)."""
    a = t.detach().to(torch.float32).reshape(-1).numpy()
    return [float(f"{v:.9g}") for v in a]


def make_fixture(cfg, seed, path):
    weights, input_ids, target_ids = gen_data(cfg, seed)
    params = to_torch(weights, torch.float32)  # f64 draws cast to f32
    loss, logits = loss_fn(params, cfg, input_ids, target_ids)
    loss.backward()
    fixture = {
        "config": {
            **cfg,
            "seed": seed,
            "note": "weights drawn in weight_specs order from np.random.default_rng(seed); "
            f"numpy {np.__version__}, torch {torch.__version__}",
        },
        "weights": {n: fmt_arr(p) for n, p in params.items()},
        "inputIds": [int(i) for i in input_ids],
        "targetIds": [int(i) for i in target_ids],
        "logits": fmt_arr(logits),
        "loss": float(f"{loss.item():.9g}"),
        "grads": {n: fmt_arr(p.grad) for n, p in params.items()},
    }
    with open(path, "w") as f:
        json.dump(fixture, f)
    return loss.item(), path


def main():
    torch.manual_seed(0)  # torch RNG unused, but pin anyway

    print(f"[1/2] finite-diff check (float64) at micro config {MICRO}")
    max_rel, n_checked, loss64 = finite_diff_check(MICRO, SEED)
    status = "PASS" if max_rel < 1e-4 else "FAIL"
    print(f"      loss={loss64:.12f}  checked {n_checked} coords  "
          f"max rel err = {max_rel:.3e}  [{status}] (threshold 1e-4)")
    if max_rel >= 1e-4:
        raise SystemExit("finite-diff check FAILED; not writing fixture")

    print(f"[2/2] fixture (float32) at parity config {PARITY}, seed={SEED}")
    loss32, path = make_fixture(PARITY, SEED, "fixture.json")
    import os
    print(f"      loss={loss32:.6f}  wrote {path} "
          f"({os.path.getsize(path) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
