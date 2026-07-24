#!/usr/bin/env python3
"""Probe the flagship Rook for an emergent board and emit a compact JSON the
ProbeLab renders. Loads the trained checkpoint, captures the residual stream
across held-out games, trains linear probes (mine/theirs/empty, mover-oriented
— the Nanda frame) per layer to decode each of the 64 squares, and records:
  - the depth curve (per-layer accuracy, trained + untrained control)
  - per-layer per-square accuracy heatmaps
  - a few example positions with the probe's decoded board at every layer
    (so the lab can show the board sharpening as you go deeper)

Run: spikes/m0/parity/.venv/bin/python spikes/flagship/probe_flagship.py
"""
import json, math, os, time
import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
dev = "mps" if torch.backends.mps.is_available() else "cpu"

meta = json.load(open(os.path.join(HERE, "rook-flagship-meta.json")))
L, D, Hh, S, V = meta["nLayer"], meta["nEmbd"], meta["nHead"], meta["blockSize"], meta["vocab"]
hd = D // Hh
probe_games = json.load(open(os.path.join(HERE, "rook-flagship-probe.json")))
print(f"flagship L{L} D{D} H{Hh} block{S} vocab{V}  |  {len(probe_games)} probe games")


def load_params(path):
    flat = np.fromfile(path, dtype=np.float32)
    order = [("wte", (V, D)), ("wpe", (S, D)), ("lmHead", (D, V))]
    for i in range(L):
        for n, sh in [("wq", (D, D)), ("wk", (D, D)), ("wv", (D, D)), ("wo", (D, D)),
                      ("mlpFc1", (D, 4 * D)), ("mlpFc2", (4 * D, D))]:
            order.append((f"layers.{i}.{n}", sh))
    P, off = {}, 0
    for name, sh in order:
        n = int(np.prod(sh))
        P[name] = torch.tensor(flat[off:off + n].reshape(sh), device=dev)
        off += n
    return P


def rand_params(seed):
    g = torch.Generator().manual_seed(seed)
    def rp(sh, s):
        return (torch.randn(sh, generator=g) * s).to(dev)
    P = {"wte": rp((V, D), 0.02), "wpe": rp((S, D), 0.02), "lmHead": rp((D, V), 0.02)}
    for i in range(L):
        for n, sh in [("wq", (D, D)), ("wk", (D, D)), ("wv", (D, D)), ("wo", (D, D)),
                      ("mlpFc1", (D, 4 * D)), ("mlpFc2", (4 * D, D))]:
            P[f"layers.{i}.{n}"] = rp(sh, 0.02)
    return P


causal = torch.tril(torch.ones(S, S, dtype=torch.bool, device=dev))


def rmsnorm(x):
    return x / torch.sqrt((x * x).mean(-1, keepdim=True) + 1e-5)


@torch.no_grad()
def residuals(P, tok_ids):
    seqLen = len(tok_ids)
    x = torch.zeros(S, dtype=torch.long, device=dev)
    x[:seqLen] = torch.tensor(tok_ids, device=dev)
    pos = torch.arange(S, device=dev)
    h = (P["wte"][x] + P["wpe"][pos]).unsqueeze(0)
    h = rmsnorm(h)
    out = []
    for i in range(L):
        w = lambda n: P[f"layers.{i}.{n}"]
        res = h
        hn = rmsnorm(h)
        q = (hn @ w("wq")).view(1, S, Hh, hd)
        k = (hn @ w("wk")).view(1, S, Hh, hd)
        v = (hn @ w("wv")).view(1, S, Hh, hd)
        sc = torch.einsum("blnh,bsnh->bnls", q, k) * (1.0 / math.sqrt(hd))
        sc = sc.masked_fill(~causal, float("-inf"))
        pr = torch.softmax(sc, -1)
        attn = torch.einsum("bnls,bsnh->blnh", pr, v).reshape(1, S, D)
        h = attn @ w("wo") + res
        res2 = h
        hn = rmsnorm(h)
        h = torch.relu(hn @ w("mlpFc1")) @ w("mlpFc2") + res2
        out.append(h[0, :seqLen].float().cpu().numpy())
    return out


def collect(P, games):
    acts = [[] for _ in range(L)]
    labs = []
    for game in games:
        toks, labels = game["tokens"], game["labels"]
        res = residuals(P, toks)
        n = min(len(toks), len(labels))
        for i in range(1, n):
            for li in range(L):
                acts[li].append(res[li][i])
            labs.append(labels[i])
    return [np.array(a, dtype=np.float32) for a in acts], np.array(labs, dtype=np.int64)


def train_probe(Xtr, Ytr, steps=300, lr=0.02):
    N, Din = Xtr.shape
    OUT = 64 * 3
    W = np.zeros((Din, OUT), np.float32); b = np.zeros(OUT, np.float32)
    mW = np.zeros_like(W); vW = np.zeros_like(W); mb = np.zeros_like(b); vb = np.zeros_like(b)
    onehot = np.zeros((N, 64, 3), np.float32)
    onehot[np.arange(N)[:, None], np.arange(64)[None, :], Ytr] = 1.0
    b1, b2, eps = 0.9, 0.999, 1e-8
    for t in range(1, steps + 1):
        logits = (Xtr @ W + b).reshape(N, 64, 3)
        logits -= logits.max(-1, keepdims=True)
        e = np.exp(logits); p = e / e.sum(-1, keepdims=True)
        grad = ((p - onehot) / N).reshape(N, OUT)
        gW = Xtr.T @ grad; gb = grad.sum(0)
        mW = b1 * mW + (1 - b1) * gW; vW = b2 * vW + (1 - b2) * gW * gW
        mb = b1 * mb + (1 - b1) * gb; vb = b2 * vb + (1 - b2) * gb * gb
        W -= lr * (mW / (1 - b1**t)) / (np.sqrt(vW / (1 - b2**t)) + eps)
        b -= lr * (mb / (1 - b1**t)) / (np.sqrt(vb / (1 - b2**t)) + eps)
    return W, b


def per_square_acc(W, b, X, Y):
    pred = (X @ W + b).reshape(len(X), 64, 3).argmax(-1)
    return (pred == Y).mean(0)  # [64]


def baseline_acc(Y):
    base = 0.0
    for sq in range(64):
        base += np.bincount(Y[:, sq], minlength=3).max()
    return base / (len(Y) * 64)


# ── split games (probe set) into train / test / example ──
rng = np.random.default_rng(0)
order = rng.permutation(len(probe_games))
n_ex = 6
ex_idx = order[:n_ex]
test_idx = order[n_ex:n_ex + 90]
train_idx = order[n_ex + 90:]
train_games = [probe_games[i] for i in train_idx]
test_games = [probe_games[i] for i in test_idx]
example_games = [probe_games[i] for i in ex_idx]


def fit_all(P, tag):
    print(f"\n=== {tag} ===", flush=True)
    t0 = time.time()
    Xtr, Ytr = collect(P, train_games)
    Xte, Yte = collect(P, test_games)
    base = baseline_acc(Yte)
    print(f"  {len(Ytr)} train / {len(Yte)} test  in {time.time()-t0:.0f}s  baseline {base*100:.1f}%")
    per_layer = []
    for li in range(L):
        mu, sd = Xtr[li].mean(0), Xtr[li].std(0) + 1e-6
        W, b = train_probe((Xtr[li] - mu) / sd, Ytr)
        ps = per_square_acc(W, b, (Xte[li] - mu) / sd, Yte)
        acc = float(ps.mean())
        per_layer.append({"acc": acc, "per_square": [float(v) for v in ps],
                          "W": W, "b": b, "mu": mu, "sd": sd})
        print(f"  layer {li}: {acc*100:5.1f}%  lift +{(acc-base)*100:.1f}", flush=True)
    return per_layer, base


trained, base = fit_all(load_params(os.path.join(HERE, "rook-flagship.bin")), "TRAINED FLAGSHIP")
control, _ = fit_all(rand_params(12345), "UNTRAINED CONTROL")
best = int(np.argmax([l["acc"] for l in trained]))

# ── example positions: decode boards at every layer (mover-oriented) ──
examples = []
TRAINED_P = load_params(os.path.join(HERE, "rook-flagship.bin"))
for game in example_games:
    toks, labels = game["tokens"], game["labels"]
    n = min(len(toks), len(labels))
    if n < 25:
        continue
    ply = min(n - 1, 30)  # a developed mid/late position
    res = residuals(TRAINED_P, toks)
    pred_by_layer = []
    for li in range(L):
        x = (res[li][ply] - trained[li]["mu"]) / trained[li]["sd"]
        logit = (x @ trained[li]["W"] + trained[li]["b"]).reshape(64, 3)
        pred_by_layer.append([int(v) for v in logit.argmax(-1)])
    examples.append({
        "ply": int(ply),
        "turn": "w" if ply % 2 == 0 else "b",
        "trueOriented": [int(v) for v in labels[ply]],
        "predByLayer": pred_by_layer,
    })

out = {
    "config": {"nLayer": L, "nEmbd": D, "nHead": Hh, "params": meta["params"],
               "games": 100000, "trainMinutes": 47, "valLoss": 4.23},
    "baseline": float(base),
    "bestLayer": best,
    "layers": [{"trained": trained[li]["acc"], "control": control[li]["acc"]} for li in range(L)],
    "perSquare": {
        "trained": [trained[li]["per_square"] for li in range(L)],
        "control": [control[li]["per_square"] for li in range(L)],
    },
    "examples": examples,
}
dst = os.path.join(ROOT, "static", "data", "rook-probe.json")
json.dump(out, open(dst, "w"))
print(f"\nbest layer {best}: trained {trained[best]['acc']*100:.1f}% vs control "
      f"{control[best]['acc']*100:.1f}% (baseline {base*100:.1f}%)")
print(f"wrote {dst} ({os.path.getsize(dst)//1024} KB, {len(examples)} examples)")
