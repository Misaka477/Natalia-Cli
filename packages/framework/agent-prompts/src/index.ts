/**
 * Unified agent system prompts — @natalia/agent-prompts.
 *
 * One place for the core agents' static personas, composed from a shared
 * preamble (universal discipline) plus the agent's own persona. Prompts live as
 * `.txt` files (raw strings, inlined at build) so they are editable data, not
 * scattered inline strings. A standalone leaf package so both the client and
 * provider-model (a lower layer) can share one assembly point.
 *
 * Static vs dynamic: this builds only the STATIC system prompt. Per-turn dynamic
 * context (plan / drift / goal / collaboration) is appended separately as
 * `<runtime_context>` — never inlined here (ADR D1/D2, prompt-cache friendly).
 *
 * The subagent prompt is context-variant (sandboxed vs plain) and the team
 * prompts live in the team plugin — both stay where they are.
 */
import PREAMBLE from "./preamble.txt";
import NATALIA from "./natalia.txt";
import NAVI from "./navi.txt";
import NIA from "./nia.txt";

export type AgentID = "natalia" | "navi" | "nia";

/** Each core agent's persona / static block (its own `.txt`). */
const PERSONAS: Record<AgentID, string> = {
  natalia: NATALIA,
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
