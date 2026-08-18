/**
 * The todo tool family, as a separately packaged family.
 *
 * This is the first built-in family to live outside `@natalia/tools`, and it is
 * the proof of the shape the rest follow: it depends on the framework only for
 * the tool-authoring surface (`RuntimeTool`, `ToolFamily`, the argument helpers)
 * and knows nothing about the runtime, the capability kernel or the host that
 * loads it. The host composes families; the framework ships none.
 */
import {
  requireObject,
  requireString,
  type RuntimeTool,
  type ToolFamily,
} from "@natalia/tools";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type TodoItem = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

function planTool(): RuntimeTool {
  return {
    name: "plan",
    description: "Create or update this session's durable execution plan.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { items: { type: "array" } },
      required: ["items"],
      additionalProperties: false,
    },
    async execute(input, context) {
      return await todoWriteTool().execute(input, context);
    },
  };
}

function todoReadTool(): RuntimeTool {
  return {
    name: "todo_read",
    description: "Read this session's durable todo items.",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    output: {
      schema: {
        type: "object",
        properties: { items: { type: "array" } },
        required: ["items"],
        additionalProperties: false,
      },
      presentCall() {
        return { kind: "generic", title: "todos", summary: "read" };
      },
      presentResult(_args, value) {
        const items =
          (JSON.parse(value) as Array<{
            status?: string;
            content?: string;
          }> | null) ?? [];
        const done = items.filter((item) => item.status === "completed").length;
        return {
          kind: "generic",
          title: "todos",
          summary: `${items.length} items · ${done} done`,
          body: value,
        };
      },
    },
    async execute(_input, context) {
      return JSON.stringify(
        await readTodos(
          context.workspaceRoot,
          requireSessionID(context.sessionID),
        ),
        null,
        2,
      );
    },
  };
}

function todoWriteTool(): RuntimeTool {
  return {
    name: "todo_write",
    description: "Replace this session's durable todo items.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { items: { type: "array" } },
      required: ["items"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      if (!Array.isArray(args.items)) throw new Error("items must be an array");
      const items = args.items.map((item) => {
        const value = requireObject(item);
        const status = requireString(value.status, "items.status");
        if (!["pending", "in_progress", "completed"].includes(status))
          throw new Error("items.status is invalid");
        return {
          content: requireString(value.content, "items.content"),
          status,
        } as TodoItem;
      });
      const path = todoPath(
        context.workspaceRoot,
        requireSessionID(context.sessionID),
      );
      await mkdir(resolve(context.workspaceRoot, ".natalia", "todos"), {
        recursive: true,
      });
      await writeFile(path, `${JSON.stringify(items, null, 2)}\n`, {
        mode: 0o600,
      });
      return `saved ${items.length} todo items`;
    },
  };
}

async function readTodos(
  workspaceRoot: string,
  sessionID: string,
): Promise<TodoItem[]> {
  try {
    const parsed = JSON.parse(
      await readFile(todoPath(workspaceRoot, sessionID), "utf8"),
    ) as TodoItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function requireSessionID(sessionID: string | undefined) {
  if (!sessionID) throw new Error("todo tools require a session ID");
  return sessionID;
}

function todoPath(workspaceRoot: string, sessionID: string) {
  return resolve(
    workspaceRoot,
    ".natalia",
    "todos",
    `${encodeURIComponent(sessionID)}.json`,
  );
}

export const todoTools: RuntimeTool[] = [
  planTool(),
  todoReadTool(),
  todoWriteTool(),
];

/**
 * Session scope: each session owns a separate durable list inside the workspace.
 */
export function todoToolFamily(): ToolFamily {
  return {
    id: "todo",
    name: "Todo Tools",
    version: "1.0.0",
    description: "The session's task list.",
    scope: "session",
    tools: todoTools,
  };
}
