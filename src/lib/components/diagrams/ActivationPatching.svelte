<script lang="ts">
	const uid = $props.id();
</script>

<div class="diagram">
	<svg
		viewBox="0 0 900 595"
		role="img"
		aria-label="Activation patching: the move tokens run through layers 1 to k normally, the residual-stream vector is captured and edited along the probe's direction to flip one square's contents, the remaining layers run on the edited activation, and the model's chosen move is compared."
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
				id="{uid}-ac"
				viewBox="0 0 10 10"
				refX="8.5"
				refY="5"
				markerWidth="7.5"
				markerHeight="7.5"
				orient="auto-start-reverse"
			>
				<path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-challenge-bright)" />
			</marker>
			<filter id="{uid}-sh" x="-30%" y="-30%" width="160%" height="160%">
				<feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-opacity="0.14" />
			</filter>
		</defs>

		<!-- main pipe -->
		<path class="edge" d="M 340 76 L 340 102" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 340 186 L 340 213" marker-end="url(#{uid}-a)" />
		<!-- the original vector does NOT flow on: dashed, bypassed -->
		<line x1="340" y1="249" x2="340" y2="341" class="cut" />
		<path class="edge" d="M 340 373 L 340 400" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 340 484 L 340 511" marker-end="url(#{uid}-a)" />
		<!-- the detour through the edit -->
		<path class="edge" d="M 357 232 L 536 232" marker-end="url(#{uid}-a)" />
		<path class="edge c" d="M 600 296 C 600 340, 430 358, 359 358" marker-end="url(#{uid}-ac)" />

		<!-- input -->
		<g>
			<rect
				x="205"
				y="24"
				width="270"
				height="52"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 10%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="340" y="46" font-size="14">input — the moves so far</text>
			<text class="mono" x="340" y="65" font-size="12.5" style="fill: var(--color-text-muted);"
				>e2e4 g8f6 d2d4 …</text
			>
		</g>

		<!-- layers 1..k -->
		<g>
			<rect
				x="215"
				y="106"
				width="250"
				height="80"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-primary) 10%, transparent); stroke: color-mix(in srgb, var(--color-primary) 45%, transparent); stroke-width: 1.5;"
			/>
			<g style="fill: color-mix(in srgb, var(--color-primary) 45%, transparent);">
				<rect x="232" y="126" width="30" height="5" rx="2.5" />
				<rect x="232" y="143" width="30" height="5" rx="2.5" />
				<rect x="232" y="160" width="30" height="5" rx="2.5" />
			</g>
			<text class="hd" x="355" y="142" font-size="15">layers 1 … k</text>
			<text class="cap" x="355" y="162" font-size="11.5">run normally</text>
		</g>

		<!-- capture junction -->
		<g>
			<circle
				cx="340"
				cy="232"
				r="15"
				style="fill: var(--color-bg); stroke: color-mix(in srgb, #d9a441 70%, transparent); stroke-width: 2;"
			/>
			<circle
				cx="340"
				cy="232"
				r="4.5"
				style="fill: color-mix(in srgb, #d9a441 80%, transparent);"
			/>
		</g>
		<text class="cap" x="300" y="228" font-size="12.5" text-anchor="end">capture the</text>
		<text class="cap" x="300" y="243" font-size="12.5" text-anchor="end"
			>residual-stream vector</text
		>

		<!-- the edit -->
		<g>
			<rect
				x="540"
				y="178"
				width="340"
				height="118"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-challenge-bright) 9%, transparent); stroke: color-mix(in srgb, var(--color-challenge-bright) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="710" y="206" font-size="14.5">edit along the probe direction</text>
			<text class="cap" x="710" y="228" font-size="11.5">flip one square's contents</text>
			<circle
				cx="640"
				cy="262"
				r="5"
				style="fill: none; stroke: var(--color-text-muted); stroke-width: 1.6;"
			/>
			<path class="edge" d="M 650 262 L 736 262" marker-end="url(#{uid}-ac)" />
			<circle cx="750" cy="262" r="5.5" style="fill: var(--color-challenge-bright);" />
			<text class="cap" x="640" y="283" font-size="10">old belief</text>
			<text class="cap" x="750" y="283" font-size="10">new belief</text>
		</g>

		<!-- inject junction -->
		<g>
			<circle
				cx="340"
				cy="358"
				r="15"
				style="fill: var(--color-bg); stroke: color-mix(in srgb, #d9a441 70%, transparent); stroke-width: 2;"
			/>
			<circle cx="340" cy="358" r="4.5" style="fill: var(--color-challenge-bright);" />
		</g>
		<text class="cap" x="300" y="354" font-size="12.5" text-anchor="end">resume with the</text>
		<text class="cap" x="300" y="369" font-size="12.5" text-anchor="end">edited vector</text>

		<!-- layers k+1..end -->
		<g>
			<rect
				x="215"
				y="404"
				width="250"
				height="80"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-primary) 10%, transparent); stroke: color-mix(in srgb, var(--color-primary) 45%, transparent); stroke-width: 1.5;"
			/>
			<g style="fill: color-mix(in srgb, var(--color-primary) 45%, transparent);">
				<rect x="232" y="424" width="30" height="5" rx="2.5" />
				<rect x="232" y="441" width="30" height="5" rx="2.5" />
				<rect x="232" y="458" width="30" height="5" rx="2.5" />
			</g>
			<text class="hd" x="355" y="440" font-size="15">layers k+1 … end</text>
			<text class="cap" x="355" y="460" font-size="11.5">run on the edited activation</text>
		</g>

		<!-- compare -->
		<g>
			<rect
				x="185"
				y="515"
				width="310"
				height="60"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-tip) 10%, transparent); stroke: color-mix(in srgb, var(--color-tip) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="340" y="539" font-size="15">compare</text>
			<text class="cap" x="340" y="559" font-size="12">which move does the model choose now?</text>
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

	.mono {
		font-family: var(--font-mono);
		fill: var(--color-text);
	}

	.edge {
		stroke: var(--color-text-muted);
		stroke-width: 1.7;
		fill: none;
	}

	.edge.c {
		stroke: var(--color-challenge-bright);
	}

	.cut {
		stroke: var(--color-text-muted);
		stroke-width: 1.7;
		stroke-dasharray: 5 5;
		opacity: 0.45;
	}
</style>
