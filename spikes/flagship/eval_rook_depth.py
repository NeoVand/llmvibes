#!/usr/bin/env python3
"""Rook eval feasibility: is legal-move rate a MEMORIZATION artifact or evidence
of a MODELED board? Positions a few plies from the start recur across random games
(memorizable); deep positions are astronomically unique (never seen), so legality
there can only come from something that tracks the board. We measure the flagship
Rook's legal-move rate binned by ply depth — flat-and-high with depth = modeling;
decaying = recall running out. Also runs an untrained control (the chance floor).

Run: spikes/m0/parity/.venv/bin/python spikes/flagship/eval_rook_depth.py
"""
import json, math, os
import numpy as np
import torch
import chess

HERE = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(f"{HERE}/rook-flagship-meta.json"))
V, D, L, Hh, S = meta["vocab"], meta["nEmbd"], meta["nLayer"], meta["nHead"], meta["blockSize"]
hd = D // Hh
vocab = json.load(open(f"{HERE}/rook-flagship-vocab.json"))
MOVES = vocab["moves"]
uci_of = {i + 1: m for i, m in enumerate(MOVES)}
id_of = {m: i + 1 for i, m in enumerate(MOVES)}

order = ["wte", "wpe", "lmHead"] + [f"layers.{i}.{n}" for i in range(L)
                                    for n in ("wq", "wk", "wv", "wo", "mlpFc1", "mlpFc2")]
shapes = {"wte": (V, D), "wpe": (S, D), "lmHead": (D, V)}
for i in range(L):
    for n, sh in [("wq", (D, D)), ("wk", (D, D)), ("wv", (D, D)), ("wo", (D, D)),
                  ("mlpFc1", (D, 4 * D)), ("mlpFc2", (4 * D, D))]:
        shapes[f"layers.{i}.{n}"] = sh


def load(path):
    flat = np.fromfile(path, dtype=np.float32)
    P, off = {}, 0
    for k in order:
        n = int(np.prod(shapes[k]))
        P[k] = torch.tensor(flat[off:off + n].reshape(shapes[k]))
        off += n
    return P


def rms(x):
    return x / torch.sqrt((x * x).mean(-1, keepdim=True) + 1e-5)


@torch.no_grad()
def next_id(P, prefix):
    x = torch.tensor([prefix[-S:]], dtype=torch.long)
    T = x.shape[1]
    causal = torch.tril(torch.ones(T, T, dtype=torch.bool))
    h = rms(P["wte"][x] + P["wpe"][torch.arange(T)][None])
    for i in range(L):
        w = lambda n: P[f"layers.{i}.{n}"]
        res = h; hn = rms(h)
        q = (hn @ w("wq")).view(1, T, Hh, hd); k = (hn @ w("wk")).view(1, T, Hh, hd); v = (hn @ w("wv")).view(1, T, Hh, hd)
        sc = torch.einsum("blnh,bsnh->bnls", q, k) * (1 / math.sqrt(hd))
        sc = sc.masked_fill(~causal, float("-inf"))
        h = (torch.einsum("bnls,bsnh->blnh", torch.softmax(sc, -1), v).reshape(1, T, D)) @ w("wo") + res
        res2 = h; hn = rms(h); h = (torch.relu(hn @ w("mlpFc1")) @ w("mlpFc2")) + res2
    return int((h[0, -1] @ P["lmHead"]).argmax())


def untrained():
    torch.manual_seed(0)
    return {k: torch.randn(shapes[k]) * (0.02 if k in ("wte", "wpe", "lmHead") else 0.02) for k in order}


# held-out random-legal games (seed disjoint from the training generator)
def eval_model(P, n_games=200, max_ply=80, seed=424242):
    rng = np.random.default_rng(seed)
    bins = {}  # ply bucket -> [legal, total]
    for _ in range(n_games):
        b = chess.Board(); prefix = [0]; ply = 0
        while ply < max_ply:
            legal = list(b.legal_moves)
            if not legal:
                break
            # model's prediction at THIS position
            nid = next_id(P, prefix)
            uci = uci_of.get(nid)
            ok = uci is not None and chess.Move.from_uci(uci) in b.legal_moves
            bucket = min(ply // 8, 9)  # 0-7,8-15,...,72-79
            bins.setdefault(bucket, [0, 0])
            bins[bucket][0] += ok; bins[bucket][1] += 1
            # advance the game by a random legal move (build the held-out trajectory)
            mv = legal[int(rng.integers(0, len(legal)))]
            if mv.uci() not in id_of:
                break
            prefix.append(id_of[mv.uci()]); b.push(mv); ply += 1
    return {k: (v[0] / v[1], v[1]) for k, v in sorted(bins.items())}


# collect a few DEEP example positions (ply >= 40) with the flagship's predicted move
def deep_examples(P, k=6, seed=777, min_ply=40):
    rng = np.random.default_rng(seed)
    out = []
    while len(out) < k:
        b = chess.Board(); prefix = [0]; moves = []
        target = int(rng.integers(min_ply, 70))
        ok = True
        for _ in range(target):
            legal = list(b.legal_moves)
            if not legal:
                ok = False; break
            mv = legal[int(rng.integers(0, len(legal)))]
            if mv.uci() not in id_of:
                ok = False; break
            moves.append(mv.uci()); prefix.append(id_of[mv.uci()]); b.push(mv)
        if not ok or not list(b.legal_moves):
            continue
        uci = uci_of.get(next_id(P, prefix))
        is_legal = uci is not None and chess.Move.from_uci(uci) in b.legal_moves
        out.append({"ply": len(moves), "moves": moves, "fen": b.fen(),
                    "move": uci or "<game>", "legal": bool(is_legal),
                    "turn": "w" if b.turn == chess.WHITE else "b"})
    return out


print(f"flagship Rook: L{L} D{D} vocab {V}")
Ptr = load(f"{HERE}/rook-flagship.bin")
trained = eval_model(Ptr)
control = eval_model(untrained())
print("\nply-bin   trained-legal%   (n)    control-legal%")
for bucket in sorted(trained):
    t, n = trained[bucket]
    c = control.get(bucket, (0, 0))[0]
    lo = bucket * 8
    print(f"  {lo:>2}-{lo+7:<2}     {t*100:5.1f}          {n:>4}     {c*100:4.1f}")
tvals = [trained[b][0] for b in sorted(trained)]
print(f"\nshallow (0-7): {tvals[0]*100:.1f}%   deep (last bin): {tvals[-1]*100:.1f}%   "
      f"trained mean: {np.mean(tvals)*100:.1f}%  control mean: {np.mean([control.get(b,(0,0))[0] for b in sorted(trained)])*100:.1f}%")

out = {
    "model": f"flagship Rook (~5.8M, {L}L/{D}d)",
    "bins": [{"plyLo": b * 8, "plyHi": b * 8 + 7,
              "trained": round(trained[b][0], 4), "control": round(control.get(b, (0, 0))[0], 4),
              "n": trained[b][1]} for b in sorted(trained)],
    "examples": deep_examples(Ptr),
}
DATA = os.path.join(HERE, "..", "..", "static", "data")
json.dump(out, open(os.path.join(DATA, "rook-eval.json"), "w"))
print(f"wrote static/data/rook-eval.json ({len(out['examples'])} deep examples)")
