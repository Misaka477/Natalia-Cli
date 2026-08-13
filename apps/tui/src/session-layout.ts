export type SidebarMode = "auto" | "hide";

export function sessionLayout(
  terminalWidth: number,
  terminalHeight: number,
  sidebarMode: SidebarMode,
  sidebarOpen: boolean,
  viewOpen = false,
) {
  const compact = terminalWidth < 80;
  const short = terminalHeight < 18;
  const sidebarWidth = 42;
  const viewWidth = 38;
  const wide = terminalWidth > 120;
  const sidebarVisible = wide ? sidebarMode === "auto" : sidebarOpen;
  // The view dock is a fixed column beside the feed. On narrow terminals it
  // floats over the content like the session sidebar does, so it never forces
  // the feed itself into an unusable sliver.
  const viewVisible = viewOpen;
  const viewOverlay = viewVisible && !wide;
  const contentWidth =
    terminalWidth -
    (sidebarVisible && wide ? sidebarWidth : 0) -
    (viewVisible && !viewOverlay ? viewWidth : 0);
  return {
    compact,
    short,
    wide,
    sidebarWidth,
    sidebarVisible,
    sidebarOverlay: sidebarVisible && !wide,
    viewWidth,
    viewVisible,
    viewOverlay,
    contentWidth,
    toolContentWidth: Math.max(1, contentWidth - 4),
    promptMaxHeight: Math.max(6, Math.floor(terminalHeight / 3)),
    toolPreviewLines: 10,
    showComposerHints: terminalHeight >= 12,
  };
}

export function timelineLayout(contentWidth: number) {
  return {
    maxWidth: Math.max(1, contentWidth - 4),
    horizontalPadding: 2,
  };
}
