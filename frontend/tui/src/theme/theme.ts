export type Theme = {
  background: string;
  panel: string;
  text: string;
  muted: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
};

export const darkTheme: Theme = {
  background: "#111318",
  panel: "#1a1d25",
  text: "#e7eaf0",
  muted: "#8991a5",
  accent: "#7dd3fc",
  success: "#86efac",
  warning: "#facc15",
  danger: "#f87171",
};

export function roleColor(role: string, theme = darkTheme) {
  if (role === "assistant") return theme.accent;
  if (role === "thinking") return theme.muted;
  if (role === "tool" || role === "snapshot") return theme.success;
  if (role === "approval" || role === "question") return theme.warning;
  if (role === "user") return theme.text;
  return theme.muted;
}
