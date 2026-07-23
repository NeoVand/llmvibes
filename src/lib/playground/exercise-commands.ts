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

export function commandWordsOf(line: string): string[] {
	void line;
	return [];
}

export function exerciseFocusOf(anchorId: string | null): ExerciseFocus | null {
	void anchorId;
	return null;
}

export function rowUsesWords(rowCommand: string, words: ReadonlySet<string>): boolean {
	void rowCommand;
	void words;
	return false;
}
