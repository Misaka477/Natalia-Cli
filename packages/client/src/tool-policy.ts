import { isAbsolute, normalize, relative, resolve } from "node:path";
import {
  commandHasPrefix,
  parseBashCommandRule,
  parseBashSimpleCommand,
  type BashCommandRule,
} from "./bash-command-policy";

export type ToolPolicy = {
  allow?: string[];
  exclude?: string[];
};

export type ResourceRule = {
  pattern: string;
  allow?: boolean;
  reason?: string;
};

export type PermissionRules = {
  tools?: ToolPolicy;
  files?: {
    readPaths?: ResourceRule[];
    writePaths?: ResourceRule[];
  };
  commands?: {
    allowPatterns?: string[];
    denyPatterns?: string[];
  };
  network?: {
    allowHosts?: string[];
    denyHosts?: string[];
    allowLocalhost?: boolean;
    allowPrivate?: boolean;
  };
  env?: {
    allowlist?: string[];
  };
  redactOutput?: boolean;
};

export type PermissionProfileCommandRules = {
  mode: "blacklist" | "whitelist" | "none";
  rules: BashCommandRule[];
};

export type TerminalCommandBufferResult = PermissionCheck & {
  clearTerminal?: boolean;
};

const TERMINAL_COMMAND_BUFFER_LIMIT = 16 * 1024;

export type ToolHookEvent = {
  turnID: string;
  toolName: string;
  toolCallID: string;
  arguments: string;
};

export type ToolHookResult = {
  allowed: boolean;
  diagnostics: string[];
  clearTerminal?: boolean;
};

export type ToolHooks = {
  preExecute?: (
    event: ToolHookEvent,
  ) => ToolHookResult | Promise<ToolHookResult>;
  postExecute?: (
    event: ToolHookEvent & { result?: string; error?: string },
  ) => void | Promise<void>;
};

export type ToolPolicyHookLayer = {
  isToolAllowed(toolName: string): boolean;
  filterTools<T extends { name: string }>(tools: T[]): T[];
  preExecute(event: ToolHookEvent): Promise<ToolHookResult>;
  postExecute(
    event: ToolHookEvent & { result?: string; error?: string },
  ): Promise<void>;
};

export function createToolPolicyHookLayer(
  policy?: ToolPolicy,
  hooks?: ToolHooks,
): ToolPolicyHookLayer {
  const allowPatterns = compilePatterns(policy?.allow);
  const excludePatterns = compilePatterns(policy?.exclude);

  function isToolAllowed(toolName: string): boolean {
    if (
      allowPatterns.length > 0 &&
      !allowPatterns.some((p) => p.test(toolName))
    )
      return false;
    if (excludePatterns.some((p) => p.test(toolName))) return false;
    return true;
  }

  function filterTools<T extends { name: string }>(tools: T[]): T[] {
    return tools.filter((t) => isToolAllowed(t.name));
  }

  async function preExecute(event: ToolHookEvent): Promise<ToolHookResult> {
    const diagnostics: string[] = [];
    if (!isToolAllowed(event.toolName)) {
      diagnostics.push(`blocked by policy: ${event.toolName}`);
      return { allowed: false, diagnostics };
    }
    if (hooks?.preExecute) {
      const result = await hooks.preExecute(event);
      if (result) {
        diagnostics.push(...result.diagnostics);
        if (!result.allowed)
          return {
            allowed: false,
            diagnostics,
            clearTerminal: result.clearTerminal,
          };
      }
    }
    return { allowed: true, diagnostics };
  }

  async function postExecute(
    event: ToolHookEvent & { result?: string; error?: string },
  ): Promise<void> {
    if (hooks?.postExecute) {
      await hooks.postExecute(event);
    }
  }

  return { isToolAllowed, filterTools, preExecute, postExecute };
}

export type PermissionCheck = {
  allowed: boolean;
  reason?: string;
  diagnostics: string[];
};

/**
 * Tools that receive the command to run as an argument, so the command policy
 * reads `command`.
 */
const COMMAND_ARGUMENT_TOOLS = [
  "run_shell",
  "sandbox_execute",
  "sandbox_resource_start",
  "process_start",
  "background_start",
  "interactive_start",
  "interactive_terminal_start",
];

/**
 * Terminal input tools carry the command as terminal input instead of as a
 * command argument. They have to be checked by the same policy: otherwise a
 * model opens a shell once, which is checked, and then feeds every later
 * command through terminal input, which was not. Both the canonical names and
 * the registered aliases are listed because either name can be called.
 */
const TERMINAL_INPUT_TOOLS = [
  "interactive_terminal_write",
  "interactive_terminal_send_line",
  "interactive_terminal_keys",
  "interactive_terminal_input",
  "interactive_write",
  "interactive_send_line",
  "interactive_keys",
  "interactive_input",
];

/**
 * The command text a policy should judge for one tool call, or undefined when
 * the call carries no command. Shell and terminal paths deliberately share this
 * one function so a rule cannot hold on one path and be absent on the other.
 */
export function commandTextForTool(
  toolName: string,
  args: Record<string, unknown>,
): string | undefined {
  if (COMMAND_ARGUMENT_TOOLS.includes(toolName))
    return typeof args.command === "string" ? args.command : undefined;
  if (!TERMINAL_INPUT_TOOLS.includes(toolName)) return undefined;
  return terminalInputText(args);
}

/**
 * Key sequences are joined without a separator because a model can type a
 * command one key at a time, and only the reconstructed string shows what was
 * typed. Separate sources are joined by newline so they cannot merge into a
 * token that neither of them contained.
 */
function terminalInputText(args: Record<string, unknown>): string | undefined {
  const segments: string[] = [];
  if (typeof args.text === "string") segments.push(args.text);
  if (typeof args.input === "string") segments.push(args.input);
  if (typeof args.key === "string") segments.push(args.key);
  if (Array.isArray(args.keys)) {
    const typed: string[] = [];
    for (const entry of args.keys) {
      if (typeof entry === "string") {
        typed.push(entry);
        continue;
      }
      if (!entry || typeof entry !== "object") continue;
      const key = entry as Record<string, unknown>;
      if (typeof key.text === "string") typed.push(key.text);
      else if (typeof key.key === "string") typed.push(key.key);
    }
    if (typed.length) segments.push(typed.join(""));
  }
  const text = segments.join("\n");
  return text.length ? text : undefined;
}

/**
 * File rules are written as workspace-relative patterns, but a tool resolves
 * its path against the workspace root before touching disk. `secret.txt` and
 * `./secret.txt` are therefore the same file, and matching the raw argument let
 * a rule be evaded by respelling the path. Paths are normalized to the same
 * workspace-relative POSIX form the tool will actually use.
 *
 * Both the normalized and the raw spelling are tested, so this can only ever
 * block more than before, never less.
 */
function policyPathCandidates(path: string, workspaceRoot?: string): string[] {
  const candidates = new Set<string>([path]);
  const slashed = path.replace(/\\/gu, "/");
  candidates.add(slashed);
  if (workspaceRoot) {
    const absolute = resolve(workspaceRoot, path);
    const relativePath = relative(resolve(workspaceRoot), absolute);
    // A path outside the workspace is matched by its absolute form. Tools
    // reject those anyway, but a rule must not silently stop applying.
    candidates.add(
      relativePath &&
        !relativePath.startsWith("..") &&
        !isAbsolute(relativePath)
        ? relativePath.replace(/\\/gu, "/")
        : absolute.replace(/\\/gu, "/"),
    );
  } else {
    candidates.add(normalize(slashed).replace(/\\/gu, "/"));
  }
  for (const candidate of [...candidates])
    if (candidate.startsWith("./")) candidates.add(candidate.slice(2));
  return [...candidates].filter((candidate) => candidate.length > 0);
}

function matchesResourceRule(
  rules: ResourceRule[],
  path: string,
  workspaceRoot?: string,
): ResourceRule | undefined {
  const candidates = policyPathCandidates(path, workspaceRoot);
  return rules.find(
    (rule) =>
      !rule.allow &&
      candidates.some((candidate) => pathMatch(candidate, rule.pattern)),
  );
}

export function evaluatePermissionRules(
  rules: PermissionRules | undefined,
  toolName: string,
  args: Record<string, unknown>,
  workspaceRoot?: string,
): PermissionCheck {
  const diags: string[] = [];
  if (!rules) return { allowed: true, diagnostics: diags };

  // Check tool allow/exclude
  if (rules.tools) {
    const allowP = compilePatterns(rules.tools.allow);
    const excludeP = compilePatterns(rules.tools.exclude);
    if (allowP.length && !allowP.some((p) => p.test(toolName))) {
      diags.push(`tool "${toolName}" not in allow list`);
      return {
        allowed: false,
        reason: "tool blocked by policy",
        diagnostics: diags,
      };
    }
    if (excludeP.some((p) => p.test(toolName))) {
      diags.push(`tool "${toolName}" in exclude list`);
      return {
        allowed: false,
        reason: "tool blocked by policy",
        diagnostics: diags,
      };
    }
  }

  const readsPath = ["read_file", "read_media_file", "glob", "grep"].includes(
    toolName,
  );
  const writesPath = [
    "write_file",
    "edit_file",
    "sandbox_write",
    "sandbox_merge",
    "browser_screenshot",
  ].includes(toolName);
  if (rules.files && (readsPath || writesPath)) {
    const path = typeof args.path === "string" ? args.path : undefined;
    if (path) {
      if (writesPath && rules.files.writePaths) {
        const denied = matchesResourceRule(
          rules.files.writePaths,
          path,
          workspaceRoot,
        );
        if (denied) {
          diags.push(
            `write to "${path}" blocked: ${denied.reason ?? "path denied"}`,
          );
          return { allowed: false, reason: denied.reason, diagnostics: diags };
        }
      }
      if (readsPath && rules.files.readPaths) {
        const denied = matchesResourceRule(
          rules.files.readPaths,
          path,
          workspaceRoot,
        );
        if (denied) {
          diags.push(
            `read of "${path}" blocked: ${denied.reason ?? "path denied"}`,
          );
          return { allowed: false, reason: denied.reason, diagnostics: diags };
        }
      }
    }
  }

  if (rules.commands) {
    const cmd = commandTextForTool(toolName, args);
    if (cmd) {
      const denied = matchesCommandPatterns(cmd, rules.commands.denyPatterns);
      if (denied.error) {
        diags.push(`invalid command deny pattern: ${denied.error}`);
        return {
          allowed: false,
          reason: "command policy configuration is invalid",
          diagnostics: diags,
        };
      }
      if (denied.matches) {
        diags.push(`command matches deny pattern`);
        return {
          allowed: false,
          reason: "command blocked by policy",
          diagnostics: diags,
        };
      }
      const allowed = matchesCommandPatterns(cmd, rules.commands.allowPatterns);
      if (allowed.error) {
        diags.push(`invalid command allow pattern: ${allowed.error}`);
        return {
          allowed: false,
          reason: "command policy configuration is invalid",
          diagnostics: diags,
        };
      }
      if (rules.commands.allowPatterns?.length && !allowed.matches) {
        diags.push(`command does not match any allow pattern`);
        return {
          allowed: false,
          reason: "command blocked by policy",
          diagnostics: diags,
        };
      }
    }
  }

  return { allowed: true, diagnostics: diags };
}

/**
 * Applies the structured command rules written by permission-profile editing.
 * Legacy regular-expression rules remain in `evaluatePermissionRules` for
 * compatibility and are deliberately evaluated before this profile layer.
 */
export async function evaluatePermissionProfileCommandRules(
  rules: PermissionProfileCommandRules | undefined,
  toolName: string,
  args: Record<string, unknown>,
  scope = "profile",
): Promise<PermissionCheck> {
  const diagnostics: string[] = [];
  if (!rules || rules.mode === "none") return { allowed: true, diagnostics };
  const source = commandTextForTool(toolName, args);
  if (!source) return { allowed: true, diagnostics };

  const command = await parseBashSimpleCommand(source);
  if (!command.ok)
    return {
      allowed: false,
      reason: "command blocked by policy",
      diagnostics: [`command could not be parsed safely: ${command.reason}`],
    };

  const parsedRules = await Promise.all(
    rules.rules.map(async (rule) => ({
      rule,
      parsed: await parseBashCommandRule(rule),
    })),
  );
  const invalidRule = parsedRules.find(({ parsed }) => !parsed.ok);
  if (invalidRule)
    return {
      allowed: false,
      reason: "command policy configuration is invalid",
      diagnostics: [
        `invalid ${scope} command rule "${invalidRule.rule.command}": ${parseFailureReason(invalidRule.parsed)}`,
      ],
    };
  const matched = parsedRules.find(
    ({ parsed }) =>
      parsed.ok && commandHasPrefix(command.command, parsed.command),
  );
  if (rules.mode === "blacklist" && matched)
    return {
      allowed: false,
      reason: "command blocked by policy",
      diagnostics: [
        `command matches ${scope} deny rule "${matched.rule.command}"${matched.rule.reason ? `: ${matched.rule.reason}` : ""}`,
      ],
    };
  if (rules.mode === "whitelist" && !matched)
    return {
      allowed: false,
      reason: "command blocked by policy",
      diagnostics: [`command does not match any ${scope} allow rule`],
    };
  return { allowed: true, diagnostics };
}

/** Keeps one unsubmitted Bash line per managed pane for structured profiles. */
export class TerminalCommandBuffer {
  #lines = new Map<string, string>();

  clear(id: string): void {
    this.#lines.delete(id);
  }

  clearAll(): void {
    this.#lines.clear();
  }

  async evaluate(
    rules:
      | PermissionProfileCommandRules
      | readonly PermissionProfileCommandRules[]
      | undefined,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<TerminalCommandBufferResult | undefined> {
    const activeRules = (Array.isArray(rules) ? rules : [rules]).filter(
      (rule): rule is PermissionProfileCommandRules =>
        Boolean(rule) && rule.mode !== "none",
    );
    if (!activeRules.length) return undefined;
    const input = terminalCommandInput(toolName, args);
    if (!input) return undefined;
    if (!input.id)
      return denyTerminalBuffer("terminal command policy requires a pane id");
    if (input.unsupported) {
      this.clear(input.id);
      return denyTerminalBuffer(input.unsupported, true);
    }
    const line = `${this.#lines.get(input.id) ?? ""}${input.text}`;
    if (
      new TextEncoder().encode(line).byteLength > TERMINAL_COMMAND_BUFFER_LIMIT
    ) {
      this.clear(input.id);
      return denyTerminalBuffer(
        `terminal command buffer exceeded ${TERMINAL_COMMAND_BUFFER_LIMIT} bytes`,
        true,
      );
    }
    if (!input.submit) {
      this.#lines.set(input.id, line);
      return { allowed: true, diagnostics: [] };
    }
    this.clear(input.id);
    for (const [index, rules] of activeRules.entries()) {
      const check = await evaluatePermissionProfileCommandRules(
        rules,
        "run_shell",
        { command: line },
        index === 0 ? "profile" : "active module",
      );
      if (!check.allowed) return { ...check, clearTerminal: true };
    }
    return { allowed: true, diagnostics: [] };
  }
}

function denyTerminalBuffer(
  diagnostic: string,
  clearTerminal = false,
): TerminalCommandBufferResult {
  return {
    allowed: false,
    reason: "command blocked by policy",
    diagnostics: [diagnostic],
    clearTerminal,
  };
}

type TerminalCommandInput = {
  id?: string;
  text: string;
  submit: boolean;
  unsupported?: string;
};

function terminalCommandInput(
  toolName: string,
  args: Record<string, unknown>,
): TerminalCommandInput | undefined {
  if (!TERMINAL_INPUT_TOOLS.includes(toolName)) return undefined;
  const id = typeof args.id === "string" ? args.id : undefined;
  if (
    toolName === "interactive_terminal_send_line" ||
    toolName === "interactive_send_line"
  )
    return terminalCommandText(id, args.text, true);
  if (
    toolName === "interactive_terminal_write" ||
    toolName === "interactive_write"
  )
    return terminalCommandText(id, args.input, false);
  if (
    toolName === "interactive_terminal_input" ||
    toolName === "interactive_input"
  ) {
    if (args.paste)
      return {
        id,
        text: "",
        submit: false,
        unsupported:
          "terminal paste is not allowed while command rules are active",
      };
    if (typeof args.text === "string")
      return terminalCommandText(id, args.text, args.submit !== false);
  }
  return terminalCommandKeys(id, args);
}

function terminalCommandText(
  id: string | undefined,
  value: unknown,
  submit: boolean,
): TerminalCommandInput {
  if (typeof value !== "string")
    return {
      id,
      text: "",
      submit: false,
      unsupported: "terminal command input must be text",
    };
  if (/\r|\n/u.test(value))
    return {
      id,
      text: "",
      submit: false,
      unsupported:
        "terminal command input cannot contain a newline while command rules are active",
    };
  return { id, text: value, submit };
}

function terminalCommandKeys(
  id: string | undefined,
  args: Record<string, unknown>,
): TerminalCommandInput {
  const entries = Array.isArray(args.keys)
    ? args.keys
    : args.key === undefined
      ? []
      : [{ key: args.key, modifiers: args.modifiers }];
  let text = "";
  let submit = false;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object")
      return {
        id,
        text: "",
        submit: false,
        unsupported: "terminal command keys must be structured entries",
      };
    const key = entry as Record<string, unknown>;
    if (Array.isArray(key.modifiers) && key.modifiers.length)
      return {
        id,
        text: "",
        submit: false,
        unsupported:
          "terminal modified keys are not allowed while command rules are active",
      };
    if (typeof key.text === "string") {
      if (/\r|\n/u.test(key.text))
        return {
          id,
          text: "",
          submit: false,
          unsupported:
            "terminal command input cannot contain a newline while command rules are active",
        };
      text += key.text;
      continue;
    }
    if (key.key === "Enter" || key.key === "return") {
      submit = true;
      continue;
    }
    if (typeof key.key === "string" && Array.from(key.key).length === 1) {
      text += key.key;
      continue;
    }
    return {
      id,
      text: "",
      submit: false,
      unsupported:
        "terminal control keys are not allowed while command rules are active",
    };
  }
  return { id, text, submit };
}

function parseFailureReason(
  result: Awaited<ReturnType<typeof parseBashCommandRule>>,
): string {
  return result.ok ? "unknown parser failure" : result.reason;
}

function pathMatch(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    .replace(/\\\*/gu, ".*");
  return new RegExp(`^${escaped}$`, "u").test(path);
}

function matchesCommandPatterns(command: string, patterns?: string[]) {
  try {
    return {
      matches:
        patterns?.some((pattern) => new RegExp(pattern, "iu").test(command)) ??
        false,
    };
  } catch (error) {
    return {
      matches: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function compilePatterns(patterns?: string[]): RegExp[] {
  if (!patterns || patterns.length === 0) return [];
  return patterns.map((p) => {
    const escaped = p
      .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
      .replace(/\\\*/gu, ".*");
    return new RegExp(`^${escaped}$`, "u");
  });
}
