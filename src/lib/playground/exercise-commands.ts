/**
 * STUB (M1). CheatSheet dynamically imports this to focus rows on the nearby
 * exercise; with no exercises yet, focus never activates.
 */

export interface ExerciseFocus {
	anchorId: string;
	title: string;
	kind: 'playground' | 'challenge';
	words: ReadonlySet<string>;
}

export function commandWordsOf(_line: string): string[] {
	return [];
}

export function exerciseFocusOf(_anchorId: string | null): ExerciseFocus | null {
	return null;
}

export function rowUsesWords(_rowCommand: string, _words: ReadonlySet<string>): boolean {
	return false;
}
