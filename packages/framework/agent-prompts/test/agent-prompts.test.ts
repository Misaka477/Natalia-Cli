import { expect, test } from "bun:test";
import {
  agentPromptPreamble,
  agentSystemPrompt,
} from "../src/index";

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
