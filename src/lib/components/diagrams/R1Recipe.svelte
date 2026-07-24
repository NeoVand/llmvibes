<!-- Hand-drawn replacement for the `r1-recipe` mermaid diagram (Part 11.5).
     The DeepSeek-R1 recipe as a two-row serpentine: base → cold-start SFT → RL
     on the top row, a long wrap-around curve into rejection sampling, then
     SFT again → RL again → R1 across the bottom. SFT stages tinted important,
     RL stages tinted challenge, R1 gets the tip color. -->
<script module lang="ts">
	let instances = 0;
</script>

<script lang="ts">
	instances += 1;
	const uid = `r1-recipe-${instances}`;
</script>

<svg
	viewBox="0 0 900 290"
	class="my-4 block h-auto w-full"
	role="img"
	aria-label="DeepSeek-R1 recipe: base model, cold-start SFT on a small readable CoT set, RL on verifiable rewards, rejection-sample the RL model into a better SFT set, SFT again, RL again with reasoning plus preferences, producing R1."
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
		<line x1="160" y1="53" x2="214" y2="53" marker-end="url(#{uid}-arrow)" />
		<line x1="480" y1="53" x2="534" y2="53" marker-end="url(#{uid}-arrow)" />
		<path d="M665,86 C665,160 150,128 150,198" marker-end="url(#{uid}-arrow)" />
		<line x1="280" y1="233" x2="324" y2="233" marker-end="url(#{uid}-arrow)" />
		<line x1="460" y1="233" x2="504" y2="233" marker-end="url(#{uid}-arrow)" />
		<line x1="740" y1="233" x2="784" y2="233" marker-end="url(#{uid}-arrow)" />
	</g>

	<!-- base model -->
	<g>
		<rect
			x="20"
			y="24"
			width="140"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-text-muted) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-text-muted) 45%, transparent)"
			stroke-width="1.5"
		/>
		<text x="90" y="58" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Base model</text
		>
	</g>

	<!-- cold-start SFT -->
	<g>
		<rect
			x="220"
			y="24"
			width="260"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="350" y="47" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Cold-start SFT on a</text
		>
		<text x="350" y="67" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>small, readable CoT set</text
		>
	</g>

	<!-- RL on verifiable rewards -->
	<g>
		<rect
			x="540"
			y="24"
			width="250"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-challenge) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-challenge) 40%, transparent)"
			stroke-width="1.5"
		/>
		<text x="665" y="58" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>RL on verifiable rewards</text
		>
	</g>

	<!-- rejection sampling -->
	<g>
		<rect
			x="20"
			y="204"
			width="260"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="150" y="227" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Rejection-sample the RL model</text
		>
		<text x="150" y="247" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>into a better SFT set</text
		>
	</g>

	<!-- SFT again -->
	<g>
		<rect
			x="330"
			y="204"
			width="130"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="395" y="238" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>SFT again</text
		>
	</g>

	<!-- RL again -->
	<g>
		<rect
			x="510"
			y="204"
			width="230"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-challenge) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-challenge) 40%, transparent)"
			stroke-width="1.5"
		/>
		<text x="625" y="227" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>RL again:</text
		>
		<text x="625" y="247" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>reasoning + preferences</text
		>
	</g>

	<!-- R1 -->
	<g>
		<rect
			x="790"
			y="204"
			width="90"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-tip) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-tip) 45%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="835"
			y="239"
			text-anchor="middle"
			font-size="16"
			font-weight="600"
			font-family="var(--font-mono)"
			fill="var(--color-text)">R1</text
		>
	</g>
</svg>
