/**
 * The write filesystem tool family, split out of `tool-fs` by read/write
 * boundary (2026-08-21): these tools write the workspace, take the write lock,
 * are `requiresApproval: true` and carry the write-path permission rules. The
 * read half lives in `@natalia/tool-fs-read`.
 *
 * Depends on the framework only for the tool-authoring surface and knows
 * nothing about the runtime or the capability kernel.
 */
import {
  applyUnifiedPatchToText,
  parseUnifiedPatch,
  requireObject,
  requireString,
  workspacePath,
  type RuntimeTool,
  type ToolFamily,
} from "@natalia/tools";
import type { Plugin } from "@natalia/plugin";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

export const FS_WRITE_PLUGIN_ID = "natalia-tool-fs-write";

function writeFileTool(): RuntimeTool {
  return {
    name: "write_file",
    description: "Write a UTF-8 text file inside the workspace.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        mode: { type: "number" },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
      presentCall(args) {
        return {
          kind: "generic",
          title: requireObject(args).path as string,
          summary: "write",
        };
      },
      presentResult(args, value) {
        return {
          kind: "generic",
          title: requireObject(args).path as string,
          summary: value,
        };
      },
    },
    async execute(input, context) {
      const args = requireObject(input);
      const path = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      await context.workspaceWriteAuthorize?.({
        toolName: "write_file",
        path,
      });
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, requireString(args.content, "content"));
      if (typeof args.mode === "number") await chmod(path, args.mode);
      return `wrote ${relative(context.workspaceRoot, path)}`;
    },
  };
}

function editFileTool(): RuntimeTool {
  return {
    name: "edit_file",
    description: "Replace exact text inside a UTF-8 workspace file.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        oldText: { type: "string" },
        newText: { type: "string" },
      },
      required: ["path", "oldText", "newText"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
      presentCall(args) {
        return {
          kind: "diff",
          title: requireObject(args).path as string,
          summary: "edit",
        };
      },
      presentResult(args, value) {
        return {
          kind: "diff",
          title: requireObject(args).path as string,
          summary: value,
        };
      },
    },
    async execute(input, context) {
      const args = requireObject(input);
      const path = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      await context.workspaceWriteAuthorize?.({
        toolName: "edit_file",
        path,
      });
      const oldText = requireString(args.oldText, "oldText");
      const current = await readFile(path, "utf8");
      if (!current.includes(oldText)) throw new Error("oldText not found");
      const next = current.replace(
        oldText,
        requireString(args.newText, "newText"),
      );
      await writeFile(path, next);
      return `edited ${relative(context.workspaceRoot, path)}`;
    },
  };
}

function applyPatchTool(): RuntimeTool {
  return {
    name: "apply_patch",
    description:
      "Apply a unified diff (the format `git diff` emits) to workspace files. " +
      "Use it to make several coordinated edits in one call instead of many separate " +
      "edit_file calls. Every hunk must match before anything is written, so a bad " +
      "patch changes nothing.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { patch: { type: "string" } },
      required: ["patch"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: { files: { type: "array" } },
        required: ["files"],
        additionalProperties: false,
      },
      presentCall() {
        return { kind: "diff", title: "workspace", summary: "apply patch" };
      },
      presentResult(_args, value) {
        return { kind: "diff", title: "workspace", summary: value };
      },
    },
    async execute(input, context) {
      const args = requireObject(input);
      const patch = requireString(args.patch, "patch");
      const files = parseUnifiedPatch(patch);
      if (!files.length) throw new Error("patch contains no file changes");

      // Phase 1: authorize every touched path and compute every new content in
      // memory. A mismatch anywhere aborts here, before any file is written.
      const prepared: Array<{
        path: string;
        abs: string;
        next: string;
        changed: boolean;
      }> = [];
      for (const file of files) {
        const abs = workspacePath(context.workspaceRoot, file.path);
        await context.workspaceWriteAuthorize?.({
          toolName: "apply_patch",
          path: abs,
        });
        let current = "";
        if (!file.newFile) {
          try {
            current = await readFile(abs, "utf8");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT")
              throw new Error(`apply_patch: file does not exist: ${file.path}`);
            throw error;
          }
        }
        const applied = applyUnifiedPatchToText(current, file);
        prepared.push({
          path: file.path,
          abs,
          next: applied.next,
          changed: applied.changed,
        });
      }

      // Phase 2: write the changed files. On a mid-write failure, restore the
      // files already written so a patch is all-or-nothing on disk too.
      const written: string[] = [];
      const originals = new Map<string, string | undefined>();
      try {
        for (const entry of prepared) {
          if (!entry.changed) continue;
          let original: string | undefined;
          try {
            original = await readFile(entry.abs, "utf8");
          } catch {
            original = undefined;
          }
          originals.set(entry.abs, original);
          await mkdir(dirname(entry.abs), { recursive: true });
          await writeFile(entry.abs, entry.next);
          written.push(entry.path);
        }
      } catch (error) {
        for (const [abs, original] of originals) {
          try {
            if (original === undefined) {
              await import("node:fs/promises").then(({ rm }) =>
                rm(abs, { force: true }),
              );
            } else {
              await writeFile(abs, original);
            }
          } catch {
            // Best-effort rollback; report the original failure below.
          }
        }
        throw error;
      }

      if (!written.length) return "patch already applied (no changes)";
      return `applied patch to ${written.length} file${
        written.length === 1 ? "" : "s"
      }: ${written.join(", ")}`;
    },
  };
}

export const writeFileTools: RuntimeTool[] = [
  writeFileTool(),
  editFileTool(),
  applyPatchTool(),
];

/**
 * Workspace scope: these tools only mean something inside the workspace they are
 * pointed at, and the host's write lock serialises their writes per workspace.
 */
export function fsWriteToolFamily(): ToolFamily {
  return {
    id: "fs-write",
    name: "Filesystem Write Tools",
    version: "1.0.0",
    description: "Writing and editing workspace files.",
    scope: "workspace",
    tools: writeFileTools,
  };
}

export function createFsWritePlugin(): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: FS_WRITE_PLUGIN_ID,
      version: "1.0.0",
      name: "Filesystem Write Tools",
      description: "Writing and editing workspace files.",
      entry: "natalia:tool-fs-write",
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
      for (const tool of writeFileTools) api.tools.register(tool);
    },
  };
}
