// M0e probe: the live-tier training step inside a Web Worker.
// Self-contained copy of the minimal train benchmark (duplication is fine in a
// spike; main.ts stays the source of truth for the full suite).

import {
  init,
  defaultDevice,
  numpy as np,
  nn,
  jit,
  valueAndGrad,
  random,
  tree,
  blockUntilReady,
} from '@jax-js/jax';
import { adam, applyUpdates } from '@jax-js/optax';

interface Cfg {
  nLayer: number;
  nEmbd: number;
  nHead: number;
  blockSize: number;
  vocab: number;
  batch: number;
}

const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);
const wlog = (msg: string) => post({ type: 'log', msg });

function initParams(cfg: Cfg, key: any) {
  const s = Math.sqrt(3 / cfg.nEmbd);
  const n = 3 + cfg.nLayer * 6;
  const keys = random.split(key, n);
  let ki = 0;
  const nk = () => {
    ki++;
    return ki < n ? keys.ref.slice(ki - 1) : keys.slice(ki - 1);
  };
  const params: any = {
    wte: random.normal(nk(), [cfg.vocab, cfg.nEmbd]).mul(0.02),
    wpe: random.normal(nk(), [cfg.blockSize, cfg.nEmbd]).mul(0.02),
    lmHead: random.normal(nk(), [cfg.nEmbd, cfg.vocab]).mul(0.001),
    layers: [],
  };
  for (let i = 0; i < cfg.nLayer; i++) {
    params.layers.push({
      wq: random.uniform(nk(), [cfg.nEmbd, cfg.nEmbd], { minval: -s, maxval: s }),
      wk: random.uniform(nk(), [cfg.nEmbd, cfg.nEmbd], { minval: -s, maxval: s }),
      wv: random.uniform(nk(), [cfg.nEmbd, cfg.nEmbd], { minval: -s, maxval: s }),
      wo: np.zeros([cfg.nEmbd, cfg.nEmbd]),
      mlpFc1: random.uniform(nk(), [cfg.nEmbd, 4 * cfg.nEmbd], { minval: -0.4 * s, maxval: 0.4 * s }),
      mlpFc2: np.zeros([4 * cfg.nEmbd, cfg.nEmbd]),
    });
  }
  return params;
}

function rmsnorm(x: any) {
  const ms = np.mean(np.square(x.ref), -1, { keepdims: true });
  return x.div(np.sqrt(ms.add(1e-5)));
}

function lossFn(params: any, cfg: Cfg, tokenOH: any, posOH: any, targetOH: any) {
  const headDim = cfg.nEmbd / cfg.nHead;
  const seqLen = cfg.blockSize;
  let x = np.dot(tokenOH.reshape([-1, cfg.vocab]), params.wte);
  const posEmb = np.dot(posOH.reshape([-1, cfg.blockSize]), params.wpe);
  x = rmsnorm(x.add(posEmb));
  for (let li = 0; li < cfg.nLayer; li++) {
    const layer = params.layers[li];
    const xRes = x.ref;
    x = rmsnorm(x);
    const q = np.dot(x.ref, layer.wq);
    const k = np.dot(x.ref, layer.wk);
    const v = np.dot(x, layer.wv);
    const qH = q.reshape([-1, seqLen, cfg.nHead, headDim]);
    const kH = k.reshape([-1, seqLen, cfg.nHead, headDim]);
    const vH = v.reshape([-1, seqLen, cfg.nHead, headDim]);
    const attnOut = nn.dotProductAttention(qH, kH, vH, { isCausal: true });
    x = np.dot(attnOut.reshape([-1, cfg.nEmbd]), layer.wo).add(xRes);
    const mlpRes = x.ref;
    x = rmsnorm(x);
    x = nn.relu(np.dot(x, layer.mlpFc1));
    x = np.dot(x, layer.mlpFc2).add(mlpRes);
  }
  const logits = np.dot(x, params.lmHead);
  const logprobs = nn.logSoftmax(logits, -1);
  return np.mean(np.sum(logprobs.mul(targetOH.reshape([-1, cfg.vocab])), -1).neg());
}

function makeBatch(cfg: Cfg, step: number) {
  const nTok = cfg.batch * cfg.blockSize;
  const inputBuf = new Int32Array(nTok);
  const targetBuf = new Int32Array(nTok);
  for (let i = 0; i < nTok; i++) {
    inputBuf[i] = (i * 2654435761 + step * 40503) % cfg.vocab;
    targetBuf[i] = (inputBuf[i] + 1) % cfg.vocab;
  }
  const inputIds = np.array(inputBuf, { dtype: np.int32 }).reshape([cfg.batch, cfg.blockSize]);
  const posIds = np.tile(np.arange(cfg.blockSize).astype(np.int32), [cfg.batch, 1]);
  const targetIds = np.array(targetBuf, { dtype: np.int32 }).reshape([cfg.batch, cfg.blockSize]);
  return {
    tokenOH: nn.oneHot(inputIds, cfg.vocab),
    posOH: nn.oneHot(posIds, cfg.blockSize),
    targetOH: nn.oneHot(targetIds, cfg.vocab),
  };
}

self.onmessage = async () => {
  try {
    const devices = await init();
    const dev = devices.includes('webgpu') ? 'webgpu' : devices[0];
    defaultDevice(dev);
    wlog(`init ok — devices: ${devices.join(', ')} (using ${dev})`);

    const cfg: Cfg = { nLayer: 6, nEmbd: 256, nHead: 8, blockSize: 256, vocab: 4096, batch: 8 };
    let params = initParams(cfg, random.key(42));
    await blockUntilReady(params);
    const solver = adam(3e-4, { b1: 0.9, b2: 0.99 });
    let optState = solver.init(tree.ref(params));
    const jitStep = jit((p: any, a: any, b: any, c: any) =>
      valueAndGrad((pp: any) => lossFn(pp, cfg, a, b, c))(p),
    );

    const runStep = (stepIdx: number): number => {
      const { tokenOH, posOH, targetOH } = makeBatch(cfg, stepIdx);
      const [lossVal, grads] = jitStep(tree.ref(params), tokenOH.ref, posOH.ref, targetOH.ref);
      const [updates, newOptState] = solver.update(grads, optState, tree.ref(params));
      params = applyUpdates(params, updates);
      optState = newOptState;
      tokenOH.dispose();
      posOH.dispose();
      targetOH.dispose();
      return lossVal.item();
    };

    const tw0 = performance.now();
    const firstLoss = runStep(0);
    const firstStepMs = Math.round(performance.now() - tw0);
    const timedSteps = 8;
    const t0 = performance.now();
    let lastLoss = NaN;
    for (let i = 0; i < timedSteps; i++) lastLoss = runStep(1 + i);
    const msPerStep = (performance.now() - t0) / timedSteps;

    post({
      type: 'result',
      payload: {
        device: dev,
        label: 'worker live-V4096',
        msPerStep: Math.round(msPerStep),
        tokPerSec: Math.round(((cfg.batch * cfg.blockSize) / msPerStep) * 1000),
        firstStepMs,
        firstLoss: Number(firstLoss.toFixed(3)),
        lastLoss: Number(lastLoss.toFixed(3)),
      },
    });
  } catch (e) {
    post({ type: 'error', error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
  }
};
