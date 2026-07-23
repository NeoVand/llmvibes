/**
 * The five racers and their update rules — math ported faithfully from the
 * GradientDescent project's core optimizers (gd, momentum, adam, adamw,
 * lion), collapsed to the 2-D case. Steps are written against a mutable
 * per-runner state record; `predictNext` dry-runs one update on cloned
 * state so the ghost circle can show the landing point without committing.
 */

export type OptimizerId = 'gd' | 'momentum' | 'adam' | 'adamw' | 'lion';

/** GradientDescent's RACE_COLORS — a distinct, stable colour per trail. */
export const RACE_COLORS: Record<OptimizerId, string> = {
	gd: '#94a3b8', // slate
	momentum: '#a855f7', // violet
	adam: '#f43f5e', // rose
	adamw: '#ef4444', // red
	lion: '#eab308' // gold
};

export interface RunnerSpec {
	id: OptimizerId;
	label: string;
	color: string;
	blurb: string;
}

export const RUNNERS: RunnerSpec[] = [
	{
		id: 'gd',
		label: 'SGD',
		color: RACE_COLORS.gd,
		blurb: 'θ ← θ − γ∇ℒ — the raw slope, nothing else'
	},
	{
		id: 'momentum',
		label: 'Momentum',
		color: RACE_COLORS.momentum,
		blurb: 'Polyak heavy ball: v ← μv + ∇ℒ; θ ← θ − γv'
	},
	{
		id: 'adam',
		label: 'Adam',
		color: RACE_COLORS.adam,
		blurb: 'bias-corrected moments, per-axis step scaling'
	},
	{
		id: 'adamw',
		label: 'AdamW',
		color: RACE_COLORS.adamw,
		blurb: 'Adam + DECOUPLED weight decay — the λθ pull is the “W”'
	},
	{
		id: 'lion',
		label: 'Lion',
		color: RACE_COLORS.lion,
		blurb: 'sign of blended momentum: every step has magnitude γ per axis'
	}
];

// Constants match the GradientDescent library's spec defaults exactly.
export const EPS = 1e-8;
export const MU = 0.9; // momentum μ
export const BETA1 = 0.9;
export const BETA2 = 0.999;
export const LION_BETA1 = 0.9;
export const LION_BETA2 = 0.99;

export interface OptState {
	/** momentum / Lion buffer, or Adam's first moment m */
	vx: number;
	vy: number;
	/** Adam's second moment v */
	sx: number;
	sy: number;
	t: number;
}

export function initOptState(): OptState {
	return { vx: 0, vy: 0, sx: 0, sy: 0, t: 0 };
}

/**
 * One update: mutates `st`, returns the next position. `wd` (decoupled λ)
 * only acts in AdamW — everyone else ignores it, same as the source app.
 */
export function stepOptimizer(
	id: OptimizerId,
	x: number,
	y: number,
	gx: number,
	gy: number,
	st: OptState,
	lr: number,
	wd: number
): { x: number; y: number } {
	switch (id) {
		case 'gd':
			// [gd] θ ← θ − γ∇ℒ — the whole algorithm.
			st.t++;
			return { x: x - lr * gx, y: y - lr * gy };
		case 'momentum':
			// [momentum] v ← μv + g; θ ← θ − γv (γ NOT folded into v).
			st.vx = MU * st.vx + gx;
			st.vy = MU * st.vy + gy;
			st.t++;
			return { x: x - lr * st.vx, y: y - lr * st.vy };
		case 'adam':
		case 'adamw': {
			// [adam/adamw] moments + bias correction; AdamW adds the γλθ pull.
			const t = ++st.t;
			const mc1 = 1 - Math.pow(BETA1, t);
			const mc2 = 1 - Math.pow(BETA2, t);
			st.vx = BETA1 * st.vx + (1 - BETA1) * gx;
			st.vy = BETA1 * st.vy + (1 - BETA1) * gy;
			st.sx = BETA2 * st.sx + (1 - BETA2) * gx * gx;
			st.sy = BETA2 * st.sy + (1 - BETA2) * gy * gy;
			const decay = id === 'adamw' ? wd : 0;
			return {
				x: x - lr * (st.vx / mc1 / (Math.sqrt(st.sx / mc2) + EPS) + decay * x),
				y: y - lr * (st.vy / mc1 / (Math.sqrt(st.sy / mc2) + EPS) + decay * y)
			};
		}
		case 'lion': {
			// [lion] direction = sign(β₁m + (1−β₁)g); fixed-size γ steps;
			// the buffer updates with its own, slower decay β₂.
			const cx = LION_BETA1 * st.vx + (1 - LION_BETA1) * gx;
			const cy = LION_BETA1 * st.vy + (1 - LION_BETA1) * gy;
			const nx = x - lr * Math.sign(cx);
			const ny = y - lr * Math.sign(cy);
			st.vx = LION_BETA2 * st.vx + (1 - LION_BETA2) * gx;
			st.vy = LION_BETA2 * st.vy + (1 - LION_BETA2) * gy;
			st.t++;
			return { x: nx, y: ny };
		}
	}
}

/** Dry-run the next update on cloned state — the ghost's landing point. */
export function predictNext(
	id: OptimizerId,
	x: number,
	y: number,
	gx: number,
	gy: number,
	st: OptState,
	lr: number,
	wd: number
): { x: number; y: number } {
	return stepOptimizer(id, x, y, gx, gy, { ...st }, lr, wd);
}
