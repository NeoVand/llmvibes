import { describe, it, expect } from 'vitest';
import { activityStateOf, migrateSections, type ProgressState } from './progress';

function stateOf(partial: Partial<ProgressState>): ProgressState {
	return { scenarios: {}, attempts: {}, sections: {}, checklist: {}, ...partial };
}

describe('activityStateOf', () => {
	it('scrolling is not doing — an untouched activity stays untouched', () => {
		// A section id recorded as read says nothing about the activity inside it.
		const state = stateOf({ sections: { 'section-2-1': '2026-07-22T00:00:00.000Z' } });
		expect(activityStateOf(state, 'core-loop')).toBe('untouched');
	});

	it('a submitted command marks the activity attempted', () => {
		const state = stateOf({ attempts: { 'core-loop': '2026-07-22T00:00:00.000Z' } });
		expect(activityStateOf(state, 'core-loop')).toBe('attempted');
	});

	it('a passing check marks it completed', () => {
		const state = stateOf({
			attempts: { 'core-loop': '2026-07-22T00:00:00.000Z' },
			scenarios: { 'core-loop': { completedAt: '2026-07-22T00:01:00.000Z', count: 1 } }
		});
		expect(activityStateOf(state, 'core-loop')).toBe('completed');
	});

	it('completed outranks attempted, so completed ⊆ attempted never shows a gap', () => {
		// Even if the attempt record is missing (old payload), completion wins.
		const state = stateOf({
			scenarios: { 'core-loop': { completedAt: '2026-07-22T00:01:00.000Z', count: 1 } }
		});
		expect(activityStateOf(state, 'core-loop')).toBe('completed');
	});
});

describe('migrateSections', () => {
	// The LLMVibes curriculum has not been reordered yet, so the migration
	// chain is empty and every walk is an identity. These tests pin the
	// machinery so the first real reorder only has to add its step.
	it('is an identity walk while no reorder has happened', () => {
		const saved = { 'section-2-1': 'a', 'section-11-3': 'b' };
		expect(migrateSections(saved, 0)).toEqual(saved);
	});

	it('is a no-op for data already stamped at the current version', () => {
		const saved = { 'section-1-1': 'a' };
		expect(migrateSections(saved, 2)).toEqual(saved);
	});

	it('leaves scenario-shaped keys untouched (they are names, not positions)', () => {
		// Guards the deliberate choice that `attempts` skips the migration chain.
		const saved = { 'twin-dashboards': 'a', 'reward-editor': 'b' };
		expect(migrateSections(saved, 0)).toEqual(saved);
	});
});
