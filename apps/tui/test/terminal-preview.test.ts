import { expect, test } from "bun:test";
import { terminalPreview } from "../src/terminal-preview";

test("terminal preview only scans the bounded output tail", () => {
  const early = "expensive-line\n".repeat(100_000);
  expect(terminalPreview(`${early}latest one\nlatest two`)).toEqual([
    "latest one",
    "latest two",
  ]);
});
