import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  composerKeyAction,
  commands,
  parseKeybindKey,
  normalizeKeybindKey,
  formatKeybindKey,
  keybindForEvent,
  parseKeybindOverrides,
  detectKeybindConflicts,
  buildKeybindMap,
} from "../src/keymap";
import { resolveTuiConfig, tuiConfigSchema } from "../src/config";

describe("composer key routing", () => {
  test("routes Enter to submit and modified Enter to newline", () => {
    expect(composerKeyAction({ name: "return" })).toBe("submit");
    expect(composerKeyAction({ name: "enter" })).toBe("submit");
    expect(composerKeyAction({ name: "return", option: true })).toBe("newline");
    expect(composerKeyAction({ name: "return", alt: true })).toBe("newline");
    expect(composerKeyAction({ name: "return", meta: true })).toBe("newline");
    expect(composerKeyAction({ name: "return", shift: true })).toBe("newline");
    expect(composerKeyAction({ name: "j", ctrl: true })).toBe("newline");
    expect(composerKeyAction({ name: "linefeed", source: "raw" })).toBe(
      "newline",
    );
  });

  test("leaves plain Home and End for message scrolling", () => {
    expect(composerKeyAction({ name: "home" })).toBeUndefined();
    expect(composerKeyAction({ name: "end" })).toBeUndefined();
    expect(composerKeyAction({ name: "home", ctrl: true })).toBe("buffer-home");
    expect(composerKeyAction({ name: "end", ctrl: true })).toBe("buffer-end");
  });
});

describe("keybind event normalization", () => {
  test("preserves every supported modifier for configured shortcuts", () => {
    expect(keybindForEvent({ name: "p", ctrl: true, shift: true })).toBe(
      "ctrl+shift+p",
    );
    expect(keybindForEvent({ name: "enter", alt: true })).toBe("alt+return");
    expect(keybindForEvent({ name: "k", meta: true })).toBe("meta+k");
  });
});

describe("keybind normalization", () => {
  test("normalizes terminal aliases before conflict checks or registration", () => {
    expect(normalizeKeybindKey("ctrl+enter")).toBe("ctrl+return");
    expect(normalizeKeybindKey("ctrl+pgup")).toBe("ctrl+pageup");
    expect(normalizeKeybindKey("esc")).toBe("escape");
  });
});

describe("command definitions", () => {
  test("all commands have valid default keys", () => {
    const ids = Object.keys(commands);
    expect(ids.length).toBeGreaterThan(10);
    for (const [id, def] of Object.entries(commands)) {
      expect(def.id).toBe(id);
      expect(def.desc).toBeTruthy();
      if (def.keys === "unset") continue;
      expect(def.keys).toBeTruthy();
      const parsed = parseKeybindKey(def.keys);
      expect(parsed.key).toBeTruthy();
    }
  });

  test("known command IDs match documented set", () => {
    expect(commands["palette.toggle"]).toBeDefined();
    expect(commands["session.new"]).toBeDefined();
    expect(commands["session.list"]).toBeDefined();
    expect(commands["settings.open"]).toBeDefined();
    expect(commands["help.open"]).toBeDefined();
    expect(commands["snapshot"]).toBeDefined();
    expect(commands["pty.focus-toggle"]).toBeDefined();
    expect(commands["cancel"]).toBeDefined();
    expect(commands["exit"]).toBeDefined();
    expect(commands["dialog.close"]).toBeDefined();
    expect(commands["scroll.up"]).toBeDefined();
    expect(commands["scroll.down"]).toBeDefined();
    expect(commands["scroll.top"]).toBeDefined();
    expect(commands["scroll.bottom"]).toBeDefined();
    expect(commands["composer.submit"]).toBeDefined();
    expect(commands["composer.newline"]).toBeDefined();
    expect(commands["composer.buffer-home"]).toBeDefined();
    expect(commands["composer.buffer-end"]).toBeDefined();
  });
});

test("resolved keybind map exposes configured help binding", () => {
  const { map } = buildKeybindMap({ "help.open": "ctrl+shift+h" });
  expect(map["help.open"]).toBe("ctrl+shift+h");
});

describe("parseKeybindKey", () => {
  test("parses control modifier", () => {
    const r = parseKeybindKey("ctrl+p");
    expect(r.ctrl).toBe(true);
    expect(r.key).toBe("p");
    expect(r.alt).toBe(false);
    expect(r.shift).toBe(false);
    expect(r.meta).toBe(false);
  });

  test("parses shift modifier", () => {
    const r = parseKeybindKey("shift+return");
    expect(r.shift).toBe(true);
    expect(r.key).toBe("return");
  });

  test("parses multiple modifiers", () => {
    const r = parseKeybindKey("ctrl+shift+a");
    expect(r.ctrl).toBe(true);
    expect(r.shift).toBe(true);
    expect(r.key).toBe("a");
  });

  test("parses bare key without modifiers", () => {
    const r = parseKeybindKey("escape");
    expect(r.ctrl).toBe(false);
    expect(r.key).toBe("escape");
  });

  test("parses option alias for alt", () => {
    const r = parseKeybindKey("option+enter");
    expect(r.alt).toBe(true);
    expect(r.key).toBe("enter");
  });

  test("parses control alias", () => {
    const r = parseKeybindKey("control+x");
    expect(r.ctrl).toBe(true);
    expect(r.key).toBe("x");
  });

  test("parses super aliases", () => {
    expect(parseKeybindKey("cmd+k").super).toBe(true);
    expect(parseKeybindKey("win+k").super).toBe(true);
    expect(parseKeybindKey("super+k").super).toBe(true);
  });

  test("handles empty string", () => {
    const r = parseKeybindKey("");
    expect(r.key).toBe("");
    expect(r.ctrl).toBe(false);
  });

  test("parses comma key", () => {
    const r = parseKeybindKey("ctrl+,");
    expect(r.ctrl).toBe(true);
    expect(r.key).toBe(",");
  });

  test("parses navigation keys", () => {
    expect(parseKeybindKey("pageup").key).toBe("pageup");
    expect(parseKeybindKey("pagedown").key).toBe("pagedown");
    expect(parseKeybindKey("home").key).toBe("home");
    expect(parseKeybindKey("end").key).toBe("end");
  });
});

describe("formatKeybindKey", () => {
  test("formats control modifier key", () => {
    expect(formatKeybindKey("ctrl+p")).toBe("Ctrl+P");
  });

  test("formats shift modifier key", () => {
    expect(formatKeybindKey("shift+return")).toBe("Shift+Return");
  });

  test("formats multi-modifier key", () => {
    expect(formatKeybindKey("ctrl+shift+a")).toBe("Ctrl+Shift+A");
  });

  test("formats bare key", () => {
    expect(formatKeybindKey("escape")).toBe("Escape");
  });

  test("formats comma key", () => {
    expect(formatKeybindKey("ctrl+,")).toBe("Ctrl+,");
  });
});

describe("parseKeybindOverrides", () => {
  test("returns empty diagnostics and resolved for valid overrides", () => {
    const { diagnostics, resolved } = parseKeybindOverrides({
      "palette.toggle": "ctrl+shift+p",
      "session.new": "ctrl+shift+n",
    });
    expect(diagnostics).toEqual([]);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({
      command: "palette.toggle",
      keys: "ctrl+shift+p",
      source: "override",
      disabled: false,
    });
    expect(resolved[1]).toMatchObject({
      command: "session.new",
      keys: "ctrl+shift+n",
      source: "override",
      disabled: false,
    });
  });

  test("flags unknown command in diagnostics", () => {
    const { diagnostics, resolved } = parseKeybindOverrides({
      "nonexistent.cmd": "ctrl+x",
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("unknown-command");
    expect(diagnostics[0].command).toBe("nonexistent.cmd");
    expect(resolved).toHaveLength(0);
  });

  test("disables command when value is false", () => {
    const { diagnostics, resolved } = parseKeybindOverrides({
      snapshot: false,
    });
    expect(diagnostics).toEqual([]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ command: "snapshot", disabled: true });
  });

  test("handles array of key strings", () => {
    const { diagnostics, resolved } = parseKeybindOverrides({
      "session.list": ["ctrl+l", "ctrl+shift+l"],
    });
    expect(diagnostics).toEqual([]);
    expect(resolved).toHaveLength(2);
    expect(resolved.map((item) => item.keys)).toEqual([
      "ctrl+l",
      "ctrl+shift+l",
    ]);
  });

  test("flags key string with no actual key", () => {
    const { diagnostics } = parseKeybindOverrides({
      "settings.open": "++++",
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("invalid-key");
  });

  test("flags non-string, non-false value", () => {
    const { diagnostics } = parseKeybindOverrides({
      cancel: 42 as any,
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("invalid-key");
  });
});

describe("detectKeybindConflicts", () => {
  test("detects same key assigned to two commands", () => {
    const diags = detectKeybindConflicts([
      {
        command: "palette.toggle",
        keys: "ctrl+p",
        source: "override",
        disabled: false,
      },
      {
        command: "session.list",
        keys: "ctrl+p",
        source: "override",
        disabled: false,
      },
    ]);
    expect(diags).toHaveLength(1);
    expect(diags[0].code).toBe("conflict");
    expect(diags[0].message).toContain("ctrl+p");
  });

  test("ignores disabled commands", () => {
    const diags = detectKeybindConflicts([
      {
        command: "palette.toggle",
        keys: "ctrl+p",
        source: "default",
        disabled: false,
      },
      { command: "snapshot", keys: "", source: "override", disabled: true },
    ]);
    expect(diags).toEqual([]);
  });

  test("no conflicts when all keys are unique", () => {
    const diags = detectKeybindConflicts([
      {
        command: "palette.toggle",
        keys: "ctrl+p",
        source: "default",
        disabled: false,
      },
      {
        command: "session.new",
        keys: "ctrl+n",
        source: "default",
        disabled: false,
      },
    ]);
    expect(diags).toEqual([]);
  });
});

describe("buildKeybindMap", () => {
  test("returns defaults when no overrides", () => {
    const { map, diagnostics } = buildKeybindMap(null);
    expect(diagnostics).toEqual([]);
    expect(map["palette.toggle"]).toBe("ctrl+p");
    expect(map["session.new"]).toBe("ctrl+n");
    const cmdBindings = Object.values(commands).filter((c) => c.keys !== "unset").length;
    expect(Object.keys(map).length).toBe(cmdBindings);
  });

  test("applies overrides on top of defaults", () => {
    const { map } = buildKeybindMap({
      "palette.toggle": "ctrl+shift+p",
    });
    expect(map["palette.toggle"]).toBe("ctrl+shift+p");
    expect(map["session.new"]).toBe("ctrl+n");
  });

  test("removes binding when overridden with false", () => {
    const { map, diagnostics } = buildKeybindMap({
      snapshot: false,
    });
    expect(diagnostics).toEqual([]);
    expect(map["snapshot"]).toBeUndefined();
    const cmdCount = Object.values(commands).filter((c) => c.keys !== "unset").length;
    expect(Object.keys(map).length).toBe(cmdCount - 1);
  });

  test("propagates unknown command diagnostics", () => {
    const { diagnostics } = buildKeybindMap({
      "bad.command": "ctrl+x",
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("unknown-command");
  });

  test("detects conflict between override and default", () => {
    const { diagnostics } = buildKeybindMap({
      "session.list": "ctrl+p",
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("conflict");
  });

  test("keeps every configured alternative binding for keymap registration", () => {
    const { bindings, map } = buildKeybindMap({
      "session.list": ["ctrl+shift+l", "ctrl+alt+l"],
    });
    expect(bindings["session.list"]).toEqual([
      "ctrl+shift+l",
      "ctrl+alt+l",
    ]);
    expect(map["session.list"]).toBe("ctrl+shift+l");
  });

  test("treats terminal aliases as conflicting bindings", () => {
    const { diagnostics } = buildKeybindMap({
      "composer.newline": "ctrl+enter",
      "composer.buffer-home": "ctrl+return",
    });
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "conflict", command: "composer.buffer-home" }),
    );
  });
});

describe("tui.json keybinds schema integration", () => {
  test("parses valid keybinds from raw JSON", () => {
    const config = tuiConfigSchema.parse({
      keybinds: {
        "palette.toggle": "ctrl+shift+p",
        "session.new": ["ctrl+n", "ctrl+alt+n"],
        snapshot: false,
      },
    });
    expect(config.keybinds).toBeDefined();
    expect(config.keybinds["palette.toggle"]).toBe("ctrl+shift+p");
    expect(Array.isArray(config.keybinds["session.new"])).toBe(true);
    expect(config.keybinds["snapshot"]).toBe(false);
  });

  test("parses empty keybinds object", () => {
    const config = tuiConfigSchema.parse({ keybinds: {} });
    expect(config.keybinds).toEqual({});
  });

  test("defaults to empty object when missing", () => {
    const config = tuiConfigSchema.parse({});
    expect(config.keybinds).toEqual({});
  });

  test("rejects non-string keys", () => {
    expect(() =>
      tuiConfigSchema.parse({
        keybinds: { cmd: 42 },
      }),
    ).toThrow();
  });
});

describe("resolveTuiConfig keybinds roundtrip", () => {
  test("loads and merges keybinds from tui.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "natalia-keybinds-roundtrip-"));
    try {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const tuiDir = join(root, ".natalia");
      await mkdir(tuiDir, { recursive: true, mode: 0o700 });
      await writeFile(
        join(tuiDir, "tui.json"),
        JSON.stringify({ keybinds: { "palette.toggle": "ctrl+alt+p" } }),
        { mode: 0o600 },
      );

      const { config } = await resolveTuiConfig(root);
      expect(config.keybinds["palette.toggle"]).toBe("ctrl+alt+p");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("parseKeybindKey edge cases", () => {
  test("meta modifier", () => {
    const r = parseKeybindKey("meta+z");
    expect(r.meta).toBe(true);
    expect(r.key).toBe("z");
  });

  test("hyper modifier", () => {
    const r = parseKeybindKey("hyper+x");
    expect(r.hyper).toBe(true);
    expect(r.key).toBe("x");
  });

  test("case insensitive", () => {
    const r = parseKeybindKey("Ctrl+Shift+P");
    expect(r.ctrl).toBe(true);
    expect(r.shift).toBe(true);
    expect(r.key).toBe("p");
  });
});

describe("buildKeybindMap null and undefined overrides", () => {
  test("handles null overrides", () => {
    const { map, diagnostics } = buildKeybindMap(null);
    expect(diagnostics).toEqual([]);
    expect(map["palette.toggle"]).toBe("ctrl+p");
  });

  test("handles undefined overrides", () => {
    const { map, diagnostics } = buildKeybindMap(undefined);
    expect(diagnostics).toEqual([]);
    expect(map["palette.toggle"]).toBe("ctrl+p");
  });

  test("handles empty overrides", () => {
    const { map, diagnostics } = buildKeybindMap({});
    expect(diagnostics).toEqual([]);
    const cmdCount = Object.values(commands).filter((c) => c.keys !== "unset").length;
    expect(Object.keys(map).length).toBe(cmdCount);
  });
});
