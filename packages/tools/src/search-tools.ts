import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
  numberOr,
  optionalString,
  requireObject,
  requireString,
} from "./arguments";
import type { RuntimeTool } from "./types";

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
