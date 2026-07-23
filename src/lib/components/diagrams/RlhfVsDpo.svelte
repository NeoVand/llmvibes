<!-- Hand-drawn replacement for the `rlhf-vs-dpo-pipeline` mermaid diagram (Part 9).
     Main RLHF column on the left, the frozen reference off to the side, and the
     DPO shortcut as a dashed jump from the preference clicks straight to one
     supervised loss — both routes landing on the same aligned model. -->
<script module lang="ts">
	let instances = 0;
</script>

<script lang="ts">
	instances += 1;
	const uid = `rlhf-dpo-${instances}`;
</script>

<svg
	viewBox="0 0 900 630"
	class="my-4 block h-auto w-full"
	role="img"
	aria-label="RLHF pipeline: SFT model to sampled response pairs to annotator clicks to a Bradley-Terry reward model to an RL loop with a KL leash to a frozen reference, producing an aligned model. A dashed DPO shortcut skips the reward model and RL loop, going straight from the preference clicks to one supervised loss on the pairs."
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
		<marker
			id="{uid}-arrow-tip"
			viewBox="0 0 10 10"
			refX="9"
			refY="5"
			markerWidth="7"
			markerHeight="7"
			orient="auto-start-reverse"
		>
			<path d="M0,0 L10,5 L0,10 z" fill="var(--color-tip)" />
		</marker>
	</defs>

	<!-- edges -->
	<g stroke="var(--color-text-muted)" stroke-width="1.5" fill="none">
		<line x1="330" y1="62" x2="330" y2="106" marker-end="url(#{uid}-arrow)" />
		<line x1="330" y1="158" x2="330" y2="202" marker-end="url(#{uid}-arrow)" />
		<line x1="330" y1="254" x2="330" y2="298" marker-end="url(#{uid}-arrow)" />
		<line x1="330" y1="362" x2="330" y2="406" marker-end="url(#{uid}-arrow)" />
		<path d="M330,470 C330,520 393,540 428,554" marker-end="url(#{uid}-arrow)" />
		<!-- frozen copy: SFT model → reference (dashed) -->
		<path
			d="M170,39 C110,39 100,110 100,298"
			stroke-dasharray="6 5"
			marker-end="url(#{uid}-arrow)"
		/>
		<!-- reference → RL loop (dashed) -->
		<path d="M100,362 L100,441 L162,441" stroke-dasharray="6 5" marker-end="url(#{uid}-arrow)" />
	</g>

	<!-- DPO shortcut edges -->
	<g stroke="var(--color-tip)" stroke-width="1.5" fill="none">
		<path
			d="M490,231 C640,231 745,285 745,380"
			stroke-dasharray="6 5"
			marker-end="url(#{uid}-arrow-tip)"
		/>
		<path d="M745,442 C745,500 580,540 516,556" marker-end="url(#{uid}-arrow-tip)" />
	</g>

	<!-- edge label pills -->
	<g>
		<rect
			x="52"
			y="148"
			width="96"
			height="24"
			rx="12"
			fill="var(--color-surface)"
			stroke="var(--color-border)"
		/>
		<text x="100" y="165" text-anchor="middle" font-size="14" fill="var(--color-text-muted)"
			>frozen copy</text
		>
		<rect
			x="534"
			y="250"
			width="250"
			height="24"
			rx="12"
			fill="var(--color-surface)"
			stroke="var(--color-tip-border)"
		/>
		<text x="659" y="267" text-anchor="middle" font-size="14" fill="var(--color-tip)"
			>DPO: skip the RM and the RL loop</text
		>
	</g>

	<!-- main pipeline nodes -->
	<g>
		<rect
			x="170"
			y="16"
			width="320"
			height="46"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="330" y="45" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>SFT model — the starting policy</text
		>

		<rect
			x="170"
			y="112"
			width="320"
			height="46"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="330" y="141" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Sample response pairs per prompt</text
		>

		<rect
			x="170"
			y="208"
			width="320"
			height="46"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="330" y="237" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Annotator clicks: which is better?</text
		>

		<!-- reward model — the reward color -->
		<rect
			x="170"
			y="304"
			width="320"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-challenge) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-challenge) 40%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="330"
			y="327"
			text-anchor="middle"
			font-size="15"
			font-weight="600"
			fill="var(--color-text)">Reward model</text
		>
		<text x="330" y="347" text-anchor="middle" font-size="14" fill="var(--color-text-muted)"
			>Bradley-Terry on comparisons</text
		>

		<rect
			x="170"
			y="412"
			width="320"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="330" y="435" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>RL loop: sample, score with RM,</text
		>
		<text x="330" y="455" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>update policy — KL leash to reference</text
		>
	</g>

	<!-- frozen reference -->
	<g>
		<rect
			x="10"
			y="304"
			width="180"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-text-muted) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-text-muted) 45%, transparent)"
			stroke-width="1.5"
			stroke-dasharray="6 5"
		/>
		<text x="100" y="327" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Reference model</text
		>
		<text
			x="100"
			y="348"
			text-anchor="middle"
			font-size="14"
			font-family="var(--font-mono)"
			fill="var(--color-text-muted)">πref</text
		>
	</g>

	<!-- DPO node -->
	<g>
		<rect
			x="620"
			y="384"
			width="250"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-tip) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-tip) 40%, transparent)"
			stroke-width="1.5"
		/>
		<text x="745" y="407" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>One supervised loss</text
		>
		<text x="745" y="427" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>directly on the pairs</text
		>
	</g>

	<!-- aligned model — where both routes land -->
	<g>
		<rect
			x="345"
			y="560"
			width="250"
			height="46"
			rx="10"
			fill="color-mix(in srgb, var(--color-tip) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-tip) 40%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="470"
			y="589"
			text-anchor="middle"
			font-size="15"
			font-weight="600"
			fill="var(--color-text)">Aligned model</text
		>
	</g>
</svg>
