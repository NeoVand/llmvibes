import { describe, expect, it } from 'vitest';
import {
	PRESETS,
	presetById,
	computeGrid,
	contourThresholds,
	normalizedLogLoss,
	gradAt,
	fieldMaxMag,
	GRID_RES
} from './landscape';
import { COLORMAPS, colormapStops, getLUT, heatmapRGBA } from './colormaps';
import { contourPaths } from './contours';
import { RUNNERS, RACE_COLORS, initOptState, stepOptimizer, predictNext } from './optimizers';

describe('landscape grids', () => {
	it.each(PRESETS.map((p) => [p.id] as const))('%s: finite, positive, log-normalizable', (id) => {
		const preset = presetById(id);
		const grid = computeGrid(preset);
		expect(grid.values.length).toBe(GRID_RES * GRID_RES);
		// Loss stays positive everywhere the color mapping can see it — the
		// log(loss + 0.001) mapping needs that.
		let min = Infinity;
		for (const v of grid.values) {
			expect(Number.isFinite(v)).toBe(true);
			if (v < min) min = v;
		}
		expect(min).toBeGreaterThan(-0.001);
		expect(grid.visMin).toBeLessThan(grid.visMax);
		expect(grid.logMin).toBeLessThan(grid.logMax);
		// The extended skirt reaches 20% past the visible window.
		expect(grid.extXMin).toBeLessThan(preset.xMin);
		expect(grid.extYMax).toBeGreaterThan(preset.yMax);
		// Normalized log loss spans [0, 1] over the visible extrema.
		expect(normalizedLogLoss(grid, grid.visMin)).toBeCloseTo(0, 6);
		expect(normalizedLogLoss(grid, grid.visMax)).toBeCloseTo(1, 6);
	});

	it('keeps the 700:540 span ratio per preset so angles survive projection', () => {
		for (const p of PRESETS) {
			expect((p.xMax - p.xMin) / (p.yMax - p.yMin)).toBeCloseTo(700 / 540, 2);
		}
	});

	it('central-difference gradient matches the analytic saddle', () => {
		const saddle = presetById('saddle');
		// f = 0.28x² − 0.5y² + 0.05y⁴ + 1.4 → ∇ = (0.56x, −y + 0.2y³)
		const [gx, gy] = gradAt(saddle, 1.5, -2);
		expect(gx).toBeCloseTo(0.56 * 1.5, 4);
		expect(gy).toBeCloseTo(2 - 0.2 * 8, 4);
	});

	it('field max magnitude is positive and finite', () => {
		for (const p of PRESETS) {
			const m = fieldMaxMag(p);
			expect(m).toBeGreaterThan(0);
			expect(Number.isFinite(m)).toBe(true);
		}
	});
});

describe('contours', () => {
	it('produces ~15 log-spaced rings that project into the viewbox frame', () => {
		const preset = presetById('basins');
		const grid = computeGrid(preset);
		const thresholds = contourThresholds(grid);
		expect(thresholds.length).toBe(15); // 16 bands → 15 dividing levels
		for (let i = 1; i < thresholds.length; i++) {
			expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1]);
		}
		const sx = (x: number) => ((x - preset.xMin) / (preset.xMax - preset.xMin)) * 700;
		const sy = (y: number) => 540 - ((y - preset.yMin) / (preset.yMax - preset.yMin)) * 540;
		const paths = contourPaths(grid, (x, y) => [sx(x), sy(y)]);
		expect(paths.length).toBeGreaterThan(4);
		for (const d of paths) {
			expect(d.startsWith('M')).toBe(true);
			expect(d.includes('Z')).toBe(true);
		}
	});
});

describe('colormaps', () => {
	it('bakes 256-entry LUTs for all three maps', () => {
		for (const cm of COLORMAPS) {
			const lut = getLUT(cm);
			expect(lut.length).toBe(256 * 3);
			// Sequential maps: the two ends differ clearly in luminance.
			const lum = (o: number) => 0.299 * lut[o] + 0.587 * lut[o + 1] + 0.114 * lut[o + 2];
			expect(Math.abs(lum(0) - lum(255 * 3))).toBeGreaterThan(60);
		}
	});

	it('theme tone curves: dark = bright basin at ~0.85 alpha, light ramps alpha down', () => {
		const grid = computeGrid(presetById('basins'));
		const dark = heatmapRGBA(grid, 'viridis', 'dark');
		const light = heatmapRGBA(grid, 'viridis', 'light');
		expect(dark.length).toBe(grid.res * grid.res * 4);
		// Dark theme: constant alpha 217 everywhere.
		for (let i = 3; i < dark.length; i += 4) expect(dark[i]).toBe(217);
		// Light theme: alpha spans the ramp — near-opaque basins, faint walls.
		let lo = 255;
		let hi = 0;
		for (let i = 3; i < light.length; i += 4) {
			if (light[i] < lo) lo = light[i];
			if (light[i] > hi) hi = light[i];
		}
		expect(hi).toBeGreaterThan(220);
		expect(lo).toBeLessThan(60);
	});

	it('gradient stops reverse between themes', () => {
		const darkStops = colormapStops('inferno', 4, 'dark').split(', ');
		const lightStops = colormapStops('inferno', 4, 'light').split(', ');
		expect(darkStops[0]).toBe(lightStops[lightStops.length - 1]);
	});
});

describe('optimizers', () => {
	it('declares the five racers with the GradientDescent race colors', () => {
		expect(RUNNERS.map((r) => r.id)).toEqual(['gd', 'momentum', 'adam', 'adamw', 'lion']);
		expect(RACE_COLORS.gd).toBe('#94a3b8');
		expect(RACE_COLORS.momentum).toBe('#a855f7');
		expect(RACE_COLORS.adam).toBe('#f43f5e');
		expect(RACE_COLORS.adamw).toBe('#ef4444');
		expect(RACE_COLORS.lion).toBe('#eab308');
	});

	it('gd: θ ← θ − γ∇ℒ', () => {
		const st = initOptState();
		const next = stepOptimizer('gd', 1, 2, 0.5, -0.25, st, 0.1, 0);
		expect(next.x).toBeCloseTo(0.95, 10);
		expect(next.y).toBeCloseTo(2.025, 10);
	});

	it('momentum: velocity accumulates with μ = 0.9, γ not folded in', () => {
		const st = initOptState();
		stepOptimizer('momentum', 0, 0, 1, 0, st, 0.1, 0);
		const next = stepOptimizer('momentum', -0.1, 0, 1, 0, st, 0.1, 0);
		// v = 0.9·1 + 1 = 1.9 → step 0.19
		expect(st.vx).toBeCloseTo(1.9, 10);
		expect(next.x).toBeCloseTo(-0.29, 10);
	});

	it('adamw pulls toward zero with decoupled λ; adam does not', () => {
		const p = 3;
		const g = 0; // zero gradient isolates the decay term
		const stW = initOptState();
		const stA = initOptState();
		const w = stepOptimizer('adamw', p, p, g, g, stW, 0.1, 0.3);
		const a = stepOptimizer('adam', p, p, g, g, stA, 0.1, 0.3);
		expect(w.x).toBeCloseTo(p - 0.1 * 0.3 * p, 10);
		expect(a.x).toBeCloseTo(p, 10);
	});

	it('lion: every step has magnitude γ per axis', () => {
		const st = initOptState();
		const next = stepOptimizer('lion', 0, 0, 0.001, -7, st, 0.05, 0);
		expect(next.x).toBeCloseTo(-0.05, 10);
		expect(next.y).toBeCloseTo(0.05, 10);
	});

	it('predictNext never mutates the live state', () => {
		const st = initOptState();
		stepOptimizer('adam', 0, 0, 1, 1, st, 0.1, 0);
		const snapshot = { ...st };
		predictNext('adam', 1, 1, 0.5, 0.5, st, 0.1, 0);
		expect(st).toEqual(snapshot);
	});
});
