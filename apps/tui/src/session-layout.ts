export type SidebarMode = "auto" | "hide";

export type SessionPaneMode = "single" | "double" | "triple";

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
  const wide = terminalWidth > 120;
  const viewVisible = viewOpen;
  const paneMode: SessionPaneMode = !viewVisible
    ? "single"
    : terminalWidth >= 168
      ? "triple"
      : terminalWidth >= 112
        ? "double"
        : "single";
  const viewOverlay = viewVisible && paneMode === "single";
  const viewWidth = !viewVisible
    ? 0
    : viewOverlay
      ? terminalWidth
      : paneMode === "triple"
        ? clamp(Math.floor(terminalWidth * 0.34), 52, 68)
        : clamp(Math.floor(terminalWidth * 0.4), 48, 64);
  // Chat replaces the automatic Plan sidebar until all three panes have enough
  // room. An explicitly opened sidebar remains an overlay on narrower screens.
  const dockedSidebar = viewVisible
    ? paneMode === "triple" && sidebarMode === "auto"
    : wide && sidebarMode === "auto";
  const overlaySidebar = sidebarOpen && !dockedSidebar && !viewVisible;
  const sidebarVisible = dockedSidebar || overlaySidebar;
  const sidebarGap = dockedSidebar ? 1 : 0;
  const contentWidth =
    terminalWidth -
    (dockedSidebar ? sidebarWidth : 0) -
    sidebarGap -
    (viewVisible && !viewOverlay ? viewWidth : 0);
  return {
    compact,
    short,
    wide,
    sidebarWidth,
    sidebarGap,
    sidebarVisible,
    sidebarOverlay: overlaySidebar,
    paneMode,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function timelineLayout(contentWidth: number) {
  return {
    maxWidth: Math.max(1, contentWidth - 4),
    horizontalPadding: 2,
  };
}
