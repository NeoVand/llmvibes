<script lang="ts">
	const uid = $props.id();
</script>

<div class="diagram">
	<svg
		viewBox="0 0 760 400"
		role="img"
		aria-label="Merge tree: bytes t and h combine into token th at merge 3, byte e and a space combine into token e-with-trailing-space at merge 1, and those two combine into the token 'the ' at merge 13."
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

		<!-- edges: leaves up into merges -->
		<path class="edge" d="M 120 306 C 120 278, 140 276, 140 246" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 230 306 C 230 278, 210 276, 210 246" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 470 306 C 470 278, 490 276, 490 246" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 580 306 C 580 278, 560 276, 560 246" marker-end="url(#{uid}-a)" />
		<!-- edges: merges up into the root -->
		<path class="edge" d="M 175 168 C 175 138, 315 142, 315 112" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 525 168 C 525 138, 385 142, 385 112" marker-end="url(#{uid}-a)" />

		<!-- leaf tiles: raw bytes -->
		<g>
			<rect
				x="70"
				y="310"
				width="100"
				height="64"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 10%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="120" y="344" font-size="24">t</text>
			<text class="cap" x="120" y="364" font-size="10.5">byte 116</text>
		</g>
		<g>
			<rect
				x="180"
				y="310"
				width="100"
				height="64"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 10%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="230" y="344" font-size="24">h</text>
			<text class="cap" x="230" y="364" font-size="10.5">byte 104</text>
		</g>
		<g>
			<rect
				x="420"
				y="310"
				width="100"
				height="64"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 10%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="470" y="344" font-size="24">e</text>
			<text class="cap" x="470" y="364" font-size="10.5">byte 101</text>
		</g>
		<g>
			<rect
				x="530"
				y="310"
				width="100"
				height="64"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 10%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="580" y="344" font-size="24">␣</text>
			<text class="cap" x="580" y="364" font-size="10.5">byte 32 · space</text>
		</g>

		<!-- merge tiles -->
		<g>
			<rect
				x="97"
				y="172"
				width="156"
				height="68"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-primary) 10%, transparent); stroke: color-mix(in srgb, var(--color-primary) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="175" y="206" font-size="24">th</text>
			<text class="cap" x="175" y="228" font-size="11">token 258 · merge 3</text>
		</g>
		<g>
			<rect
				x="447"
				y="172"
				width="156"
				height="68"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-primary) 10%, transparent); stroke: color-mix(in srgb, var(--color-primary) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="525" y="206" font-size="24">e‿</text>
			<text class="cap" x="525" y="228" font-size="11">token 256 · merge 1</text>
		</g>

		<!-- root tile -->
		<g>
			<rect
				x="260"
				y="34"
				width="180"
				height="72"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-important) 10%, transparent); stroke: color-mix(in srgb, var(--color-important) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="350" y="72" font-size="27">the‿</text>
			<text class="cap" x="350" y="94" font-size="11">token 268 · merge 13</text>
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
		max-width: 620px;
		height: auto;
	}

	text {
		text-anchor: middle;
	}

	.mono {
		font-family: var(--font-mono);
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
