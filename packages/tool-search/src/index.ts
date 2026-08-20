/**
 * The search tool family, as a separately packaged family.
 *
 * Depends on the framework only for the tool-authoring surface (`RuntimeTool`,
 * `ToolFamily`, the argument helpers) and knows nothing about the runtime, the
 * capability kernel or the host that loads it.
 */
import {
  numberOr,
  optionalString,
  requireObject,
  requireString,
  type RuntimeTool,
  type ToolFamily,
} from "@natalia/tools";
import type { Plugin } from "@natalia/plugin";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

export const SEARCH_PLUGIN_ID = "natalia-tool-search";

function globTool(): RuntimeTool {
  return {
    name: "glob",
    description: "List workspace files matching a Bun glob pattern.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: { paths: { type: "array" } },
        required: ["paths"],
        additionalProperties: false,
      },
      presentCall(args) {
        return {
          kind: "search",
          title: requireObject(args).pattern as string,
          summary: "glob",
        };
      },
      presentResult(args, value) {
        const paths = value
          .split("\n")
          .filter((line) => !line.startsWith("..."));
        return {
          kind: "search",
          title: requireObject(args).pattern as string,
          summary: `${paths.length} matches`,
          body: value,
        };
      },
    },
    async execute(input, context) {
      const args = requireObject(input);
      const pattern = requireString(args.pattern, "pattern");
      if (isAbsolute(pattern) || pattern.includes(".."))
        throw new Error("glob pattern must remain inside workspace");
      const paths: string[] = [];
      for await (const path of new Bun.Glob(pattern).scan({
        cwd: context.workspaceRoot,
        onlyFiles: true,
      }))
        paths.push(path);
      paths.sort();
      const offset = Math.max(0, numberOr(args.offset, 0));
      const limit = Math.min(1000, Math.max(1, numberOr(args.limit, 200)));
      const page = paths.slice(offset, offset + limit);
      await context.workspaceReadAuthorize?.({ toolName: "glob", paths: page });
      return [
        ...page,
        paths.length > offset + limit
          ? `... ${paths.length - offset - limit} more; use offset=${offset + limit}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  };
}

function grepTool(): RuntimeTool {
  return {
    name: "grep",
    description: "Search UTF-8 workspace files with a regular expression.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        include: { type: "string" },
        limit: { type: "number" },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: { matches: { type: "array" } },
        required: ["matches"],
        additionalProperties: false,
      },
      presentCall(args) {
        return {
          kind: "search",
          title: requireObject(args).pattern as string,
          summary: "grep",
        };
      },
      presentResult(args, value) {
        return {
          kind: "search",
          title: requireObject(args).pattern as string,
          summary:
            value === "no matches"
              ? "no matches"
              : `${value.split("\n").length} matches`,
          body: value,
        };
      },
    },
    async execute(input, context) {
      const args = requireObject(input);
      const expression = new RegExp(
        requireString(args.pattern, "pattern"),
        "u",
      );
      const include = optionalString(args.include) ?? "**/*";
      const limit = Math.min(1000, Math.max(1, numberOr(args.limit, 200)));
      const paths: string[] = [];
      for await (const relativePath of new Bun.Glob(include).scan({
        cwd: context.workspaceRoot,
        onlyFiles: true,
      }))
        paths.push(relativePath);
      paths.sort();
      const lines: string[] = [];
      for (const relativePath of paths) {
        if (lines.length >= limit) break;
        await context.workspaceReadAuthorize?.({
          toolName: "grep",
          paths: [relativePath],
        });
        let content: string;
        try {
          content = await readFile(
            resolve(context.workspaceRoot, relativePath),
            "utf8",
          );
        } catch {
          continue;
        }
        if (content.includes("\0")) continue;
        for (const [index, line] of content.split(/\r?\n/u).entries()) {
          expression.lastIndex = 0;
          if (!expression.test(line)) continue;
          lines.push(`${relativePath}:${index + 1}:${line}`);
          if (lines.length >= limit) break;
        }
      }
      return lines.length ? lines.join("\n") : "no matches";
    },
  };
}

export const searchTools: RuntimeTool[] = [globTool(), grepTool()];

/**
 * Workspace scope: these tools only mean something inside the workspace they are
 * pointed at, and they read through the same workspace authorization the host
 * applies to file reads.
 */
export function searchToolFamily(): ToolFamily {
  return {
    id: "search",
    name: "Search Tools",
    version: "1.0.0",
    description: "Finding files by name and content in the workspace.",
    scope: "workspace",
    tools: searchTools,
  };
}

export function createSearchPlugin(): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: SEARCH_PLUGIN_ID,
      version: "1.0.0",
      name: "Search Tools",
      description: "Finding files by name and content in the workspace.",
      entry: "natalia:tool-search",
      scope: "workspace",
      provides: [],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["tools"],
    },
    setup(api) {
      for (const tool of searchTools) api.tools.register(tool);
    },
  };
}
