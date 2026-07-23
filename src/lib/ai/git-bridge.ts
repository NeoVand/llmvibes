/**
 * STUB (M1) — the gate-to-engine bridge, awaiting the LLM lab engine.
 *
 * In GitVibes this connected the AI tutor's bash tool to a private GitEngine
 * sandbox. In LLMVibes the same seam will connect the tutor to the training
 * lab (inspect the dataset, poke the tokenizer, read training metrics). Until
 * that engine lands, every command returns a friendly under-construction note.
 * Export surface is kept identical to minimize churn in runtime.svelte.ts and
 * AgentPanel; rename to llm-bridge when the real engine arrives.
 */
import { createGate, type Gate, type GateResolution } from './gate';

export interface TerminalLine {
	type: 'input' | 'output';
	text: string;
	error?: boolean;
	/** Colored lines carry pre-escaped HTML. */
	colored?: boolean;
	/** For input lines: the prompt context shown when the command ran. */
	promptCwd?: string;
}

export interface BashRunResult {
	output: string;
	error: boolean;
}

export interface GitBridge {
	gate: Gate;
	engine: null;
	run(cmd: string): Promise<BashRunResult>;
	propose(cmd: string): Promise<GateResolution>;
	listing(): string;
}

export interface GitBridgeOptions {
	gate?: Gate;
	onLine?: (line: TerminalLine) => void;
}

const UNDER_CONSTRUCTION =
	'The LLMVibes lab is under construction — the training sandbox arrives in a later milestone.';

export async function createGitBridge(opts: GitBridgeOptions = {}): Promise<GitBridge> {
	const gate = opts.gate ?? createGate();
	const onLine = opts.onLine ?? (() => {});
	return {
		gate,
		engine: null,
		propose: (cmd: string) => gate.propose(cmd),
		listing: () => UNDER_CONSTRUCTION,
		run: async (cmd: string) => {
			onLine({ type: 'input', text: cmd, promptCwd: 'lab' });
			onLine({ type: 'output', text: UNDER_CONSTRUCTION });
			return { output: UNDER_CONSTRUCTION, error: false };
		}
	};
}
