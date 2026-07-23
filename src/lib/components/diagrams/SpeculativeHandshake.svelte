<!-- Hand-drawn replacement for the `speculative-handshake` mermaid sequence
     diagram (Part 13.5). Two lifelines — the draft and the target — with the
     drafted burst shown as literal token chips: the proposal row neutral, the
     verdict row with four accepted tokens in green, "copper" rejected in red,
     and the resampled "great" appended with a dashed border. -->
<script module lang="ts">
	let instances = 0;
</script>

<script lang="ts">
	instances += 1;
	const uid = `spec-handshake-${instances}`;
</script>

<svg
	viewBox="0 0 900 450"
	class="my-4 block h-auto w-full"
	role="img"
	aria-label="Speculative decoding handshake: Live-Quill the draft proposes 5 tokens — the dragon spread its copper; Flagship-Quill the target scores all 5 positions in one batched pass; it accepts 4 tokens, rejects copper, and resamples great; the draft then drafts the next burst from spread its great."
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
		<line x1="220" y1="54" x2="220" y2="434" />
		<line x1="680" y1="54" x2="680" y2="434" />
	</g>

	<!-- activation bars -->
	<g
		fill="color-mix(in srgb, var(--color-important) 12%, transparent)"
		stroke="color-mix(in srgb, var(--color-important) 40%, transparent)"
		stroke-width="1"
	>
		<rect x="215" y="96" width="10" height="30" rx="2" />
		<rect x="215" y="240" width="10" height="180" rx="2" />
	</g>
	<g
		fill="color-mix(in srgb, var(--color-tip) 12%, transparent)"
		stroke="color-mix(in srgb, var(--color-tip) 45%, transparent)"
		stroke-width="1"
	>
		<rect x="675" y="100" width="10" height="200" rx="2" />
		<rect x="675" y="352" width="10" height="68" rx="2" />
	</g>

	<!-- messages -->
	<g stroke="var(--color-text-muted)" stroke-width="1.5" fill="none">
		<line x1="225" y1="110" x2="671" y2="110" marker-end="url(#{uid}-arrow)" />
		<!-- self-loop: one batched pass -->
		<path d="M685,168 L720,168 L720,196 L689,196" marker-end="url(#{uid}-arrow)" />
		<line x1="675" y1="250" x2="229" y2="250" marker-end="url(#{uid}-arrow)" />
		<line x1="225" y1="360" x2="671" y2="360" marker-end="url(#{uid}-arrow)" />
	</g>

	<!-- message labels -->
	<g
		font-size="14"
		fill="var(--color-text)"
		stroke="var(--color-bg)"
		stroke-width="6"
		paint-order="stroke"
		stroke-linejoin="round"
	>
		<text x="450" y="98" text-anchor="middle"
			>proposes 5 tokens: <tspan font-family="var(--font-mono)"
				>"the dragon spread its copper"</tspan
			></text
		>
		<text x="730" y="178">ONE batched pass</text>
		<text x="730" y="196">scores all 5 positions</text>
		<text x="450" y="238" text-anchor="middle"
			>accepts 4, rejects <tspan font-family="var(--font-mono)">"copper"</tspan>, resamples
			<tspan font-family="var(--font-mono)">"great"</tspan></text
		>
		<text x="450" y="348" text-anchor="middle"
			>drafts the next burst from <tspan font-family="var(--font-mono)">"...spread its great"</tspan
			></text
		>
	</g>

	<!-- proposed burst: neutral token chips -->
	<g font-family="var(--font-mono)" font-size="14">
		{#each [{ x: 294, w: 41, word: 'the' }, { x: 343, w: 66, word: 'dragon' }, { x: 417, w: 66, word: 'spread' }, { x: 491, w: 41, word: 'its' }, { x: 540, w: 66, word: 'copper' }] as chip (chip.x)}
			<rect
				x={chip.x}
				y="124"
				width={chip.w}
				height="28"
				rx="6"
				fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
				stroke="color-mix(in srgb, var(--color-important) 30%, transparent)"
			/>
			<text x={chip.x + chip.w / 2} y="143" text-anchor="middle" fill="var(--color-text)"
				>{chip.word}</text
			>
		{/each}
	</g>

	<!-- verdict: accepted run in green, one red rejected square, resampled tail -->
	<g font-family="var(--font-mono)" font-size="14">
		{#each [{ x: 245, w: 41, word: 'the' }, { x: 294, w: 66, word: 'dragon' }, { x: 368, w: 66, word: 'spread' }, { x: 442, w: 41, word: 'its' }] as chip (chip.x)}
			<rect
				x={chip.x}
				y="264"
				width={chip.w}
				height="28"
				rx="6"
				fill="color-mix(in srgb, var(--color-tip) 15%, transparent)"
				stroke="color-mix(in srgb, var(--color-tip) 55%, transparent)"
			/>
			<text x={chip.x + chip.w / 2} y="283" text-anchor="middle" fill="var(--color-tip)"
				>{chip.word}</text
			>
		{/each}
		<rect
			x="491"
			y="264"
			width="66"
			height="28"
			rx="6"
			fill="color-mix(in srgb, var(--color-challenge) 12%, transparent)"
			stroke="color-mix(in srgb, var(--color-challenge) 60%, transparent)"
		/>
		<text
			x="524"
			y="283"
			text-anchor="middle"
			fill="var(--color-challenge)"
			style="text-decoration: line-through">copper</text
		>
		<text x="577" y="283" text-anchor="middle" fill="var(--color-text-muted)">→</text>
		<rect
			x="597"
			y="264"
			width="58"
			height="28"
			rx="6"
			fill="color-mix(in srgb, var(--color-tip) 15%, transparent)"
			stroke="color-mix(in srgb, var(--color-tip) 55%, transparent)"
			stroke-dasharray="4 3"
		/>
		<text x="626" y="283" text-anchor="middle" fill="var(--color-tip)">great</text>
	</g>
	<g font-size="14" fill="var(--color-text-muted)">
		<text x="364" y="312" text-anchor="middle">accepted</text>
		<text x="524" y="312" text-anchor="middle">rejected</text>
		<text x="626" y="312" text-anchor="middle">resampled</text>
	</g>

	<!-- actors -->
	<g>
		<rect
			x="100"
			y="10"
			width="240"
			height="44"
			rx="10"
			fill="color-mix(in srgb, var(--color-important) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-important) 35%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="220"
			y="38"
			text-anchor="middle"
			font-size="16"
			font-weight="600"
			fill="var(--color-text)">Live-Quill (draft)</text
		>

		<rect
			x="550"
			y="10"
			width="260"
			height="44"
			rx="10"
			fill="color-mix(in srgb, var(--color-tip) 10%, transparent)"
			stroke="color-mix(in srgb, var(--color-tip) 45%, transparent)"
			stroke-width="1.5"
		/>
		<text
			x="680"
			y="38"
			text-anchor="middle"
			font-size="16"
			font-weight="600"
			fill="var(--color-text)">Flagship-Quill (target)</text
		>
	</g>
</svg>
