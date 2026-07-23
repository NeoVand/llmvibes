import { describe, expect, it } from 'vitest';
import {
	buildAgentTools,
	createSearchCourseTool,
	formatCourseHits,
	TUTOR_SYSTEM_PROMPT,
	tutorSystemPrompt
} from './tools';

describe('tutor system prompt', () => {
	it('carries the persona and the citation contract', () => {
		expect(TUTOR_SYSTEM_PROMPT).toContain('LLMVibes tutor');
		expect(TUTOR_SYSTEM_PROMPT).toContain('search_course');
		expect(TUTOR_SYSTEM_PROMPT).toContain('[[section-4-5]]');
	});

	it('explains the lab is under construction and sets boundaries', () => {
		expect(TUTOR_SYSTEM_PROMPT).toContain('under');
		expect(TUTOR_SYSTEM_PROMPT).toContain('construction');
		expect(TUTOR_SYSTEM_PROMPT).toMatch(/does not cover/);
	});
});

describe('tutorSystemPrompt (sandbox listing injection)', () => {
	it('without a listing it is exactly the static tutor contract', () => {
		expect(tutorSystemPrompt()).toBe(TUTOR_SYSTEM_PROMPT);
		expect(tutorSystemPrompt(null)).toBe(TUTOR_SYSTEM_PROMPT);
	});

	it('appends the live listing under the FILES header', () => {
		const listing = 'cwd: ~\n~/\n  notes/\n    monday.md\n  todo.txt';
		const prompt = tutorSystemPrompt(listing);
		expect(prompt.startsWith(TUTOR_SYSTEM_PROMPT)).toBe(true);
		expect(prompt).toContain('YOUR LAB RIGHT NOW');
		expect(prompt).toContain(listing);
		expect(prompt).toContain('Anything not listed above does not exist yet.');
	});
});

describe('search_course tool', () => {
	it('returns retrieved chunks tagged with citation tokens', async () => {
		const tool = createSearchCourseTool();
		const result = (await tool.invoke({ query: 'train a BPE tokenizer' })) as string;
		expect(result).toContain('[[section-2-2]]');
		expect(result.length).toBeGreaterThan(100);
	});

	it('says so when nothing matches', async () => {
		const tool = createSearchCourseTool();
		const result = (await tool.invoke({ query: 'xyzzyqwlkj blorptastic' })) as string;
		expect(result).toMatch(/No course sections matched/);
	});

	it('formatCourseHits includes title and snippet per hit', () => {
		const text = formatCourseHits('temperature and sampling');
		expect(text).toMatch(/\[\[section-5-\d\]\]/);
		expect(text).toContain('relevance');
	});
});

describe('tool registry', () => {
	it('phase 2 registers exactly the search tool (bash seam reserved)', () => {
		const tools = buildAgentTools();
		expect(tools.map((t) => (t as { name: string }).name)).toEqual(['search_course']);
	});
});
