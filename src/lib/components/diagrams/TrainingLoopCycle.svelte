<script lang="ts">
	const uid = $props.id();
</script>

<div class="diagram">
	<svg
		viewBox="0 0 900 490"
		role="img"
		aria-label="The training loop drawn as a cycle: sample a batch from the corpus, forward pass to predict every next token, cross-entropy averages the surprise into one loss, the backward pass produces one gradient per weight, the optimizer nudges every weight downhill, and the loop repeats."
	>
		<defs>
			<marker
				id="{uid}-a"
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
			<filter id="{uid}-sh" x="-30%" y="-30%" width="160%" height="160%">
				<feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-opacity="0.14" />
			</filter>
		</defs>

		<!-- the cycle, clockwise -->
		<path class="edge" d="M 581 92 A 300 170 0 0 1 702 152" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 749 233 A 300 170 0 0 1 693 345" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 523 410 A 300 170 0 0 1 377 410" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 207 345 A 300 170 0 0 1 151 233" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 196 155 A 300 170 0 0 1 347 85" marker-end="url(#{uid}-a)" />

		<!-- center: the loop itself -->
		<path
			class="edge"
			d="M 463 185.5 A 26 26 0 1 1 425.6 199.1"
			marker-end="url(#{uid}-a)"
			style="stroke-width: 1.9;"
		/>
		<text class="hd" x="450" y="262" font-size="14.5">the loop</text>
		<text class="cap" x="450" y="282" font-size="11.5">run thousands of times</text>

		<!-- 1 · sample a batch -->
		<g>
			<rect
				x="350"
				y="47"
				width="200"
				height="56"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 10%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="450" y="71" font-size="15">sample a batch</text>
			<text class="cap" x="450" y="90" font-size="11.5">from the corpus</text>
			<circle
				cx="350"
				cy="75"
				r="12"
				style="fill: var(--color-bg); stroke: color-mix(in srgb, var(--color-note) 60%, transparent); stroke-width: 1.6;"
			/>
			<text class="hd" x="350" y="79.5" font-size="12">1</text>
		</g>

		<!-- 2 · forward pass -->
		<g>
			<rect
				x="640"
				y="165"
				width="190"
				height="56"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-primary) 10%, transparent); stroke: color-mix(in srgb, var(--color-primary) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="735" y="189" font-size="15">forward pass</text>
			<text class="cap" x="735" y="208" font-size="11.5">predict every next token</text>
			<circle
				cx="640"
				cy="193"
				r="12"
				style="fill: var(--color-bg); stroke: color-mix(in srgb, var(--color-primary) 60%, transparent); stroke-width: 1.6;"
			/>
			<text class="hd" x="640" y="197.5" font-size="12">2</text>
		</g>

		<!-- 3 · cross-entropy -->
		<g>
			<rect
				x="526"
				y="354"
				width="200"
				height="56"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-challenge-bright) 10%, transparent); stroke: color-mix(in srgb, var(--color-challenge-bright) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="626" y="378" font-size="15">cross-entropy</text>
			<text class="cap" x="626" y="397" font-size="11.5">average surprise → one loss</text>
			<circle
				cx="526"
				cy="382"
				r="12"
				style="fill: var(--color-bg); stroke: color-mix(in srgb, var(--color-challenge-bright) 60%, transparent); stroke-width: 1.6;"
			/>
			<text class="hd" x="526" y="386.5" font-size="12">3</text>
		</g>

		<!-- 4 · backward pass -->
		<g>
			<rect
				x="176"
				y="354"
				width="195"
				height="56"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-vibe) 10%, transparent); stroke: color-mix(in srgb, var(--color-vibe) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="273" y="378" font-size="15">backward pass</text>
			<text class="cap" x="273" y="397" font-size="11.5">one gradient per weight</text>
			<circle
				cx="176"
				cy="382"
				r="12"
				style="fill: var(--color-bg); stroke: color-mix(in srgb, var(--color-vibe) 60%, transparent); stroke-width: 1.6;"
			/>
			<text class="hd" x="176" y="386.5" font-size="12">4</text>
		</g>

		<!-- 5 · optimizer step -->
		<g>
			<rect
				x="70"
				y="165"
				width="190"
				height="56"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-tip) 10%, transparent); stroke: color-mix(in srgb, var(--color-tip) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="165" y="189" font-size="15">optimizer step</text>
			<text class="cap" x="165" y="208" font-size="11.5">nudge every weight downhill</text>
			<circle
				cx="70"
				cy="193"
				r="12"
				style="fill: var(--color-bg); stroke: color-mix(in srgb, var(--color-tip) 60%, transparent); stroke-width: 1.6;"
			/>
			<text class="hd" x="70" y="197.5" font-size="12">5</text>
		</g>
	</svg>
</div>

<style>
	.diagram {
		display: flex;
		justify-content: center;
		padding: 4px 0;
	}

	svg {
		display: block;
		width: 100%;
		max-width: 760px;
		height: auto;
	}

	text {
		text-anchor: middle;
	}

	.hd {
		font-family: var(--font-heading);
		font-weight: 600;
		fill: var(--color-text);
	}

	.cap {
		font-family: var(--font-sans);
		fill: var(--color-text-muted);
	}

	.edge {
		stroke: var(--color-text-muted);
		stroke-width: 1.7;
		fill: none;
		stroke-linecap: round;
	}
</style>
