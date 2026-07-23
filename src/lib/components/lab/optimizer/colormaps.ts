/**
 * Heatmap colorization — a faithful port of the GradientDescent project's
 * lossGrid.ts rendering: real d3-scale-chromatic sequential interpolators
 * baked into 256-entry LUTs, loss mapped in log space, and two theme-tuned
 * tone curves (dark: bright = low loss at ~0.85 alpha so the basin glows on
 * the near-black plot; light: "dark basins on light" with the far field
 * fading toward transparent so the plot stays bright and airy).
 *
 * Pure byte-pushing — no DOM. The component wraps the RGBA buffer into an
 * ImageData/canvas inside an effect, so this stays SSR-safe and testable.
 */

import {
	interpolateViridis,
	interpolateInferno,
	interpolateCubehelixDefault
} from 'd3-scale-chromatic';
import { LOG_EPS, type LossGrid } from './landscape';

export type ColormapId = 'cubehelix' | 'viridis' | 'inferno';

/** Offered order — cubehelix is the default. All are sequential (monotone
 *  luminance): rainbow maps are excluded on purpose, their end color
 *  reappears near the basin and the scale reads as circular. */
export const COLORMAPS: ColormapId[] = ['cubehelix', 'viridis', 'inferno'];

const INTERPOLATORS: Record<ColormapId, (t: number) => string> = {
	cubehelix: interpolateCubehelixDefault,
	viridis: interpolateViridis,
	inferno: interpolateInferno
};

const LUT_SIZE = 256;
// One 256-entry byte LUT per colormap, built on first use and keyed by name
// so a colormap switch can never return stale bytes.
const lutCache: Partial<Record<ColormapId, Uint8ClampedArray>> = {};

/** Parse the interpolator's output — hex `#rrggbb` or `rgb(r, g, b)`. */
function parseColor(s: string): [number, number, number] {
	if (s.startsWith('#')) {
		return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
	}
	const m = s.match(/[\d.]+/g);
	return m ? [Math.round(+m[0]), Math.round(+m[1]), Math.round(+m[2])] : [128, 128, 128];
}

export function getLUT(cmap: ColormapId): Uint8ClampedArray {
	let lut = lutCache[cmap];
	if (!lut) {
		lut = new Uint8ClampedArray(LUT_SIZE * 3);
		const interp = INTERPOLATORS[cmap] ?? interpolateCubehelixDefault;
		for (let k = 0; k < LUT_SIZE; k++) {
			const [r, g, b] = parseColor(interp(k / (LUT_SIZE - 1)));
			lut[k * 3] = r;
			lut[k * 3 + 1] = g;
			lut[k * 3 + 2] = b;
		}
		lutCache[cmap] = lut;
	}
	return lut;
}

/**
 * CSS color stops for a colormap — for the swatch buttons and the legend
 * bar. In light mode the tone is reversed (dark = low loss) to match the
 * "dark basins on light" heatmap, so the bar reads in the same direction
 * the heatmap does.
 */
export function colormapStops(
	cmap: ColormapId,
	steps = 8,
	theme: 'light' | 'dark' = 'dark'
): string {
	const interp = INTERPOLATORS[cmap] ?? interpolateCubehelixDefault;
	const light = theme === 'light';
	const parts: string[] = [];
	for (let k = 0; k <= steps; k++) {
		const s = k / steps;
		parts.push(interp(light ? 1 - s : s));
	}
	return parts.join(', ');
}

/**
 * Colorize the grid into an RGBA buffer, one pixel per cell, row 0 at the
 * TOP of the plot (canvas y points down, β points up).
 *
 *  - dark:  LUT reversed (basin → bright end), constant alpha ≈ 0.85
 *  - light: LUT forward (basin → rich/dark end), alpha ramps ~0.93 at the
 *    basin → ~0.15 in the far field so high loss melts into the white page
 */
export function heatmapRGBA(
	grid: LossGrid,
	cmap: ColormapId,
	theme: 'light' | 'dark'
): Uint8ClampedArray {
	const { res, values, logMin, logMax } = grid;
	const out = new Uint8ClampedArray(res * res * 4);
	const lut = getLUT(cmap);
	const logSpan = logMax - logMin || 1;
	const light = theme === 'light';

	for (let j = 0; j < res; j++) {
		const row = res - 1 - j;
		for (let i = 0; i < res; i++) {
			let t = (Math.log(Math.max(values[j * res + i] + LOG_EPS, 1e-9)) - logMin) / logSpan;
			t = t < 0 ? 0 : t > 1 ? 1 : t;
			const k = light
				? Math.round(t * (LUT_SIZE - 1)) // day: basin → dark/rich end
				: Math.round((1 - t) * (LUT_SIZE - 1)); // dark: basin → bright end
			const a = light
				? Math.round(236 - t * 200) // ~0.93 at basin → ~0.14 far field
				: 217; // ≈ 0.85
			const o = (row * res + i) * 4;
			out[o] = lut[k * 3];
			out[o + 1] = lut[k * 3 + 1];
			out[o + 2] = lut[k * 3 + 2];
			out[o + 3] = a;
		}
	}
	return out;
}
