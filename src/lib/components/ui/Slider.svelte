<script lang="ts" module>
	let uid = 0;
</script>

<script lang="ts">
	// House slider — no default range styling anywhere in the course.
	// Track fill follows the value via a hard-stop gradient driven by --p;
	// thumb is a ringed dot that scales on hover and grows a focus halo.
	let {
		label,
		value = $bindable(),
		min,
		max,
		step = 1,
		decimals,
		format,
		hint,
		tone = 'accent',
		unit = '',
		disabled = false,
		oninput
	}: {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		decimals?: number;
		format?: (v: number) => string;
		hint?: string;
		tone?: 'accent' | 'good' | 'bad' | 'violet' | 'blue' | 'teal' | 'amber' | 'rose';
		unit?: string;
		disabled?: boolean;
		oninput?: (v: number) => void;
	} = $props();

	uid += 1;
	const id = `slider-${uid}`;
	const dp = $derived(decimals ?? (step < 0.01 ? 3 : step < 1 ? 2 : 0));
	const display = $derived(format ? format(value) : value.toFixed(dp) + unit);
	const progress = $derived(
		max === min ? 0 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
	);
</script>

<div class="field tone-{tone}" class:disabled>
	<div class="top">
		<label class="label" for={id}>{label}</label>
		<span class="value">{display}</span>
	</div>
	<input
		{id}
		class="slider"
		type="range"
		{min}
		{max}
		{step}
		{disabled}
		bind:value
		style="--p: {progress}%"
		oninput={() => oninput?.(value)}
	/>
	{#if hint}
		<span class="hint">{hint}</span>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		--tone: var(--color-important);
		--tone-end: color-mix(in srgb, var(--color-important) 65%, var(--color-text));
	}
	.tone-good {
		--tone: var(--color-tip);
		--tone-end: color-mix(in srgb, var(--color-tip) 65%, var(--color-text));
	}
	.tone-bad {
		--tone: var(--color-challenge);
		--tone-end: color-mix(in srgb, var(--color-challenge) 65%, var(--color-text));
	}
	.tone-violet {
		--tone: #a855f7;
		--tone-end: #7c3aed;
	}
	.tone-blue {
		--tone: #2563eb;
		--tone-end: #0ea5e9;
	}
	.tone-teal {
		--tone: #0f766e;
		--tone-end: #14b8a6;
	}
	.tone-amber {
		--tone: #b45309;
		--tone-end: #f59e0b;
	}
	.tone-rose {
		--tone: #be123c;
		--tone-end: #fb7185;
	}

	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.label {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--color-text-secondary);
	}
	.value {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		color: var(--tone);
	}
	.hint {
		font-size: 0.66rem;
		color: var(--color-text-muted);
	}

	.slider {
		appearance: none;
		-webkit-appearance: none;
		width: 100%;
		height: 16px;
		margin: 0;
		background: transparent;
		cursor: pointer;
	}
	.slider:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.slider::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			var(--tone-end) 0%,
			var(--tone) var(--p),
			color-mix(in srgb, var(--color-border) 70%, transparent) var(--p),
			color-mix(in srgb, var(--color-border) 70%, transparent) 100%
		);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-text) 6%, transparent);
	}
	.slider::-moz-range-track {
		height: 6px;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			var(--tone-end) 0%,
			var(--tone) var(--p),
			color-mix(in srgb, var(--color-border) 70%, transparent) var(--p),
			color-mix(in srgb, var(--color-border) 70%, transparent) 100%
		);
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		margin-top: -5px;
		border-radius: 999px;
		background: var(--color-surface);
		border: 3px solid var(--tone);
		box-shadow:
			0 1px 4px rgb(0 0 0 / 0.25),
			0 0 0 1px color-mix(in srgb, var(--tone) 35%, transparent);
		transition:
			transform 100ms ease,
			box-shadow 120ms ease;
	}
	.slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 999px;
		background: var(--color-surface);
		border: 3px solid var(--tone);
		box-shadow:
			0 1px 4px rgb(0 0 0 / 0.25),
			0 0 0 1px color-mix(in srgb, var(--tone) 35%, transparent);
		transition:
			transform 100ms ease,
			box-shadow 120ms ease;
	}
	.slider:hover:not(:disabled)::-webkit-slider-thumb {
		transform: scale(1.15);
	}
	.slider:hover:not(:disabled)::-moz-range-thumb {
		transform: scale(1.15);
	}
	.slider:focus-visible {
		outline: none;
	}
	.slider:focus-visible::-webkit-slider-thumb {
		box-shadow:
			0 0 0 4px color-mix(in srgb, var(--tone) 22%, transparent),
			0 0 0 1px var(--tone);
	}
	.slider:focus-visible::-moz-range-thumb {
		box-shadow:
			0 0 0 4px color-mix(in srgb, var(--tone) 22%, transparent),
			0 0 0 1px var(--tone);
	}
</style>
