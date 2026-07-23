export const keymapBoundary = {
  leader: "ctrl+x",
  submit: "return",
  newline: "ctrl+j",
  cancel: "ctrl+c",
  exit: "ctrl+d on empty composer",
  palette: "ctrl+p",
  newSession: "ctrl+n",
  sessions: "ctrl+l",
  settings: "ctrl+,",
  status: "ctrl+i",
  help: "ctrl+h",
  sidebar: "ctrl+b",
  copy: "ctrl+shift+c",
  composer: "history up/down · word move/delete · paste limit 8 MiB",
  scrollUp: "pgup",
  scrollDown: "pgdn",
  scrollTop: "home",
  scrollBottom: "end",
};

export const moduleBoundaries = [
  "real runtime: TypeScript/Bun provider, session, tools, approvals, checkpoints",
  "start here: /doctor verifies provider and workspace without calling an LLM",
  "live smoke: submit a short prompt, then approve any write/shell/process tool action",
  "durability: /checkpoint, /checkpoints, /rollback <id> --dry-run",
  "control: /pause, /resume, Ctrl-C cancel, Ctrl-D exit on an empty composer",
  "legacy Go remains a fallback only; it is not used by this TS7 TUI",
];

export type ComposerKeyEvent = {
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
  option?: boolean;
  shift?: boolean;
  name?: string;
  source?: "raw" | "kitty";
};

export type ComposerKeyAction =
  | "submit"
  | "newline"
  | "buffer-home"
  | "buffer-end"
  | undefined;

export function composerKeyAction(event: ComposerKeyEvent): ComposerKeyAction {
  const key = event.name;
  if ((event.ctrl && key === "j") || key === "linefeed") return "newline";
  if (key === "return" || key === "enter") {
    if (event.option || event.alt || event.meta || event.shift)
      return "newline";
    return "submit";
  }
  if (event.ctrl && key === "home") return "buffer-home";
  if (event.ctrl && key === "end") return "buffer-end";
  return undefined;
}

export function keybindForEvent(event: ComposerKeyEvent): string {
  const key = event.name;
  const normalized = key === "enter" ? "return" : key?.toLowerCase();
  return [
    event.ctrl ? "ctrl" : "",
    event.alt || event.option ? "alt" : "",
    event.meta ? "meta" : "",
    event.shift ? "shift" : "",
    normalized ?? "",
  ]
    .filter(Boolean)
    .join("+");
}

export interface CommandDef {
  id: string;
  keys: string;
  desc: string;
  scope?: "dialog" | "autocomplete";
}

export const commands: Record<string, CommandDef> = {
  "palette.toggle": {
    id: "palette.toggle",
    keys: "ctrl+p",
    desc: "Toggle command palette",
  },
  "session.new": { id: "session.new", keys: "ctrl+n", desc: "New session" },
  "session.list": { id: "session.list", keys: "ctrl+l", desc: "List sessions" },
  "settings.open": {
    id: "settings.open",
    keys: "ctrl+,",
    desc: "Open settings",
  },
  status: { id: "status", keys: "ctrl+i", desc: "Show runtime status" },
  diagnostics: {
    id: "diagnostics",
    keys: "unset",
    desc: "Show runtime diagnostics",
  },
  "help.open": {
    id: "help.open",
    keys: "ctrl+h",
    desc: "Show keyboard shortcuts",
  },
  "session.sidebar.toggle": {
    id: "session.sidebar.toggle",
    keys: "ctrl+b",
    desc: "Toggle session sidebar",
  },
  "message.copy.last": {
    id: "message.copy.last",
    keys: "ctrl+shift+c",
    desc: "Copy last assistant or tool message",
  },
  "session.fork.last": {
    id: "session.fork.last",
    keys: "ctrl+shift+g",
    desc: "Fork session at the last submitted message",
  },
  snapshot: { id: "snapshot", keys: "ctrl+s", desc: "Create snapshot" },
  "pty.focus-toggle": {
    id: "pty.focus-toggle",
    keys: "ctrl+t",
    desc: "Toggle PTY/chat focus",
  },
  cancel: { id: "cancel", keys: "ctrl+c", desc: "Cancel current turn" },
  exit: { id: "exit", keys: "ctrl+d", desc: "Exit on empty composer" },
  "dialog.close": {
    id: "dialog.close",
    keys: "escape",
    desc: "Close current dialog",
  },
  "dialog.select.submit": {
    id: "dialog.select.submit",
    keys: "unset",
    desc: "Select dialog item",
    scope: "dialog",
  },
  "dialog.select.prev": {
    id: "dialog.select.prev",
    keys: "unset",
    desc: "Previous dialog item",
    scope: "dialog",
  },
  "dialog.select.next": {
    id: "dialog.select.next",
    keys: "unset",
    desc: "Next dialog item",
    scope: "dialog",
  },
  "dialog.select.page-up": {
    id: "dialog.select.page-up",
    keys: "unset",
    desc: "Previous dialog page",
    scope: "dialog",
  },
  "dialog.select.page-down": {
    id: "dialog.select.page-down",
    keys: "unset",
    desc: "Next dialog page",
    scope: "dialog",
  },
  "dialog.select.first": {
    id: "dialog.select.first",
    keys: "unset",
    desc: "First dialog item",
    scope: "dialog",
  },
  "dialog.select.last": {
    id: "dialog.select.last",
    keys: "unset",
    desc: "Last dialog item",
    scope: "dialog",
  },
  "model.dialog.favorite": {
    id: "model.dialog.favorite",
    keys: "f",
    desc: "Toggle model favorite",
    scope: "dialog",
  },
  "agent.dialog.edit": {
    id: "agent.dialog.edit",
    keys: "f",
    desc: "Edit agent override",
    scope: "dialog",
  },
  "agent.dialog.details": {
    id: "agent.dialog.details",
    keys: "d",
    desc: "View agent details",
    scope: "dialog",
  },
  "model.dialog.variant": {
    id: "model.dialog.variant",
    keys: "v",
    desc: "Select model variant",
    scope: "dialog",
  },
  "skill.list": {
    id: "skill.list",
    keys: "unset",
    desc: "List local skills",
  },
  "mcp.dialog.delete": {
    id: "mcp.dialog.delete",
    keys: "d",
    desc: "Delete MCP server",
    scope: "dialog",
  },
  "prompt.stash.save": {
    id: "prompt.stash.save",
    keys: "ctrl+shift+s",
    desc: "Stash current prompt",
  },
  "prompt.stash.list": {
    id: "prompt.stash.list",
    keys: "ctrl+shift+p",
    desc: "Open prompt stash",
  },
  "prompt.stash.delete": {
    id: "prompt.stash.delete",
    keys: "d",
    desc: "Delete stashed prompt",
    scope: "dialog",
  },
  "prompt.attachment.add": {
    id: "prompt.attachment.add",
    keys: "ctrl+shift+a",
    desc: "Queue workspace attachment",
  },
  "prompt.attachment.list": {
    id: "prompt.attachment.list",
    keys: "ctrl+shift+o",
    desc: "List queued attachments",
  },
  "prompt.attachment.remove": {
    id: "prompt.attachment.remove",
    keys: "d",
    desc: "Remove queued attachment",
    scope: "dialog",
  },
  "prompt.autocomplete.prev": {
    id: "prompt.autocomplete.prev",
    keys: "up",
    desc: "Previous autocomplete item",
    scope: "autocomplete",
  },
  "prompt.autocomplete.next": {
    id: "prompt.autocomplete.next",
    keys: "down",
    desc: "Next autocomplete item",
    scope: "autocomplete",
  },
  "prompt.autocomplete.select": {
    id: "prompt.autocomplete.select",
    keys: "return",
    desc: "Select autocomplete item",
    scope: "autocomplete",
  },
  "prompt.autocomplete.hide": {
    id: "prompt.autocomplete.hide",
    keys: "escape",
    desc: "Hide autocomplete",
    scope: "autocomplete",
  },
  "workspace.search": {
    id: "workspace.search",
    keys: "ctrl+shift+f",
    desc: "Search workspace files",
  },
  "provider.connect": {
    id: "provider.connect",
    keys: "unset",
    desc: "Connect a new provider",
  },
  "model.list": {
    id: "model.list",
    keys: "unset",
    desc: "List configured models",
  },
  "agent.list": {
    id: "agent.list",
    keys: "unset",
    desc: "Select configured agent",
  },
  "mcp.list": {
    id: "mcp.list",
    keys: "unset",
    desc: "Manage MCP servers",
  },
  "model.edit": {
    id: "model.edit",
    keys: "unset",
    desc: "Edit model parameters",
  },
  "scroll.up": { id: "scroll.up", keys: "pageup", desc: "Scroll up" },
  "scroll.down": { id: "scroll.down", keys: "pagedown", desc: "Scroll down" },
  "scroll.top": { id: "scroll.top", keys: "home", desc: "Scroll to top" },
  "scroll.bottom": {
    id: "scroll.bottom",
    keys: "end",
    desc: "Scroll to bottom",
  },
  "dialog.test": {
    id: "dialog.test",
    keys: "none",
    desc: "Test dialog stack (confirm → prompt → select)",
  },
  "composer.submit": {
    id: "composer.submit",
    keys: "return",
    desc: "Submit prompt",
  },
  "composer.newline": {
    id: "composer.newline",
    keys: "shift+return",
    desc: "Insert newline",
  },
  "composer.buffer-home": {
    id: "composer.buffer-home",
    keys: "ctrl+home",
    desc: "Go to buffer start",
  },
  "composer.buffer-end": {
    id: "composer.buffer-end",
    keys: "ctrl+end",
    desc: "Go to buffer end",
  },
};

const leaderBindings: Record<string, string> = {
  "session.new": "<leader>n",
  "session.list": "<leader>l",
  "session.sidebar.toggle": "<leader>b",
  "settings.open": "<leader>,",
  "help.open": "<leader>h",
  snapshot: "<leader>c",
  "agent.list": "<leader>a",
  "model.list": "<leader>m",
};

export interface ParsedKey {
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  shift: boolean;
  super: boolean;
  hyper: boolean;
  key: string;
}

export function parseKeybindKey(keyStr: string): ParsedKey {
  const parts = keyStr.toLowerCase().split("+");
  const result: ParsedKey = {
    ctrl: false,
    alt: false,
    meta: false,
    shift: false,
    super: false,
    hyper: false,
    key: "",
  };
  const keyParts: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    switch (part) {
      case "ctrl":
      case "control":
        result.ctrl = true;
        break;
      case "alt":
      case "option":
        result.alt = true;
        break;
      case "meta":
        result.meta = true;
        break;
      case "shift":
        result.shift = true;
        break;
      case "super":
      case "cmd":
      case "win":
        result.super = true;
        break;
      case "hyper":
        result.hyper = true;
        break;
      default:
        keyParts.push(part);
        break;
    }
  }
  result.key = keyParts.join("+");
  return result;
}

export function formatKeybindKey(keyStr: string): string {
  if (keyStr.startsWith("<leader>"))
    return `Leader+${keyStr.slice("<leader>".length).toUpperCase()}`;
  const parsed = parseKeybindKey(keyStr);
  const parts: string[] = [];
  if (parsed.ctrl) parts.push("Ctrl");
  if (parsed.alt) parts.push("Alt");
  if (parsed.meta) parts.push("Meta");
  if (parsed.shift) parts.push("Shift");
  if (parsed.super) parts.push("Super");
  if (parsed.hyper) parts.push("Hyper");
  const k = parsed.key;
  parts.push(k ? k.charAt(0).toUpperCase() + k.slice(1) : "");
  return parts.join("+");
}

export function formatKeybinds(keys: readonly string[]) {
  return keys.map(formatKeybindKey).join(" / ");
}

export type UserKeybindOverrides = Record<string, string | string[] | false>;

export interface OverrideDiagnostic {
  code: "unknown-command" | "invalid-key" | "conflict";
  command: string;
  message: string;
}

export interface ResolvedKeybind {
  command: string;
  keys: string;
  source: "default" | "override";
  disabled: boolean;
}

export interface ParseOverridesResult {
  diagnostics: OverrideDiagnostic[];
  resolved: ResolvedKeybind[];
}

export type ResolvedKeybindMap = {
  bindings: Record<string, string[]>;
  diagnostics: OverrideDiagnostic[];
  // Kept for existing callers that display one primary shortcut.
  map: Record<string, string>;
};

const keyAliases: Record<string, string> = {
  enter: "return",
  esc: "escape",
  pgdown: "pagedown",
  pgup: "pageup",
};

export function normalizeKeybindKey(value: string) {
  const parsed = parseKeybindKey(value);
  if (!parsed.key) return "";
  const key = keyAliases[parsed.key] ?? parsed.key;
  return [
    parsed.ctrl ? "ctrl" : "",
    parsed.alt ? "alt" : "",
    parsed.meta ? "meta" : "",
    parsed.shift ? "shift" : "",
    parsed.super ? "super" : "",
    parsed.hyper ? "hyper" : "",
    key,
  ]
    .filter(Boolean)
    .join("+");
}

function keybindAlternatives(value: string) {
  return value
    .split(
      /,(?=(?:ctrl|control|alt|option|meta|shift|super|cmd|win|hyper)\+)/iu,
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseKeybindOverrides(
  overrides: UserKeybindOverrides,
): ParseOverridesResult {
  const diagnostics: OverrideDiagnostic[] = [];
  const resolved: ResolvedKeybind[] = [];

  for (const [command, value] of Object.entries(overrides)) {
    if (!commands[command]) {
      diagnostics.push({
        code: "unknown-command",
        command,
        message: `Unknown command "${command}" in keybind overrides`,
      });
      continue;
    }
    if (value === false) {
      resolved.push({ command, keys: "", source: "override", disabled: true });
      continue;
    }
    const keysArray = (Array.isArray(value) ? value : [value]).flatMap((key) =>
      typeof key === "string" ? keybindAlternatives(key) : [key],
    );
    for (const k of keysArray) {
      if (typeof k !== "string") {
        diagnostics.push({
          code: "invalid-key",
          command,
          message: `Invalid key value for "${command}": expected string, got ${typeof k}`,
        });
        continue;
      }
      const keys = normalizeKeybindKey(k);
      if (!keys) {
        diagnostics.push({
          code: "invalid-key",
          command,
          message: `Invalid key "${k}" for command "${command}": could not parse`,
        });
        continue;
      }
      resolved.push({
        command,
        keys,
        source: "override",
        disabled: false,
      });
    }
  }
  return { diagnostics, resolved };
}

export function detectKeybindConflicts(
  resolved: ResolvedKeybind[],
): OverrideDiagnostic[] {
  const diagnostics: OverrideDiagnostic[] = [];
  const keyToCommands = new Map<string, string[]>();

  for (const r of resolved) {
    if (r.disabled || !r.keys) continue;
    const keys = normalizeKeybindKey(r.keys);
    if (!keys) continue;
    const prev = keyToCommands.get(keys);
    if (prev) {
      diagnostics.push({
        code: "conflict",
        command: r.command,
        message: `Key "${keys}" conflicts: assigned to both "${prev[0]}" and "${r.command}"`,
      });
    }
    keyToCommands.set(keys, [...(prev ?? []), r.command]);
  }
  return diagnostics;
}

export function buildKeybindMap(
  overrides?: UserKeybindOverrides | null,
): ResolvedKeybindMap {
  const bindings: Record<string, string[]> = {};
  const diagnostics: OverrideDiagnostic[] = [];

  for (const [id, cmd] of Object.entries(commands)) {
    const defaults = [
      ...(cmd.keys === "unset" ? [] : [normalizeKeybindKey(cmd.keys)]),
      ...(leaderBindings[id] ? [leaderBindings[id]] : []),
    ];
    if (defaults.length) bindings[id] = defaults;
  }

  if (overrides) {
    const { resolved, diagnostics: parseDiags } =
      parseKeybindOverrides(overrides);
    diagnostics.push(...parseDiags);
    const overridden = new Set<string>();

    for (const r of resolved) {
      if (r.disabled) {
        delete bindings[r.command];
        overridden.add(r.command);
        continue;
      }
      bindings[r.command] = overridden.has(r.command)
        ? [...(bindings[r.command] ?? []), r.keys]
        : [r.keys];
      overridden.add(r.command);
    }
  }

  const conflictDiags = detectKeybindConflicts(
    Object.entries(bindings)
      .filter(([command]) => !commands[command]?.scope)
      .flatMap(([command, keys]) =>
        keys.map((key) => ({
          command,
          keys: key,
          source: "default" as const,
          disabled: false,
        })),
      ),
  );
  diagnostics.push(...conflictDiags);

  return {
    bindings,
    diagnostics,
    map: Object.fromEntries(
      Object.entries(bindings).map(([command, keys]) => [command, keys[0]!]),
    ),
  };
}
