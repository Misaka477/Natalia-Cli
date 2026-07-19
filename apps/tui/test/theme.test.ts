import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ThemeService } from "../src/theme/service";
import {
  defaultTheme,
  themeDefinitionSchema,
  detectSystemTheme,
  resolveTheme,
  builtinThemeNames,
  isValidThemeName,
  type Theme,
} from "../src/theme/theme";

describe("built-in themes", () => {
  test("provides at least 6 built-in theme definitions", () => {
    const service = new ThemeService();
    const themes = service.getBuiltinThemes();
    expect(themes.length).toBeGreaterThanOrEqual(6);
    for (const t of themes) {
      expect(t.name).toBeTruthy();
      expect(t.background).toBeTruthy();
      expect(t.panel).toBeTruthy();
      expect(t.text).toBeTruthy();
      expect(t.muted).toBeTruthy();
      expect(t.accent).toBeTruthy();
      expect(t.success).toBeTruthy();
      expect(t.warning).toBeTruthy();
      expect(t.danger).toBeTruthy();
    }
  });

  test("includes dark and light as first two entries", () => {
    const themes = new ThemeService().getBuiltinThemes();
    expect(themes[0].name).toContain("dark");
    expect(themes[1].name).toContain("light");
  });

  test("builtinThemeNames returns names for auto-complete", () => {
    const names = new ThemeService().getBuiltinThemeNames();
    expect(names.length).toBeGreaterThanOrEqual(6);
    expect(names).toContain("natalia-dark");
    expect(names).toContain("natalia-light");
    expect(names).toContain("natalia-dracula");
    expect(names).toContain("natalia-nord");
    expect(names).toContain("natalia-monokai");
    expect(Array.isArray(names)).toBe(true);
  });

  test("isValidThemeName returns true for built-in names", () => {
    expect(isValidThemeName("natalia-dark")).toBe(true);
    expect(isValidThemeName("natalia-solarized-light")).toBe(true);
    expect(isValidThemeName("nonexistent")).toBe(false);
  });
});

describe("theme validation", () => {
  test("accepts valid theme definition", () => {
    const valid: Theme = {
      name: "test-theme",
      background: "#000",
      panel: "#111",
      text: "#fff",
      muted: "#888",
      accent: "#00f",
      success: "#0f0",
      warning: "#ff0",
      danger: "#f00",
      diffAdded: "#0f0",
      diffRemoved: "#f00",
      diffAddedBg: "#020",
      diffRemovedBg: "#200",
      diffContextBg: "#111",
      diffHighlightAdded: "#0f0",
      diffHighlightRemoved: "#f00",
      diffLineNumber: "#888",
      diffAddedLineNumberBg: "#030",
      diffRemovedLineNumberBg: "#300",
    };
    const result = themeDefinitionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  test("rejects theme without name", () => {
    const invalid = {
      background: "#000",
      panel: "#111",
      text: "#fff",
      muted: "#888",
      accent: "#00f",
      success: "#0f0",
      warning: "#ff0",
      danger: "#f00",
    };
    const result = themeDefinitionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test("rejects theme with empty name", () => {
    const invalid = {
      name: "",
      background: "#000",
      panel: "#111",
      text: "#fff",
      muted: "#888",
      accent: "#00f",
      success: "#0f0",
      warning: "#ff0",
      danger: "#f00",
    };
    const result = themeDefinitionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("ThemeService.validateTheme", () => {
  test("returns theme for valid input", () => {
    const service = new ThemeService();
    const result = service.validateTheme({
      name: "my-theme",
      background: "#000",
      panel: "#111",
      text: "#fff",
      muted: "#888",
      accent: "#00f",
      success: "#0f0",
      warning: "#ff0",
      danger: "#f00",
      diffAdded: "#0f0",
      diffRemoved: "#f00",
      diffAddedBg: "#020",
      diffRemovedBg: "#200",
      diffContextBg: "#111",
      diffHighlightAdded: "#0f0",
      diffHighlightRemoved: "#f00",
      diffLineNumber: "#888",
      diffAddedLineNumberBg: "#030",
      diffRemovedLineNumberBg: "#300",
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("my-theme");
  });

  test("returns null for invalid input", () => {
    const service = new ThemeService();
    expect(service.validateTheme({})).toBeNull();
    expect(service.validateTheme({ name: "x" })).toBeNull();
    expect(service.validateTheme(null)).toBeNull();
    expect(service.validateTheme("string")).toBeNull();
  });
});

describe("custom theme discovery", () => {
  test("discovers valid .json theme files from directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "natalia-themes-"));
    try {
      await writeFile(
        join(dir, "my-theme.json"),
        JSON.stringify({
          name: "my-theme",
          background: "#0a0a0a",
          panel: "#141414",
          text: "#e0e0e0",
          muted: "#808080",
          accent: "#7c3aed",
          success: "#22c55e",
          warning: "#eab308",
          danger: "#ef4444",
          diffAdded: "#22c55e",
          diffRemoved: "#ef4444",
          diffAddedBg: "#0a2a0a",
          diffRemovedBg: "#2a0a0a",
          diffContextBg: "#141414",
          diffHighlightAdded: "#4ade80",
          diffHighlightRemoved: "#f87171",
          diffLineNumber: "#808080",
          diffAddedLineNumberBg: "#0e3010",
          diffRemovedLineNumberBg: "#301010",
        }),
      );
      await writeFile(
        join(dir, "invalid.json"),
        JSON.stringify({ name: "incomplete" }),
      );

      const service = new ThemeService();
      const themes = await service.discoverCustomThemes(dir);
      expect(themes.length).toBe(1);
      expect(themes[0].name).toBe("my-theme");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("ignores missing custom theme directory", async () => {
    const service = new ThemeService("/nonexistent/workspace");
    const themes = await service.discoverCustomThemes();
    expect(themes.length).toBe(0);
  });

  test("custom themes override built-in themes with same name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "natalia-override-"));
    try {
      await writeFile(
        join(dir, "override-dark.json"),
        JSON.stringify({
          name: "natalia-dark",
          background: "#ff0000",
          panel: "#ff1111",
          text: "#fff",
          muted: "#888",
          accent: "#00f",
          success: "#0f0",
          warning: "#ff0",
          danger: "#f00",
          diffAdded: "#0f0",
          diffRemoved: "#f00",
          diffAddedBg: "#020",
          diffRemovedBg: "#200",
          diffContextBg: "#111",
          diffHighlightAdded: "#0f0",
          diffHighlightRemoved: "#f00",
          diffLineNumber: "#888",
          diffAddedLineNumberBg: "#030",
          diffRemovedLineNumberBg: "#300",
        }),
      );

      const service = new ThemeService();
      const all = await service.getAllThemes(dir);
      const dark = all.find((t) => t.name === "natalia-dark");
      expect(dark).toBeDefined();
      expect(dark!.background).toBe("#ff0000");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("theme resolution", () => {
  const service = new ThemeService();

  test("resolves by exact name", () => {
    const theme = service.resolveTheme("natalia-dark");
    expect(theme.name).toBe("natalia-dark");
    expect(theme.background).toBe("#111318");
  });

  test("resolves by exact name for non-default themes", () => {
    const theme = service.resolveTheme("natalia-dracula");
    expect(theme.name).toBe("natalia-dracula");
    expect(theme.background).toBe("#282a36");
  });

  test("falls back to dark when name unknown and mode is dark", () => {
    const theme = service.resolveTheme("nonexistent", "dark");
    expect(theme.name).toBe("natalia-dark");
  });

  test("falls back to light when name unknown and mode is light", () => {
    const theme = service.resolveTheme("nonexistent", "light");
    expect(theme.name).toBe("natalia-light");
  });

  test("falls back when name unknown and mode is system", () => {
    const theme = service.resolveTheme("nonexistent", "system");
    expect(["natalia-dark", "natalia-light"]).toContain(theme.name);
  });

  test("all theme names are resolvable", () => {
    for (const name of builtinThemeNames) {
      const theme = service.resolveTheme(name);
      expect(theme.name).toBe(name);
    }
  });

  test("getAllThemeNames returns names for auto-complete", async () => {
    const names = await service.getAllThemeNames();
    expect(names).toContain("natalia-dark");
    expect(names).toContain("natalia-dracula");
    expect(names.length).toBe(builtinThemeNames.length);
  });
});

describe("system theme detection", () => {
  test("returns a valid theme mode string", () => {
    const mode = detectSystemTheme();
    expect(["dark", "light"]).toContain(mode);
  });

  test("ThemeService.detectSystemTheme matches standalone function", () => {
    const service = new ThemeService();
    expect(service.detectSystemTheme()).toBe(detectSystemTheme());
  });
});

describe("defaultTheme", () => {
  test("defaultTheme is darkTheme", () => {
    expect(defaultTheme.name).toBe("natalia-dark");
  });

  test("resolveTheme default matches defaultTheme for known names", () => {
    expect(resolveTheme("natalia-dark").background).toBe(
      defaultTheme.background,
    );
  });
});

describe("theme config integration", () => {
  test("theme name can be persisted and loaded via ThemeService", async () => {
    const dir = await mkdtemp(join(tmpdir(), "natalia-theme-config-"));
    try {
      await mkdir(join(dir, ".natalia", "themes"), { recursive: true });
      await writeFile(
        join(dir, ".natalia", "themes", "user-theme.json"),
        JSON.stringify({
          name: "user-theme",
          background: "#1a1b2e",
          panel: "#232540",
          text: "#e2e4f0",
          muted: "#7a7d9a",
          accent: "#818cf8",
          success: "#6ee7b7",
          warning: "#fbbf24",
          danger: "#f87171",
          diffAdded: "#6ee7b7",
          diffRemoved: "#f87171",
          diffAddedBg: "#0a2a1a",
          diffRemovedBg: "#2a1010",
          diffContextBg: "#232540",
          diffHighlightAdded: "#a7f3d0",
          diffHighlightRemoved: "#fca5a5",
          diffLineNumber: "#7a7d9a",
          diffAddedLineNumberBg: "#0e3020",
          diffRemovedLineNumberBg: "#301818",
        }),
      );

      const service = new ThemeService(dir);
      const names = await service.getAllThemeNames();
      expect(names).toContain("user-theme");
      expect(names).toContain("natalia-dark");

      const all = await service.getAllThemes();
      const user = all.find((t) => t.name === "user-theme");
      expect(user).toBeDefined();
      expect(user!.background).toBe("#1a1b2e");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
