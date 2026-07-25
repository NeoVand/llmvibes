#!/usr/bin/env python3
"""Record a few flagship-Rook games for the "Stockfish judges Rook" eval widget.
Rook plays BOTH sides (it just continues the move stream); we legal-mask its
distribution so the game runs to a natural end — this widget is about move
QUALITY (Stockfish grades it live in the browser), not legality (the depth eval
already covered that). Emits static/data/rook-games.json.

Run: spikes/m0/parity/.venv/bin/python spikes/flagship/gen_rook_games.py
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
id_of = {m: i + 1 for i, m in enumerate(MOVES)}

order = ["wte", "wpe", "lmHead"] + [f"layers.{i}.{n}" for i in range(L)
                                    for n in ("wq", "wk", "wv", "wo", "mlpFc1", "mlpFc2")]
shapes = {"wte": (V, D), "wpe": (S, D), "lmHead": (D, V)}
for i in range(L):
    for n, sh in [("wq", (D, D)), ("wk", (D, D)), ("wv", (D, D)), ("wo", (D, D)),
                  ("mlpFc1", (D, 4 * D)), ("mlpFc2", (4 * D, D))]:
        shapes[f"layers.{i}.{n}"] = sh
flat = np.fromfile(f"{HERE}/rook-flagship.bin", dtype=np.float32)
P, off = {}, 0
for k in order:
    n = int(np.prod(shapes[k])); P[k] = torch.tensor(flat[off:off + n].reshape(shapes[k])); off += n


def rms(x):
    return x / torch.sqrt((x * x).mean(-1, keepdim=True) + 1e-5)


@torch.no_grad()
def logits_last(prefix):
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
    return (h[0, -1] @ P["lmHead"])


def play_game(seed, temp=0.4, max_ply=60):
    rng = np.random.default_rng(seed)
    b = chess.Board(); prefix = [0]; moves = []
    while len(moves) < max_ply:
        legal = list(b.legal_moves)
        if not legal:
            break
        lg = logits_last(prefix).numpy()
        # restrict to legal moves the vocab knows, softmax w/ temperature, sample
        cand = [(m, id_of[m.uci()]) for m in legal if m.uci() in id_of]
        if not cand:
            break
        z = np.array([lg[i] for _, i in cand]) / temp
        p = np.exp(z - z.max()); p /= p.sum()
        j = int(rng.choice(len(cand), p=p))
        mv, mid = cand[j]
        moves.append(mv.uci()); prefix.append(mid); b.push(mv)
    outcome = b.outcome(claim_draw=True)
    result = outcome.result() if outcome else "*"
    reason = outcome.termination.name.lower() if outcome else "move-limit"
    return {"moves": moves, "result": result, "reason": reason, "plies": len(moves)}


games = [play_game(1000 + i, temp=0.4) for i in range(5)]
for g in games:
    print(f"  {g['plies']} plies · {g['result']} ({g['reason']})")
out = {"model": f"flagship Rook (~5.8M, {L}L/{D}d)", "games": games}
json.dump(out, open(os.path.join(HERE, "..", "..", "static", "data", "rook-games.json"), "w"))
print(f"wrote static/data/rook-games.json ({len(games)} games)")
