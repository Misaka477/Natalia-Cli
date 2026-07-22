import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import type { MCPResourceCatalog } from "@natalia/contracts";

export function retainEditorMentions(input: {
  text: string;
  attachments: string[];
  agents: string[];
  resources: MCPResourceCatalog[];
}) {
  return {
    attachments: input.attachments.filter((path) =>
      hasMention(input.text, path),
    ),
    agents: input.agents.filter((name) => hasMention(input.text, name)),
    resources: input.resources.filter((resource) =>
      hasMention(input.text, resource.name),
    ),
  };
}

export async function editPromptExternally(input: {
  text: string;
  editor?: string;
  env?: NodeJS.ProcessEnv;
  tempRoot?: string;
}) {
  const command = input.editor ?? input.env?.VISUAL ?? input.env?.EDITOR;
  if (!command?.trim())
    throw new Error("external editor is not configured; set VISUAL or EDITOR");
  const directory = await mkdtemp(
    join(input.tempRoot ?? tmpdir(), "natalia-edit-"),
  );
  const path = join(directory, "prompt.md");
  try {
    await writeFile(path, input.text, { mode: 0o600 });
    const [program, ...args] = splitCommand(command);
    if (!program) throw new Error("external editor command is empty");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(program, [...args, path], {
        stdio: "inherit",
        env: input.env,
      });
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0) return resolve();
        reject(
          new Error(
            `external editor ${basename(program)} failed${signal ? ` with ${signal}` : ` with exit code ${code ?? "unknown"}`}`,
          ),
        );
      });
    });
    return await readFile(path, "utf8");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function splitCommand(command: string) {
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/gu) ?? [];
  return parts.map((part) => part.replace(/^("|')|("|')$/gu, ""));
}

function hasMention(text: string, value: string) {
  return new RegExp(`(?:^|\\s)@${escapeRegex(value)}(?=\\s|$)`, "u").test(text);
}

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+*?.]/gu, "\\$&");
}
