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

export function defaultTools(
  processRegistry = new ManagedProcessRegistry(),
): RuntimeTool[] {
  return [
    ...fileTools,
    ...searchTools,
    ...todoTools,
    askUserTool(),
    ...agentTools(),
    ...terminalTools(),
    ...sandboxTools(),
    ...shellTools,
    ...managedProcessTools(processRegistry),
    ...webTools,
  ];
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
