#!/usr/bin/env python3
"""Record a canonical LIVE-PAIR training run as a scrubbable time machine.

Trains one bird (Quill or Rook) offline in LLMVibes' EXACT architecture
(parity-validated against jax-js in spikes/m0/parity/ref.py; same arch the
flagship trainer uses), on the SAME data the browser live pair trains on
(static/data/<bird>-tokens.bin), at the live-pair config (4L / 128d / 4h /
block 128). Along the way it snapshots ~12 log-spaced waypoints. Each waypoint
carries:

  * int8-quantized weights (per-tensor symmetric) written to
    static/data/timemachine/<bird>-w<idx>.i8  — leaf order matches model.ts
    flattenParams, so a browser dequant + loadParams reloads them exactly;
  * train + val cross-entropy at that step;
  * FAITHFUL sample outputs generated from the DEQUANTIZED weights (so the
    displayed text/moves are exactly what a live re-roll of the shipped bin
    reproduces):
      Quill — continuations of fixed prompts (byte-BPE decoded here);
      Rook  — legal-move rate over held-out positions (python-chess) + the
              model's top move distribution from a couple of fixed positions
              (for board arrows) + one sampled game.

The manifest (static/data/timemachine/<bird>-manifest.json) holds everything the
scrubber needs to render instantly with no WebGPU; the .i8 bins are lazy,
fetched only for the optional "re-roll live" button.

Run (from repo root):
  spikes/m0/parity/.venv/bin/python spikes/timemachine/record_timemachine.py --bird quill
  spikes/m0/parity/.venv/bin/python spikes/timemachine/record_timemachine.py --bird rook
"""
import argparse, json, math, os, time
import numpy as np
import torch
import torch.nn.functional as F

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(REPO, "static", "data")
OUT = os.path.join(DATA, "timemachine")
os.makedirs(OUT, exist_ok=True)

ap = argparse.ArgumentParser()
ap.add_argument("--bird", choices=["quill", "rook"], required=True)
ap.add_argument("--layers", type=int, default=4)
ap.add_argument("--dim", type=int, default=128)
ap.add_argument("--heads", type=int, default=4)
ap.add_argument("--block", type=int, default=128)
ap.add_argument("--lr", type=float, default=1.2e-3)
ap.add_argument("--warmup", type=int, default=100)
ap.add_argument("--steps", type=int, default=2600)
ap.add_argument("--batch", type=int, default=64)
ap.add_argument("--dropout", type=float, default=0.1)
ap.add_argument("--wd", type=float, default=0.05)
ap.add_argument("--seed", type=int, default=7)
args = ap.parse_args()

dev = "mps" if torch.backends.mps.is_available() else "cpu"
torch.manual_seed(args.seed)
np.random.seed(args.seed)
D, L, H, S = args.dim, args.layers, args.heads, args.block
hd = D // H

# ── vocab / decoders ────────────────────────────────────────────────────────
if args.bird == "quill":
    vocab = json.load(open(os.path.join(DATA, "quill-vocab.json")))
    V = vocab["vocabSize"]
    merges = vocab["merges"]
    token_bytes = [bytes([i]) for i in range(256)]
    for a, b in merges:
        token_bytes.append(token_bytes[a] + token_bytes[b])

    def decode(ids):
        return b"".join(token_bytes[i] for i in ids).decode("utf-8", errors="replace")

    def encode(text):
        ids = list(text.encode("utf-8"))
        for r, (a, b) in enumerate(merges):
            nid, out, i = 256 + r, [], 0
            while i < len(ids):
                if i < len(ids) - 1 and ids[i] == a and ids[i + 1] == b:
                    out.append(nid)
                    i += 2
                else:
                    out.append(ids[i])
                    i += 1
            ids = out
        return ids
else:
    import chess

    vocab = json.load(open(os.path.join(DATA, "rook-vocab.json")))
    V = vocab["vocabSize"]  # 1931: id 0 = <game>, ids 1.. = moves[i-1]
    MOVES = vocab["moves"]
    uci_of = {i + 1: m for i, m in enumerate(MOVES)}  # id -> uci
    id_of = {m: i + 1 for i, m in enumerate(MOVES)}  # uci -> id

toks = np.fromfile(os.path.join(DATA, f"{args.bird}-tokens.bin"), dtype=np.uint16).astype(np.int64)
val_start = int(len(toks) * 0.95)
train_toks = torch.from_numpy(toks[:val_start])
val_toks = torch.from_numpy(toks[val_start:])
print(f"[{args.bird}] tokens {len(toks):,}  vocab {V}  cfg L{L} D{D} H{H} block{S}  device {dev}")


def batch(src, B):
    hi = len(src) - S - 1
    ix = torch.randint(0, hi, (B,))
    x = torch.stack([src[i : i + S] for i in ix]).to(dev)
    y = torch.stack([src[i + 1 : i + 1 + S] for i in ix]).to(dev)
    return x, y


# ── model (our exact arch; leaf order == model.ts flattenParams) ─────────────
LEAF_ORDER = ["wte", "wpe", "lmHead"]
LEAF_SHAPES = {"wte": (V, D), "wpe": (S, D), "lmHead": (D, V)}
for i in range(L):
    for n, sh in [("wq", (D, D)), ("wk", (D, D)), ("wv", (D, D)), ("wo", (D, D)),
                  ("mlpFc1", (D, 4 * D)), ("mlpFc2", (4 * D, D))]:
        key = f"layers.{i}.{n}"
        LEAF_ORDER.append(key)
        LEAF_SHAPES[key] = sh


def new_params():
    P = {}
    for k in LEAF_ORDER:
        P[k] = torch.nn.Parameter((torch.randn(LEAF_SHAPES[k]) * 0.02).to(dev))
    return P


P = new_params()
params = list(P.values())
nparam = sum(p.numel() for p in params)
print(f"params {nparam / 1e6:.3f}M")


def rmsnorm(x):
    return x / torch.sqrt((x * x).mean(-1, keepdim=True) + 1e-5)


def forward(PP, x, train=True):
    B, T = x.shape
    causal = torch.tril(torch.ones(T, T, dtype=torch.bool, device=x.device))
    h = PP["wte"][x] + PP["wpe"][torch.arange(T, device=x.device)][None]
    h = rmsnorm(h)
    if train and args.dropout > 0:
        h = F.dropout(h, args.dropout)
    for i in range(L):
        w = lambda n: PP[f"layers.{i}.{n}"]
        res = h
        hn = rmsnorm(h)
        q = (hn @ w("wq")).view(B, T, H, hd)
        k = (hn @ w("wk")).view(B, T, H, hd)
        v = (hn @ w("wv")).view(B, T, H, hd)
        scores = torch.einsum("blnh,bsnh->bnls", q, k) * (1.0 / math.sqrt(hd))
        scores = scores.masked_fill(~causal, float("-inf"))
        attn = torch.einsum("bnls,bsnh->blnh", torch.softmax(scores, -1), v).reshape(B, T, D)
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
    return h @ PP["lmHead"]


opt = torch.optim.AdamW(params, lr=args.lr, weight_decay=args.wd, betas=(0.9, 0.95))


def lr_at(step):
    if step < args.warmup:
        return args.lr * step / args.warmup
    p = (step - args.warmup) / max(1, args.steps - args.warmup)
    return args.lr * (0.05 + 0.95 * 0.5 * (1 + math.cos(math.pi * min(1.0, p))))


@torch.no_grad()
def val_loss(PP, nb=25):
    tot = 0.0
    for _ in range(nb):
        x, y = batch(val_toks, args.batch)
        tot += F.cross_entropy(forward(PP, x, False).reshape(-1, V), y.reshape(-1)).item()
    return tot / nb


# ── int8 per-tensor symmetric quantization ───────────────────────────────────
def quantize(PP):
    scales, q_bytes = [], []
    for k in LEAF_ORDER:
        t = PP[k].detach().float().cpu().numpy().reshape(-1)
        amax = float(np.abs(t).max())
        scale = amax / 127.0 if amax > 0 else 1.0
        q = np.clip(np.round(t / scale), -127, 127).astype(np.int8)
        scales.append(scale)
        q_bytes.append(q)
    return scales, np.concatenate(q_bytes)


def dequant_params(scales, q_flat):
    """int8 bin + scales -> a param dict (fp32 tensors) for faithful sampling."""
    PP, off = {}, 0
    for k, s in zip(LEAF_ORDER, scales):
        n = int(np.prod(LEAF_SHAPES[k]))
        chunk = q_flat[off : off + n].astype(np.float32) * s
        off += n
        PP[k] = torch.from_numpy(chunk.reshape(LEAF_SHAPES[k])).to(dev)
    return PP


# ── sampling helpers ─────────────────────────────────────────────────────────
@torch.no_grad()
def gen(PP, prefix, n, temp, seed, stop_ids=()):
    g = torch.Generator().manual_seed(seed)
    ids = list(prefix)
    for _ in range(n):
        ctx = ids[-S:]
        logits = forward(PP, torch.tensor([ctx], device=dev), False)[0, -1]
        if temp <= 0:
            nxt = int(logits.argmax())
        else:
            probs = torch.softmax(logits / temp, -1).float().cpu()
            nxt = int(torch.multinomial(probs, 1, generator=g))
        ids.append(nxt)
        if nxt in stop_ids:
            break
    return ids[len(prefix):]


@torch.no_grad()
def next_dist(PP, prefix):
    logits = forward(PP, torch.tensor([prefix], device=dev), False)[0, -1]
    return torch.softmax(logits, -1).float().cpu().numpy()


# ── Quill / Rook per-waypoint output recorders ───────────────────────────────
QUILL_PROMPTS = ["Once upon a time, ", "The little robot ", "One day, a cat "]


def record_quill(PP, idx):
    out = []
    for pi, p in enumerate(QUILL_PROMPTS):
        ids = encode(p)
        cont = gen(PP, ids, 48, temp=0.7, seed=1000 + idx * 17 + pi)
        out.append({"prompt": p, "text": decode(cont)})
    return {"samples": out}


ROOK_ARROW_POS = [[], ["e2e4"]]  # startpos, and after 1.e4 — fixed arrow scenes


def _board_after(moves):
    import chess

    b = chess.Board()
    for m in moves:
        b.push_uci(m)
    return b


def make_rook_probe_positions(n, seed):
    """n held-out positions (list of uci moves so far) from fresh random games."""
    import chess

    rng = np.random.default_rng(seed)
    pos = []
    while len(pos) < n:
        b = chess.Board()
        moves = []
        plies = int(rng.integers(1, 40))
        ok = True
        for _ in range(plies):
            lm = list(b.legal_moves)
            if not lm:
                ok = False
                break
            mv = lm[int(rng.integers(0, len(lm)))]
            moves.append(mv.uci())
            b.push(mv)
        if ok and all(m in id_of for m in moves):
            pos.append(moves)
    return pos


def record_rook(PP, idx, probe_positions):
    import chess

    # legal-move rate: model's argmax next token, is it a legal move here?
    legal = 0
    for moves in probe_positions:
        prefix = [0] + [id_of[m] for m in moves]
        dist = next_dist(PP, prefix)
        nid = int(dist.argmax())
        uci = uci_of.get(nid)
        b = _board_after(moves)
        if uci is not None and chess.Move.from_uci(uci) in b.legal_moves:
            legal += 1
    legal_rate = legal / len(probe_positions)

    # top-k move distribution from fixed positions (board arrows)
    scenes = []
    for moves in ROOK_ARROW_POS:
        prefix = [0] + [id_of[m] for m in moves]
        dist = next_dist(PP, prefix)
        b = _board_after(moves)
        top = np.argsort(dist)[::-1][:8]
        arrows = []
        for nid in top:
            nid = int(nid)
            uci = uci_of.get(nid, "<game>")
            is_legal = uci in id_of and chess.Move.from_uci(uci) in b.legal_moves
            arrows.append({"uci": uci, "p": float(dist[nid]), "legal": bool(is_legal)})
        scenes.append({"moves": moves, "arrows": arrows})

    # one sampled game from the start (temp) — how long can it stay legal?
    seq = gen(PP, [0], 40, temp=0.5, seed=500 + idx, stop_ids=(0,))
    game, b, illegal_at = [], chess.Board(), None
    for j, nid in enumerate(seq):
        uci = uci_of.get(int(nid))
        if uci is None or chess.Move.from_uci(uci) not in b.legal_moves:
            illegal_at = j
            break
        b.push_uci(uci)
        game.append(uci)
    return {"legalRate": legal_rate, "scenes": scenes, "game": game, "illegalAt": illegal_at}


# ── waypoint schedule (log-spaced, incl. step 0 = random init) ───────────────
def waypoint_steps(total):
    raw = np.unique(np.round(np.exp(np.linspace(math.log(2), math.log(total), 11))).astype(int))
    return [0] + [int(s) for s in raw if 0 < s <= total]


WP = waypoint_steps(args.steps)
print(f"waypoints @ steps {WP}")

probe_positions = make_rook_probe_positions(200, seed=99) if args.bird == "rook" else None
waypoints = []
t0 = time.time()


def snapshot(step, train_loss):
    idx = len(waypoints)
    scales, q_flat = quantize(P)
    q_flat.tofile(os.path.join(OUT, f"{args.bird}-w{idx}.i8"))
    deq = dequant_params(scales, q_flat)  # faithful-to-shipped-bin weights
    vl = val_loss(deq)
    entry = {
        "step": step,
        "trainLoss": round(float(train_loss), 4),
        "valLoss": round(float(vl), 4),
        "scales": [float(s) for s in scales],
        "bytes": int(q_flat.size),
    }
    if args.bird == "quill":
        entry.update(record_quill(deq, idx))
    else:
        entry.update(record_rook(deq, idx, probe_positions))
    waypoints.append(entry)
    tag = f"legal {entry.get('legalRate', 0):.2f}" if args.bird == "rook" else ""
    print(f"  · wp{idx:>2} step {step:>5}  train {entry['trainLoss']:.3f}  val {entry['valLoss']:.3f}  "
          f"{tag}  ({(time.time() - t0) / 60:.1f}m)", flush=True)


# step 0 = random init
snapshot(0, val_loss(P))
ema = None
for step in range(1, args.steps + 1):
    for g in opt.param_groups:
        g["lr"] = lr_at(step)
    x, y = batch(train_toks, args.batch)
    loss = F.cross_entropy(forward(P, x, True).reshape(-1, V), y.reshape(-1))
    opt.zero_grad(set_to_none=True)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(params, 1.0)
    opt.step()
    ema = loss.item() if ema is None else 0.9 * ema + 0.1 * loss.item()
    if step in WP:
        snapshot(step, ema)

manifest = {
    "bird": args.bird,
    "config": {"nLayer": L, "nEmbd": D, "nHead": H, "blockSize": S, "vocab": V},
    "params": int(nparam),
    "leafSizes": [int(np.prod(LEAF_SHAPES[k])) for k in LEAF_ORDER],
    "quant": "int8-symmetric-per-tensor",
    "steps": args.steps,
    "waypoints": waypoints,
}
json.dump(manifest, open(os.path.join(OUT, f"{args.bird}-manifest.json"), "w"))
mb = sum(w["bytes"] for w in waypoints) / 1e6
print(f"[{args.bird}] DONE in {(time.time() - t0) / 60:.1f}m  "
      f"{len(waypoints)} waypoints  {mb:.1f}MB int8  -> {OUT}")
