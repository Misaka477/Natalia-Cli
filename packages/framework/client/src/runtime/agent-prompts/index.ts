/**
 * Unified agent system prompts — runtime/agent-prompts/index.ts.
 *
 * One place for every core agent's static persona, composed from a shared
 * preamble (universal discipline) plus the agent's own persona. Prompts live as
 * `.txt` files (raw strings, inlined at build) so they are editable data, not
 * scattered inline strings across the turn-runners.
 *
 * Static vs dynamic: this module builds only the STATIC system prompt. Per-turn
 * dynamic context (plan / drift / goal / collaboration) is appended separately
 * as `<runtime_context>` — never inlined here (ADR D1/D2, prompt-cache friendly).
 *
 * Scope: Navi and Nia (the Live Work Chat personas) are unified here. The main
 * agent's static system prompt is built by provider-model (a lower-layer package)
 * and is a full static block, not a persona — unifying it needs a shared package.
 * The subagent prompt is context-variant (sandboxed vs plain), the team prompts
 * live in the team plugin, and goal is dynamic per-turn context — all out of scope
 * here.
 */
import PREAMBLE from "./preamble.txt";
import NAVI from "./navi.txt";
import NIA from "./nia.txt";

export type AgentID = "navi" | "nia";

/** Each core agent's persona (its own `.txt`). */
const PERSONAS: Record<AgentID, string> = {
  navi: NAVI,
  nia: NIA,
};

/** The shared universal discipline every agent reads first. */
export function agentPromptPreamble(): string {
  return PREAMBLE;
}

/**
 * Assemble an agent's static system prompt: the shared preamble, then the
 * agent's persona, then any rare agent-specific static addition. Dynamic
 * per-turn context is appended by the caller as `<runtime_context>`.
 */
export function agentSystemPrompt(agent: AgentID, extra?: string): string {
  return [PREAMBLE, PERSONAS[agent], extra].filter(Boolean).join("\n\n");
}
