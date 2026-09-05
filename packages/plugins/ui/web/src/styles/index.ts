import { applyUiSkin } from "@natalia/ui-kit";
import { nataliaNeuBaseStyles } from "./base";
import { nataliaNeuThemeDark } from "./theme-dark";
import { nataliaNeuThemeLight } from "./theme-light";
import { nataliaNeuThemeLime } from "./theme-lime";
import { NATALIA_SKINS, NEU_THEME_MODES, type NeuThemeMode } from "../skins";

export { nataliaNeuBaseStyles } from "./base";
export { nataliaNeuThemeDark } from "./theme-dark";
export { nataliaNeuThemeLight } from "./theme-light";
export { nataliaNeuThemeLime } from "./theme-lime";

export { NATALIA_SKINS, NEU_THEME_MODES } from "../skins";

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
  const skin = NATALIA_SKINS[resolved];
  applyUiSkin(skin, root ?? document.documentElement);
  return resolved;
}
