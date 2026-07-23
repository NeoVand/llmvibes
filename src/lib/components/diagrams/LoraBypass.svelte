<script lang="ts">
	const uid = $props.id();
</script>

<div class="diagram">
	<svg
		viewBox="0 0 900 380"
		role="img"
		aria-label="LoRA: the input x flows through the big frozen weight matrix W, and also through a low-rank bypass of two thin trainable matrices A and B; the bypass output, scaled by alpha over r, is added to W times x at a plus junction to produce the output h."
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
			<marker
				id="{uid}-aw"
				viewBox="0 0 10 10"
				refX="8.5"
				refY="5"
				markerWidth="7.5"
				markerHeight="7.5"
				orient="auto-start-reverse"
			>
				<path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-warning)" />
			</marker>
			<filter id="{uid}-sh" x="-30%" y="-30%" width="160%" height="160%">
				<feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-opacity="0.14" />
			</filter>
		</defs>

		<!-- main path -->
		<path class="edge" d="M 110 130 L 156 130" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 470 130 L 641 130" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 684 130 L 741 130" marker-end="url(#{uid}-a)" />
		<!-- the bypass detour -->
		<path class="edge w" d="M 70 160 C 70 245, 95 292, 181 292" marker-end="url(#{uid}-aw)" />
		<path class="edge w" d="M 330 292 L 386 292" marker-end="url(#{uid}-aw)" />
		<path class="edge w" d="M 535 292 C 620 292, 665 260, 665 153" marker-end="url(#{uid}-aw)" />

		<!-- input x -->
		<g>
			<rect
				x="30"
				y="102"
				width="80"
				height="56"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, #d9a441 18%, transparent); stroke: color-mix(in srgb, #d9a441 50%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="70" y="130" font-size="20">x</text>
			<text class="cap" x="70" y="147" font-size="10.5">input</text>
		</g>

		<!-- W: the frozen block -->
		<g>
			<rect
				x="160"
				y="40"
				width="310"
				height="180"
				rx="12"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, #64748b 12%, transparent); stroke: color-mix(in srgb, #64748b 40%, transparent); stroke-width: 1.5;"
			>
				<title>Frozen: no gradients, no optimizer state — never touched</title>
			</rect>
			<text class="mono" x="315" y="122" font-size="46">W</text>
			<text class="cap" x="315" y="157" font-size="12.5">frozen — all the pretrained knowledge</text
			>
			<text class="mono" x="315" y="182" font-size="11.5" style="fill: var(--color-text-muted);"
				>d × d</text
			>
			<!-- lock glyph -->
			<path
				d="M 433 64 v -7 a 6.5 6.5 0 0 1 13 0 v 7"
				style="fill: none; stroke: color-mix(in srgb, var(--color-text-muted) 75%, transparent); stroke-width: 2.5; stroke-linecap: round;"
			/>
			<rect
				x="428"
				y="64"
				width="23"
				height="17"
				rx="3"
				style="fill: color-mix(in srgb, var(--color-text-muted) 55%, transparent);"
			/>
		</g>

		<!-- W·x edge label -->
		<g>
			<rect x="525" y="118" width="50" height="24" rx="11" class="pill" />
			<text class="mono" x="550" y="134.5" font-size="12.5">W·x</text>
		</g>

		<!-- the sum -->
		<g>
			<circle
				cx="665"
				cy="130"
				r="19"
				style="fill: var(--color-bg); stroke: var(--color-primary); stroke-width: 2;"
			/>
			<text class="hd" x="665" y="137.5" font-size="22">+</text>
		</g>

		<!-- output h -->
		<g>
			<rect
				x="745"
				y="102"
				width="127"
				height="56"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-tip) 10%, transparent); stroke: color-mix(in srgb, var(--color-tip) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="808" y="130" font-size="20">h</text>
			<text class="cap" x="808" y="147" font-size="10.5">output</text>
		</g>

		<!-- A: down-projection -->
		<g>
			<rect
				x="185"
				y="264"
				width="145"
				height="56"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-warning) 12%, transparent); stroke: color-mix(in srgb, var(--color-warning) 50%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="257" y="288" font-size="14">A — trainable</text>
			<text class="cap" x="257" y="307" font-size="11">down-project to rank r</text>
		</g>

		<!-- B: up-projection, zero-init -->
		<g>
			<rect
				x="390"
				y="264"
				width="145"
				height="56"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-warning) 12%, transparent); stroke: color-mix(in srgb, var(--color-warning) 50%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="462" y="288" font-size="14">B — trainable</text>
			<text class="cap" x="462" y="307" font-size="11">up-project · starts at 0</text>
		</g>

		<!-- α/r scale on the way back up -->
		<g>
			<rect x="632" y="213" width="60" height="24" rx="11" class="pill" />
			<text class="mono" x="662" y="229.5" font-size="12">× α/r</text>
		</g>

		<!-- what the detour learns -->
		<text x="360" y="356" font-size="11.5" text-anchor="middle">
			<tspan class="mono" style="fill: var(--color-text-secondary);">ΔW = B·A</tspan>
			<tspan class="cap">— the learned change, a sliver of W</tspan>
		</text>
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
	}

	.edge.w {
		stroke: var(--color-warning);
	}

	.pill {
		fill: var(--color-bg);
		stroke: var(--color-border);
		stroke-width: 1;
	}
</style>
