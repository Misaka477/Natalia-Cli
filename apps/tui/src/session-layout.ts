export type SidebarMode = "auto" | "hide";

export function sessionLayout(
  terminalWidth: number,
  terminalHeight: number,
  sidebarMode: SidebarMode,
  sidebarOpen: boolean,
) {
  const compact = terminalWidth < 80;
  const short = terminalHeight < 18;
  const sidebarWidth = 42;
  const wide = terminalWidth > 120;
  const sidebarVisible = wide ? sidebarMode === "auto" : sidebarOpen;
  const contentWidth =
    terminalWidth - (sidebarVisible && wide ? sidebarWidth : 0);
  return {
    compact,
    short,
    wide,
    sidebarWidth,
    sidebarVisible,
    sidebarOverlay: sidebarVisible && !wide,
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
