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
  workspacePath,
  type RuntimeTool,
  type ToolFamily,
} from "@natalia/tools";
import type { Plugin, PluginManifest } from "@natalia/plugin";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const SEARCH_PLUGIN_ID = "natalia-tool-search";

function globTool(): RuntimeTool {
  return {
    name: "glob",
    description:
      "List workspace files matching a Bun glob pattern. Optionally scope the search to a workspace-relative directory with path.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: { paths: { type: "array", items: { type: "string" } } },
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
      const scope = optionalString(args.path);
      const directory = scope
        ? workspacePath(context.workspaceRoot, scope)
        : context.workspaceRoot;
      const base = relative(context.workspaceRoot, directory)
        .split(sep)
        .join("/");
      const paths: string[] = [];
      for await (const relativePath of new Bun.Glob(pattern).scan({
        cwd: directory,
        onlyFiles: true,
      }))
        paths.push(base ? `${base}/${relativePath}` : relativePath);
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
    description:
      "Search UTF-8 workspace files with a regular expression. Optionally scope the search to a workspace-relative directory with path.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string" },
        include: { type: "string" },
        limit: { type: "number" },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: {
          matches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                line: { type: "number" },
                text: { type: "string" },
              },
              required: ["path", "line", "text"],
              additionalProperties: false,
            },
          },
        },
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
      const scope = optionalString(args.path);
      const directory = scope
        ? workspacePath(context.workspaceRoot, scope)
        : context.workspaceRoot;
      const base = relative(context.workspaceRoot, directory)
        .split(sep)
        .join("/");
      const include = optionalString(args.include) ?? "**/*";
      const limit = Math.min(1000, Math.max(1, numberOr(args.limit, 200)));
      const paths: string[] = [];
      for await (const relativePath of new Bun.Glob(include).scan({
        cwd: directory,
        onlyFiles: true,
      }))
        paths.push(base ? `${base}/${relativePath}` : relativePath);
      paths.sort();
      const lines: string[] = [];
      for (const displayPath of paths) {
        if (lines.length >= limit) break;
        const localPath = base
          ? displayPath.slice(base.length + 1)
          : displayPath;
        await context.workspaceReadAuthorize?.({
          toolName: "grep",
          paths: [displayPath],
        });
        let content: string;
        try {
          content = await readFile(resolve(directory, localPath), "utf8");
        } catch {
          continue;
        }
        if (content.includes("\0")) continue;
        for (const [index, line] of content.split(/\r?\n/u).entries()) {
          expression.lastIndex = 0;
          if (!expression.test(line)) continue;
          lines.push(`${displayPath}:${index + 1}:${line}`);
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

export const SEARCH_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: SEARCH_PLUGIN_ID,
  version: "1.0.0",
  name: "Search Tools",
  description: "Finding files by name and content in the workspace.",
  entry: "index.js",
  scope: "workspace",
  provides: [],
  requires: [],
  optionalRequires: [],
  conflicts: [],
  dependencies: [],
  hooks: {},
  integrationPoints: ["tools"],
};

export function createSearchPlugin(): Plugin {
  return {
    manifest: SEARCH_PLUGIN_MANIFEST,
    setup(api) {
      for (const tool of searchTools) api.tools.register(tool);
    },
  };
}
