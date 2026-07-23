<!-- Hand-drawn replacement for the `grpo-loop` mermaid diagram (Part 11.3).
     The six GRPO stages laid out on a real circle, arcs running clockwise;
     the KL-leash edge that closes the loop back to the prompt batch is dashed,
     and the verifier node wears the reward color. -->
<script module lang="ts">
	let instances = 0;
</script>

<script lang="ts">
	instances += 1;
	const uid = `grpo-loop-${instances}`;
</script>

<svg
	viewBox="0 0 900 545"
	class="my-4 block h-auto w-full"
	role="img"
	aria-label="GRPO training cycle: a batch of prompts, sample a group of G completions per prompt, verifier scores every completion, advantage equals score minus group mean over group std, clipped update upweights winners and downweights losers, and a dashed KL leash keeps the policy near the reference before the loop returns to the next batch."
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

	<!-- clockwise arcs between the stages -->
	<g stroke="var(--color-text-muted)" stroke-width="1.5" fill="none">
		<path d="M550,117 A200 200 0 0 1 596,154" marker-end="url(#{uid}-arrow)" />
		<path d="M639,225 A200 200 0 0 1 639,355" marker-end="url(#{uid}-arrow)" />
		<path d="M599,424 A200 200 0 0 1 562,456" marker-end="url(#{uid}-arrow)" />
		<path d="M338,456 A200 200 0 0 1 301,424" marker-end="url(#{uid}-arrow)" />
		<path d="M261,355 A200 200 0 0 1 261,225" marker-end="url(#{uid}-arrow)" />
		<!-- the KL leash closes the loop — dashed -->
		<path
			d="M304,154 A200 200 0 0 1 350,117"
			stroke-dasharray="6 5"
			marker-end="url(#{uid}-arrow)"
		/>
	</g>

	<!-- center label -->
	<text
		x="450"
		y="296"
		text-anchor="middle"
		font-size="18"
		font-weight="600"
		font-family="var(--font-mono)"
		fill="var(--color-text-muted)">GRPO</text
	>

	<!-- batch of prompts (12 o'clock) -->
	<g>
		<rect
			x="350"
			y="68"
			width="200"
			height="44"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="450" y="96" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Batch of prompts</text
		>
	</g>

	<!-- sample a group (2 o'clock) -->
	<g>
		<rect
			x="508"
			y="161"
			width="230"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="623" y="184" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Sample a group of G</text
		>
		<text x="623" y="204" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>completions per prompt</text
		>
	</g>

	<!-- verifier scores (4 o'clock) — the reward color -->
	<g>
		<rect
			x="528"
			y="361"
			width="190"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-challenge) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-challenge) 40%, transparent)"
			stroke-width="1.5"
		/>
		<text x="623" y="384" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Verifier scores</text
		>
		<text x="623" y="404" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>every completion</text
		>
	</g>

	<!-- advantage (6 o'clock) -->
	<g>
		<rect
			x="325"
			y="461"
			width="250"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="450" y="484" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Advantage = score minus</text
		>
		<text x="450" y="504" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>group mean, over group std</text
		>
	</g>

	<!-- clipped update (8 o'clock) -->
	<g>
		<rect
			x="157"
			y="361"
			width="240"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text x="277" y="384" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>Clipped update: upweight</text
		>
		<text x="277" y="404" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>winners, downweight losers</text
		>
	</g>

	<!-- KL leash (10 o'clock) — the anchor, dashed -->
	<g>
		<rect
			x="162"
			y="161"
			width="230"
			height="58"
			rx="10"
			fill="color-mix(in srgb, var(--color-tip) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-tip) 45%, transparent)"
			stroke-width="1.5"
			stroke-dasharray="6 5"
		/>
		<text x="277" y="184" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>KL leash keeps the policy</text
		>
		<text x="277" y="204" text-anchor="middle" font-size="15" fill="var(--color-text)"
			>near the reference</text
		>
	</g>
</svg>
