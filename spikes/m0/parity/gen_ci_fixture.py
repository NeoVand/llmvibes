#!/usr/bin/env python3
"""Generate the small golden fixture the CI parity test checks jax-js against.

Same math as ref.py (the finite-difference-validated PyTorch reference for our
exact architecture), at a TINY config so the fixture is a small committed JSON.
Adds `logprobs` (log_softmax of logits) so the test can compare model.ts's
forwardLogprobs output directly.

Writes: src/lib/llm/fixtures/parity-golden.json  (checked by src/lib/llm/parity.test.ts)

Run: spikes/m0/parity/.venv/bin/python spikes/m0/parity/gen_ci_fixture.py
"""
import json, math, os
import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "..", "src", "lib", "llm", "fixtures", "parity-golden.json")

SEED = 20260725
# Tiny but exercises every op: 2 layers, multi-head attention, MLP, real vocab.
CFG = dict(nLayer=2, nEmbd=24, nHead=4, blockSize=12, vocab=32, batch=2)


def weight_specs(cfg):
    V, D, S, L = cfg["vocab"], cfg["nEmbd"], cfg["blockSize"], cfg["nLayer"]
    s = math.sqrt(3.0 / D)
    specs = [("wte", (V, D), ("normal", 0.02)), ("wpe", (S, D), ("normal", 0.02)),
             ("lmHead", (D, V), ("normal", 0.001))]
    for i in range(L):
        specs += [(f"layers.{i}.wq", (D, D), ("uniform", s)),
                  (f"layers.{i}.wk", (D, D), ("uniform", s)),
                  (f"layers.{i}.wv", (D, D), ("uniform", s)),
                  (f"layers.{i}.wo", (D, D), ("uniform", s)),
                  (f"layers.{i}.mlpFc1", (D, 4 * D), ("uniform", 0.4 * s)),
                  (f"layers.{i}.mlpFc2", (4 * D, D), ("uniform", 0.4 * s))]
    return specs


def gen_data(cfg, seed):
    rng = np.random.default_rng(seed)
    weights = {}
    for name, shape, (kind, scale) in weight_specs(cfg):
        weights[name] = (rng.standard_normal(shape) * scale if kind == "normal"
                         else rng.uniform(-scale, scale, shape))
    n = cfg["batch"] * cfg["blockSize"]
    return weights, rng.integers(0, cfg["vocab"], n), rng.integers(0, cfg["vocab"], n)


def rmsnorm(x):
    return x / torch.sqrt((x * x).mean(dim=-1, keepdim=True) + 1e-5)


def forward_logits(P, cfg, input_ids):
    B, S, D, H = cfg["batch"], cfg["blockSize"], cfg["nEmbd"], cfg["nHead"]
    hd = D // H
    ids = torch.as_tensor(input_ids, dtype=torch.long)
    pos = torch.arange(S, dtype=torch.long).repeat(B)
    x = rmsnorm(P["wte"][ids] + P["wpe"][pos])
    for i in range(cfg["nLayer"]):
        wq, wk, wv, wo, fc1, fc2 = (P[f"layers.{i}.{n}"]
                                    for n in ("wq", "wk", "wv", "wo", "mlpFc1", "mlpFc2"))
        x_res = x
        x = rmsnorm(x)
        q = (x @ wq).reshape(B, S, H, hd)
        k = (x @ wk).reshape(B, S, H, hd)
        v = (x @ wv).reshape(B, S, H, hd)
        scores = torch.einsum("blnh,bsnh->bnls", q, k) * (1.0 / math.sqrt(hd))
        causal = torch.ones(S, S, dtype=torch.bool).tril()
        probs = torch.softmax(scores.masked_fill(~causal, float("-inf")), dim=-1)
        attn = torch.einsum("bnls,bsnh->blnh", probs, v).reshape(B * S, D)
        x = attn @ wo + x_res
        mlp_res = x
        x = rmsnorm(x)
        x = torch.relu(x @ fc1) @ fc2 + mlp_res
    return x @ P["lmHead"]


def loss_fn(P, cfg, input_ids, target_ids):
    logits = forward_logits(P, cfg, input_ids)
    logprobs = torch.log_softmax(logits, dim=-1)
    tgt = torch.as_tensor(target_ids, dtype=torch.long)
    return -logprobs[torch.arange(len(tgt)), tgt].mean(), logits, logprobs


def fmt(t):
    a = t.detach().to(torch.float32).reshape(-1).numpy()
    return [float(f"{v:.9g}") for v in a]


def finite_diff(cfg, seed, eps=1e-5):
    """Central-diff self-check (float64), so the committed golden is trustworthy."""
    w, xi, yi = gen_data(cfg, seed)
    P = {n: torch.tensor(v, dtype=torch.float64, requires_grad=True) for n, v in w.items()}
    loss, _, _ = loss_fn(P, cfg, xi, yi)
    loss.backward()
    rng = np.random.default_rng(seed + 1)
    mx = 0.0
    for name, p in P.items():
        flat, g = p.detach().reshape(-1), p.grad.reshape(-1)
        for idx in rng.choice(flat.numel(), size=min(4, flat.numel()), replace=False):
            o = flat[idx].item()
            with torch.no_grad():
                flat[idx] = o + eps; lp, _, _ = loss_fn(P, cfg, xi, yi)
                flat[idx] = o - eps; lm, _, _ = loss_fn(P, cfg, xi, yi)
                flat[idx] = o
            fd = (lp.item() - lm.item()) / (2 * eps)
            mx = max(mx, abs(fd - g[idx].item()) / max(abs(fd), abs(g[idx].item()), 1e-8))
    return mx


mr = finite_diff(CFG, SEED)
assert mr < 1e-4, f"finite-diff self-check FAILED ({mr:.2e}); refusing to write golden"
print(f"finite-diff self-check ok (max rel {mr:.2e})")

w, xi, yi = gen_data(CFG, SEED)
P = {n: torch.tensor(v, dtype=torch.float32, requires_grad=True) for n, v in w.items()}
loss, logits, logprobs = loss_fn(P, CFG, xi, yi)
loss.backward()
fixture = {
    "config": {**CFG, "seed": SEED,
               "note": f"golden from ref.py math (finite-diff validated); numpy {np.__version__}, torch {torch.__version__}"},
    "weights": {n: fmt(p) for n, p in P.items()},
    "inputIds": [int(i) for i in xi],
    "targetIds": [int(i) for i in yi],
    "logits": fmt(logits),
    "logprobs": fmt(logprobs),
    "loss": float(f"{loss.item():.9g}"),
    "grads": {n: fmt(p.grad) for n, p in P.items()},
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(os.path.normpath(OUT), "w") as f:
    json.dump(fixture, f)
print(f"loss={loss.item():.6f}  wrote {os.path.normpath(OUT)} ({os.path.getsize(os.path.normpath(OUT))/1e3:.0f} KB)")
