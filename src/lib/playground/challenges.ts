/**
 * STUB (M1). Empty challenge registry keeping GitVibes' import surface so the
 * Sidebar's progress accounting compiles. Real LLMVibes challenges arrive with
 * the lab milestones.
 */

export interface Challenge {
	id: string;
	partId: string;
	part: number;
	title: string;
}

export const allChallenges: readonly Challenge[] = [];

export const challengeIds: readonly string[] = [];

export function challengeForPart(part: number): Challenge | undefined {
	void part;
	return undefined;
}
