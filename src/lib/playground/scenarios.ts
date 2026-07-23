/**
 * STUB (M1). GitVibes' scenario registry, reduced to an empty surface so the
 * shared shell (Sidebar, CheatSheet, reading-context, AgentPanel) compiles
 * unchanged. The real LLMVibes lab scenarios arrive with the training-engine
 * milestones; this module keeps the same import path and export names.
 */

export interface PlaygroundScenario {
	id: string;
	title: string;
	description?: string;
}

export const playgroundScenarios: PlaygroundScenario[] = [];

export const scenarioAliases: Record<string, string> = {};

export function getScenario(id: string): PlaygroundScenario {
	return { id, title: id };
}

export async function loadScenarioSeed(): Promise<null> {
	return null;
}

export const lessonScenarioIds = [] as const;

export type LessonScenarioId = (typeof lessonScenarioIds)[number];

export function isLessonScenario(_id: string): _id is LessonScenarioId {
	return false;
}

export const PLAYGROUND_COMMANDS_HELP = 'The LLMVibes lab arrives in a later milestone.';
