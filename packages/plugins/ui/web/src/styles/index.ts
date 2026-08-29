import { nataliaNeuBaseStyles } from "./base";
import { nataliaNeuThemeDark } from "./theme-dark";
import { nataliaNeuThemeLight } from "./theme-light";
import { nataliaNeuThemeLime } from "./theme-lime";

export { nataliaNeuBaseStyles } from "./base";
export { nataliaNeuThemeDark } from "./theme-dark";
export { nataliaNeuThemeLight } from "./theme-light";
export { nataliaNeuThemeLime } from "./theme-lime";

export const NEU_THEME_MODES = ["light", "dark", "lime"] as const;
export type NeuThemeMode = (typeof NEU_THEME_MODES)[number];

export const nataliaNeuThemeStyles =
  nataliaNeuThemeLight + nataliaNeuThemeDark + nataliaNeuThemeLime;

export const nataliaNeuStyles = nataliaNeuThemeStyles + nataliaNeuBaseStyles;

export function resolveNeuThemeMode(
  value: string | undefined | null,
): NeuThemeMode {
  return value === "dark" || value === "lime" ? value : "light";
}

export function applyNeuTheme(
  mode: string | undefined | null,
  root?: HTMLElement,
) {
  const resolved = resolveNeuThemeMode(mode);
  document.documentElement.dataset.theme = resolved;
  if (root) root.dataset.theme = resolved;
  return resolved;
}
