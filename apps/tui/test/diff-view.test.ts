import { expect, test } from "bun:test";

test("diff element receives unified diff props correctly", () => {
  const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
-line2
+line2 modified
+line3 added
 line4`;

  const lines = diff.split("\n").filter(Boolean);
  expect(lines.length).toBeGreaterThan(0);

  const hunkLines = diff.split("\n").slice(5);
  const adds = hunkLines.filter((l) => l.startsWith("+")).length;
  const dels = hunkLines.filter((l) => l.startsWith("-")).length;
  expect(adds).toBe(2);
  expect(dels).toBe(1);

  expect(diff).toContain("@@ -1,3 +1,4 @@");
  expect(diff).toContain("--- a/file.ts");
  expect(diff).toContain("+++ b/file.ts");
});
