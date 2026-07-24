<script lang="ts">
	const uid = $props.id();
</script>

<div class="diagram">
	<svg
		viewBox="0 0 900 610"
		role="img"
		aria-label="Self-Instruct pipeline: human-written seed tasks prompt a generator LLM to write new instructions, a filter drops near-duplicates and malformed tasks, surviving instructions loop back into the seed pool while the generator writes responses for them, a verifier filters for quality, and the result fine-tunes the student model."
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

		<!-- main flow -->
		<path class="edge" d="M 520 88 L 520 124" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 520 188 L 520 224" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 520 288 L 520 324" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 520 388 L 520 424" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 520 488 L 520 524" marker-end="url(#{uid}-a)" />
		<!-- the feedback loop -->
		<path
			class="edge"
			d="M 310 258 C 200 258, 155 235, 155 175 L 155 140 C 155 80, 200 58, 302 58"
			marker-end="url(#{uid}-a)"
		/>
		<g>
			<rect x="92" y="136" width="126" height="46" rx="12" class="pill" />
			<text class="cap" x="155" y="155" font-size="12">survivors join</text>
			<text class="cap" x="155" y="171" font-size="12">the seed pool</text>
		</g>

		<!-- seed tasks -->
		<g>
			<rect
				x="310"
				y="28"
				width="420"
				height="60"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 10%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="520" y="53" font-size="15">seed tasks</text>
			<text class="cap" x="520" y="73" font-size="11.5">a few hundred, human-written</text>
		</g>

		<!-- generator writes instructions -->
		<g>
			<rect
				x="310"
				y="128"
				width="420"
				height="60"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-vibe) 10%, transparent); stroke: color-mix(in srgb, var(--color-vibe) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="520" y="153" font-size="14">generator LLM writes new instructions</text>
			<text class="cap" x="520" y="173" font-size="11.5"
				>prompted with random seeds as examples</text
			>
		</g>

		<!-- filter -->
		<g>
			<rect
				x="310"
				y="228"
				width="420"
				height="60"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-warning) 10%, transparent); stroke: color-mix(in srgb, var(--color-warning) 45%, transparent); stroke-width: 1.5;"
			/>
			<polygon
				points="338,246 374,246 362,262 362,274 350,274 350,262"
				style="fill: color-mix(in srgb, var(--color-warning) 45%, transparent);"
			/>
			<text class="hd" x="520" y="253" font-size="15">filter</text>
			<text class="cap" x="520" y="273" font-size="11.5"
				>drop near-duplicates, malformed or unanswerable tasks</text
			>
		</g>

		<!-- generator writes responses -->
		<g>
			<rect
				x="310"
				y="328"
				width="420"
				height="60"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-vibe) 10%, transparent); stroke: color-mix(in srgb, var(--color-vibe) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="520" y="353" font-size="14">generator LLM writes a response</text>
			<text class="cap" x="520" y="373" font-size="11.5">for each surviving instruction</text>
		</g>

		<!-- verifier -->
		<g>
			<rect
				x="310"
				y="428"
				width="420"
				height="60"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-challenge-bright) 10%, transparent); stroke: color-mix(in srgb, var(--color-challenge-bright) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="520" y="453" font-size="15">verifier / quality filter</text>
			<text class="cap" x="520" y="473" font-size="11.5">generate cheap, filter hard</text>
		</g>

		<!-- fine-tune -->
		<g>
			<rect
				x="310"
				y="528"
				width="420"
				height="60"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-tip) 10%, transparent); stroke: color-mix(in srgb, var(--color-tip) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="520" y="553" font-size="15">fine-tune the student model</text>
			<text class="cap" x="520" y="573" font-size="11.5"
				>a few hundred seeds → tens of thousands of pairs</text
			>
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

	.edge {
		stroke: var(--color-text-muted);
		stroke-width: 1.7;
		fill: none;
		stroke-linecap: round;
	}

	.pill {
		fill: var(--color-bg);
		stroke: var(--color-border);
		stroke-width: 1;
	}
</style>
