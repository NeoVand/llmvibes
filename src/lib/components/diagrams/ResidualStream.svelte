<script lang="ts">
	const uid = $props.id();
</script>

<div class="diagram">
	<svg
		viewBox="0 0 900 730"
		role="img"
		aria-label="The residual stream drawn as a vertical highway: token ids are embedded, the stream flows upward through repeated blocks where attention and the MLP each read the stream, compute, and add their result back, and the final vector is unembedded into next-token probabilities."
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

		<!-- the residual stream: one gold highway, bottom to top -->
		<g>
			<rect
				x="266"
				y="152"
				width="48"
				height="438"
				rx="10"
				style="fill: color-mix(in srgb, #d9a441 35%, transparent); stroke: color-mix(in srgb, #d9a441 55%, transparent); stroke-width: 1;"
			>
				<title>The residual stream — one 128-dim vector per position, accumulated by addition</title
				>
			</rect>
			<!-- upward-flow chevrons -->
			<path class="chev" d="M 278 566 l 12 -9 l 12 9" />
			<path class="chev" d="M 278 462 l 12 -9 l 12 9" />
			<path class="chev" d="M 278 305 l 12 -9 l 12 9" />
			<path class="chev" d="M 278 195 l 12 -9 l 12 9" />
		</g>
		<text
			class="hd"
			font-size="13"
			transform="rotate(-90 250 371)"
			x="250"
			y="371"
			style="fill: color-mix(in srgb, #d9a441 70%, var(--color-text));">residual stream</text
		>

		<!-- the repeated block -->
		<rect
			x="232"
			y="232"
			width="640"
			height="342"
			rx="14"
			style="fill: none; stroke: color-mix(in srgb, var(--color-text-muted) 45%, transparent); stroke-width: 1.2; stroke-dasharray: 6 6;"
		/>
		<text class="cap" x="858" y="254" font-size="12.5" text-anchor="end"
			>one block — repeated ×N</text
		>

		<!-- attention branch (first sub-layer, lower on the highway) -->
		<path class="edge" d="M 314 520 L 362 520" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 430 520 L 464 520" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 560 486 C 560 438, 390 420, 310 420" marker-end="url(#{uid}-a)" />
		<g>
			<rect
				x="366"
				y="503"
				width="64"
				height="34"
				rx="17"
				style="fill: color-mix(in srgb, var(--color-text-muted) 10%, transparent); stroke: color-mix(in srgb, var(--color-text-muted) 40%, transparent); stroke-width: 1.3;"
			/>
			<text class="hd" x="398" y="524.5" font-size="12.5">norm</text>
		</g>
		<g>
			<rect
				x="468"
				y="488"
				width="370"
				height="64"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, #b06a82 12%, transparent); stroke: color-mix(in srgb, #b06a82 50%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="653" y="514" font-size="15">attention</text>
			<text class="cap" x="653" y="535" font-size="11.5">mixes information between positions</text>
		</g>
		<g>
			<circle
				cx="290"
				cy="420"
				r="15"
				style="fill: var(--color-bg); stroke: color-mix(in srgb, #d9a441 70%, transparent); stroke-width: 2;"
			/>
			<text class="hd" x="290" y="426.5" font-size="18">+</text>
		</g>

		<!-- MLP branch (second sub-layer, higher on the highway) -->
		<path class="edge" d="M 314 360 L 362 360" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 430 360 L 464 360" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 560 326 C 560 288, 390 258, 310 258" marker-end="url(#{uid}-a)" />
		<g>
			<rect
				x="366"
				y="343"
				width="64"
				height="34"
				rx="17"
				style="fill: color-mix(in srgb, var(--color-text-muted) 10%, transparent); stroke: color-mix(in srgb, var(--color-text-muted) 40%, transparent); stroke-width: 1.3;"
			/>
			<text class="hd" x="398" y="364.5" font-size="12.5">norm</text>
		</g>
		<g>
			<rect
				x="468"
				y="328"
				width="370"
				height="64"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-tip) 12%, transparent); stroke: color-mix(in srgb, var(--color-tip) 50%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="653" y="354" font-size="15">MLP</text>
			<text class="cap" x="653" y="375" font-size="11.5">processes each position alone</text>
		</g>
		<g>
			<circle
				cx="290"
				cy="258"
				r="15"
				style="fill: var(--color-bg); stroke: color-mix(in srgb, #d9a441 70%, transparent); stroke-width: 2;"
			/>
			<text class="hd" x="290" y="264.5" font-size="18">+</text>
		</g>

		<!-- bottom: tokens in -->
		<g>
			<rect
				x="180"
				y="668"
				width="220"
				height="48"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 10%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="290" y="688" font-size="14">token ids</text>
			<text class="mono" x="290" y="706" font-size="12" style="fill: var(--color-text-muted);"
				>[ 42, 17, 96, … ]</text
			>
		</g>
		<path class="edge" d="M 290 666 L 290 648" marker-end="url(#{uid}-a)" />
		<g>
			<rect
				x="160"
				y="590"
				width="260"
				height="52"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-primary) 10%, transparent); stroke: color-mix(in srgb, var(--color-primary) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="290" y="611" font-size="14.5">embedding</text>
			<text class="cap" x="290" y="630" font-size="11.5">one learned row per token</text>
		</g>

		<!-- top: probabilities out -->
		<g>
			<rect
				x="150"
				y="100"
				width="280"
				height="52"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-primary) 10%, transparent); stroke: color-mix(in srgb, var(--color-primary) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="290" y="121" font-size="14.5">unembedding</text>
			<text class="cap" x="290" y="140" font-size="11.5">score every token in the vocab</text>
		</g>
		<path class="edge" d="M 290 98 L 290 74" marker-end="url(#{uid}-a)" />
		<g>
			<rect
				x="160"
				y="20"
				width="260"
				height="48"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-important) 10%, transparent); stroke: color-mix(in srgb, var(--color-important) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="290" y="49" font-size="14.5">next-token probabilities</text>
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
		max-width: 720px;
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

	.mono {
		font-family: var(--font-mono);
		fill: var(--color-text);
	}

	.edge {
		stroke: var(--color-text-muted);
		stroke-width: 1.7;
		fill: none;
		stroke-linecap: round;
	}

	.chev {
		stroke: color-mix(in srgb, #d9a441 80%, transparent);
		stroke-width: 2.5;
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
