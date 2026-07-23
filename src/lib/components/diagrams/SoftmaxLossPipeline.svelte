<script lang="ts">
	const uid = $props.id();
</script>

<div class="diagram">
	<svg
		viewBox="0 0 900 225"
		role="img"
		aria-label="From logits to loss: raw logits pass through softmax to become a probability distribution over the vocab, the probability of the actual next token is looked up, and the loss is its negative log."
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

		<path class="edge" d="M 175 122 L 211 122" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 310 122 L 346 122" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 505 122 L 541 122" marker-end="url(#{uid}-a)" />
		<path class="edge" d="M 700 122 L 736 122" marker-end="url(#{uid}-a)" />

		<!-- logits: any real number, positive or negative -->
		<g>
			<rect
				x="20"
				y="40"
				width="155"
				height="165"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-note) 8%, transparent); stroke: color-mix(in srgb, var(--color-note) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="97" y="62" font-size="14.5">logits</text>
			<line x1="36" y1="130" x2="159" y2="130" class="zero" />
			<g style="fill: color-mix(in srgb, var(--color-note) 60%, transparent);">
				<rect x="42" y="104" width="11" height="26" rx="2" />
				<rect x="58.5" y="130" width="11" height="16" rx="2" />
				<rect x="75" y="92" width="11" height="38" rx="2" />
				<rect x="91.5" y="130" width="11" height="28" rx="2" />
				<rect x="108" y="118" width="11" height="12" rx="2" />
				<rect x="124.5" y="82" width="11" height="48" rx="2" />
				<rect x="141" y="130" width="11" height="10" rx="2" />
			</g>
			<text class="cap" x="97" y="180" font-size="10.5">one per vocab token,</text>
			<text class="cap" x="97" y="193" font-size="10.5">any real number</text>
		</g>

		<!-- softmax -->
		<g>
			<rect
				x="215"
				y="92"
				width="95"
				height="60"
				rx="14"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-primary) 10%, transparent); stroke: color-mix(in srgb, var(--color-primary) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="262" y="118" font-size="14">softmax</text>
			<text class="cap" x="262" y="136" font-size="10">exp, normalize</text>
		</g>

		<!-- probability distribution -->
		<g>
			<rect
				x="350"
				y="40"
				width="155"
				height="165"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-primary) 8%, transparent); stroke: color-mix(in srgb, var(--color-primary) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="427" y="62" font-size="14.5">probabilities</text>
			<line x1="366" y1="160" x2="489" y2="160" class="base" />
			<g style="fill: color-mix(in srgb, var(--color-primary) 60%, transparent);">
				<rect x="372" y="150" width="11" height="10" rx="2" />
				<rect x="388.5" y="156" width="11" height="4" rx="1.5" />
				<rect x="405" y="138" width="11" height="22" rx="2" />
				<rect x="421.5" y="158" width="11" height="2" rx="1" />
				<rect x="438" y="154" width="11" height="6" rx="1.5" />
				<rect x="454.5" y="102" width="11" height="58" rx="2" />
				<rect x="471" y="157" width="11" height="3" rx="1" />
			</g>
			<text class="cap" x="427" y="186" font-size="10.5">all positive · sums to 1</text>
		</g>

		<!-- look up the truth -->
		<g>
			<rect
				x="545"
				y="40"
				width="155"
				height="165"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-important) 8%, transparent); stroke: color-mix(in srgb, var(--color-important) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="hd" x="622" y="62" font-size="14">look up the truth</text>
			<line x1="561" y1="160" x2="684" y2="160" class="base" />
			<g style="fill: color-mix(in srgb, var(--color-text-muted) 30%, transparent);">
				<rect x="567" y="150" width="11" height="10" rx="2" />
				<rect x="583.5" y="156" width="11" height="4" rx="1.5" />
				<rect x="600" y="138" width="11" height="22" rx="2" />
				<rect x="616.5" y="158" width="11" height="2" rx="1" />
				<rect x="633" y="154" width="11" height="6" rx="1.5" />
				<rect x="666" y="157" width="11" height="3" rx="1" />
			</g>
			<rect
				x="649.5"
				y="102"
				width="11"
				height="58"
				rx="2"
				style="fill: color-mix(in srgb, var(--color-important) 75%, transparent);"
			/>
			<polygon points="655,98 649,88 661,88" style="fill: var(--color-important);" />
			<text class="mono" x="655" y="82" font-size="10" style="fill: var(--color-important);"
				>truth</text
			>
			<text class="mono" x="622" y="186" font-size="10.5" style="fill: var(--color-text-muted);"
				>p(actual next token)</text
			>
		</g>

		<!-- loss -->
		<g>
			<rect
				x="740"
				y="92"
				width="140"
				height="60"
				rx="10"
				filter="url(#{uid}-sh)"
				style="fill: color-mix(in srgb, var(--color-challenge-bright) 10%, transparent); stroke: color-mix(in srgb, var(--color-challenge-bright) 45%, transparent); stroke-width: 1.5;"
			/>
			<text class="mono" x="810" y="118" font-size="14">loss = −log p</text>
			<text class="cap" x="810" y="136" font-size="10">the model's surprise</text>
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
		max-width: 820px;
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

	.zero {
		stroke: var(--color-text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		opacity: 0.6;
	}

	.base {
		stroke: var(--color-text-muted);
		stroke-width: 1.2;
		opacity: 0.7;
	}
</style>
