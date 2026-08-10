import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requireObject, requireString } from "./arguments";
import type { RuntimeTool } from "./types";

type TodoItem = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

function planTool(): RuntimeTool {
  return {
    name: "plan",
    description: "Create or update the durable workspace execution plan.",
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
    description: "Read durable workspace todo items.",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_input, context) {
      return JSON.stringify(await readTodos(context.workspaceRoot), null, 2);
    },
  };
}

function todoWriteTool(): RuntimeTool {
  return {
    name: "todo_write",
    description: "Replace durable workspace todo items.",
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
      await mkdir(resolve(context.workspaceRoot, ".natalia"), {
        recursive: true,
      });
      await writeFile(
        resolve(context.workspaceRoot, ".natalia", "todos.json"),
        `${JSON.stringify(items, null, 2)}\n`,
        { mode: 0o600 },
      );
      return `saved ${items.length} todo items`;
    },
  };
}

async function readTodos(workspaceRoot: string): Promise<TodoItem[]> {
  try {
    const parsed = JSON.parse(
      await readFile(resolve(workspaceRoot, ".natalia", "todos.json"), "utf8"),
    ) as TodoItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export const todoTools: RuntimeTool[] = [
  planTool(),
  todoReadTool(),
  todoWriteTool(),
];
