<!-- Hand-drawn replacement for the `tool-call-loop` mermaid sequence diagram
     (Part 12.1). Three lifelines — Quill, the runtime loop, the tool — with
     activation bars showing who is in charge at each instant, and a self-loop
     on Quill when sampling resumes. Message labels get a background-colored
     halo so they stay readable where they cross a lifeline. -->
<script module lang="ts">
	let instances = 0;
</script>

<script lang="ts">
	instances += 1;
	const uid = `tool-call-${instances}`;
</script>

<svg
	viewBox="0 0 900 430"
	class="my-4 block h-auto w-full"
	role="img"
	aria-label="Sequence diagram: Quill emits call tokens ending with the stop token; the runtime loop executes lookup of dragon.name; the tool returns Ember; the runtime splices the result tokens into the context; Quill resumes sampling with the fact in view."
>
	<defs>
		<marker
			id="{uid}-arrow"
			viewBox="0 0 10 10"
			refX="9"
			refY="5"
			markerWidth="7"
			markerHeight="7"
			orient="auto-start-reverse"
		>
			<path d="M0,0 L10,5 L0,10 z" fill="var(--color-text-muted)" />
		</marker>
	</defs>

	<!-- lifelines -->
	<g stroke="var(--color-text-muted)" stroke-width="1" stroke-dasharray="4 5">
		<line x1="150" y1="54" x2="150" y2="410" />
		<line x1="450" y1="54" x2="450" y2="410" />
		<line x1="750" y1="54" x2="750" y2="410" />
	</g>

	<!-- activation bars -->
	<g
		fill="color-mix(in srgb, var(--color-important) 12%, transparent)"
		stroke="color-mix(in srgb, var(--color-important) 40%, transparent)"
		stroke-width="1"
	>
		<rect x="145" y="80" width="10" height="42" rx="2" />
		<rect x="145" y="274" width="10" height="112" rx="2" />
	</g>
	<g
		fill="color-mix(in srgb, var(--color-text-muted) 12%, transparent)"
		stroke="color-mix(in srgb, var(--color-text-muted) 45%, transparent)"
		stroke-width="1"
	>
		<rect x="445" y="100" width="10" height="206" rx="2" />
	</g>
	<g
		fill="color-mix(in srgb, var(--color-tip) 12%, transparent)"
		stroke="color-mix(in srgb, var(--color-tip) 45%, transparent)"
		stroke-width="1"
	>
		<rect x="745" y="160" width="10" height="86" rx="2" />
	</g>

	<!-- messages, in time order -->
	<g stroke="var(--color-text-muted)" stroke-width="1.5" fill="none">
		<line x1="155" y1="110" x2="441" y2="110" marker-end="url(#{uid}-arrow)" />
		<line x1="455" y1="170" x2="741" y2="170" marker-end="url(#{uid}-arrow)" />
		<line x1="745" y1="230" x2="459" y2="230" marker-end="url(#{uid}-arrow)" />
		<line x1="445" y1="290" x2="159" y2="290" marker-end="url(#{uid}-arrow)" />
		<!-- self-loop: sampling resumes -->
		<path d="M155,330 L235,330 L235,362 L159,362" marker-end="url(#{uid}-arrow)" />
	</g>

	<!-- message labels (halo masks the lifelines behind them) -->
	<g
		font-size="14"
		fill="var(--color-text)"
		stroke="var(--color-bg)"
		stroke-width="6"
		paint-order="stroke"
		stroke-linejoin="round"
	>
		<text x="298" y="99" text-anchor="middle">emits call tokens, ends with the stop token</text>
		<text x="600" y="159" text-anchor="middle"
			>executes <tspan font-family="var(--font-mono)">lookup("dragon.name")</tspan></text
		>
		<text x="602" y="219" text-anchor="middle"
			>returns <tspan font-family="var(--font-mono)">"Ember"</tspan></text
		>
		<text x="302" y="279" text-anchor="middle">splices result tokens into the context</text>
		<text x="247" y="340">sampling resumes</text>
		<text x="247" y="358">with the fact in view</text>
	</g>

	<!-- actors -->
	<g>
		<rect
			x="60"
			y="10"
			width="180"
			height="44"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="150"
			y="38"
			text-anchor="middle"
			font-size="16"
			font-weight="600"
			fill="var(--color-text)">Quill</text
		>

		<rect
			x="360"
			y="10"
			width="180"
			height="44"
			rx="10"
			fill="color-mix(in srgb, var(--color-text-muted) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-text-muted) 45%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="450"
			y="38"
			text-anchor="middle"
			font-size="16"
			font-weight="600"
			fill="var(--color-text)">Runtime loop</text
		>

		<rect
			x="660"
			y="10"
			width="180"
			height="44"
			rx="10"
			fill="color-mix(in srgb, var(--color-tip) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-tip) 45%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="750"
			y="38"
			text-anchor="middle"
			font-size="16"
			font-weight="600"
			fill="var(--color-text)">Tool</text
		>
	</g>
</svg>
