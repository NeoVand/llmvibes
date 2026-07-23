<script lang="ts">
	const uid = $props.id();
</script>

<div class="diagram">
	<svg
		viewBox="0 0 900 272"
		role="img"
		aria-label="The pipeline both birds travel: raw corpus to tokens to pretraining to SFT to preference tuning to RLVR, ending with Quill and Rook fully raised."
	>
		<defs>
			<marker
				id="{uid}-a"
				viewBox="0 0 10 10"
				refX="8.5"
				refY="5"
				markerWidth="7.5"
				markerHeight="7.5"
				orient="auto-start-reverse"
			>
				<path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-text-muted)" />
			</marker>
			<filter id="{uid}-sh" x="-30%" y="-30%" width="160%" height="160%">
				<feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-opacity="0.14" />
			</filter>
		</defs>

		<!-- row 1 edges -->
		<path class="edge" d="M 170 67 L 236 67" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 360 67 L 426 67" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 585 67 L 651 67" marker-end="url(#{uid}-a)" />
		<!-- wrap-around from SFT down to row 2 -->
		<path class="edge" d="M 710 94 C 710 150, 185 140, 185 194" marker-end="url(#{uid}-a)" />
		<!-- row 2 edges -->
		<path class="edge" d="M 280 227 L 346 227" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 460 227 L 526 227" marker-end="url(#{uid}-a)" />

		<!-- raw corpus -->
		<g>
			<rect
				x="30"
				y="40"
				width="140"
				height="54"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 10%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="100" y="63" font-size="15">raw corpus</text>
			<text class="cap" x="100" y="82" font-size="11">Part 1</text>
		</g>

		<!-- tokens -->
		<g>
			<rect
				x="240"
				y="40"
				width="120"
				height="54"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 10%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="300" y="63" font-size="15">tokens</text>
			<text class="cap" x="300" y="82" font-size="11">Part 2</text>
		</g>

		<!-- pretraining -->
		<g>
			<rect
				x="430"
				y="40"
				width="155"
				height="54"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-primary) 10%, transparent); stroke: color-mix(in srgb, var(--color-primary) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="507" y="63" font-size="15">pretraining</text>
			<text class="cap" x="507" y="82" font-size="11">Parts 2–6</text>
		</g>

		<!-- SFT -->
		<g>
			<rect
				x="655"
				y="40"
				width="110"
				height="54"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-vibe) 10%, transparent); stroke: color-mix(in srgb, var(--color-vibe) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="710" y="63" font-size="15">SFT</text>
			<text class="cap" x="710" y="82" font-size="11">Part 7</text>
		</g>

		<!-- preference tuning -->
		<g>
			<rect
				x="90"
				y="200"
				width="190"
				height="54"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-important) 10%, transparent); stroke: color-mix(in srgb, var(--color-important) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="185" y="223" font-size="15">preference tuning</text>
			<text class="cap" x="185" y="242" font-size="11">Parts 9–10</text>
		</g>

		<!-- RLVR -->
		<g>
			<rect
				x="350"
				y="200"
				width="110"
				height="54"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-challenge-bright) 10%, transparent); stroke: color-mix(in srgb, var(--color-challenge-bright) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="405" y="223" font-size="15">RLVR</text>
			<text class="cap" x="405" y="242" font-size="11">Part 11</text>
		</g>

		<!-- raised birds -->
		<g>
			<rect
				x="530"
				y="200"
				width="230"
				height="54"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-tip) 10%, transparent); stroke: color-mix(in srgb, var(--color-tip) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="645" y="223" font-size="15">Quill &amp; Rook, raised</text>
			<text class="cap" x="645" y="242" font-size="11">the finished birds</text>
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

	.edge {
		stroke: var(--color-text-muted);
		stroke-width: 1.7;
		fill: none;
	}
</style>
