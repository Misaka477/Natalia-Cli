import { expect, test } from "bun:test";
import { sessionLayout, timelineLayout } from "../src/session-layout";

test("wide sessions reserve the fixed 42-column sidebar", () => {
  expect(sessionLayout(160, 42, "auto", false)).toMatchObject({
    wide: true,
    sidebarWidth: 42,
    sidebarVisible: true,
    sidebarOverlay: false,
    contentWidth: 118,
    toolContentWidth: 114,
  });
  expect(sessionLayout(132, 38, "auto", false)).toMatchObject({
    wide: true,
    sidebarWidth: 42,
    contentWidth: 90,
    toolContentWidth: 86,
  });
  expect(sessionLayout(160, 42, "hide", false).contentWidth).toBe(160);
});

test("session timeline fills its column with fixed two-column padding", () => {
  expect(timelineLayout(80)).toEqual({ maxWidth: 76, horizontalPadding: 2 });
  expect(timelineLayout(118)).toEqual({ maxWidth: 114, horizontalPadding: 2 });
  expect(timelineLayout(200)).toEqual({ maxWidth: 196, horizontalPadding: 2 });
});

test("normal and narrow sessions keep full width and overlay sidebar", () => {
  expect(sessionLayout(120, 24, "auto", false)).toMatchObject({
    wide: false,
    sidebarVisible: false,
    sidebarOverlay: false,
    contentWidth: 120,
    toolContentWidth: 116,
    promptMaxHeight: 8,
  });
  expect(sessionLayout(80, 24, "auto", true)).toMatchObject({
    wide: false,
    sidebarVisible: true,
    sidebarOverlay: true,
    contentWidth: 80,
    toolContentWidth: 76,
  });
  expect(sessionLayout(72, 18, "auto", false)).toMatchObject({
    compact: true,
    contentWidth: 72,
    promptMaxHeight: 6,
    toolPreviewLines: 10,
    showComposerHints: true,
  });
  expect(sessionLayout(50, 12, "auto", false)).toMatchObject({
    compact: true,
    short: true,
    contentWidth: 50,
    toolContentWidth: 46,
    promptMaxHeight: 6,
    showComposerHints: true,
  });
});
