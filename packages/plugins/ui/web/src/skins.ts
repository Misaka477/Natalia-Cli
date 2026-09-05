import { defineUiSkin, type UiSkin } from "@natalia/ui-kit";

export const nataliaLightSkin: UiSkin = defineUiSkin({
  id: "light",
  name: "Light",
  version: "1.0.0",
  tokens: {
    "--neu-bg": "#e8e9e1",
    "--neu-bg-light": "#f2f3ed",
    "--neu-shadow-dark": "rgba(48, 48, 46, 0.18)",
    "--neu-shadow-light": "rgba(255, 255, 255, 0.7)",
    "--neu-accent": "#8fb7b0",
    "--neu-accent-soft": "#b9d5cf",
    "--neu-text": "#30302e",
    "--neu-muted": "#7d8885",
    "--neu-success": "#6ba89f",
    "--neu-error": "#c9776b",
    "--neu-warning": "#b79549",
    "--neu-user-bubble": "#b9d5cf",
    "--neu-user-bubble-text": "#16201d",
    "--neu-border": "rgba(48, 48, 46, 0.12)",
    "--neu-hairline": "rgba(0, 0, 0, 0.06)",
    "--neu-overlay": "rgba(0, 0, 0, 0.25)",
    "--neu-overlay-scrim": "rgba(20, 22, 20, 0.35)",
    "--neu-hover-overlay": "rgba(48, 48, 46, 0.06)",
    "--neu-divider": "rgba(48, 48, 46, 0.12)",
  },
});

export const nataliaDarkSkin: UiSkin = defineUiSkin({
  id: "dark",
  name: "Dark",
  version: "1.0.0",
  tokens: {
    "--neu-bg": "#121418",
    "--neu-bg-light": "#1b1e24",
    "--neu-shadow-dark": "rgba(0, 0, 0, 0.55)",
    "--neu-shadow-light": "rgba(255, 255, 255, 0.04)",
    "--neu-accent": "#5fd4b8",
    "--neu-accent-soft": "#7de8d0",
    "--neu-text": "#e6e8eb",
    "--neu-muted": "#8992a0",
    "--neu-success": "#67d98c",
    "--neu-error": "#ff6b6b",
    "--neu-warning": "#d8b04a",
    "--neu-user-bubble": "#1f3934",
    "--neu-user-bubble-text": "#e6e8eb",
    "--neu-border": "rgba(255, 255, 255, 0.1)",
    "--neu-hairline": "rgba(255, 255, 255, 0.08)",
    "--neu-overlay": "rgba(0, 0, 0, 0.45)",
    "--neu-overlay-scrim": "rgba(0, 0, 0, 0.55)",
    "--neu-hover-overlay": "rgba(255, 255, 255, 0.04)",
    "--neu-divider": "rgba(184, 188, 194, 0.2)",
  },
});

export const nataliaLimeSkin: UiSkin = defineUiSkin({
  id: "lime",
  name: "Lime",
  version: "1.0.0",
  tokens: {
    "--neu-bg": "#222222",
    "--neu-bg-light": "#2a2a2a",
    "--neu-shadow-dark": "rgba(0, 0, 0, 0.6)",
    "--neu-shadow-light": "rgba(255, 255, 255, 0.04)",
    "--neu-accent": "#bff000",
    "--neu-accent-soft": "#4a5b0d",
    "--neu-text": "#e8e8e8",
    "--neu-muted": "#9a9a9a",
    "--neu-success": "#bff000",
    "--neu-error": "#ff6b6b",
    "--neu-warning": "#ffd166",
    "--neu-user-bubble": "#4a5b0d",
    "--neu-user-bubble-text": "#e8e8e8",
    "--neu-border": "rgba(255, 255, 255, 0.1)",
    "--neu-hairline": "rgba(255, 255, 255, 0.08)",
    "--neu-overlay": "rgba(0, 0, 0, 0.45)",
    "--neu-overlay-scrim": "rgba(0, 0, 0, 0.55)",
    "--neu-hover-overlay": "rgba(255, 255, 255, 0.04)",
    "--neu-divider": "rgba(184, 188, 194, 0.2)",
  },
});

export const NATALIA_SKINS: Record<string, UiSkin> = {
  light: nataliaLightSkin,
  dark: nataliaDarkSkin,
  lime: nataliaLimeSkin,
};

export const NEU_THEME_MODES = ["light", "dark", "lime"] as const;
export type NeuThemeMode = (typeof NEU_THEME_MODES)[number];
