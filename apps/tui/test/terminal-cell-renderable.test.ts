import { expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import type { TerminalScreenSnapshot } from "@natalia/contracts";
import { TerminalCellRenderable } from "../src/component/terminal-cell-renderable";

test("terminal cell renderable draws styled and wide-cell snapshots directly", async () => {
  const setup = await createTestRenderer({
    width: 8,
    height: 2,
    gatherStats: true,
  });
  const screen: TerminalScreenSnapshot = {
    rows: 2,
    cols: 8,
    buffer: "normal",
    cursor: { row: 1, col: 0, visible: true },
    lines: [
      [
        ["A", 1, 1],
        ["B", 1, 2],
        [" ", 1],
        [" ", 1],
        [" ", 1],
        [" ", 1],
        [" ", 1],
        [" ", 1],
      ],
      [
        ["你", 2],
        ["", 0],
        ["Z", 1],
        [" ", 1],
        [" ", 1],
        [" ", 1],
        [" ", 1],
        [" ", 1],
      ],
    ],
    text: "AB\n你Z",
  };
  const renderable = new TerminalCellRenderable(setup.renderer, screen);
  setup.renderer.root.add(renderable);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("AB");
  // OpenTUI leaves the continuation column blank after a wide CJK glyph.
  expect(setup.captureCharFrame()).toContain("你 Z");
  expect(setup.getNativeStats().nativeFrameCount).toBeGreaterThan(0);
  setup.renderer.destroy();
});
