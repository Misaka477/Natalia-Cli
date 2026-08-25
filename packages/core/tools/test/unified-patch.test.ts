import { expect, test } from "bun:test";
import {
  applyUnifiedPatchToText,
  parseUnifiedPatch,
} from "../src/unified-patch";

test("parses a multi-hunk multi-file patch", () => {
  const patch = [
    "diff --git a/a.txt b/a.txt",
    "--- a/a.txt",
    "+++ b/a.txt",
    "@@ -1,3 +1,3 @@",
    " one",
    "-two",
    "+TWO",
    " three",
    "diff --git a/new.txt b/new.txt",
    "--- /dev/null",
    "+++ b/new.txt",
    "@@ -0,0 +1,2 @@",
    "+hello",
    "+world",
  ].join("\n");
  const files = parseUnifiedPatch(patch);
  expect(files.map((file) => file.path)).toEqual(["a.txt", "new.txt"]);
  expect(files[0]?.newFile).toBe(false);
  expect(files[0]?.hunks.length).toBe(1);
  expect(files[0]?.hunks[0]?.oldLines.map((line) => line.text)).toEqual([
    "one",
    "two",
    "three",
  ]);
  expect(files[0]?.hunks[0]?.newLines.map((line) => line.text)).toEqual([
    "one",
    "TWO",
    "three",
  ]);
  expect(files[1]?.newFile).toBe(true);
});

test("applies an edit hunk with context", () => {
  const patch = [
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,3 +1,3 @@",
    " const a = 1;",
    "-const b = 2;",
    "+const b = 20;",
    " const c = 3;",
  ].join("\n");
  const file = parseUnifiedPatch(patch)[0]!;
  const result = applyUnifiedPatchToText(
    "const a = 1;\nconst b = 2;\nconst c = 3;\n",
    file,
  );
  expect(result.changed).toBe(true);
  expect(result.next).toBe("const a = 1;\nconst b = 20;\nconst c = 3;\n");
});

test("applies hunks in sequence with offset shifting", () => {
  const patch = [
    "--- a/list.txt",
    "+++ b/list.txt",
    "@@ -1,2 +1,2 @@",
    "-a",
    "+A",
    " b",
    "@@ -4,1 +4,1 @@",
    "-d",
    "+D",
  ].join("\n");
  const file = parseUnifiedPatch(patch)[0]!;
  const result = applyUnifiedPatchToText("a\nb\nc\nd\n", file);
  expect(result.next).toBe("A\nb\nc\nD\n");
});

test("is idempotent: an already-applied patch reports no change", () => {
  const patch = [
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,2 +1,2 @@",
    "-old",
    "+new",
    " same",
  ].join("\n");
  const file = parseUnifiedPatch(patch)[0]!;
  const first = applyUnifiedPatchToText("old\nsame\n", file);
  expect(first.changed).toBe(true);
  const second = applyUnifiedPatchToText(first.next, file);
  expect(second.changed).toBe(false);
  expect(second.next).toBe(first.next);
});

test("creates a new file from a /dev/null patch", () => {
  const patch = [
    "--- /dev/null",
    "+++ b/hello.txt",
    "@@ -0,0 +1,2 @@",
    "+hello",
    "+world",
  ].join("\n");
  const file = parseUnifiedPatch(patch)[0]!;
  const result = applyUnifiedPatchToText("", file);
  expect(result.changed).toBe(true);
  expect(result.next).toBe("hello\nworld\n");
});

test("rejects a deleting patch", () => {
  const patch = [
    "--- a/gone.txt",
    "+++ /dev/null",
    "@@ -1,2 +0,0 @@",
    "-a",
    "-b",
  ].join("\n");
  const file = parseUnifiedPatch(patch)[0]!;
  expect(file.deleted).toBe(true);
  expect(() => applyUnifiedPatchToText("a\nb\n", file)).toThrow(
    /deleting files is not supported/u,
  );
});

test("throws when a hunk does not match the file", () => {
  const patch = [
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,2 +1,2 @@",
    "-missing",
    "+replacement",
    " same",
  ].join("\n");
  const file = parseUnifiedPatch(patch)[0]!;
  expect(() =>
    applyUnifiedPatchToText("completely\ndifferent\n", file),
  ).toThrow(/did not match/u);
});

test("preserves a file that does not end in a newline", () => {
  const patch = [
    "--- a/nonl.txt",
    "+++ b/nonl.txt",
    "@@ -1,1 +1,1 @@",
    "-tail",
    "+tail!",
  ].join("\n");
  const file = parseUnifiedPatch(patch)[0]!;
  const result = applyUnifiedPatchToText("tail", file);
  expect(result.next).toBe("tail!");
});
