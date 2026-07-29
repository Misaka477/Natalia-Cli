import { expect, test } from "bun:test";
import {
  filetype,
  formatPrimitiveArgs,
  formatToolPath,
  parseExecuteCalls,
  parseQuestionAnswers,
  parseResultRecord,
  stringField,
  toolColor,
  toolIcon,
  toolInput,
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
  expect(
    parseQuestionAnswers([
      ["a", "b"],
      ["c"],
    ]),
  ).toEqual([["a", "b"], ["c"]]);
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
  const home = process.env.HOME ?? "";
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
  expect(toolIcon("unknown")).toBe("tool");
});
