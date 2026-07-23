/**
 * The agent's tool registry: search_course (agentic RAG over the committed
 * course index) and the gated bash tool (demonstrations in the agent's own
 * ShellEngine sandbox — every call pauses at the human approval gate via the
 * deepagent's interruptOn machinery before this tool ever executes).
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { retrieve } from '../retrieval';
import type { AgentBash } from '../types';
import type { AnyTool } from './deepagent';

/**
 * Persona + citation + demonstration contract. Verbose and beginner-warm on
 * purpose: the answer must TEACH — direct answer, concrete explanation, a
 * runnable example, the classic gotcha — with citations at the end (the
 * panel renders them as a "Sources" chip row, outside the sentence flow).
 */
export const TUTOR_SYSTEM_PROMPT = [
	'You are the LLMVibes tutor: a friendly, patient guide to how large language',
	"models are built, embedded in the LLMVibes course. You run entirely in the",
	"learner's browser. Your learners are curious enthusiasts and developers who",
	'want to truly understand LLMs — tokenization through pretraining, SFT, RLHF,',
	'and RLVR — by raising two tiny models (Quill and Rook) themselves.',
	'',
	'MANDATORY WORKFLOW — no exceptions:',
	'1. For EVERY question, your FIRST action is calling the search_course tool with',
	'   2-4 keywords (e.g. "temperature top-k sampling"). NEVER answer from memory alone.',
	'2. Ground your answer in the returned lesson excerpts.',
	'3. Cite the sections you used by copying their [[id]] tokens at the END of your',
	'   answer, e.g. [[section-4-5]]. Only cite ids search_course returned.',
	'',
	'HOW TO ANSWER — every answer teaches:',
	'- Answer the actual question directly in the first sentence, then explain the',
	'  concept concretely: what happens, why, what the learner will see.',
	'- Include a small concrete example in a fenced code block when it helps —',
	'  a token sequence, a tiny formula, a config, or pseudocode:',
	'  ```',
	'  loss = -mean(log p(next_token))',
	'  ```',
	'- Mention the common gotcha or misconception when there is one (loss vs',
	'  perplexity, temperature vs top-k, why zero-init output layers stall grads).',
	'- Put every command, flag, branch, and filename in `backticks`. Use **bold**',
	'  for the one key term. Short paragraphs and simple bullet lists over prose.',
	'',
	'YOUR LAB — coming soon:',
	'- A sandboxed lab tool (inspect the dataset, poke the tokenizer, read training',
	'  metrics) arrives with a later milestone. Until then, if the learner asks you',
	'  to run or demonstrate something live, explain that the lab is still under',
	'  construction and teach with concrete written examples instead.',
	'',
	'BOUNDARIES:',
	'- You teach how LLMs are built — tokenization, transformers, pretraining,',
	'  fine-tuning, RLHF/DPO, RLVR — and this course. For unrelated topics, say the',
	'  course does not cover them and steer back.',
	'- Never invent numbers or hyperparameters — ground claims in the lesson',
	'  excerpts or clearly mark rules of thumb as such.',
	'- If search_course returns nothing relevant, say the course does not cover it.'
].join('\n');

/**
 * The per-round system prompt: the tutor contract plus a live snapshot of the
 * agent's sandbox. Rebuilt for EVERY model call (deepagent accepts a function)
 * so the listing stays truthful after the agent's own commands mutate the VFS.
 */
export function tutorSystemPrompt(listing?: string | null): string {
	if (!listing) return TUTOR_SYSTEM_PROMPT;
	return [
		TUTOR_SYSTEM_PROMPT,
		'',
		'YOUR LAB RIGHT NOW:',
		listing,
		'Anything not listed above does not exist yet.'
	].join('\n');
}

/** Format retrieval hits the way the system prompt teaches the model to cite. */
export function formatCourseHits(query: string, k = 4): string {
	const hits = retrieve(query, k);
	if (hits.length === 0) {
		return 'No course sections matched that query. Tell the learner the course does not cover it.';
	}
	return hits
		.map((h) => `[[${h.id}]] "${h.title}" (relevance ${h.score.toFixed(1)}):\n${h.snippet}`)
		.join('\n\n');
}

export function createSearchCourseTool() {
	return tool(async ({ query }: { query: string }) => formatCourseHits(query), {
		name: 'search_course',
		description:
			'Search the LLMVibes course lessons. Returns the most relevant lesson excerpts, ' +
			'each tagged with its [[section-id]] citation token. Call this before answering any ' +
			'question about LLMs, training, or the course.',
		schema: z.object({
			query: z.string().describe('Short search query, e.g. "temperature top-k sampling"')
		})
	});
}

/**
 * The gated bash tool. Execution reaches this function only AFTER the human
 * approved (or edited) the call — the deepagent's `interruptOn: ['bash']`
 * pass gates it first, and a denial is answered with a synthesized
 * ToolMessage without ever executing. Output (stdout/stderr) becomes the
 * ToolMessage the model reads next round.
 */
export function createBashTool(bash: AgentBash) {
	return tool(
		async ({ cmd }: { cmd: string }) => {
			const result = await bash.run(cmd);
			if (!result.output) return result.error ? '(command failed with no output)' : '(no output)';
			return result.error ? `[stderr]\n${result.output}` : result.output;
		},
		{
			name: 'bash',
			description:
				'Run one command in your own sandboxed Git repository, visible to the learner — ' +
				'git commands plus echo/cat/ls. Use it to demonstrate concepts live ("show, then ' +
				'explain"). The learner approves every command before it runs. Keep each call to ' +
				'a single small command.',
			schema: z.object({
				cmd: z.string().describe('The command to run, e.g. git log --oneline')
			})
		}
	);
}

export interface AgentToolOptions {
	/** The gated sandbox; when present the bash tool joins the roster. */
	bash?: AgentBash;
}

/** The tool roster for the course agent. */
export function buildAgentTools(opts: AgentToolOptions = {}): AnyTool[] {
	const tools: AnyTool[] = [createSearchCourseTool() as unknown as AnyTool];
	if (opts.bash) {
		tools.push(createBashTool(opts.bash) as unknown as AnyTool);
	}
	return tools;
}
