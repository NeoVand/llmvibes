export interface CheatSheetCommand {
	command: string;
	description: string;
	/**
	 * One or two extra sentences — when to reach for it, the classic gotcha,
	 * the related concept. Shown where there's room (the expanded modal and
	 * the PDF), not in the narrow side panel.
	 */
	detail?: string;
}

export interface CheatSheetCategory {
	label: string;
	icon: string; // lucide icon name for reference
	commands: CheatSheetCommand[];
}

export interface CheatSheetLegendEntry {
	/** The notation as it appears in the command column */
	notation: string;
	meaning: string;
}

export interface CheatSheetLegend {
	lead: string;
	entries: CheatSheetLegendEntry[];
}

/**
 * LLMVibes' reference card will collect the course's formulas, hyperparameters
 * and named concepts (cross-entropy, AdamW, LoRA rank, KL penalty, GRPO group
 * size, …) once the chapters carry real content. Until then the sheet ships
 * empty but fully typed, so every surface that renders it — the side panel,
 * the expanded modal, the print route — keeps compiling and simply shows an
 * empty card.
 */
export const cheatSheetLegend: CheatSheetLegend = {
	lead: 'The LLMVibes reference card arrives with a later milestone.',
	entries: []
};

export const cheatSheet: CheatSheetCategory[] = [];
