<script lang="ts">
	// The RL loop as a living diagram: π_θ writes → a sample exists → a reward
	// scores it → a gradient nudges the weights, forever around the circle. A
	// dashed KL leash ties π_θ to a frozen π_ref so the loop can't wander off.
	// The reward-source switch is the arc of Parts 9–11: human preferences,
	// then a learned reward model (watch the Goodhart drift meter fill), then
	// a verifier whose ground truth can't be gamed.
	import { BadgeCheck, Cpu, Orbit, Pause, Play, RotateCcw, StepForward, User } from 'lucide-svelte';
	import Slider from '../ui/Slider.svelte';

	type Source = 'human' | 'rm' | 'verifier';

	// ── the cycle geometry: four stations on an ellipse, pulse phase p ∈ [0,4) ──
	const CX = 430;
	const CY = 200;
	const RX = 270;
	const RY = 112;
	const SEG_PER_SEC = 0.65; // segments per second at 1× speed

	function at(a: number): { x: number; y: number } {
		return { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) };
	}
	// phase → ellipse angle: p=0 left (π_θ), 1 top (sample), 2 right (reward), 3 bottom (update)
	function angleOf(p: number): number {
		return Math.PI + (p * Math.PI) / 2;
	}

	const STATIONS = [at(angleOf(0)), at(angleOf(1)), at(angleOf(2)), at(angleOf(3))];

	// connector arcs between stations, sampled as polylines with angular padding
	function connector(seg: number): string {
		const a0 = angleOf(seg + 0.22);
		const a1 = angleOf(seg + 0.78);
		const pts: string[] = [];
		for (let k = 0; k <= 16; k++) {
			const q = at(a0 + ((a1 - a0) * k) / 16);
			pts.push(`${k === 0 ? 'M' : 'L'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`);
		}
		return pts.join(' ');
	}
	const CONNECTORS = [connector(0), connector(1), connector(2), connector(3)];

	const SOURCES: Record<
		Source,
		{ label: string; sub: string; color: string; score: string; part: string }
	> = {
		human: {
			label: 'human preference',
			sub: 'a person picks the better one',
			color: '#a855f7',
			score: 'a human compares two stories and picks this one: +1',
			part: 'Part 9'
		},
		rm: {
			label: 'reward model',
			sub: 'a learned judge, imitating humans',
			color: '#f59e0b',
			score: 'the reward model scores it: +0.8',
			part: 'Part 10'
		},
		verifier: {
			label: 'verifier',
			sub: 'ground truth, checked by code',
			color: 'var(--color-tip)',
			score: 'the verifier checks the result: +1 — it is simply true',
			part: 'Part 11'
		}
	};

	let phase = $state(0); // pulse position on the loop
	let playing = $state(false);
	let speed = $state(1);
	let source = $state<Source>('human');
	let episodes = $state(0);
	let avg = $state(0);
	let drift = $state(0); // Goodhart drift, RM only, 0..1

	const seg = $derived(Math.floor(phase) % 4);
	const pulse = $derived(at(angleOf(phase)));
	const src = $derived(SOURCES[source]);
	const gamed = $derived(source === 'rm' && drift > 0.6);

	// station glow: lit for the half-segment after the pulse arrives
	function litAmount(i: number): number {
		const d = (phase - i + 4) % 4;
		return d < 0.5 ? 1 - d / 0.5 : 0;
	}
	const lit = $derived([litAmount(0), litAmount(1), litAmount(2), litAmount(3)]);

	const narration = $derived.by(() => {
		if (seg === 0) return 'the policy π_θ writes a story, token by token';
		if (seg === 1) return 'the sample is finished — send it off to be scored';
		if (seg === 2) {
			if (source === 'rm' && gamed)
				return 'the reward model says +1.4 — but the story actually got worse';
			return src.score;
		}
		return 'update: nudge weights toward what scored well — the KL leash holds π_θ near π_ref';
	});

	// fake-but-coherent reward: drifts upward; fastest with the verifier; with
	// the RM it keeps climbing right past honest — that's the drift meter's job.
	function completeEpisode() {
		episodes += 1;
		const wob = Math.sin(episodes * 2.7) * 0.04;
		let r: number;
		if (source === 'verifier') r = Math.min(1, 1 - Math.exp(-episodes / 4)) + wob;
		else if (source === 'human') r = Math.min(0.85, 1 - Math.exp(-episodes / 10)) + wob;
		else {
			r = Math.min(1.6, 0.3 + episodes * 0.07) + wob;
			drift = Math.min(1, drift + 0.055);
		}
		avg = episodes === 1 ? r : avg + (r - avg) / Math.min(episodes, 8);
	}

	function move(dp: number) {
		let p = phase + dp;
		if (p >= 4) {
			p -= 4;
			completeEpisode();
		}
		phase = p;
	}

	// animation loop lives in an $effect: rAF only while playing, always cleaned up
	$effect(() => {
		if (!playing) return;
		let last: number | null = null;
		let raf = requestAnimationFrame(function frame(now: number) {
			if (last !== null) {
				const dt = Math.min((now - last) / 1000, 0.1);
				move(dt * speed * SEG_PER_SEC);
			}
			last = now;
			raf = requestAnimationFrame(frame);
		});
		return () => cancelAnimationFrame(raf);
	});

	function togglePlay() {
		playing = !playing;
	}
	function stepOnce() {
		playing = false;
		const next = Math.floor(phase + 1e-4) + 1;
		if (next >= 4) {
			phase = 0;
			completeEpisode();
		} else {
			phase = next;
		}
	}
	function reset() {
		playing = false;
		phase = 0;
		episodes = 0;
		avg = 0;
		drift = 0;
	}
	function setSource(s: Source) {
		if (source === s) return;
		source = s;
		drift = 0; // switching judges resets the Goodhart meter
	}

	// reward gauge needle: avg 0..1.6 mapped to −80°..+80°
	const needleDeg = $derived(-80 + Math.max(0, Math.min(1.6, avg)) * 100);
</script>

<div
	class="my-6 rounded-xl border p-5"
	style="border-color: var(--color-border); background: var(--color-surface);"
>
	<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
			style="color: var(--color-important); font-family: var(--font-heading); letter-spacing: 0.08em;"
		>
			<Orbit size={16} strokeWidth={2.5} />
			<span>The reinforcement-learning loop</span>
		</div>
		<div class="flex flex-wrap gap-2" style="font-family: var(--font-mono);">
			<span class="chip" style="--c: var(--color-primary);">episodes {episodes}</span>
			<span class="chip" style="--c: {src.color};">avg reward {avg.toFixed(2)}</span>
		</div>
	</div>
	<p class="mb-3 text-xs" style="color: var(--color-text-muted);">
		Pretraining copies text. RL closes a loop: write → get judged → move the weights → write again.
		The only thing that changes across Parts 9–11 is who holds the reward.
	</p>

	<!-- ── reward source switch + drift meter ── -->
	<div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
		<div
			class="inline-flex flex-wrap rounded-lg border p-0.5"
			style="border-color: var(--color-border); background: var(--color-surface-hover);"
		>
			<button
				class="seg"
				class:on={source === 'human'}
				style="--sc: #a855f7;"
				onclick={() => setSource('human')}
			>
				<User size={12} /> human preference
			</button>
			<button
				class="seg"
				class:on={source === 'rm'}
				style="--sc: #f59e0b;"
				onclick={() => setSource('rm')}
			>
				<Cpu size={12} /> reward model
			</button>
			<button
				class="seg"
				class:on={source === 'verifier'}
				style="--sc: var(--color-tip);"
				onclick={() => setSource('verifier')}
			>
				<BadgeCheck size={12} /> verifier
			</button>
		</div>
		{#if source === 'rm'}
			<div class="flex min-w-36 items-center gap-2">
				<span
					class="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase"
					style="color: {gamed ? 'var(--color-challenge)' : 'var(--color-text-muted)'};"
				>
					{gamed ? '⚠ being gamed' : 'goodhart drift'}
				</span>
				<div
					class="h-2 flex-1 overflow-hidden rounded-full"
					style="background: var(--color-bg-tertiary); min-width: 3rem;"
				>
					<div
						class="h-full rounded-full"
						style="width: {drift *
							100}%; background: linear-gradient(90deg, #f59e0b, var(--color-challenge)); transition: width 300ms ease;"
					></div>
				</div>
			</div>
		{/if}
	</div>

	<!-- ── controls ── -->
	<div class="mb-2 flex flex-wrap items-center gap-2">
		<button
			class="ctl-btn"
			onclick={reset}
			disabled={episodes === 0 && phase === 0}
			aria-label="reset"
		>
			<RotateCcw size={14} />
		</button>
		<button class="ctl-btn play" onclick={togglePlay} aria-label={playing ? 'pause' : 'play'}>
			{#if playing}<Pause size={14} />{:else}<Play size={14} />{/if}
		</button>
		<button class="ctl-btn" onclick={stepOnce} aria-label="advance one station">
			<StepForward size={14} />
		</button>
		<div class="ml-2 max-w-56 min-w-32 flex-1">
			<Slider
				label="speed"
				bind:value={speed}
				min={0.25}
				max={3}
				step={0.25}
				tone="teal"
				format={(v) => v.toFixed(2).replace(/\.?0+$/, '') + '×'}
			/>
		</div>
	</div>

	<!-- ── the loop ── -->
	<svg viewBox="0 0 860 420" class="w-full" role="img">
		<title>The RL cycle: policy, sample, reward, update, with a KL leash to a reference model</title
		>
		<defs>
			<marker
				id="rl-arrow"
				viewBox="0 0 10 10"
				refX="8"
				refY="5"
				markerWidth="7"
				markerHeight="7"
				orient="auto-start-reverse"
			>
				<path d="M0 0 L10 5 L0 10 z" fill="var(--color-text-muted)" />
			</marker>
		</defs>

		<!-- connectors, clockwise -->
		{#each CONNECTORS as d, ci (ci)}
			<path
				{d}
				fill="none"
				stroke="var(--color-border)"
				stroke-width="2"
				marker-end="url(#rl-arrow)"
			/>
		{/each}

		<!-- KL leash: dashed rope from π_θ down to the frozen reference -->
		<path
			d="M {STATIONS[0].x - 34} {STATIONS[0].y + 24} Q {STATIONS[0].x - 60} {STATIONS[0].y +
				90} {STATIONS[0].x - 40} {STATIONS[0].y + 138}"
			fill="none"
			stroke="var(--color-text-muted)"
			stroke-width="2"
			stroke-dasharray="6 5"
			opacity="0.7"
		/>
		<text
			x={STATIONS[0].x - 66}
			y={STATIONS[0].y + 92}
			text-anchor="end"
			class="mono-label"
			style="fill: var(--color-text-secondary);">β·KL</text
		>
		<g>
			<rect
				x={STATIONS[0].x - 78}
				y={STATIONS[0].y + 138}
				width="76"
				height="36"
				rx="8"
				fill="var(--color-surface-hover)"
				stroke="var(--color-border)"
				stroke-width="1.5"
				stroke-dasharray="4 3"
			/>
			<text
				x={STATIONS[0].x - 40}
				y={STATIONS[0].y + 156}
				text-anchor="middle"
				class="pi-label"
				style="fill: var(--color-text-secondary); font-size: 13px;">π_ref</text
			>
			<text x={STATIONS[0].x - 40} y={STATIONS[0].y + 169} text-anchor="middle" class="sub-label"
				>frozen anchor</text
			>
		</g>

		<!-- station 0: the policy, a chip stack -->
		<g class="station" style="--st: var(--color-primary); --glow: {lit[0]};">
			<rect
				class="halo"
				x={STATIONS[0].x - 62}
				y={STATIONS[0].y - 46}
				width="124"
				height="92"
				rx="16"
				fill="color-mix(in srgb, var(--color-primary) 14%, transparent)"
			/>
			<rect
				x={STATIONS[0].x - 40}
				y={STATIONS[0].y - 34}
				width="80"
				height="34"
				rx="8"
				fill="var(--color-surface-hover)"
				stroke="var(--color-border)"
				opacity="0.5"
			/>
			<rect
				x={STATIONS[0].x - 45}
				y={STATIONS[0].y - 26}
				width="90"
				height="36"
				rx="8"
				fill="var(--color-surface-hover)"
				stroke="var(--color-border)"
				opacity="0.75"
			/>
			<rect
				class="box"
				x={STATIONS[0].x - 50}
				y={STATIONS[0].y - 18}
				width="100"
				height="40"
				rx="8"
				fill="var(--color-surface)"
				stroke="var(--color-border)"
				stroke-width="1.5"
			/>
			<text
				x={STATIONS[0].x}
				y={STATIONS[0].y + 8}
				text-anchor="middle"
				class="pi-label"
				style="fill: var(--color-primary); font-size: 16px;">π_θ</text
			>
			<text x={STATIONS[0].x} y={STATIONS[0].y + 38} text-anchor="middle" class="st-label"
				>policy</text
			>
		</g>

		<!-- station 1: the sample, a story card -->
		<g class="station" style="--st: #2563eb; --glow: {lit[1]};">
			<rect
				class="halo"
				x={STATIONS[1].x - 52}
				y={STATIONS[1].y - 44}
				width="104"
				height="88"
				rx="16"
				fill="color-mix(in srgb, #2563eb 14%, transparent)"
			/>
			<rect
				class="box"
				x={STATIONS[1].x - 34}
				y={STATIONS[1].y - 30}
				width="68"
				height="52"
				rx="7"
				fill="var(--color-surface)"
				stroke="var(--color-border)"
				stroke-width="1.5"
			/>
			{#each [0, 1, 2, 3] as li (li)}
				<rect
					x={STATIONS[1].x - 26}
					y={STATIONS[1].y - 21 + li * 10}
					width={li === 3 ? 30 : 52}
					height="4"
					rx="2"
					fill="color-mix(in srgb, #2563eb 35%, var(--color-border))"
				/>
			{/each}
			<text x={STATIONS[1].x} y={STATIONS[1].y + 38} text-anchor="middle" class="st-label"
				>sample — a story, a game</text
			>
		</g>

		<!-- station 2: the reward, a gauge whose owner changes -->
		<g class="station" style="--st: {src.color}; --glow: {lit[2]};">
			<rect
				class="halo"
				x={STATIONS[2].x - 58}
				y={STATIONS[2].y - 46}
				width="116"
				height="92"
				rx="16"
				fill="color-mix(in srgb, {src.color} 14%, transparent)"
			/>
			<rect
				class="box"
				x={STATIONS[2].x - 44}
				y={STATIONS[2].y - 32}
				width="88"
				height="56"
				rx="8"
				fill="var(--color-surface)"
				stroke="var(--color-border)"
				stroke-width="1.5"
			/>
			<path
				d="M {STATIONS[2].x - 28} {STATIONS[2].y + 12} A 28 28 0 0 1 {STATIONS[2].x +
					28} {STATIONS[2].y + 12}"
				fill="none"
				stroke="color-mix(in srgb, {src.color} 40%, var(--color-border))"
				stroke-width="5"
				stroke-linecap="round"
			/>
			<g
				style="transform: rotate({needleDeg}deg); transform-origin: {STATIONS[2].x}px {STATIONS[2]
					.y + 12}px; transition: transform 400ms ease;"
			>
				<line
					x1={STATIONS[2].x}
					y1={STATIONS[2].y + 12}
					x2={STATIONS[2].x}
					y2={STATIONS[2].y - 14}
					stroke={src.color}
					stroke-width="3"
					stroke-linecap="round"
				/>
			</g>
			<circle cx={STATIONS[2].x} cy={STATIONS[2].y + 12} r="4" fill={src.color} />
			{#if source === 'rm'}
				<text
					x={STATIONS[2].x + 34}
					y={STATIONS[2].y - 20}
					text-anchor="middle"
					style="font-size: 13px;">⚠</text
				>
			{/if}
			<text
				x={STATIONS[2].x}
				y={STATIONS[2].y + 40}
				text-anchor="middle"
				class="st-label"
				style="fill: {src.color};">{src.label}</text
			>
			<text x={STATIONS[2].x} y={STATIONS[2].y + 54} text-anchor="middle" class="sub-label"
				>{src.sub}</text
			>
		</g>

		<!-- station 3: the update, ∇ flowing back -->
		<g class="station" style="--st: #14b8a6; --glow: {lit[3]};">
			<rect
				class="halo"
				x={STATIONS[3].x - 52}
				y={STATIONS[3].y - 40}
				width="104"
				height="84"
				rx="16"
				fill="color-mix(in srgb, #14b8a6 14%, transparent)"
			/>
			<rect
				class="box"
				x={STATIONS[3].x - 36}
				y={STATIONS[3].y - 24}
				width="72"
				height="40"
				rx="8"
				fill="var(--color-surface)"
				stroke="var(--color-border)"
				stroke-width="1.5"
			/>
			<text
				x={STATIONS[3].x}
				y={STATIONS[3].y + 4}
				text-anchor="middle"
				class="pi-label"
				style="fill: #14b8a6; font-size: 16px;">∇θ</text
			>
			<text x={STATIONS[3].x} y={STATIONS[3].y + 34} text-anchor="middle" class="st-label"
				>update</text
			>
		</g>

		<!-- the pulse: a glowing dot with a short trail -->
		{#each [0.1, 0.06, 0.03] as back, ti (ti)}
			<circle
				cx={at(angleOf((phase - back + 4) % 4)).x}
				cy={at(angleOf((phase - back + 4) % 4)).y}
				r={2 + ti}
				fill="var(--color-important)"
				opacity={0.14 + ti * 0.1}
			/>
		{/each}
		<circle
			cx={pulse.x}
			cy={pulse.y}
			r="13"
			fill="color-mix(in srgb, var(--color-important) 25%, transparent)"
		/>
		<circle
			cx={pulse.x}
			cy={pulse.y}
			r="6"
			fill="var(--color-important)"
			stroke="var(--color-surface)"
			stroke-width="2"
		/>
	</svg>

	<!-- ── narration ── -->
	<div
		class="mt-2 rounded-md border-l-4 px-3 py-1.5 text-xs"
		style="border-color: {seg === 2
			? src.color
			: 'var(--color-primary)'}; background: var(--color-surface-hover); color: var(--color-text-secondary); font-family: var(--font-mono);"
	>
		{narration}
	</div>

	<!-- ── the course arc ── -->
	<div class="mt-3 grid gap-2 sm:grid-cols-3">
		<div class="cap" style="--cc: #a855f7;">
			<strong>Part 9 — preferences.</strong> Humans pick the better sample. Honest, but slow and expensive:
			you can't ask a person a million times.
		</div>
		<div class="cap" style="--cc: #f59e0b;">
			<strong>Part 10 — the reward model.</strong> Train a judge to imitate the humans, then query it
			cheaply. It works — until the policy finds its blind spots and the score decouples from quality.
		</div>
		<div class="cap" style="--cc: var(--color-tip);">
			<strong>Part 11 — verifiers.</strong> Where ground truth exists (did the move win? does the code
			run?), the reward can't be gamed. That's RLVR.
		</div>
	</div>
</div>

<style>
	.station .halo {
		opacity: calc(var(--glow, 0) * 1);
		transition: opacity 200ms ease;
	}
	.station .box {
		stroke: color-mix(in srgb, var(--st) calc(var(--glow, 0) * 100%), var(--color-border));
		transition: stroke 200ms ease;
	}

	.pi-label {
		font-family: var(--font-mono);
		font-weight: 700;
	}
	.st-label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.04em;
		fill: var(--color-text-secondary);
	}
	.sub-label {
		font-family: var(--font-sans, sans-serif);
		font-size: 10px;
		fill: var(--color-text-muted);
	}
	.mono-label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
	}

	.chip {
		border-radius: 999px;
		padding: 2px 9px;
		font-size: 11px;
		font-weight: 600;
		color: var(--c);
		background: color-mix(in srgb, var(--c) 10%, transparent);
		white-space: nowrap;
	}

	.cap {
		border: 1px solid var(--color-border-light);
		border-top: 3px solid var(--cc);
		border-radius: 0.5rem;
		padding: 0.5rem 0.65rem;
		font-size: 11px;
		line-height: 1.5;
		color: var(--color-text-muted);
	}
	.cap strong {
		color: var(--color-text-secondary);
	}

	.seg {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}
	.seg.on {
		background: var(--color-surface);
		border-color: color-mix(in srgb, var(--sc) 50%, var(--color-border));
		color: var(--sc);
	}

	.ctl-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		color: var(--color-text);
		background: var(--color-surface-hover);
		cursor: pointer;
		transition: border-color 120ms ease;
	}
	.ctl-btn:hover:not(:disabled) {
		border-color: var(--color-important);
	}
	.ctl-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.ctl-btn.play {
		color: var(--color-important);
		border-color: color-mix(in srgb, var(--color-important) 45%, var(--color-border));
	}
</style>
