import { expect, test } from "bun:test";
import type { TerminalCell, TerminalScreenSnapshot } from "@natalia/contracts";
import {
  TerminalScreenRenderCache,
  terminalScreenRenderModel,
} from "../src/component/terminal-screen-model";

test("terminal render model measures only visible rows and style runs", () => {
  const screen: TerminalScreenSnapshot = {
    rows: 3,
    cols: 4,
    buffer: "normal",
    cursor: { row: 2, col: 0, visible: true },
    lines: [
      [
        ["a", 1],
        ["b", 1],
        [" ", 1],
        [" ", 1],
      ],
      [
        ["x", 1, 1],
        ["y", 1],
        [" ", 1],
        [" ", 1],
      ],
      [
        ["你", 2],
        ["", 0],
        ["z", 1],
        [" ", 1],
      ],
    ],
    text: "ab\nxy\n你z",
  };
  expect(terminalScreenRenderModel(screen, 2)).toMatchObject({
    visibleRows: 2,
    visibleCells: 7,
    styleRuns: 4,
    estimatedJsxNodes: 6,
  });
  expect(terminalScreenRenderModel(screen, 2).rows[1]?.runs).toHaveLength(2);
});

test("terminal render cache retains unchanged row runs across a patch", () => {
  const cache = new TerminalScreenRenderCache();
  const first: TerminalScreenSnapshot = {
    rows: 2,
    cols: 3,
    buffer: "normal",
    cursor: { row: 0, col: 0, visible: true },
    lines: [
      [
        ["a", 1],
        ["b", 1],
        [" ", 1],
      ],
      [
        ["x", 1],
        ["y", 1],
        [" ", 1],
      ],
    ],
    text: "ab\nxy",
  };
  const before = cache.model(first);
  const second: TerminalScreenSnapshot = {
    ...first,
    cursor: { row: 1, col: 1, visible: true },
    lines: [
      [
        ["c", 1],
        ["b", 1],
        [" ", 1],
      ] as TerminalCell[],
      first.lines[1]!,
    ],
    text: "cb\nxy",
  };
  const after = cache.model(second);
  expect(after.rows[0]?.runs).not.toBe(before.rows[0]?.runs);
  expect(after.rows[1]?.runs).not.toBe(before.rows[1]?.runs);
  const stable = cache.model({ ...second, cursor: { ...second.cursor } });
  expect(stable.rows[0]).toBe(after.rows[0]);
  expect(stable.rows[1]).toBe(after.rows[1]);
  expect(stable.rows[0]?.runs).toBe(after.rows[0]?.runs);
  expect(stable.rows[1]?.runs).toBe(after.rows[1]?.runs);
});
