export const sectionIds = [
	'hero',
	'part-1',
	'section-1-1',
	'section-1-2',
	'section-1-3',
	'part-2',
	'section-2-1',
	'section-2-2',
	'section-2-3',
	'section-2-4',
	'part-3',
	'section-3-1',
	'section-3-2',
	'section-3-3',
	'section-3-4',
	'part-4',
	'section-4-1',
	'section-4-2',
	'section-4-3',
	'section-4-4',
	'section-4-5',
	'part-5',
	'section-5-1',
	'section-5-2',
	'section-5-3',
	'section-5-4',
	'section-5-5',
	'section-5-6',
	'part-6',
	'section-6-1',
	'section-6-2',
	'section-6-3',
	'part-7',
	'section-7-1',
	'section-7-2',
	'section-7-3',
	'section-7-4',
	'section-7-5',
	'part-8',
	'section-8-1',
	'section-8-2',
	'section-8-3',
	'section-8-4',
	'part-9',
	'section-9-1',
	'section-9-2',
	'section-9-3',
	'section-9-4',
	'section-9-5',
	'section-9-6',
	'part-10',
	'section-10-1',
	'section-10-2',
	'section-10-3',
	'part-11',
	'section-11-1',
	'section-11-2',
	'section-11-3',
	'section-11-4',
	'section-11-5',
	'part-12',
	'section-12-1',
	'section-12-2',
	'section-12-3',
	'section-12-4',
	'part-13',
	'section-13-1',
	'section-13-2',
	'section-13-3',
	'section-13-4',
	'section-13-5',
	'section-13-6',
	'part-14',
	'section-14-1',
	'section-14-2',
	'section-14-3'
] as const;

/**
 * Anchor ids of the embedded interactive activities (the sidebar's gamepad
 * entries). Kept separate from sectionIds so the part/section hierarchy stays
 * clean, but deep links and scroll-spy treat them the same way.
 *
 * Empty for now: LLMVibes' interactive playgrounds (training dashboards, the
 * token-stream inspector, reward editors, …) arrive with later milestones.
 */
export const playgroundAnchorIds: readonly string[] = [] as const;

/**
 * Anchor ids of the graded challenges — one per part, in course order.
 * Empty until the challenge system is rebuilt on the LLM engine; the
 * timeline build treats this list as optional by construction.
 */
export const challengeAnchorIds: readonly string[] = [] as const;

/** Every id that can appear in the URL hash and the sidebar scroll-spy. */
export const anchorIds: readonly string[] = [
	...sectionIds,
	...playgroundAnchorIds,
	...challengeAnchorIds
];
