<script lang="ts">
	const uid = $props.id();
</script>

<div class="diagram">
	<svg
		viewBox="0 0 900 425"
		role="img"
		aria-label="Attention dataflow: the residual stream is projected into queries, keys and values; queries and keys form scores, the causal mask and softmax turn scores into attention weights, the weights mix the values into an output, and the output is projected and added back to the stream."
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
			<marker
				id="{uid}-aq"
				viewBox="0 0 10 10"
				refX="8.2"
				refY="5"
				markerWidth="11"
				markerHeight="11"
				markerUnits="userSpaceOnUse"
				orient="auto-start-reverse"
			>
				<path d="M 1 1.4 L 9 5 L 1 8.6 L 3.2 5 Z" fill="#5a8fc0" />
			</marker>
			<marker
				id="{uid}-ak"
				viewBox="0 0 10 10"
				refX="8.2"
				refY="5"
				markerWidth="11"
				markerHeight="11"
				markerUnits="userSpaceOnUse"
				orient="auto-start-reverse"
			>
				<path d="M 1 1.4 L 9 5 L 1 8.6 L 3.2 5 Z" fill="#c87142" />
			</marker>
			<marker
				id="{uid}-av"
				viewBox="0 0 10 10"
				refX="8.2"
				refY="5"
				markerWidth="11"
				markerHeight="11"
				markerUnits="userSpaceOnUse"
				orient="auto-start-reverse"
			>
				<path d="M 1 1.4 L 9 5 L 1 8.6 L 3.2 5 Z" fill="#56a884" />
			</marker>
			<filter id="{uid}-sh" x="-30%" y="-30%" width="160%" height="160%">
				<feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-opacity="0.14" />
			</filter>
		</defs>

		<!-- channel edges out of the stream -->
		<path class="edge q" d="M 135 194 C 172 194, 168 80, 203 80" marker-end="url(#{uid}-aq)" />
		<path class="edge k" d="M 135 212 C 165 212, 170 210, 203 210" marker-end="url(#{uid}-ak)" />
		<path class="edge v" d="M 135 230 C 172 230, 168 355, 203 355" marker-end="url(#{uid}-av)" />
		<!-- Q and K meet in the scores -->
		<path class="edge q" d="M 335 80 C 362 80, 360 131, 383 131" marker-end="url(#{uid}-aq)" />
		<path class="edge k" d="M 335 210 C 362 210, 360 159, 383 159" marker-end="url(#{uid}-ak)" />
		<!-- scores → mask+softmax → weights -->
		<path class="edge" d="M 575 145 L 601 145" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 698 172 L 698 236" marker-end="url(#{uid}-a)" />
		<!-- weights and V meet in the output -->
		<path class="edge" d="M 670 292 C 670 322, 625 322, 622 346" marker-end="url(#{uid}-a)" />
		<path class="edge v" d="M 335 355 C 420 355, 430 376, 501 376" marker-end="url(#{uid}-av)" />
		<!-- output → project + add back -->
		<path class="edge" d="M 690 376 L 726 376" marker-end="url(#{uid}-a)" />

		<!-- X: the residual stream -->
		<g>
			<rect
				x="25"
				y="178"
				width="110"
				height="68"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, #d9a441 18%, transparent); stroke: color-mix(in srgb, #d9a441 50%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="80" y="207" font-size="22">X</text>
			<text class="cap" x="80" y="224" font-size="10.5">residual stream</text>
			<text class="cap" x="80" y="238" font-size="10.5">all positions</text>
		</g>

		<!-- Q / K / V projections -->
		<g>
			<rect
				x="205"
				y="55"
				width="130"
				height="50"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, #5a8fc0 12%, transparent); stroke: color-mix(in srgb, #5a8fc0 55%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="270" y="79" font-size="14">Q = X·Wq</text>
			<text class="cap" x="270" y="96" font-size="10">what I'm looking for</text>
		</g>
		<g>
			<rect
				x="205"
				y="185"
				width="130"
				height="50"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, #c87142 12%, transparent); stroke: color-mix(in srgb, #c87142 55%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="270" y="209" font-size="14">K = X·Wk</text>
			<text class="cap" x="270" y="226" font-size="10">what I can be found by</text>
		</g>
		<g>
			<rect
				x="205"
				y="330"
				width="130"
				height="50"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, #56a884 12%, transparent); stroke: color-mix(in srgb, #56a884 55%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="270" y="354" font-size="14">V = X·Wv</text>
			<text class="cap" x="270" y="371" font-size="10">the payload delivered</text>
		</g>

		<!-- scores -->
		<g>
			<rect
				x="385"
				y="118"
				width="190"
				height="54"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-text-muted) 10%, transparent); stroke: color-mix(in srgb, var(--color-text-muted) 40%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="480" y="141" font-size="14">scores = Q·Kᵀ / √dₕ</text>
			<text class="cap" x="480" y="159" font-size="10">every query · every earlier key</text>
		</g>

		<!-- causal mask + softmax -->
		<g>
			<rect
				x="605"
				y="118"
				width="185"
				height="54"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-text-muted) 10%, transparent); stroke: color-mix(in srgb, var(--color-text-muted) 40%, transparent); stroke-width: 1.5;"
			/>
			<g style="fill: color-mix(in srgb, var(--color-text-muted) 45%, transparent);">
				<rect x="620" y="126" width="10" height="10" rx="2" />
				<rect x="620" y="138" width="10" height="10" rx="2" />
				<rect x="632" y="138" width="10" height="10" rx="2" />
				<rect x="620" y="150" width="10" height="10" rx="2" />
				<rect x="632" y="150" width="10" height="10" rx="2" />
				<rect x="644" y="150" width="10" height="10" rx="2" />
			</g>
			<text class="hd" x="722" y="141" font-size="13.5">causal mask</text>
			<text class="hd" x="722" y="159" font-size="13.5">+ softmax</text>
		</g>

		<!-- attention weights -->
		<g>
			<rect
				x="610"
				y="240"
				width="175"
				height="52"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, #b06a82 12%, transparent); stroke: color-mix(in srgb, #b06a82 55%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="697" y="262" font-size="14">attention weights</text>
			<text class="cap" x="697" y="280" font-size="10.5">each row sums to 1</text>
		</g>

		<!-- output -->
		<g>
			<rect
				x="505"
				y="350"
				width="185"
				height="52"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, #b06a82 12%, transparent); stroke: color-mix(in srgb, #b06a82 55%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="597" y="372" font-size="14">output = weights · V</text>
			<text class="cap" x="597" y="390" font-size="10.5">a weighted mix of values</text>
		</g>

		<!-- project + add back to the stream -->
		<g>
			<rect
				x="730"
				y="350"
				width="155"
				height="52"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, #d9a441 18%, transparent); stroke: color-mix(in srgb, #d9a441 50%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="807" y="371" font-size="13.5">project (Wₒ)</text>
			<text class="cap" x="807" y="389" font-size="10.5">add back to the stream</text>
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
		max-width: 780px;
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

	.edge.q {
		stroke: #5a8fc0;
	}

	.edge.k {
		stroke: #c87142;
	}

	.edge.v {
		stroke: #56a884;
	}
</style>
