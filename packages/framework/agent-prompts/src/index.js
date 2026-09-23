"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentPromptPreamble = agentPromptPreamble;
exports.agentSystemPrompt = agentSystemPrompt;
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
var preamble_txt_1 = require("./preamble.txt");
var natalia_txt_1 = require("./natalia.txt");
var navi_txt_1 = require("./navi.txt");
var nia_txt_1 = require("./nia.txt");
/** Each core agent's persona / static block (its own `.txt`). */
var PERSONAS = {
    natalia: natalia_txt_1.default,
    navi: navi_txt_1.default,
    nia: nia_txt_1.default,
};
/** The shared universal discipline every agent reads first. */
function agentPromptPreamble() {
    return preamble_txt_1.default;
}
/**
 * Assemble an agent's static system prompt: the shared preamble, then the
 * agent's persona, then any rare agent-specific static addition. Dynamic
 * per-turn context is appended by the caller as `<runtime_context>`.
 */
function agentSystemPrompt(agent, extra) {
    return [preamble_txt_1.default, PERSONAS[agent], extra].filter(Boolean).join("\n\n");
}
