<script lang="ts">
	import { Bot, Hammer, StickyNote, Database, ShieldCheck } from 'lucide-svelte';
	import Callout from '../ui/Callout.svelte';
	import SectionHeader from '../ui/SectionHeader.svelte';
</script>

<section id="part-12" class="py-10">
	<div class="mx-auto max-w-4xl px-6">
		<SectionHeader icon={Bot} partLabel="Part 12" title="Agents" color="var(--color-primary)" />

		<p class="mb-8 text-[15px] leading-relaxed" style="color: var(--color-text-secondary);">
			An agent is not a new kind of model — it's the same next-token predictor emitting tokens that
			make things happen. Quill gets two tools and a job long enough to need them: a story that
			outgrows its own context window.
		</p>

		<Callout type="note" title="Hands-on">
			This chapter's interactive playground arrives with a later milestone.
		</Callout>

		<div id="section-12-1" class="mb-14">
			<SectionHeader
				level="section"
				icon={Hammer}
				title="12.1 Tools as Tokens"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				A tool call is just a special token sequence the model learned to emit, and a tool result is
				just tokens spliced back into its context. Demystifying that loop — the same one under every
				"agentic" product — is the whole point of the chapter.
			</p>
		</div>

		<div id="section-12-2" class="mb-14">
			<SectionHeader
				level="section"
				icon={StickyNote}
				title="12.2 The Scratchpad"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Ask Quill for a story longer than its context window and it forgets its own characters
				mid-tale — the context limit from Part 3, now felt as pain. A note-taking tool is the fix,
				and the limitation itself is the lesson.
			</p>
		</div>

		<div id="section-12-3" class="mb-14">
			<SectionHeader
				level="section"
				icon={Database}
				title="12.3 The Story-World Database"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				The second tool lets Quill query facts about its story world — which character owns which
				dragon, what color the door was. Retrieval in miniature: the model looks things up instead
				of hallucinating them.
			</p>
		</div>

		<div id="section-12-4" class="mb-8">
			<SectionHeader
				level="section"
				icon={ShieldCheck}
				title="12.4 Consistency Rewards"
				color="var(--color-primary)"
			/>
			<p class="mb-4 text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">
				Training the agent closes the course's loop: synthetic tool-use traces from Part 8's
				pipeline, then Part 11's RLVR with verifiers that hunt for contradictions between the story
				and the database. Every act of the course, compounded into one system.
			</p>
		</div>
	</div>
</section>
