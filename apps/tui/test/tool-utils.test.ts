import { expect, test } from "bun:test";
import { userHomeDirectory } from "@natalia/platform";
import {
  classifyTool,
  projectToolCall,
  projectToolRender,
} from "@natalia/ui-model";
import type { ToolRenderIntent } from "@natalia/ui-model";
import {
  compactModelLabel,
  compactPath,
  filetype,
  formatPrimitiveArgs,
  formatToolPath,
  parseExecuteCalls,
  parseQuestionAnswers,
  parseResultRecord,
  statusValues,
  stringField,
  toolColor,
  toolIcon,
  toolInput,
  toolLabel,
  toolPath,
  toolRecord,
} from "../src/routes/session/tool-utils";

test("toolInput parses JSON into command/workdir", () => {
  expect(toolInput('{"command":"ls","workdir":"/tmp"}')).toEqual({
    command: "ls",
    workdir: "/tmp",
  });
  expect(toolInput(undefined)).toEqual({ command: "", workdir: "" });
  expect(toolInput("invalid")).toEqual({ command: "", workdir: "" });
});

test("toolRecord parses JSON into a record", () => {
  expect(toolRecord('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
  expect(toolRecord(undefined)).toEqual({});
  expect(toolRecord("invalid")).toEqual({});
});

test("parseResultRecord parses result JSON", () => {
  expect(parseResultRecord('{"id":"abc"}')).toEqual({ id: "abc" });
  expect(parseResultRecord(undefined)).toEqual({});
});

test("parseQuestionAnswers handles arrays of string arrays", () => {
  expect(parseQuestionAnswers([["a", "b"], ["c"]])).toEqual([
    ["a", "b"],
    ["c"],
  ]);
  expect(parseQuestionAnswers(null)).toEqual([]);
  expect(parseQuestionAnswers([1, 2])).toEqual([]);
});

test("parseExecuteCalls extracts tool call records", () => {
  const calls = parseExecuteCalls([
    { tool: "read_file", status: "completed", input: { path: "/a" } },
    { tool: "write", status: "error", input: {} },
  ]);
  expect(calls).toHaveLength(2);
  expect(calls[0]?.tool).toBe("read_file");
  expect(calls[0]?.status).toBe("completed");
  expect(parseExecuteCalls([{ tool: "x", status: "unknown" }])).toEqual([]);
});

test("statusValues parses segment key:value pairs", () => {
  expect(statusValues(["a:1", "b:x"])).toEqual({ a: "1", b: "x" });
  expect(statusValues(["no-colon"])).toEqual({});
  expect(statusValues([])).toEqual({});
});

test("compactPath shortens HOME path to ~", () => {
  // Resolve the home directory the same way the implementation does. Deriving
  // it from HOME alone yields an empty string on Windows, which made this
  // assert nothing there.
  const home = userHomeDirectory();
  expect(compactPath(`${home}/project`)).toBe("~/project");
  expect(compactPath("/other/path")).toBe("/other/path");
  expect(compactPath(undefined)).toBe("local workspace");
});

test("compactPath preserves the most specific directories within a budget", () => {
  expect(
    compactPath("/home/user/Development/Natalia_Project/natalia-cli", 24),
  ).toBe("…/natalia-cli");
  expect(compactPath("/workspace/project", 20)).toBe("/workspace/project");
  expect(compactPath("/workspace/exceptionally-long-project", 12)).toBe(
    "…ong-project",
  );
});

test("compactModelLabel removes provider paths and formats model IDs", () => {
  expect(compactModelLabel("gpt/gpt-5.6-sol", 24)).toBe("GPT 5.6 Sol");
  expect(compactModelLabel("openrouter/anthropic/claude-sonnet-4-5", 24)).toBe(
    "Claude Sonnet 4 5",
  );
  expect(compactModelLabel("provider/exceptionally-long-model-name", 12)).toBe(
    "exceptional…",
  );
});

test("formatPrimitiveArgs formats key=value pairs", () => {
  expect(formatPrimitiveArgs({ a: 1, b: "x", c: true })).toBe(
    " [a=1, b=x, c=true]",
  );
  expect(formatPrimitiveArgs({})).toBe("");
  expect(formatPrimitiveArgs({ nested: { x: 1 } })).toBe("");
});

test("stringField finds first string value by key", () => {
  expect(stringField({ a: "x", b: "y" }, "a")).toBe("x");
  expect(stringField({ a: "x", b: "y" }, "b", "a")).toBe("y");
  expect(stringField({ a: 1 }, "a")).toBe("");
});

test("formatToolPath replaces HOME with ~", () => {
  const home = userHomeDirectory();
  expect(formatToolPath(`${home}/project`)).toBe("~/project");
  expect(formatToolPath("/other/path")).toBe("/other/path");
  expect(formatToolPath("")).toBe("");
});

test("toolPath extracts a file path from arguments JSON", () => {
  expect(toolPath('{"filePath":"src/main.ts"}')).toBe("src/main.ts");
  expect(toolPath('{"path":"/tmp"}')).toBe("/tmp");
  expect(toolPath(undefined)).toBe("");
});

test("filetype returns correct syntax label", () => {
  expect(filetype("file.ts")).toBe("typescript");
  expect(filetype("file.tsx")).toBe("typescriptreact");
  expect(filetype("file.py")).toBe("python");
  expect(filetype("file.rs")).toBe("rust");
  expect(filetype("file.unknown")).toBe("text");
  expect(filetype("")).toBe("text");
});

test("toolColor returns appropriate color", () => {
  expect(toolColor("succeeded")).toBeDefined();
  expect(toolColor("failed")).toBeDefined();
  expect(toolColor("running")).toBeDefined();
  expect(toolColor("queued")).toBeDefined();
  expect(toolColor("unknown")).toBeDefined();
});

test("toolIcon returns correct icon label", () => {
  expect(toolIcon("diff")).toBe("diff");
  expect(toolIcon("shell")).toBe("$");
  expect(toolIcon("terminal")).toBe("terminal");
  expect(toolIcon("sandbox")).toBe("box");
  expect(toolIcon("unknown")).toBe("");
});

test("toolLabel names calls by their actual operation", () => {
  expect(toolLabel("read_file", "read")).toBe("read");
  expect(toolLabel("run_shell", "terminal")).toBe("shell");
  expect(toolLabel("interactive_terminal_snapshot", "terminal")).toBe(
    "interactive terminal",
  );
  expect(toolLabel("todo_read", "generic")).toBe("");
});

test("classifyTool identifies every agent tool as a subagent", () => {
  for (const name of [
    "agent_spawn",
    "agent_list",
    "agent_status",
    "agent_output",
    "agent_wait",
    "agent_stop",
    "agent_resume",
    "agent_retry",
    "agent_attach",
    "agent_detach",
    "agent_cleanup",
    "agent_audit",
  ]) {
    expect(classifyTool(name)).toBe("subagent");
  }
});

test("subagent call and result projection intents decode from metadata", () => {
  const call: ToolRenderIntent = {
    kind: "generic",
    title: "a1",
    summary: "check",
  };
  const render: ToolRenderIntent = {
    kind: "generic",
    title: "a1",
    summary: "status completed",
    meta: [["taskID", "a1"]],
  };
  expect(projectToolCall({ call })).toEqual(call);
  expect(projectToolRender({ render })).toEqual(render);
  expect(projectToolCall({ call: { kind: "generic", title: "a1" } })).toBe(
    undefined,
  );
});
