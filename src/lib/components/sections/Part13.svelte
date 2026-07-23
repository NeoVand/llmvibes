<script lang="ts">
	import { Zap, Split, Wand2, Archive, Shrink, FastForward, Star } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-13" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={Zap}
			partLabel="Part 13"
			title="Frontier & Inference"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			What separates your 25M-parameter birds from a frontier model, besides zeros? This chapter
			tries the frontier's tricks at toy scale and reports honestly which ones help — then turns to
			inference, where a bag of clever engineering makes generation fast enough to feel alive.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-13-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Split}
				title="13.1 Mixture of Experts"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Replace one feed-forward network with many and route each token to a couple of them: more
				parameters, same compute per token. A routing visualization shows which experts wake up for
				which tokens — and whether any of it helps at this scale.
			</p>
		</div>

		<div id="section-13-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Wand2}
				title="13.2 MTP, Muon, QK-Clip"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Three tricks from recent frontier papers, each tried live: predicting several tokens ahead,
				racing the Muon optimizer against AdamW, and deliberately inducing an attention-logit
				explosion so QK-clip has something to fix. Verdicts included, hype not.
			</p>
		</div>

		<div id="section-13-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={Archive}
				title="13.3 KV Cache & Sampling"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Without a cache, generating each token recomputes attention over everything before it.
				Toggle the KV cache and feel tokens-per-second jump — then finish the sampling toolbox with
				top-k and top-p, the dials temperature left unexplained in Part 5.
			</p>
		</div>

		<div id="section-13-4" class="mb-14">
			<SectionHeader
				level="section"
				icon={Shrink}
				title="13.4 Quantization"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Squeeze weights from 16 bits to 8 to 4 and watch memory shrink while Quill's prose slowly
				coarsens. Quantization is why big models fit on small machines — and reading degraded
				stories side by side makes its cost tangible.
			</p>
		</div>

		<div id="section-13-5" class="mb-14">
			<SectionHeader
				level="section"
				icon={FastForward}
				title="13.5 Speculative Decoding"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Little live-Quill drafts a burst of tokens; big flagship-Quill checks the whole burst in one
				pass and keeps what it agrees with. Same output distribution, several times the speed — your
				two birds, cooperating at last.
			</p>
		</div>

		<div id="section-13-6" class="mb-8">
			<SectionHeader
				level="section"
				icon={Star}
				title="13.6 The SmolLM Cameo"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				A real pretrained 135M-parameter model runs beside Quill for a direct conversation between
				scales. Same architecture, same sampling loop, just more of everything — the point of the
				whole course, made talkable.
			</p>
		</div>
	</div>
</section>
