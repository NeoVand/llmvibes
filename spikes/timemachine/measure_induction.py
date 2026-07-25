#!/usr/bin/env python3
"""Measure the induction bump on a Quill training run (Part 5.4's promise).

Induction heads implement in-context copying: "find the last time the current
token appeared, predict what followed it." The clean, unambiguous test (Olsson
et al. 2022): feed a sequence of DISTINCT random tokens repeated twice; the only
way to predict the second copy is to copy from the first. We track, per training
step, an INDUCTION SCORE = mean next-token loss on the first copy minus the mean
on the second copy. Before induction heads form it's ~0 (the repeat is no easier
than the original); when they form it jumps positive and stays there — the bump.

Trains the live-pair Quill (4L/128d, our exact arch) on static/data/quill-tokens.bin,
evaluates the induction score + real val loss at densely-spaced steps, and records
a few per-position loss curves for the concrete "watch it start copying" view.
Emits static/data/induction-run.json for a clean Part 5.4 plot (no weights shipped
— this is a measurement, like the board probe).

Run: spikes/m0/parity/.venv/bin/python spikes/timemachine/measure_induction.py
"""
import argparse, json, math, os
import numpy as np
import torch
import torch.nn.functional as F

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(REPO, "static", "data")

ap = argparse.ArgumentParser()
ap.add_argument("--layers", type=int, default=4)
ap.add_argument("--dim", type=int, default=128)
ap.add_argument("--heads", type=int, default=4)
ap.add_argument("--block", type=int, default=128)
ap.add_argument("--lr", type=float, default=1.2e-3)
ap.add_argument("--warmup", type=int, default=100)
ap.add_argument("--steps", type=int, default=4000)
ap.add_argument("--batch", type=int, default=64)
ap.add_argument("--dropout", type=float, default=0.1)
ap.add_argument("--wd", type=float, default=0.05)
ap.add_argument("--seed", type=int, default=7)
ap.add_argument("--data", default="static/data/quill-tokens.bin", help="tokens.bin (relative to repo)")
ap.add_argument("--model-name", default="live-pair Quill (~0.93M)")
ap.add_argument("--save-ckpt", default="", help="if set, write flat float32 weights here (flattenParams order)")
args = ap.parse_args()

dev = "mps" if torch.backends.mps.is_available() else "cpu"
torch.manual_seed(args.seed)
D, L, H, S = args.dim, args.layers, args.heads, args.block
hd = D // H

vocab = json.load(open(os.path.join(DATA, "quill-vocab.json")))
V = vocab["vocabSize"]  # flagship reuses the live Quill's byte-BPE vocab (512)
toks = np.fromfile(os.path.join(REPO, args.data), dtype=np.uint16).astype(np.int64)
val_start = int(len(toks) * 0.95)
train_toks = torch.from_numpy(toks[:val_start])
val_toks = torch.from_numpy(toks[val_start:])
print(f"[induction] tokens {len(toks):,}  vocab {V}  cfg L{L} D{D} H{H} block{S}  device {dev}")


def batch(src, B, T=S):
    hi = len(src) - T - 1
    ix = torch.randint(0, hi, (B,))
    x = torch.stack([src[i : i + T] for i in ix]).to(dev)
    y = torch.stack([src[i + 1 : i + 1 + T] for i in ix]).to(dev)
    return x, y


P = {}
for k, sh in [("wte", (V, D)), ("wpe", (S, D)), ("lmHead", (D, V))]:
    P[k] = torch.nn.Parameter((torch.randn(sh) * 0.02).to(dev))
for i in range(L):
    for n, sh in [("wq", (D, D)), ("wk", (D, D)), ("wv", (D, D)), ("wo", (D, D)),
                  ("mlpFc1", (D, 4 * D)), ("mlpFc2", (4 * D, D))]:
        P[f"layers.{i}.{n}"] = torch.nn.Parameter((torch.randn(sh) * 0.02).to(dev))
params = list(P.values())


def rmsnorm(x):
    return x / torch.sqrt((x * x).mean(-1, keepdim=True) + 1e-5)


def forward(x, train=True, pm_band=None):
    """Standard forward. If pm_band=(qi, ki) is given, ALSO returns, per layer and
    head, the mean attention weight from query positions qi to key positions ki —
    the induction prefix-match score — extracting the band per layer so the full
    [B,H,T,T] attention for all layers is never held at once (MPS memory)."""
    B, T = x.shape
    causal = torch.tril(torch.ones(T, T, dtype=torch.bool, device=x.device))
    h = rmsnorm(P["wte"][x] + P["wpe"][torch.arange(T, device=x.device)][None])
    if train and args.dropout > 0:
        h = F.dropout(h, args.dropout)
    pm = []  # per-layer [H] mean prefix-match weight
    for i in range(L):
        w = lambda n: P[f"layers.{i}.{n}"]
        res = h
        hn = rmsnorm(h)
        q = (hn @ w("wq")).view(B, T, H, hd)
        k = (hn @ w("wk")).view(B, T, H, hd)
        v = (hn @ w("wv")).view(B, T, H, hd)
        sc = torch.einsum("blnh,bsnh->bnls", q, k) * (1.0 / math.sqrt(hd))
        sc = sc.masked_fill(~causal, float("-inf"))
        probs = torch.softmax(sc, -1)  # [B, H, query, key]
        if pm_band is not None:
            qi, ki = pm_band
            pm.append(probs[:, :, qi, ki].mean(dim=(0, 2)))  # [H]
        attn = torch.einsum("bnls,bsnh->blnh", probs, v).reshape(B, T, D)
        o = attn @ w("wo")
        if train and args.dropout > 0:
            o = F.dropout(o, args.dropout)
        h = o + res
        res2 = h
        hn = rmsnorm(h)
        m = torch.relu(hn @ w("mlpFc1")) @ w("mlpFc2")
        if train and args.dropout > 0:
            m = F.dropout(m, args.dropout)
        h = m + res2
    logits = h @ P["lmHead"]
    return (logits, pm) if pm_band is not None else logits


opt = torch.optim.AdamW(params, lr=args.lr, weight_decay=args.wd, betas=(0.9, 0.95))


def lr_at(step):
    if step < args.warmup:
        return args.lr * step / args.warmup
    p = (step - args.warmup) / max(1, args.steps - args.warmup)
    return args.lr * (0.05 + 0.95 * 0.5 * (1 + math.cos(math.pi * min(1.0, p))))


@torch.no_grad()
def val_loss(nb=20):
    tot = 0.0
    for _ in range(nb):
        x, y = batch(val_toks, args.batch)
        tot += F.cross_entropy(forward(x, False).reshape(-1, V), y.reshape(-1)).item()
    return tot / nb


# ── induction probe: distinct-random tokens repeated twice ──────────────────────
# Primary signal is the attention PREFIX-MATCHING score (Olsson et al.): does some
# head attend from the current token to the position right after that token's
# previous occurrence? On a [prefix][prefix] sequence of distinct random tokens,
# an induction head at second-copy query i attends to key i-(PREFIX-1). Max over
# heads = the induction-head score; it shows a sharp phase transition. The loss
# delta (first-copy loss minus second-copy loss) is kept as a downstream check.
PREFIX = 60  # distinct random tokens; repeated -> length 120 (< block 128)
IND_SEED = 12345


@torch.no_grad()
def induction(n_seq=128, want_curve=False):
    rng = np.random.default_rng(IND_SEED)
    seqs = np.stack([np.tile(rng.choice(V, PREFIX, replace=False), 2) for _ in range(n_seq)])
    x = torch.tensor(seqs[:, :-1], dtype=torch.long, device=dev)  # [n, 2P-1]
    y = torch.tensor(seqs[:, 1:], dtype=torch.long, device=dev)
    qi = torch.arange(PREFIX, 2 * PREFIX - 1, device=dev)  # second-copy query positions
    ki = qi - (PREFIX - 1)  # induction key = right after the previous occurrence
    logits, pm = forward(x, False, pm_band=(qi, ki))

    lpp = F.cross_entropy(logits.reshape(-1, V), y.reshape(-1), reduction="none").reshape(n_seq, -1)
    per_pos = lpp.mean(0)  # [2P-1]
    first = per_pos[5 : PREFIX - 1].mean().item()
    second = per_pos[PREFIX + 5 : 2 * PREFIX - 1].mean().item()

    best, best_l, best_h = 0.0, -1, -1
    for l in range(L):
        for hh in range(H):
            if pm[l][hh].item() > best:
                best, best_l, best_h = pm[l][hh].item(), l, hh
    curve = [round(float(v), 4) for v in per_pos.cpu().numpy()] if want_curve else None
    return {"pm": best, "layer": best_l, "head": best_h,
            "lossDelta": first - second, "first": first, "second": second, "curve": curve}


# ── dense schedule: fine early (bump is early), coarser later ───────────────────
def schedule(total):
    pts = set([0])
    s = 0
    while s < total:
        s += 10 if s < 500 else 25 if s < 1500 else 100
        pts.add(min(s, total))
    return sorted(pts)


WP = schedule(args.steps)
CURVE_AT = set()  # fill after we see the bump; also grab a few fixed ones
points, curves = [], {}
ema = None
import time
t0 = time.time()


def measure(step, train_loss):
    want = step in (0, 200, 600, args.steps) or (150 <= step <= 500 and step % 50 == 0)
    r = induction(want_curve=want)
    vl = val_loss()
    points.append({"step": step, "trainLoss": round(float(train_loss), 4), "valLoss": round(vl, 4),
                   "pm": round(r["pm"], 4), "layer": r["layer"], "head": r["head"],
                   "lossDelta": round(r["lossDelta"], 4)})
    if r["curve"] is not None:
        curves[str(step)] = r["curve"]
    print(f"  step {step:>5}  train {train_loss:5.2f}  val {vl:4.2f}  prefix-match {r['pm']:.3f} "
          f"(L{r['layer']}H{r['head']})  Δloss {r['lossDelta']:+.3f}  {(time.time()-t0)/60:.1f}m", flush=True)


measure(0, val_loss())
for step in range(1, args.steps + 1):
    for g in opt.param_groups:
        g["lr"] = lr_at(step)
    x, y = batch(train_toks, args.batch)
    loss = F.cross_entropy(forward(x, True).reshape(-1, V), y.reshape(-1))
    opt.zero_grad(set_to_none=True)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(params, 1.0)
    opt.step()
    ema = loss.item() if ema is None else 0.9 * ema + 0.1 * loss.item()
    if step in WP:
        measure(step, ema)

# optional: save the trained flagship weights (flattenParams leaf order) for HF hosting
if args.save_ckpt:
    order = ["wte", "wpe", "lmHead"]
    for i in range(L):
        order += [f"layers.{i}.{n}" for n in ("wq", "wk", "wv", "wo", "mlpFc1", "mlpFc2")]
    flat = np.concatenate([P[n].detach().float().cpu().numpy().reshape(-1) for n in order])
    ckpt_path = os.path.join(REPO, args.save_ckpt)
    flat.astype(np.float32).tofile(ckpt_path)
    nparam = int(flat.size)
    json.dump({"nLayer": L, "nEmbd": D, "nHead": H, "blockSize": S, "vocab": V, "params": nparam},
              open(ckpt_path.replace(".bin", "-meta.json"), "w"))
    print(f"  saved {nparam/1e6:.2f}M-param checkpoint -> {args.save_ckpt}")

# bump detection: first step where the prefix-match score crosses half its final value
final = float(np.mean([p["pm"] for p in points[-3:]]))
bump = next((p["step"] for p in points if p["pm"] >= 0.5 * final and p["step"] > 0), None)
out = {
    "config": {"nLayer": L, "nEmbd": D, "nHead": H, "blockSize": S, "vocab": V, "model": args.model_name},
    "prefixLen": PREFIX,
    "steps": args.steps,
    "points": points,
    "curves": curves,
    "finalPrefixMatch": round(final, 4),
    "bumpStep": bump,
}
json.dump(out, open(os.path.join(DATA, "induction-run.json"), "w"))
print(f"[induction] DONE {(time.time()-t0)/60:.1f}m  final prefix-match {final:.3f}  bump ~step {bump}  "
      f"-> static/data/induction-run.json")
