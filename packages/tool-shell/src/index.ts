/**
 * The shell tool family, as a separately packaged family.
 *
 * Depends on the framework for the tool-authoring surface and process helpers.
 * The `runShell` execution primitive it wraps lives in `@natalia/tools` so other
 * tool plugins (notably `@natalia/tool-web`) can run commands without depending
 * on this package. It knows nothing about the runtime or the capability kernel.
 */
import type { Plugin } from "@natalia/plugin";
import {
  numberOr,
  requireObject,
  requireString,
  runShell,
} from "@natalia/tools";
import type { RuntimeTool, ToolFamily } from "@natalia/tools";

export { runShell };

export const SHELL_PLUGIN_ID = "natalia-tool-shell";

function runShellTool(): RuntimeTool {
  return {
    name: "run_shell",
    description:
      "Run a shell command inside the workspace with output capture. The shell is always bash-compatible (Git Bash on Windows, native bash on Linux/Mac) — use POSIX syntax, not cmd.exe.",
    requiresApproval: true,
    timeoutSec: 120,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        timeoutSec: { type: "number" },
      },
      required: ["command"],
      additionalProperties: false,
    },
    // The pilot output definition: the result is a terminal session card, so a
    // client draws the command with its exit status instead of a raw blob.
    output: {
      schema: {
        type: "object",
        properties: {
          stdout: { type: "string" },
          stderr: { type: "string" },
          exitCode: { type: "number" },
        },
        required: ["stdout", "stderr", "exitCode"],
        additionalProperties: false,
      },
      presentCall(args) {
        const command = requireObject(args).command as string | undefined;
        return {
          kind: "terminal",
          title: typeof command === "string" ? command : "command",
          summary: "run",
        };
      },
      presentResult(args, value) {
        const command = requireObject(args).command as string | undefined;
        const stdout =
          value.match(/stdout:\n([\s\S]*?)(?:\nstderr:|\n?$)/u)?.[1] ?? "";
        const stderr = value.match(/stderr:\n([\s\S]*?)$/u)?.[1] ?? "";
        const exitCode = Number(/exit=(-?\d+)/u.exec(value)?.[1] ?? "0");
        return {
          kind: "terminal",
          title: typeof command === "string" ? command : "command",
          summary: `exit ${exitCode}`,
          body: [stdout, stderr && `stderr:\n${stderr}`]
            .filter(Boolean)
            .join("\n"),
          meta: [["exit", String(exitCode)]],
        };
      },
    },
    async execute(input, context) {
      const args = requireObject(input);
      return await runShell(
        requireString(args.command, "command"),
        context,
        numberOr(args.timeoutSec, 120),
      );
    },
  };
}

export const shellTools: RuntimeTool[] = [runShellTool()];

/**
 * Session scope: a shell command only runs while the session that submitted it
 * is alive.
 */
export function shellToolFamily(): ToolFamily {
  return {
    id: "shell",
    name: "Shell Tools",
    version: "1.0.0",
    description: "One-shot command execution.",
    scope: "session",
    tools: shellTools,
  };
}

export function createShellPlugin(): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: SHELL_PLUGIN_ID,
      version: "1.0.0",
      name: "Shell Tools",
      description: "One-shot command execution.",
      entry: "natalia:tool-shell",
      scope: "session",
      provides: [],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["tools"],
    },
    setup(api) {
      for (const tool of shellTools) api.tools.register(tool);
    },
  };
}
