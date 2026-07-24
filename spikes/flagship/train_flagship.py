#!/usr/bin/env python3
"""Train the flagship Rook offline (torch/MPS) using LLMVibes' EXACT architecture
(parity-validated against jax-js in spikes/m0/parity/ref.py): parameter-free
RMSNorm, ReLU MLP, learned absolute positions, oneHot-equivalent embeddings,
weights stored [in, out] with forward x @ W. Weight/leaf order matches
model.ts flattenParams, so the exported checkpoint loads straight into the
browser engine via loadParams.

Dropout + weight decay are TRAINING-ONLY regularizers (the browser engine has
neither) — they help a modest model generalize on limited data so a board can
actually emerge in the residual stream rather than being memorized.

Run:  ./.venv/bin/python ../flagship/train_flagship.py   (from spikes/m0/parity)
  or: spikes/m0/parity/.venv/bin/python spikes/flagship/train_flagship.py
"""
import json, math, os, struct, time, argparse
import numpy as np
import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))

ap = argparse.ArgumentParser()
ap.add_argument("--layers", type=int, default=6)
ap.add_argument("--dim", type=int, default=256)
ap.add_argument("--heads", type=int, default=8)
ap.add_argument("--block", type=int, default=128)
ap.add_argument("--dropout", type=float, default=0.2)
ap.add_argument("--wd", type=float, default=0.1)
ap.add_argument("--lr", type=float, default=6e-4)
ap.add_argument("--warmup", type=int, default=400)
ap.add_argument("--steps", type=int, default=20000)
ap.add_argument("--batch", type=int, default=64)
ap.add_argument("--seed", type=int, default=1)
args = ap.parse_args()

dev = "mps" if torch.backends.mps.is_available() else "cpu"
torch.manual_seed(args.seed)
print(f"device={dev}  cfg L{args.layers} D{args.dim} H{args.heads} block{args.block} "
      f"dropout{args.dropout} wd{args.wd} steps{args.steps}")

# ── data ──────────────────────────────────────────────────────────────────────
toks = np.fromfile(os.path.join(HERE, "rook-flagship-tokens.bin"), dtype=np.uint16).astype(np.int64)
vocab = json.load(open(os.path.join(HERE, "rook-flagship-vocab.json")))
V = vocab["vocabSize"]
S = args.block
# held-out tail for validation CE (games near the end the model never trains on)
val_start = int(len(toks) * 0.97)
train_toks = torch.from_numpy(toks[:val_start])
val_toks = torch.from_numpy(toks[val_start:])
print(f"tokens {len(toks):,}  vocab {V}  (train {val_start:,} / val {len(toks)-val_start:,})")

def batch(src, B):
    hi = len(src) - S - 1
    ix = torch.randint(0, hi, (B,))
    x = torch.stack([src[i : i + S] for i in ix]).to(dev)
    y = torch.stack([src[i + 1 : i + 1 + S] for i in ix]).to(dev)
    return x, y

# ── model (our exact arch; weight_specs order == model.ts leaf order) ──────────
D, L, H = args.dim, args.layers, args.heads
hd = D // H

def new_param(shape, kind):
    if kind == "emb":
        t = torch.randn(shape) * 0.02
    elif kind == "head":
        t = torch.randn(shape) * 0.02
    else:  # linear
        t = torch.randn(shape) * 0.02
    return torch.nn.Parameter(t.to(dev))

P = {}
P["wte"] = new_param((V, D), "emb")
P["wpe"] = new_param((S, D), "emb")
P["lmHead"] = new_param((D, V), "head")
for i in range(L):
    for n, sh in [("wq", (D, D)), ("wk", (D, D)), ("wv", (D, D)), ("wo", (D, D)),
                  ("mlpFc1", (D, 4 * D)), ("mlpFc2", (4 * D, D))]:
        P[f"layers.{i}.{n}"] = new_param(sh, "linear")
params = list(P.values())
nparam = sum(p.numel() for p in params)
print(f"params {nparam/1e6:.1f}M")

def rmsnorm(x):
    return x / torch.sqrt((x * x).mean(-1, keepdim=True) + 1e-5)

causal = torch.tril(torch.ones(S, S, dtype=torch.bool, device=dev))

def forward(x, train=True):
    B = x.shape[0]
    pos = torch.arange(S, device=dev)
    h = P["wte"][x] + P["wpe"][pos][None]  # [B,S,D]
    h = rmsnorm(h)
    if train and args.dropout > 0:
        h = F.dropout(h, args.dropout)
    for i in range(L):
        w = lambda n: P[f"layers.{i}.{n}"]
        res = h
        hn = rmsnorm(h)
        q = (hn @ w("wq")).view(B, S, H, hd)
        k = (hn @ w("wk")).view(B, S, H, hd)
        v = (hn @ w("wv")).view(B, S, H, hd)
        scores = torch.einsum("blnh,bsnh->bnls", q, k) * (1.0 / math.sqrt(hd))
        scores = scores.masked_fill(~causal, float("-inf"))
        probs = torch.softmax(scores, -1)
        attn = torch.einsum("bnls,bsnh->blnh", probs, v).reshape(B, S, D)
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
    return h @ P["lmHead"]  # [B,S,V]

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
        logits = forward(x, train=False)
        tot += F.cross_entropy(logits.reshape(-1, V), y.reshape(-1)).item()
    return tot / nb

def save_ckpt():
    order = ["wte", "wpe", "lmHead"]
    for i in range(L):
        order += [f"layers.{i}.{n}" for n in ("wq", "wk", "wv", "wo", "mlpFc1", "mlpFc2")]
    flat = np.concatenate([P[n].detach().float().cpu().numpy().reshape(-1) for n in order])
    flat.astype(np.float32).tofile(os.path.join(HERE, "rook-flagship.bin"))
    json.dump({"nLayer": L, "nEmbd": D, "nHead": H, "blockSize": S, "vocab": V,
               "params": int(nparam)},
              open(os.path.join(HERE, "rook-flagship-meta.json"), "w"))

# ── train ──────────────────────────────────────────────────────────────────────
t0 = time.time()
for step in range(1, args.steps + 1):
    for g in opt.param_groups:
        g["lr"] = lr_at(step)
    x, y = batch(train_toks, args.batch)
    logits = forward(x, train=True)
    loss = F.cross_entropy(logits.reshape(-1, V), y.reshape(-1))
    opt.zero_grad(set_to_none=True)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(params, 1.0)
    opt.step()
    if step % 250 == 0 or step == 1:
        vl = val_loss() if step % 1000 == 0 else float("nan")
        el = (time.time() - t0)
        sps = step / el
        msg = f"step {step:>6}/{args.steps}  train {loss.item():.3f}"
        if not math.isnan(vl):
            msg += f"  val {vl:.3f}"
        msg += f"  lr {lr_at(step):.1e}  {sps:.1f} it/s  {el/60:.1f}m"
        print(msg, flush=True)
    if step % 2000 == 0:
        save_ckpt()

save_ckpt()
print(f"DONE in {(time.time()-t0)/60:.1f}m  final val {val_loss(40):.3f}  ckpt -> rook-flagship.bin")
