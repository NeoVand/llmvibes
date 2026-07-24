<script lang="ts">
	// RoPE made literal: position becomes rotation. Panel A spins a query pair by
	// position × frequency (several bands, each at its own geometrically-spaced
	// rate). Panel B shows the payoff — shift a query and a key by the same k and
	// they spin together, but the angle BETWEEN them (and so q·k ∝ cos θ) never
	// moves. Everything is closed-form; nothing random, safe to prerender.
	import { RotateCw } from 'lucide-svelte';
	import Slider from '../ui/Slider.svelte';
	import Katex from '../ui/Math.svelte';

	const uid = $props.id();

	const CX = 160;
	const CY = 160;
	const deg = (rad: number) => (rad * 180) / Math.PI;
	const pt = (ang: number, r: number): [number, number] => [
		CX + r * Math.cos(ang),
		CY - r * Math.sin(ang)
	];
	// angle wedge sampled as a polyline — no arc-flag guesswork
	function arcPath(a0: number, a1: number, r: number, steps = 24): string {
		let d = '';
		for (let i = 0; i <= steps; i++) {
			const a = a0 + ((a1 - a0) * i) / steps;
			const [px, py] = pt(a, r);
			d += `${i === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)} `;
		}
		return d.trim();
	}

	// ── Panel A: rotation by position ───────────────────────────────────────────
	interface Band {
		id: string;
		theta: number;
		r: number;
		color: string;
		marker: string;
		primary?: boolean;
	}
	let m = $state(8);
	const bandsA: Band[] = [
		{ id: 'low', theta: 0.12, r: 128, color: '#2563eb', marker: 'blue' },
		{
			id: 'mid',
			theta: 0.4,
			r: 96,
			color: 'var(--color-important)',
			marker: 'accent',
			primary: true
		},
		{ id: 'high', theta: 0.95, r: 60, color: '#a855f7', marker: 'violet' }
	];

	const geomA = $derived(
		bandsA.map((b) => {
			const ang = m * b.theta;
			const trail: { x: number; y: number; o: number }[] = [];
			for (let j = 1; j <= 6; j++) {
				const p = m - j;
				if (p < 0) break;
				const [tx, ty] = pt(p * b.theta, b.r);
				trail.push({ x: tx, y: ty, o: 0.3 * (1 - (j - 1) / 6) });
			}
			const [tipX, tipY] = pt(ang, b.r);
			return { ...b, ang, tipX, tipY, trail };
		})
	);
	const midAng = $derived((geomA.find((b) => b.id === 'mid')?.ang ?? 0) % (2 * Math.PI));

	// ── Panel B: only the relative position matters ─────────────────────────────
	const FREQ_B = 0.35;
	const M0 = 5;
	const N0 = 2;
	let k = $state(0);
	const geomB = $derived.by(() => {
		const mm = M0 + k;
		const nn = N0 + k;
		const qAng = mm * FREQ_B;
		const kAng = nn * FREQ_B;
		const R = 120;
		const [qx, qy] = pt(qAng, R);
		const [kx, ky] = pt(kAng, R);
		const rel = (mm - nn) * FREQ_B;
		const mid = (qAng + kAng) / 2;
		const [lx, ly] = pt(mid, 70);
		return {
			mm,
			nn,
			qx,
			qy,
			kx,
			ky,
			rel,
			cos: Math.cos(rel),
			arc: arcPath(kAng, qAng, 46),
			labelX: lx,
			labelY: ly
		};
	});
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div
		class="mb-4 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
		style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
	>
		<RotateCw size={16} strokeWidth={2.5} />
		<span>RoPE — position as rotation</span>
	</div>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- ── PANEL A ─────────────────────────────────────────────────────────── -->
		<div>
			<h5
				class="mb-1 text-[12.5px] font-semibold"
				style="color: var(--color-text); font-family: var(--font-heading);"
			>
				rotation by position
			</h5>
			<p class="mb-2 text-[11.5px] leading-snug" style="color: var(--color-text-muted);">
				each dimension-pair spins at its own rate — high-frequency fast, low-frequency slow.
			</p>
			<svg
				viewBox="0 0 320 320"
				class="w-full"
				role="img"
				aria-label="Three concentric rings; on each an arrow rotates from the centre by an angle equal to the token position times that ring's frequency, with a fading trail of earlier positions. Higher-frequency rings sweep further for the same position."
			>
				<defs>
					<marker
						id="{uid}-blue"
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerWidth="6"
						markerHeight="6"
						orient="auto"
					>
						<path d="M0,1 L9,5 L0,9 Z" fill="#2563eb" />
					</marker>
					<marker
						id="{uid}-accent"
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerWidth="6.5"
						markerHeight="6.5"
						orient="auto"
					>
						<path d="M0,1 L9,5 L0,9 Z" fill="var(--color-important)" />
					</marker>
					<marker
						id="{uid}-violet"
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerWidth="6"
						markerHeight="6"
						orient="auto"
					>
						<path d="M0,1 L9,5 L0,9 Z" fill="#a855f7" />
					</marker>
				</defs>

				<!-- axes -->
				<line
					x1="20"
					y1={CY}
					x2="300"
					y2={CY}
					stroke="var(--color-border-light)"
					stroke-width="1"
				/>
				<line
					x1={CX}
					y1="20"
					x2={CX}
					y2="300"
					stroke="var(--color-border-light)"
					stroke-width="1"
				/>

				<!-- rings -->
				{#each bandsA as b (b.id)}
					<circle
						cx={CX}
						cy={CY}
						r={b.r}
						fill="none"
						stroke="var(--color-border)"
						stroke-width="1"
						stroke-dasharray={b.primary ? 'none' : '3 4'}
						opacity={b.primary ? 0.8 : 0.5}
					/>
				{/each}

				<!-- trails + current arrows -->
				{#each geomA as b (b.id)}
					{#each b.trail as t, i (i)}
						<circle cx={t.x} cy={t.y} r={b.primary ? 3 : 2} fill={b.color} opacity={t.o} />
					{/each}
					<line
						x1={CX}
						y1={CY}
						x2={b.tipX}
						y2={b.tipY}
						stroke={b.color}
						stroke-width={b.primary ? 3 : 1.8}
						marker-end="url(#{uid}-{b.marker})"
					/>
					<circle cx={b.tipX} cy={b.tipY} r={b.primary ? 3.5 : 2.5} fill={b.color} />
				{/each}

				<!-- centre + readout -->
				<circle cx={CX} cy={CY} r="3" fill="var(--color-text-muted)" />
				<text
					x={CX}
					y="26"
					text-anchor="middle"
					font-size="12"
					font-family="var(--font-mono)"
					fill="var(--color-text)"
				>
					m = {m} · mθ = {deg(midAng).toFixed(0)}°
				</text>
			</svg>
			<div class="mt-2">
				<Slider label="position m" bind:value={m} min={0} max={32} step={1} tone="violet" />
			</div>
		</div>

		<!-- ── PANEL B ─────────────────────────────────────────────────────────── -->
		<div>
			<h5
				class="mb-1 text-[12.5px] font-semibold"
				style="color: var(--color-text); font-family: var(--font-heading);"
			>
				only the relative position matters
			</h5>
			<p class="mb-2 text-[11.5px] leading-snug" style="color: var(--color-text-muted);">
				shift both q and k by the same k — they spin together, the angle between them holds.
			</p>
			<svg
				viewBox="0 0 320 320"
				class="w-full"
				role="img"
				aria-label="A single ring with a query arrow and a key arrow. Shifting both positions by the same amount rotates both arrows together while the arc between them, and so their dot product, stays fixed."
			>
				<defs>
					<marker
						id="{uid}-qhead"
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerWidth="6.5"
						markerHeight="6.5"
						orient="auto"
					>
						<path d="M0,1 L9,5 L0,9 Z" fill="var(--color-important)" />
					</marker>
					<marker
						id="{uid}-khead"
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerWidth="6.5"
						markerHeight="6.5"
						orient="auto"
					>
						<path d="M0,1 L9,5 L0,9 Z" fill="#2563eb" />
					</marker>
				</defs>

				<!-- axes + ring -->
				<line
					x1="20"
					y1={CY}
					x2="300"
					y2={CY}
					stroke="var(--color-border-light)"
					stroke-width="1"
				/>
				<line
					x1={CX}
					y1="20"
					x2={CX}
					y2="300"
					stroke="var(--color-border-light)"
					stroke-width="1"
				/>
				<circle cx={CX} cy={CY} r="120" fill="none" stroke="var(--color-border)" stroke-width="1" />

				<!-- the fixed angle between q and k -->
				<path
					d={geomB.arc}
					fill="none"
					stroke="var(--color-text)"
					stroke-width="1.6"
					opacity="0.55"
				/>
				<text
					x={geomB.labelX}
					y={geomB.labelY}
					text-anchor="middle"
					font-size="12"
					font-family="var(--font-mono)"
					fill="var(--color-text)"
				>
					θ = {deg(geomB.rel).toFixed(0)}°
				</text>

				<!-- key arrow (blue) -->
				<line
					x1={CX}
					y1={CY}
					x2={geomB.kx}
					y2={geomB.ky}
					stroke="#2563eb"
					stroke-width="2.6"
					marker-end="url(#{uid}-khead)"
				/>
				<text
					x={geomB.kx + (geomB.kx >= CX ? 8 : -8)}
					y={geomB.ky + (geomB.ky >= CY ? 14 : -6)}
					text-anchor={geomB.kx >= CX ? 'start' : 'end'}
					font-size="12"
					font-family="var(--font-mono)"
					fill="#2563eb"
				>
					k @ n={geomB.nn}
				</text>

				<!-- query arrow (accent) -->
				<line
					x1={CX}
					y1={CY}
					x2={geomB.qx}
					y2={geomB.qy}
					stroke="var(--color-important)"
					stroke-width="2.6"
					marker-end="url(#{uid}-qhead)"
				/>
				<text
					x={geomB.qx + (geomB.qx >= CX ? 8 : -8)}
					y={geomB.qy + (geomB.qy >= CY ? 14 : -6)}
					text-anchor={geomB.qx >= CX ? 'start' : 'end'}
					font-size="12"
					font-family="var(--font-mono)"
					fill="var(--color-important)"
				>
					q @ m={geomB.mm}
				</text>

				<circle cx={CX} cy={CY} r="3" fill="var(--color-text-muted)" />
			</svg>
			<div class="mt-2">
				<Slider label="shift both by k" bind:value={k} min={0} max={24} step={1} tone="blue" />
			</div>
			<div
				class="mt-2 rounded-md px-3 py-2 text-center text-[12.5px]"
				style="background: var(--color-surface-hover); color: var(--color-text); font-family: var(--font-mono);"
			>
				m − n = {geomB.mm - geomB.nn} (fixed) · q·k ∝ cos(θ) =
				<strong style="color: var(--color-important);">{geomB.cos.toFixed(3)}</strong>
			</div>
		</div>
	</div>

	<div class="mt-4 text-center">
		<Katex
			display
			tex={String.raw`\big(R(m\theta)\,q\big)^{\!\top}\big(R(n\theta)\,k\big) \;=\; q^{\top} R\big((m-n)\theta\big)\,k`}
		/>
		<p class="mt-1 text-[11.5px] leading-relaxed" style="color: var(--color-text-muted);">
			Rotating q and k by their own positions makes qᵀk depend only on the gap (m − n) — attention
			scores read relative position, not absolute.
		</p>
	</div>
</div>
