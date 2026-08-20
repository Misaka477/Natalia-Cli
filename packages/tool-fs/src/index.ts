/**
 * The filesystem tool family, as a separately packaged family.
 *
 * Depends on the framework only for the tool-authoring surface (`RuntimeTool`,
 * `ToolFamily`, the argument helpers) and knows nothing about the runtime, the
 * capability kernel or the host that loads it.
 */
import {
  applyUnifiedPatchToText,
  optionalInteger,
  parseUnifiedPatch,
  requireObject,
  requireString,
  workspacePath,
  type RuntimeTool,
  type ToolFamily,
} from "@natalia/tools";
import type { Plugin } from "@natalia/plugin";
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

export const FS_PLUGIN_ID = "natalia-tool-fs";

function readFileTool(): RuntimeTool {
  return {
    name: "read_file",
    description:
      "Read a UTF-8 text file inside the workspace. Use offset (one-based line number) and length (line count) to read part of a file.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        offset: { type: "integer", minimum: 1 },
        length: { type: "integer", minimum: 1 },
      },
      required: ["path"],
      additionalProperties: false,
    },
    // The output definition: the tool declares what its call and result mean so
    // a client can draw a file card instead of guessing from the string.
    output: {
      schema: {
        type: "object",
        properties: { content: { type: "string" } },
        required: ["content"],
        additionalProperties: false,
      },
      presentCall(args) {
        const path = requireObject(args).path as string | undefined;
        return {
          kind: "read",
          title: typeof path === "string" ? path : "file",
          summary: "read",
        };
      },
      presentResult(args, value) {
        const path = requireObject(args).path as string | undefined;
        return {
          kind: "read",
          title: typeof path === "string" ? path : "file",
          summary: `${value.length.toLocaleString()} chars`,
          body: value,
        };
      },
    },
    async execute(input, context) {
      const args = requireObject(input);
      const path = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      const content = await readFile(path, "utf8");
      if (args.offset === undefined && args.length === undefined)
        return content;

      const offset = optionalInteger(args.offset, "offset") ?? 1;
      const length = optionalInteger(args.length, "length");
      if (offset < 1) throw new Error("offset must be a positive integer");
      if (length !== undefined && length < 1)
        throw new Error("length must be a positive integer");

      const lines = content.endsWith("\n")
        ? content.slice(0, -1).replace(/\r$/u, "").split(/\r?\n/u)
        : content.split(/\r?\n/u);
      if (offset > lines.length)
        throw new Error(`read_file offset is out of range: ${offset}`);
      const end = Math.min(lines.length, offset - 1 + (length ?? lines.length));
      const page = lines.slice(offset - 1, end).join("\n");
      if (end === lines.length) return page;

      const remaining = lines.length - end;
      const next = end + 1;
      return `${page}\n\n... ${remaining} more line${remaining === 1 ? "" : "s"}; use offset=${next}${length === undefined ? "" : ` length=${length}`} ...`;
    },
  };
}

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

function readMediaFileTool(): RuntimeTool {
  return {
    name: "read_media_file",
    description:
      "Read binary/media file metadata inside the workspace without injecting raw bytes into context.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const path = workspacePath(
        context.workspaceRoot,
        requireString(requireObject(input).path, "path"),
      );
      const info = await stat(path);
      const data = await readFile(path);
      return JSON.stringify(
        {
          path: relative(context.workspaceRoot, path),
          size: info.size,
          mode: info.mode.toString(8),
          sha256: createHash("sha256").update(data).digest("hex"),
          kind: mediaKind(data),
        },
        null,
        2,
      );
    },
  };
}

function mediaKind(data: Uint8Array) {
  const hex = [...data.slice(0, 12)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (hex.startsWith("89504e47")) return "png";
  if (hex.startsWith("ffd8ff")) return "jpeg";
  if (hex.startsWith("25504446")) return "pdf";
  if (hex.startsWith("47494638")) return "gif";
  return "binary";
}

export const fileTools: RuntimeTool[] = [
  readFileTool(),
  writeFileTool(),
  editFileTool(),
  readMediaFileTool(),
  imageReadTool(),
  applyPatchTool(),
];

/**
 * Workspace scope: these tools only mean something inside the workspace they are
 * pointed at, and the host's write lock serialises their writes per workspace.
 */
export function fsToolFamily(): ToolFamily {
  return {
    id: "fs",
    name: "Filesystem Tools",
    version: "1.0.0",
    description: "Reading, writing and editing workspace files.",
    scope: "workspace",
    tools: fileTools,
  };
}

export function createFsPlugin(): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: FS_PLUGIN_ID,
      version: "1.0.0",
      name: "Filesystem Tools",
      description: "Reading, writing and editing workspace files.",
      entry: "natalia:tool-fs",
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
      for (const tool of fileTools) api.tools.register(tool);
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

export function imageReadTool(): RuntimeTool {
  return {
    name: "image_read",
    description:
      "Attach an image file inside the workspace to the conversation so the model can see it — e.g. a screenshot of a rendered page. The selected model must support image input.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    async execute(input, context) {
      if (!context.attachImage)
        throw new Error("image attachment is unavailable in this context");
      const args = requireObject(input);
      const path = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      await context.attachImage(path);
      return `image attached: ${path}`;
    },
  };
}
