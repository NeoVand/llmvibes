// Stockfish 10 (classical eval) as a single-threaded WASM Web Worker — the
// course's chess oracle. Deliberately the lightweight build: no NNUE (would be a
// 40MB net), no SharedArrayBuffer, so it needs none of the COOP/COEP headers
// GitHub Pages can't set (PLAN.md's decision). Even shallow, SF10 is far beyond
// anything our ~5.8M Rook can do, which is all a reward signal / opponent needs.
//
// The engine (stockfish.wasm.js + stockfish.wasm) is vendored under
// static/stockfish/ as a separate GPLv3 asset (the site stays MIT); the worker
// script locates the .wasm next to itself. GPLv3 attribution ships alongside.
//
// Usage:
//   const sf = new Stockfish(base);       // base from $app/paths
//   const a = await sf.analyse(fen, 12);  // { bestMove, scoreCp, mate, pv }
//   sf.dispose();

export interface Analysis {
	/** Best move in UCI (e.g. "e2e4", "e7e8q"), or null in a terminal position. */
	bestMove: string | null;
	/** Centipawns from the side-to-move's view (+ = better for mover). null if mate. */
	scoreCp: number | null;
	/** Mate in N (sign = side-to-move); null if not a forced mate. */
	mate: number | null;
	/** Search depth actually reached. */
	depth: number;
	/** Principal variation (UCI moves). */
	pv: string[];
}

export class Stockfish {
	private worker: Worker;
	private ready: Promise<void>;
	private busy: Promise<unknown> = Promise.resolve();
	private lineHandlers: Array<(line: string) => void> = [];

	constructor(base = '') {
		this.worker = new Worker(`${base}/stockfish/stockfish.wasm.js`);
		this.worker.onmessage = (e: MessageEvent) => {
			const line = typeof e.data === 'string' ? e.data : (e.data?.data ?? '');
			for (const h of this.lineHandlers) h(line);
		};
		this.ready = this.handshake();
	}

	private send(cmd: string) {
		this.worker.postMessage(cmd);
	}

	/** Resolve once a UCI line satisfies `match`; times out defensively. */
	private await_(match: (line: string) => boolean, timeoutMs = 20000): Promise<string> {
		return new Promise((resolve, reject) => {
			const to = setTimeout(() => {
				this.lineHandlers = this.lineHandlers.filter((h) => h !== handler);
				reject(new Error('stockfish timeout'));
			}, timeoutMs);
			const handler = (line: string) => {
				if (match(line)) {
					clearTimeout(to);
					this.lineHandlers = this.lineHandlers.filter((h) => h !== handler);
					resolve(line);
				}
			};
			this.lineHandlers.push(handler);
		});
	}

	private async handshake(): Promise<void> {
		this.send('uci');
		await this.await_((l) => l.startsWith('uciok'));
		this.send('isready');
		await this.await_((l) => l.startsWith('readyok'));
	}

	/** Serialize calls — Stockfish is one engine; only one search at a time. */
	private run<T>(fn: () => Promise<T>): Promise<T> {
		const next = this.busy.then(fn, fn);
		this.busy = next.catch(() => {});
		return next;
	}

	/** Skill Level 0–20 (SF10). Lower = weaker, for calibrated opponents. */
	async setSkill(level: number): Promise<void> {
		await this.ready;
		this.send(`setoption name Skill Level value ${Math.max(0, Math.min(20, Math.round(level)))}`);
	}

	/** Search a position to a fixed depth; returns best move + evaluation. */
	analyse(fen: string, depth = 12): Promise<Analysis> {
		return this.run(async () => {
			await this.ready;
			let scoreCp: number | null = null;
			let mate: number | null = null;
			let seenDepth = 0;
			let pv: string[] = [];
			const onInfo = (line: string) => {
				if (!line.startsWith('info') || !line.includes(' pv ')) return;
				const dm = line.match(/ depth (\d+)/);
				if (dm) seenDepth = Number(dm[1]);
				const cp = line.match(/ score cp (-?\d+)/);
				const mt = line.match(/ score mate (-?\d+)/);
				if (mt) {
					mate = Number(mt[1]);
					scoreCp = null;
				} else if (cp) {
					scoreCp = Number(cp[1]);
					mate = null;
				}
				const pvm = line.match(/ pv (.+)$/);
				if (pvm) pv = pvm[1].trim().split(/\s+/);
			};
			this.lineHandlers.push(onInfo);
			this.send('position fen ' + fen);
			this.send('go depth ' + depth);
			const best = await this.await_((l) => l.startsWith('bestmove'));
			this.lineHandlers = this.lineHandlers.filter((h) => h !== onInfo);
			const bm = best.split(/\s+/)[1];
			return {
				bestMove: bm && bm !== '(none)' ? bm : null,
				scoreCp,
				mate,
				depth: seenDepth,
				pv
			};
		});
	}

	/** Best move only (convenience for playing a game). */
	async bestMove(fen: string, depth = 12): Promise<string | null> {
		return (await this.analyse(fen, depth)).bestMove;
	}

	dispose(): void {
		try {
			this.send('quit');
		} catch {
			/* already gone */
		}
		this.worker.terminate();
		this.lineHandlers = [];
	}
}
