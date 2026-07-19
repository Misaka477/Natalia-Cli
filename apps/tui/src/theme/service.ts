import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  defaultTheme,
  detectSystemTheme,
  resolveTheme,
  themeDefinitionSchema,
  themes,
  builtinThemeNames,
  type Theme,
} from "./theme";

export class ThemeService {
  constructor(private workspaceRoot?: string) {}

  getBuiltinThemes(): Theme[] {
    return Object.values(themes);
  }

  getBuiltinThemeNames(): string[] {
    return builtinThemeNames;
  }

  async discoverCustomThemes(customDir?: string): Promise<Theme[]> {
    const result: Theme[] = [];
    const directories = [
      customDir,
      this.workspaceRoot
        ? resolve(this.workspaceRoot, ".natalia", "themes")
        : undefined,
      process.env.HOME
        ? resolve(process.env.HOME, ".config", "natalia-cli", "themes")
        : undefined,
    ].filter(Boolean) as string[];

    for (const directory of [...new Set(directories)]) {
      try {
        for (const entry of await readdir(directory)) {
          if (!entry.endsWith(".json")) continue;
          const path = join(directory, entry);
          const raw = JSON.parse(await readFile(path, "utf8"));
          const validated = this.validateTheme(raw);
          if (validated) result.push(validated);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return result;
  }

  async getAllThemes(customDir?: string): Promise<Theme[]> {
    const builtin = this.getBuiltinThemes();
    const custom = await this.discoverCustomThemes(customDir);
    const merged = new Map<string, Theme>();
    for (const t of builtin) merged.set(t.name, t);
    for (const t of custom) merged.set(t.name, t);
    return [...merged.values()];
  }

  async getAllThemeNames(customDir?: string): Promise<string[]> {
    const themes_ = await this.getAllThemes(customDir);
    return themes_.map((t) => t.name);
  }

  validateTheme(value: unknown): Theme | null {
    try {
      return themeDefinitionSchema.parse(value) as Theme;
    } catch {
      return null;
    }
  }

  resolveTheme(
    name: string,
    mode: "dark" | "light" | "system" = "dark",
  ): Theme {
    return resolveTheme(name, mode);
  }

  detectSystemTheme(): "dark" | "light" {
    return detectSystemTheme();
  }
}

export {
  defaultTheme,
  resolveTheme,
  detectSystemTheme,
  themeDefinitionSchema,
  type Theme,
};
