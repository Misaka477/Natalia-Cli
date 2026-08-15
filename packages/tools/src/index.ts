import { agentTools } from "./agent-tools";
import { sandboxTools } from "./sandbox-tools";
import { terminalTools } from "./terminal-tools";
import { fileTools } from "./file-tools";
import { searchTools } from "./search-tools";
import { todoTools } from "./todo-tools";
import { shellTools } from "./shell-tools";
import { webTools } from "./web-tools";
export { validateToolParameters, assertValidToolParameters } from "./validate";
export {
  boundToolOutput,
  cleanupToolOutput,
  MAX_TOOL_OUTPUT_BYTES,
  MAX_TOOL_OUTPUT_LINES,
  TOOL_OUTPUT_RETENTION_MS,
} from "./output";
import { optionalString, requireObject, requireString } from "./arguments";

/**
 * The tool-authoring surface.
 *
 * A tool family is meant to be writable outside this package — that is the point
 * of `ToolFamily` — and every built-in family already uses these helpers to read
 * its arguments. Keeping them private would have forced an out-of-package family
 * to reimplement argument validation, which is how two dialects of "what a bad
 * argument is" appear.
 */
export {
  numberOr,
  optionalInteger,
  optionalString,
  positiveNumberOr,
  positiveNumberOrUndefined,
  requireObject,
  requireString,
  workspacePath,
} from "./arguments";
import { ManagedProcessRegistry, managedProcessTools } from "./managed-process";
import type { RuntimeTool, ToolExecutionContext } from "./types";

export type {
  RuntimeTool,
  ToolExecutionBoundary,
  ToolExecutionContext,
  ToolSchema,
} from "./types";

export {
  ManagedProcessRegistry,
  type ManagedProcessInfo,
  type ManagedProcessStatus,
} from "./managed-process";
import {
  encodeTerminalKey,
  nativeTerminalReadPage,
  nativeTerminalSearchPage,
} from "./terminal-io";

export {
  encodeTerminalKey,
  nativeTerminalReadPage,
  nativeTerminalSearchPage,
} from "./terminal-io";

export { materializeTools } from "./invocation";
export type {
  ToolInvocation,
  ToolMaterialization,
  ToolSettlement,
} from "./invocation";
export class ToolRegistry extends Map<string, RuntimeTool> {
  private readonly aliases = new Map<string, string>();

  addAlias(alias: string, target: string) {
    if (!super.has(target))
      throw new Error(`cannot alias unknown tool: ${target}`);
    this.aliases.set(alias, target);
  }

  override get(name: string) {
    return super.get(this.aliases.get(name) ?? name);
  }

  override has(name: string) {
    return super.has(this.aliases.get(name) ?? name);
  }
}

export function createToolRegistry(
  tools?: RuntimeTool[],
  processRegistry?: ManagedProcessRegistry,
): ToolRegistry {
  const registry = new ToolRegistry(
    (tools ?? defaultTools(processRegistry)).map((tool) => [tool.name, tool]),
  );
  if (!tools)
    for (const [alias, target] of Object.entries(
      interactiveTerminalToolAliases,
    ))
      registry.addAlias(alias, target);
  return registry;
}

const interactiveTerminalToolAliases = {
  interactive_start: "interactive_terminal_start",
  interactive_read: "interactive_terminal_read",
  interactive_search: "interactive_terminal_search",
  interactive_write: "interactive_terminal_write",
  interactive_send_line: "interactive_terminal_send_line",
  interactive_keys: "interactive_terminal_keys",
  interactive_input: "interactive_terminal_input",
  interactive_snapshot: "interactive_terminal_snapshot",
  interactive_resize: "interactive_terminal_resize",
  interactive_stop: "interactive_terminal_stop",
  interactive_list: "interactive_terminal_list",
} as const;

export { interactiveTerminalToolAliases };

/**
 * A tool family: the unit a host loads, and the unit that owns its tools.
 *
 * The built-in tools are grouped here rather than in the host so that the same
 * grouping is available to whoever assembles them — today the runtime, which
 * registers one capability per family so the kernel owns the tools and unloading
 * a family really removes them; tomorrow a separately distributed `tool-*`
 * package, which describes itself the same way.
 *
 * `scope` is the lifetime of the family's tools, spelled with the capability
 * scopes the kernel already understands. It stays a plain string union here:
 * this package must not depend on the kernel to describe its own tools.
 */
export type ToolFamilyScope = "process" | "workspace" | "session";

export type ToolFamily = {
  /** Stable family key, and the suffix of the capability id the host loads it as. */
  id: string;
  name: string;
  version: string;
  description: string;
  scope: ToolFamilyScope;
  tools: RuntimeTool[];
  /** Alternate names for this family's tools, applied by the host's registry. */
  aliases?: Record<string, string>;
};

/**
 * The built-in tool families, in the order their tools are advertised.
 *
 * This is the single source of truth for what the framework ships: `defaultTools`
 * is derived from it, so a family cannot be registered through the kernel and
 * still be missing from the flat catalogue (or the reverse).
 */
export function defaultToolFamilies(
  processRegistry = new ManagedProcessRegistry(),
): ToolFamily[] {
  return [
    {
      id: "fs",
      name: "Filesystem Tools",
      version: "1.0.0",
      description: "Reading, writing and editing workspace files.",
      scope: "workspace",
      tools: [...fileTools],
    },
    {
      id: "search",
      name: "Search Tools",
      version: "1.0.0",
      description: "Finding files by name and content in the workspace.",
      scope: "workspace",
      tools: [...searchTools],
    },
    {
      id: "todo",
      name: "Todo Tools",
      version: "1.0.0",
      description: "The session's task list.",
      scope: "session",
      tools: [...todoTools],
    },
    {
      id: "ask",
      name: "Interactive Question Tools",
      version: "1.0.0",
      description: "Asking the user a structured question.",
      scope: "session",
      tools: [askUserTool()],
    },
    {
      id: "agent",
      name: "Subagent Tools",
      version: "1.0.0",
      description: "Delegating work to a subagent.",
      scope: "session",
      tools: [...agentTools()],
    },
    {
      id: "terminal",
      name: "Terminal Tools",
      version: "1.0.0",
      description: "Native terminal panes and interactive programs.",
      scope: "session",
      tools: [...terminalTools()],
      aliases: { ...interactiveTerminalToolAliases },
    },
    {
      id: "sandbox",
      name: "Sandbox Tools",
      version: "1.0.0",
      description: "Isolated workspaces and their merge back.",
      scope: "workspace",
      tools: [...sandboxTools()],
    },
    {
      id: "shell",
      name: "Shell Tools",
      version: "1.0.0",
      description: "One-shot command execution.",
      scope: "session",
      tools: [...shellTools],
    },
    {
      id: "process",
      name: "Managed Process Tools",
      version: "1.0.0",
      description: "Long-running background processes.",
      scope: "session",
      tools: [...managedProcessTools(processRegistry)],
    },
    {
      id: "web",
      name: "Web Tools",
      version: "1.0.0",
      description: "Fetching and searching the web.",
      scope: "session",
      tools: [...webTools],
    },
  ];
}

export function defaultTools(
  processRegistry = new ManagedProcessRegistry(),
): RuntimeTool[] {
  return defaultToolFamilies(processRegistry).flatMap((family) => family.tools);
}

function askUserTool(): RuntimeTool {
  return {
    name: "ask_user",
    description:
      "Ask the user a structured question and wait for their answer.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        question: { type: "string" },
        options: { type: "array" },
        multiple: { type: "boolean" },
      },
      required: ["question", "options"],
      additionalProperties: false,
    },
    async execute(input, context) {
      if (!context.askQuestion)
        throw new Error("interactive question channel unavailable");
      const args = requireObject(input);
      if (!Array.isArray(args.options))
        throw new Error("options must be an array");
      const options = args.options.map((item) => ({ label: String(item) }));
      const answers = await context.askQuestion({
        title: optionalString(args.title) ?? "Question from Natalia",
        questions: [
          {
            id: "question_0",
            header: "Question",
            question: requireString(args.question, "question"),
            options,
            multiple: args.multiple === true,
            custom: true,
          },
        ],
      });
      return JSON.stringify({ answers }, null, 2);
    },
  };
}
