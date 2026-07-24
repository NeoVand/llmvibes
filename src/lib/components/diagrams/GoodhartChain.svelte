<!-- Hand-drawn replacement for the `proxy-chain` mermaid diagram (Part 10).
     The Goodhart chain in serpentine order: want → measure on the top row,
     a long curve down through the model fit, optimize → get on the bottom row.
     The tint decays from tip (intent) through important (proxy) to challenge
     (what optimization actually delivers). -->
<script module lang="ts">
	let instances = 0;
</script>

<script lang="ts">
	instances += 1;
	const uid = `goodhart-${instances}`;
</script>

<svg
	viewBox="0 0 900 290"
	class="my-4 block h-auto w-full"
	role="img"
	aria-label="Goodhart proxy chain: what you want (good stories, won games) is compressed into what you can measure (clicks, piece values), fit by a model into what gets optimized (RM score, material sum), and argmax or RL yields what you get (dragon soup, hung kings)."
>
	<defs>
		<marker
			id="{uid}-arrow"
			viewBox="0 0 10 10"
			refX="8.2"
			refY="5"
			markerWidth="11"
			markerHeight="11"
			markerUnits="userSpaceOnUse"
			orient="auto-start-reverse"
		>
			<path d="M 1 1.4 L 9 5 L 1 8.6 L 3.2 5 Z" fill="var(--color-text-muted)" />
		</marker>
	</defs>

	<!-- edges -->
	<g stroke="var(--color-text-muted)" stroke-width="1.7" fill="none" stroke-linecap="round">
		<line x1="340" y1="52" x2="552" y2="52" marker-end="url(#{uid}-arrow)" />
		<path d="M710,88 C710,150 190,120 190,182" marker-end="url(#{uid}-arrow)" />
		<line x1="340" y1="222" x2="552" y2="222" marker-end="url(#{uid}-arrow)" />
	</g>

	<!-- edge label pills -->
	<g>
		<rect
			x="385"
			y="40"
			width="126"
			height="24"
			rx="12"
			fill="var(--color-surface)"
			stroke="var(--color-border)"
		/>
		<text x="448" y="57" text-anchor="middle" font-size="14" fill="var(--color-text-muted)"
			>compressed into</text
		>
		<rect
			x="392"
			y="123"
			width="116"
			height="24"
			rx="12"
			fill="var(--color-surface)"
			stroke="var(--color-border)"
		/>
		<text x="450" y="140" text-anchor="middle" font-size="14" fill="var(--color-text-muted)"
			>fit by a model</text
		>
		<rect
			x="394"
			y="210"
			width="108"
			height="24"
			rx="12"
			fill="var(--color-surface)"
			stroke="var(--color-border)"
		/>
		<text
			x="448"
			y="227"
			text-anchor="middle"
			font-size="14"
			font-family="var(--font-mono)"
			fill="var(--color-text-muted)">argmax / RL</text
		>
	</g>

	<!-- what you want — the true intent -->
	<g>
		<rect
			x="40"
			y="20"
			width="300"
			height="64"
			rx="10"
			fill="color-mix(in srgb, var(--color-tip) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-tip) 40%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="190"
			y="46"
			text-anchor="middle"
			font-size="16"
			font-weight="600"
			fill="var(--color-text)">What you want</text
		>
		<text x="190" y="68" text-anchor="middle" font-size="14" fill="var(--color-text-muted)"
			>good stories · won games</text
		>
	</g>

	<!-- what you can measure -->
	<g>
		<rect
			x="560"
			y="20"
			width="300"
			height="64"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="710"
			y="46"
			text-anchor="middle"
			font-size="16"
			font-weight="600"
			fill="var(--color-text)">What you can measure</text
		>
		<text x="710" y="68" text-anchor="middle" font-size="14" fill="var(--color-text-muted)"
			>clicks · piece values</text
		>
	</g>

	<!-- what gets optimized -->
	<g>
		<rect
			x="40"
			y="190"
			width="300"
			height="64"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="190"
			y="216"
			text-anchor="middle"
			font-size="16"
			font-weight="600"
			fill="var(--color-text)">What gets optimized</text
		>
		<text x="190" y="238" text-anchor="middle" font-size="14" fill="var(--color-text-muted)"
			>RM score · material sum</text
		>
	</g>

	<!-- what you get — the wreckage -->
	<g>
		<rect
			x="560"
			y="190"
			width="300"
			height="64"
			rx="10"
			fill="color-mix(in srgb, var(--color-challenge) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-challenge) 45%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="710"
			y="216"
			text-anchor="middle"
			font-size="16"
			font-weight="600"
			fill="var(--color-text)">What you get</text
		>
		<text x="710" y="238" text-anchor="middle" font-size="14" fill="var(--color-challenge)"
			>dragon soup · hung kings</text
		>
	</g>
</svg>
