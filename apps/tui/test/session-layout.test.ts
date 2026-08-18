import { expect, test } from "bun:test";
import { sessionLayout, timelineLayout } from "../src/session-layout";

test("wide sessions reserve the sidebar and its one-column gutter", () => {
  expect(sessionLayout(160, 42, "auto", false)).toMatchObject({
    wide: true,
    sidebarWidth: 42,
    sidebarGap: 1,
    sidebarVisible: true,
    sidebarOverlay: false,
    contentWidth: 117,
    toolContentWidth: 113,
  });
  expect(sessionLayout(132, 38, "auto", false)).toMatchObject({
    wide: true,
    sidebarWidth: 42,
    sidebarGap: 1,
    contentWidth: 89,
    toolContentWidth: 85,
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
    sidebarGap: 0,
    contentWidth: 120,
    toolContentWidth: 116,
    promptMaxHeight: 8,
  });
  expect(sessionLayout(80, 24, "auto", true)).toMatchObject({
    wide: false,
    sidebarVisible: true,
    sidebarOverlay: true,
    sidebarGap: 0,
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

test("Live Chat uses responsive single, double, and triple pane layouts", () => {
  expect(sessionLayout(80, 24, "auto", false, true)).toMatchObject({
    paneMode: "single",
    viewVisible: true,
    viewOverlay: true,
    viewWidth: 80,
    sidebarVisible: false,
    contentWidth: 80,
  });
  expect(sessionLayout(112, 24, "auto", false, true)).toMatchObject({
    paneMode: "double",
    viewOverlay: false,
    viewWidth: 48,
    sidebarVisible: false,
    contentWidth: 64,
  });
  expect(sessionLayout(150, 34, "auto", false, true)).toMatchObject({
    paneMode: "double",
    viewWidth: 60,
    sidebarVisible: false,
    contentWidth: 90,
  });
  expect(sessionLayout(168, 42, "auto", false, true)).toMatchObject({
    paneMode: "triple",
    viewWidth: 57,
    sidebarVisible: true,
    sidebarOverlay: false,
    sidebarGap: 1,
    contentWidth: 68,
  });
});

test("double-pane layouts leave the secondary view slot available for switching", () => {
  const layout = sessionLayout(150, 34, "auto", false, true);
  expect(layout.paneMode).toBe("double");
  expect(layout.viewWidth).toBeGreaterThan(0);
  expect(layout.contentWidth + layout.viewWidth).toBe(150);
});
