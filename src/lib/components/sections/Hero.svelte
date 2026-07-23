<script lang="ts">
	import { Bot, Castle, Feather, MonitorSmartphone } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import CourseMap from '../ui/CourseMap.svelte';

	let {
		onOpenAgent
	}: {
		onOpenAgent?: () => void;
	} = $props();

	const stats = ['14 parts', '2 birds', '100% in your browser', '100% free'];
</script>

<section id="hero" class="px-6 py-16">
	<h1 class="sr-only">LLMVibes</h1>

	<!-- Title block — course art lands with a later milestone; until then the
	     wordmark carries the opening. -->
	<div class="mx-auto mb-12 max-w-4xl">
		<p
			class="text-[40px] leading-tight font-bold sm:text-[52px]"
			style="color: var(--color-text); letter-spacing: -0.03em; font-family: var(--font-heading);"
			aria-hidden="true"
		>
			LLMVibes
		</p>
		<p class="mt-3 text-[17px] leading-relaxed" style="color: var(--color-text-secondary);">
			Raise two tiny language models — <strong style="color: var(--color-text);"
				>Quill the storyteller</strong
			>
			and <strong style="color: var(--color-text);">Rook the chess player</strong> — from raw data to
			aligned, reasoning models, entirely in your browser: pretraining → SFT → RLHF/DPO → RLVR.
		</p>
	</div>

	<!-- Welcome + quick links -->
	<div class="mx-auto mb-16 max-w-4xl">
		<p class="mb-5 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
			<strong style="color: var(--color-text);">Welcome!</strong> This course walks the full modern
			LLM pipeline on two models small enough to train live while you watch. Every stage a frontier
			lab runs — data cleaning, tokenization, pretraining, instruction tuning, preference
			optimization, reinforcement learning on verifiable rewards — you will run yourself, on your
			own hardware, in this tab. The thesis the whole course keeps returning to:
			<em>it's all next-token prediction over token streams.</em>
		</p>

		<div class="mb-5 flex flex-wrap gap-2">
			{#each stats as stat (stat)}
				<span
					class="rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
					style="background: var(--color-surface); color: var(--color-primary-text); border: 1px solid var(--color-border);"
				>
					{stat}
				</span>
			{/each}
		</div>

		<div class="space-y-3">
			<div
				class="flex items-start gap-3 rounded-lg px-5 py-4 text-left"
				style="background: var(--color-surface);"
			>
				<Feather size={18} class="mt-0.5 flex-shrink-0" style="color: var(--color-primary);" />
				<p class="text-[13px] leading-relaxed" style="color: var(--color-text-secondary);">
					<strong style="color: var(--color-text);">Quill</strong> is a TinyStories-class English
					storyteller. It leads the chapters on tokenization, synthetic data, and the
					you-are-the-annotator RLHF loop — by the end it writes the story <em>you</em> shaped it to write.
				</p>
			</div>

			<div
				class="flex items-start gap-3 rounded-lg px-5 py-4 text-left"
				style="background: var(--color-note-bg);"
			>
				<Castle size={18} class="mt-0.5 flex-shrink-0" style="color: var(--color-note);" />
				<p class="text-[13px] leading-relaxed" style="color: var(--color-text-secondary);">
					<strong style="color: var(--color-text);">Rook</strong> is a chess-move model. It leads the
					chapters on verifiable rewards and interpretability — including the moment you open its residual
					stream and find a chessboard inside. A rook is a corvid; a quill is a feather. You are raising
					two birds.
				</p>
			</div>

			<div
				class="flex items-start gap-3 rounded-lg px-5 py-4 text-left"
				style="background: color-mix(in srgb, var(--color-btn-agent) 12%, transparent);"
			>
				<Bot size={18} class="mt-0.5 flex-shrink-0" style="color: var(--color-btn-agent);" />
				<p class="text-[13px] leading-relaxed" style="color: var(--color-text-secondary);">
					<strong style="color: var(--color-text);">Stuck on a passage?</strong> The
					<button
						type="button"
						onclick={onOpenAgent}
						class="cursor-pointer font-medium underline underline-offset-2"
						style="color: var(--color-btn-agent);">AI tutor</button
					>
					in the header answers from this course and cites the section it drew on — a small language model
					helping you raise two smaller ones.
				</p>
			</div>

			<div
				class="flex items-start gap-3 rounded-lg px-5 py-4 text-left"
				style="background: var(--color-important-bg);"
			>
				<MonitorSmartphone
					size={18}
					class="mt-0.5 flex-shrink-0"
					style="color: var(--color-important);"
				/>
				<p class="text-[13px] leading-relaxed" style="color: var(--color-text-secondary);">
					<strong style="color: var(--color-text);">Sister courses:</strong>
					<a
						href="https://neovand.github.io/terminalvibes/"
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium underline underline-offset-2"
						style="color: var(--color-important);">TerminalVibes</a
					>
					teaches the command line from zero and
					<a
						href="https://neovand.github.io/gitvibes/"
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium underline underline-offset-2"
						style="color: var(--color-important);">GitVibes</a
					>
					teaches version control, in the same visual, hands-on style. Neither is required here — this
					course only assumes curiosity.
				</p>
			</div>
		</div>

		<Callout type="note" title="How the training runs">
			Everything trains through WebGPU, right in this tab — no cloud, no sign-up, no GPU cluster.
			The live pair are ~5M-parameter models that pretrain in about a coffee break; their larger
			flagship siblings ship as downloadable checkpoints with a scrubbable training history. The
			interactive playgrounds arrive with later milestones; the chapters below sketch the road.
		</Callout>

		<!-- Offered after the companions rather than before: it answers "what
		     order, and what can I skip?", which is a question you only have once
		     you have decided to start. -->
		<div class="mt-6">
			<CourseMap />
		</div>
	</div>
</section>
