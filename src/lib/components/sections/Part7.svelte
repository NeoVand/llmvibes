<script lang="ts">
	import {
		GraduationCap,
		FileText,
		MessageSquare,
		Feather,
		SlidersHorizontal,
		ArrowLeftRight
	} from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-7" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader
			icon={GraduationCap}
			partLabel="Part 7"
			title="SFT + LoRA"
			color="var(--color-primary)"
		/>

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			Pretrained Quill continues stories; it doesn't follow instructions. Act III opens with the
			technique that turns a text-completer into an assistant — supervised fine-tuning — and the
			low-rank trick that makes fine-tuning big models affordable enough to run in a browser tab.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-7-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={FileText}
				title="7.1 Instruction Data"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The only difference between a completer and an assistant is what it was fine-tuned on: pairs
				of instructions and responses. TinyStories-Instruct gives Quill exactly that — write a story
				about a brave fox, and a story about a brave fox follows.
			</p>
		</div>

		<div id="section-7-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={MessageSquare}
				title="7.2 Chat Templates & Loss Masking"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Under every chat interface is a rigid token format: special tokens fencing off who said
				what, a loss mask so the model learns to write answers rather than questions, and an EOS
				token so it knows when to stop. The inspector makes all three visible.
			</p>
		</div>

		<div id="section-7-3" class="mb-14">
			<SectionHeader level="section" icon={Feather} title="7.3 LoRA" color="var(--color-primary)" />
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Instead of updating millions of weights, freeze them and train two thin matrices per layer.
				LoRA is how the flagship birds get fine-tuned inside your browser — and toggling the adapter
				off instantly recovers the original model, a trick later chapters lean on hard.
			</p>
		</div>

		<div id="section-7-4" class="mb-14">
			<SectionHeader
				level="section"
				icon={SlidersHorizontal}
				title="7.4 Conditioning vs Fine-Tuning"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Two ways to make Rook play stronger: fine-tune it on elite games, or just prepend a high-Elo
				token and ask. Comparing them side by side makes a deep distinction visceral — changing the
				weights versus changing the prompt.
			</p>
		</div>

		<div id="section-7-5" class="mb-8">
			<SectionHeader
				level="section"
				icon={ArrowLeftRight}
				title="7.5 Before & After"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Every stage boundary in this course ends the same way: the same prompts, the same positions,
				before and after. Here it's the first one — base Quill versus instruct Quill — plus an
				honest look at what fine-tuning quietly made worse.
			</p>
		</div>
	</div>
</section>
