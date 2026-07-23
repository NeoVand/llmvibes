<script lang="ts">
	import { Network, Layers, Eye, RotateCw, Box } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-3" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={Network}
			partLabel="Part 3"
			title="The Transformer"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			The same few hundred lines of architecture power Quill, Rook, and every frontier model you've
			heard of. This chapter builds the modern decoder block one sub-layer at a time — with Rook in
			the lead, because attention drawn as arrows on a chessboard is attention you can actually see.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-3-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Layers}
				title="3.1 Embeddings & the Residual Stream"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Every token becomes a vector, and every vector flows down one shared highway — the residual
				stream — that each layer reads from and writes back to. Getting this picture right first
				makes everything else in the transformer feel inevitable rather than arbitrary.
			</p>
		</div>

		<div id="section-3-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={Eye}
				title="3.2 Attention, Two Ways"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Attention lets every token look back at every token before it and decide what matters. For
				Quill that's spans of text lighting up; for Rook it's arrows between moves on a board — one
				mechanism, two visualizations, and the contrast is the lesson.
			</p>
		</div>

		<div id="section-3-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={RotateCw}
				title="3.3 RoPE & Context Windows"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Attention by itself has no idea which token came first — position has to be smuggled in, and
				rotary embeddings are how modern models do it. Along the way: what a context window actually
				is, and why every model eventually runs out of one.
			</p>
		</div>

		<div id="section-3-4" class="mb-8">
			<SectionHeader
				level="section"
				icon={Box}
				title="3.4 SwiGLU, RMSNorm, the Block"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The last pieces click in: the gated feed-forward network where most of the parameters live,
				the normalization that keeps activations sane, and the pre-norm wiring that stacks it all
				into a block you can repeat a dozen times to get a real model.
			</p>
		</div>
	</div>
</section>
