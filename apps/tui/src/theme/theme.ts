import { z } from "zod";

export type Theme = {
  name: string;
  background: string;
  panel: string;
  text: string;
  muted: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  diffAdded: string;
  diffRemoved: string;
  diffAddedBg: string;
  diffRemovedBg: string;
  diffContextBg: string;
  diffHighlightAdded: string;
  diffHighlightRemoved: string;
  diffLineNumber: string;
  diffAddedLineNumberBg: string;
  diffRemovedLineNumberBg: string;
};

export const themeDefinitionSchema = z.object({
  name: z.string().min(1),
  background: z.string(),
  panel: z.string(),
  text: z.string(),
  muted: z.string(),
  accent: z.string(),
  success: z.string(),
  warning: z.string(),
  danger: z.string(),
  diffAdded: z.string(),
  diffRemoved: z.string(),
  diffAddedBg: z.string(),
  diffRemovedBg: z.string(),
  diffContextBg: z.string(),
  diffHighlightAdded: z.string(),
  diffHighlightRemoved: z.string(),
  diffLineNumber: z.string(),
  diffAddedLineNumberBg: z.string(),
  diffRemovedLineNumberBg: z.string(),
});

export const darkTheme: Theme = {
  name: "natalia-dark",
  background: "#111318",
  panel: "#1a1d25",
  text: "#e7eaf0",
  muted: "#8991a5",
  accent: "#7dd3fc",
  success: "#86efac",
  warning: "#facc15",
  danger: "#f87171",
  diffAdded: "#86efac",
  diffRemoved: "#f87171",
  diffAddedBg: "#1a3a1a",
  diffRemovedBg: "#3a1a1a",
  diffContextBg: "#1a1d25",
  diffHighlightAdded: "#a3f7c8",
  diffHighlightRemoved: "#fa9e9e",
  diffLineNumber: "#5a6377",
  diffAddedLineNumberBg: "#1e4420",
  diffRemovedLineNumberBg: "#442020",
};

export const lightTheme: Theme = {
  name: "natalia-light",
  background: "#f7f8fb",
  panel: "#eef1f6",
  text: "#1a1d25",
  muted: "#596275",
  accent: "#0369a1",
  success: "#15803d",
  warning: "#a16207",
  danger: "#b91c1c",
  diffAdded: "#15803d",
  diffRemoved: "#b91c1c",
  diffAddedBg: "#d8f0dd",
  diffRemovedBg: "#f8d8d8",
  diffContextBg: "#eef1f6",
  diffHighlightAdded: "#1a9e4a",
  diffHighlightRemoved: "#dc2626",
  diffLineNumber: "#9ca3af",
  diffAddedLineNumberBg: "#c8e8d0",
  diffRemovedLineNumberBg: "#f0c8c8",
};

export const draculaTheme: Theme = {
  name: "natalia-dracula",
  background: "#282a36",
  panel: "#21222c",
  text: "#f8f8f2",
  muted: "#6272a4",
  accent: "#bd93f9",
  success: "#50fa7b",
  warning: "#ffb86c",
  danger: "#ff5555",
  diffAdded: "#50fa7b",
  diffRemoved: "#ff5555",
  diffAddedBg: "#2a3a2a",
  diffRemovedBg: "#3a2a2a",
  diffContextBg: "#21222c",
  diffHighlightAdded: "#8affb0",
  diffHighlightRemoved: "#ff8888",
  diffLineNumber: "#44475a",
  diffAddedLineNumberBg: "#304430",
  diffRemovedLineNumberBg: "#443030",
};

export const nordTheme: Theme = {
  name: "natalia-nord",
  background: "#2e3440",
  panel: "#3b4252",
  text: "#eceff4",
  muted: "#616e88",
  accent: "#88c0d0",
  success: "#a3be8c",
  warning: "#ebcb8b",
  danger: "#bf616a",
  diffAdded: "#a3be8c",
  diffRemoved: "#bf616a",
  diffAddedBg: "#2e3a2e",
  diffRemovedBg: "#3a2e2e",
  diffContextBg: "#3b4252",
  diffHighlightAdded: "#c5dfb0",
  diffHighlightRemoved: "#d38a90",
  diffLineNumber: "#4c566a",
  diffAddedLineNumberBg: "#354535",
  diffRemovedLineNumberBg: "#453535",
};

export const monokaiTheme: Theme = {
  name: "natalia-monokai",
  background: "#272822",
  panel: "#1e1f1c",
  text: "#f8f8f2",
  muted: "#75715e",
  accent: "#a6e22e",
  success: "#66d9ef",
  warning: "#fd971f",
  danger: "#f92672",
  diffAdded: "#66d9ef",
  diffRemoved: "#f92672",
  diffAddedBg: "#1e3028",
  diffRemovedBg: "#301e28",
  diffContextBg: "#1e1f1c",
  diffHighlightAdded: "#a6e22e",
  diffHighlightRemoved: "#fd5ff0",
  diffLineNumber: "#49483e",
  diffAddedLineNumberBg: "#244030",
  diffRemovedLineNumberBg: "#402430",
};

export const solarizedDarkTheme: Theme = {
  name: "natalia-solarized-dark",
  background: "#002b36",
  panel: "#073642",
  text: "#839496",
  muted: "#586e75",
  accent: "#268bd2",
  success: "#859900",
  warning: "#b58900",
  danger: "#dc322f",
  diffAdded: "#859900",
  diffRemoved: "#dc322f",
  diffAddedBg: "#0a3020",
  diffRemovedBg: "#301020",
  diffContextBg: "#073642",
  diffHighlightAdded: "#a3b82c",
  diffHighlightRemoved: "#e85550",
  diffLineNumber: "#445a5f",
  diffAddedLineNumberBg: "#124028",
  diffRemovedLineNumberBg: "#401828",
};

export const solarizedLightTheme: Theme = {
  name: "natalia-solarized-light",
  background: "#fdf6e3",
  panel: "#eee8d5",
  text: "#586e75",
  muted: "#93a1a1",
  accent: "#268bd2",
  success: "#859900",
  warning: "#b58900",
  danger: "#dc322f",
  diffAdded: "#859900",
  diffRemoved: "#dc322f",
  diffAddedBg: "#e8f0d0",
  diffRemovedBg: "#f8e0d0",
  diffContextBg: "#eee8d5",
  diffHighlightAdded: "#9db82c",
  diffHighlightRemoved: "#e85550",
  diffLineNumber: "#bcc2c2",
  diffAddedLineNumberBg: "#d8e8c0",
  diffRemovedLineNumberBg: "#f0d0c0",
};

export const themes: Record<string, Theme> = {
  [darkTheme.name]: darkTheme,
  [lightTheme.name]: lightTheme,
  [draculaTheme.name]: draculaTheme,
  [nordTheme.name]: nordTheme,
  [monokaiTheme.name]: monokaiTheme,
  [solarizedDarkTheme.name]: solarizedDarkTheme,
  [solarizedLightTheme.name]: solarizedLightTheme,
};

export const builtinThemeNames = Object.keys(themes);

export const defaultTheme = darkTheme;

export function isValidThemeName(name: string): boolean {
  return name in themes;
}

export function detectSystemTheme(): "dark" | "light" {
  if (typeof globalThis.matchMedia === "function") {
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "dark";
}

export function resolveTheme(
  name: string,
  mode: "dark" | "light" | "system" = "dark",
): Theme {
  if (name in themes) return themes[name];
  const fallback = mode === "system" ? detectSystemTheme() : mode;
  return fallback === "dark" ? darkTheme : lightTheme;
}

export function roleColor(role: string, theme = darkTheme) {
  if (role === "assistant") return theme.accent;
  if (role === "thinking") return theme.muted;
  if (role === "tool" || role === "snapshot") return theme.success;
  if (role === "approval" || role === "question") return theme.warning;
  if (role === "user") return theme.text;
  return theme.muted;
}
