import { expect, test } from "bun:test";
import { agentPromptPreamble, agentSystemPrompt } from "../src/index";

test("agentSystemPrompt prepends the shared preamble then the persona", () => {
  const navi = agentSystemPrompt("navi");
  // Preamble first (shared discipline), then the persona tag.
  expect(navi.startsWith(agentPromptPreamble())).toBe(true);
  expect(navi).toContain("<navi_chat_persona>");
  expect(navi).toContain("</navi_chat_persona>");
  // The persona follows the preamble.
  expect(navi.indexOf("<navi_chat_persona>")).toBeGreaterThan(
    navi.indexOf(agentPromptPreamble()),
  );
});

test("each agent gets its own persona under the same preamble", () => {
  for (const [agent, tag] of [
    ["natalia", "<natalia_cli_persona>"],
    ["navi", "<navi_chat_persona>"],
    ["nia", "<nia_chat_persona>"],
  ] as const) {
    const prompt = agentSystemPrompt(agent);
    expect(prompt.startsWith(agentPromptPreamble())).toBe(true);
    expect(prompt).toContain(tag);
  }
});

test("extra static text is appended after the persona", () => {
  const prompt = agentSystemPrompt("nia", "Use the tools for filesystem work.");
  expect(prompt.endsWith("Use the tools for filesystem work.")).toBe(true);
});

test("Navi and Nia are wired to the read-only context tools (Phase2b-2)", () => {
  // The RINA study's prompt wiring: both sisters search the structured
  // memory first and page the transcript only for exact wording. The five
  // tool names are the contract between the prompt and the registry.
  for (const agent of ["navi", "nia"] as const) {
    const prompt = agentSystemPrompt(agent);
    for (const tool of [
      "context_search",
      "context_list",
      "context_read",
      "context_history",
      "context_pack",
    ])
      expect(prompt).toContain(tool);
    // Retrieval-first: the context tools precede the transcript fallback.
    expect(prompt).toContain("context tools first");
    // The honest degradation: no vault -> page the log instead.
    expect(prompt).toContain("vault_unavailable");
    expect(prompt).toContain("session_history");
    // The isolation rule the tools enforce is stated to the model too.
    expect(prompt).toContain("another session is refused");
  }
});
