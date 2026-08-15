/**
 * The shell tool family, as a separately packaged family.
 *
 * Depends on the framework for the tool-authoring surface and process helpers,
 * and on the platform package for shell resolution. It knows nothing about the
 * runtime or the capability kernel.
 */
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { profileShellCommand } from "@natalia/platform";
import { numberOr, requireObject, requireString } from "@natalia/tools";
import { safeToolEnv, terminateChildProcessTree } from "@natalia/tools";
import type {
  RuntimeTool,
  ToolExecutionContext,
  ToolFamily,
} from "@natalia/tools";

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

export async function runShell(
  command: string,
  context: ToolExecutionContext,
  timeoutSec: number,
) {
  await stat(context.workspaceRoot);
  const shell = profileShellCommand(command);
  return await new Promise<string>((resolvePromise, reject) => {
    const child = spawn(shell.executable, shell.args, {
      cwd: context.workspaceRoot,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: safeToolEnv(context.settings?.envAllowlist),
    });
    let settled = false;
    const finish = (result: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.signal?.removeEventListener("abort", abort);
      result();
    };
    const abort = () => {
      terminateChildProcessTree(child.pid);
      finish(() =>
        reject(context.signal?.reason ?? new Error("command cancelled")),
      );
    };
    const timer = setTimeout(() => {
      terminateChildProcessTree(child.pid);
      finish(() => reject(new Error(`command timed out after ${timeoutSec}s`)));
    }, timeoutSec * 1000);
    context.signal?.addEventListener("abort", abort, { once: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.on("error", (error) => {
      finish(() => reject(error));
    });
    child.on("close", (code) => {
      const output = [
        `exit=${code}`,
        stdout && `stdout:\n${stdout}`,
        stderr && `stderr:\n${stderr}`,
      ]
        .filter(Boolean)
        .join("\n");
      if (code === 0) finish(() => resolvePromise(output));
      else finish(() => reject(new Error(output)));
    });
  });
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
