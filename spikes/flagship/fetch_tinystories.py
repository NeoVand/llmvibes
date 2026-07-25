#!/usr/bin/env python3
"""Fetch TinyStories via the HF datasets library (streams parquet from the CDN —
not the rate-limited datasets-server /rows API). Writes the raw corpus text;
build-quill-flagship-data.mjs then encodes it with the live Quill's byte-BPE.

Run: spikes/m0/parity/.venv/bin/python spikes/flagship/fetch_tinystories.py [25000]
"""
import os, sys
from datasets import load_dataset

N = int(sys.argv[1]) if len(sys.argv) > 1 else 25000
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quill-flagship-corpus.txt")

ds = load_dataset("roneneldan/TinyStories", split="train", streaming=True)
stories = []
for row in ds:
    t = (row.get("text") or "").strip()
    if t:
        stories.append(t)
        if len(stories) % 2000 == 0:
            print(f"\r  {len(stories)}/{N} stories", end="", flush=True)
    if len(stories) >= N:
        break

corpus = "\n\n".join(stories)
with open(OUT, "w") as f:
    f.write(corpus)
print(f"\nwrote {len(stories)} stories · {len(corpus) / 1e6:.1f} MB -> {OUT}")
