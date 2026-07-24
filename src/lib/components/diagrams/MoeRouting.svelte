<!-- Hand-drawn replacement for the `moe-routing` mermaid diagram (Part 13.1).
     A token embedding enters the router diamond, which gates it into experts
     3 and 7 (weights 0.7 / 0.3); the other six experts sit dimmed at 25%
     opacity; a shared always-on lane runs down the right; everything blends
     into a weighted sum bound for the next layer. -->
<script module lang="ts">
	let instances = 0;
</script>

<script lang="ts">
	instances += 1;
	const uid = `moe-routing-${instances}`;
</script>

<svg
	viewBox="0 0 900 470"
	class="my-4 block h-auto w-full"
	role="img"
	aria-label="Mixture-of-experts routing: a token embedding x enters the router, which picks the top 2 of 8 experts — expert 3 with gate weight 0.7 and expert 7 with gate weight 0.3 — while the six inactive experts are dimmed; a shared expert lane is always on; the outputs merge into a weighted sum passed to the next layer."
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
		<line x1="380" y1="58" x2="380" y2="92" marker-end="url(#{uid}-arrow)" />
		<path d="M310,171 C280,200 236,230 236,276" marker-end="url(#{uid}-arrow)" />
		<path d="M450,171 C500,200 588,230 588,276" marker-end="url(#{uid}-arrow)" />
		<path d="M485,36 C620,36 810,50 810,92" marker-end="url(#{uid}-arrow)" />
		<path d="M236,344 C236,378 300,392 326,396" marker-end="url(#{uid}-arrow)" />
		<path d="M588,344 C588,378 470,392 444,396" marker-end="url(#{uid}-arrow)" />
		<path d="M810,344 C810,394 570,420 526,424" marker-end="url(#{uid}-arrow)" />
	</g>

	<!-- gate weight pills -->
	<g font-family="var(--font-mono)" font-size="14">
		<rect
			x="246"
			y="213"
			width="44"
			height="24"
			rx="12"
			fill="var(--color-surface)"
			stroke="var(--color-border)"
		/>
		<text x="268" y="230" text-anchor="middle" fill="var(--color-text)">0.7</text>
		<rect
			x="516"
			y="205"
			width="44"
			height="24"
			rx="12"
			fill="var(--color-surface)"
			stroke="var(--color-border)"
		/>
		<text x="538" y="222" text-anchor="middle" fill="var(--color-text)">0.3</text>
	</g>

	<!-- token embedding -->
	<g>
		<rect
			x="275"
			y="14"
			width="210"
			height="44"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="380" y="42" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>token embedding <tspan font-family="var(--font-mono)">x</tspan></text
		>
	</g>

	<!-- router diamond -->
	<g>
		<polygon
			points="380,96 520,146 380,196 240,146"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 40%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="380"
			y="142"
			text-anchor="middle"
			font-size="15"
			font-weight="600"
			fill="var(--color-text)">router:</text
		>
		<text x="380" y="162" text-anchor="middle" font-size="14" fill="var(--color-text)"
			>pick top-2 of 8</text
		>
	</g>

	<!-- inactive experts, dimmed -->
	<g opacity="0.25">
		{#each [{ x: 20, n: 1 }, { x: 108, n: 2 }, { x: 284, n: 4 }, { x: 372, n: 5 }, { x: 460, n: 6 }, { x: 636, n: 8 }] as e (e.n)}
			<rect
				x={e.x}
				y="280"
				width="80"
				height="64"
				rx="10"
				fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
				stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
				stroke-width="1.5"
			/>
			<text x={e.x + 40} y="317" text-anchor="middle" font-size="14" fill="var(--color-text)"
				>expert {e.n}</text
			>
		{/each}
	</g>

	<!-- active experts 3 and 7 -->
	<g>
		<rect
			x="196"
			y="280"
			width="80"
			height="64"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="var(--color-important)"
			stroke-width="2"
		/>
		<text
			x="236"
			y="307"
			text-anchor="middle"
			font-size="14"
			font-weight="600"
			fill="var(--color-text)">expert 3</text
		>
		<text x="236" y="327" text-anchor="middle" font-size="14" fill="var(--color-text-muted)"
			>(small MLP)</text
		>

		<rect
			x="548"
			y="280"
			width="80"
			height="64"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="var(--color-important)"
			stroke-width="2"
		/>
		<text
			x="588"
			y="307"
			text-anchor="middle"
			font-size="14"
			font-weight="600"
			fill="var(--color-text)">expert 7</text
		>
		<text x="588" y="327" text-anchor="middle" font-size="14" fill="var(--color-text-muted)"
			>(small MLP)</text
		>
	</g>

	<!-- shared expert lane, always on -->
	<g>
		<rect
			x="740"
			y="96"
			width="140"
			height="248"
			rx="10"
			fill="color-mix(in srgb, var(--color-tip) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-tip) 45%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="810"
			y="126"
			text-anchor="middle"
			font-size="15"
			font-weight="600"
			fill="var(--color-text)">shared expert</text
		>
		<text x="810" y="146" text-anchor="middle" font-size="14" fill="var(--color-text-muted)"
			>— always on</text
		>
	</g>

	<!-- weighted sum -->
	<g>
		<rect
			x="240"
			y="400"
			width="280"
			height="48"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="380" y="430" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>weighted sum → next layer</text
		>
	</g>
</svg>
