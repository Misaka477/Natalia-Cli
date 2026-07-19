import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

export type SkillMetadata = {
  name: string;
  description: string;
  allowedTools: string[];
  requireApproval: boolean;
  sandboxRequired: boolean;
  scripts: Record<string, string>;
  resources: string[];
};

export type Skill = SkillMetadata & {
  qualifiedName: string;
  root: string;
  body: string;
  source: "project" | "user";
};

export type SkillPolicy = {
  mode: "default" | "restricted" | "sandbox" | "full";
  allowedTools?: string[];
};

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  register(skill: Skill) {
    if (this.skills.has(skill.qualifiedName))
      throw new Error(`duplicate skill: ${skill.qualifiedName}`);
    this.skills.set(skill.qualifiedName, skill);
  }

  resolve(name: string) {
    const direct = this.skills.get(name);
    if (direct) return direct;
    const matches = [...this.skills.values()].filter(
      (skill) => skill.name === name,
    );
    if (matches.length !== 1)
      throw new Error(`skill not found or ambiguous: ${name}`);
    return matches[0]!;
  }

  list() {
    return [...this.skills.values()].sort((a, b) =>
      a.qualifiedName.localeCompare(b.qualifiedName),
    );
  }
}

export async function discoverSkills(input: {
  workspaceRoot: string;
  userRoot?: string;
}) {
  const registry = new SkillRegistry();
  await discoverRoot(
    registry,
    join(resolve(input.workspaceRoot), ".natalia", "skills"),
    "project",
  );
  if (input.userRoot)
    await discoverRoot(registry, resolve(input.userRoot), "user");
  return registry;
}

export function parseSkill(
  content: string,
  input: { root: string; source: "project" | "user" },
) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u);
  if (!match) throw new Error("SKILL.md requires YAML frontmatter delimiters");
  const frontmatter = parseFrontmatter(match[1]!);
  const name = required(frontmatter.name, "name");
  const description = required(frontmatter.description, "description");
  validateName(name);
  return {
    qualifiedName: `${input.source}:${name}`,
    name,
    description,
    allowedTools: listValue(frontmatter["allowed-tools"]),
    requireApproval: boolValue(frontmatter["require-approval"]),
    sandboxRequired: boolValue(frontmatter["sandbox-required"]),
    scripts: recordValue(frontmatter.scripts),
    resources: listValue(frontmatter.resources),
    root: resolve(input.root),
    body: match[2]!.trim(),
    source: input.source,
  } satisfies Skill;
}

export function authorizeSkillTool(
  skill: Skill,
  tool: string,
  policy: SkillPolicy,
) {
  if (policy.mode === "restricted") return false;
  if (policy.allowedTools && !policy.allowedTools.includes(tool)) return false;
  if (skill.allowedTools.length && !skill.allowedTools.includes(tool))
    return false;
  if (policy.mode === "sandbox" && !skill.sandboxRequired) return false;
  return true;
}

export function resolveSkillResource(skill: Skill, path: string) {
  if (isAbsolute(path)) throw new Error("skill resource must be relative");
  const target = resolve(skill.root, path);
  const rel = relative(skill.root, target);
  if (rel.startsWith("..") || isAbsolute(rel))
    throw new Error("skill resource escapes root");
  return target;
}

export async function readSkillResource(skill: Skill, path: string) {
  return await readFile(resolveSkillResource(skill, path), "utf8");
}

export async function runSkillScript(
  skill: Skill,
  name: string,
  input: { signal?: AbortSignal } = {},
) {
  const command = skill.scripts[name];
  if (!command) throw new Error(`skill script not found: ${name}`);
  const child = Bun.spawn(
    [process.env.SHELL ?? "/usr/bin/bash", "-lc", command],
    {
      cwd: skill.root,
      stdout: "pipe",
      stderr: "pipe",
      env: safeSkillEnv(globalThis.process.env),
      signal: input.signal,
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return {
    exitCode,
    stdout: stdout.slice(0, 12000),
    stderr: stderr.slice(0, 12000),
  };
}

async function discoverRoot(
  registry: SkillRegistry,
  root: string,
  source: "project" | "user",
) {
  const entries = await readSkillDirectories(root);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillRoot = join(root, entry.name);
    try {
      registry.register(
        parseSkill(await readFile(join(skillRoot, "SKILL.md"), "utf8"), {
          root: skillRoot,
          source,
        }),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
  }
}

async function readSkillDirectories(root: string) {
  try {
    return await readdir(root, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function parseFrontmatter(input: string) {
  const result: Record<string, string> = {};
  for (const line of input.split(/\r?\n/u)) {
    const match = line.match(/^([\w-]+):\s*(.*)$/u);
    if (match)
      result[match[1]!] = match[2]!.trim().replace(/^['"]|['"]$/gu, "");
  }
  return result;
}

function recordValue(value: string | undefined) {
  const result: Record<string, string> = {};
  if (!value) return result;
  for (const item of value.replace(/^\{|\}$/gu, "").split(",")) {
    const separator = item.indexOf(":");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    const command = item.slice(separator + 1).trim();
    if (key && command) result[key] = command;
  }
  return result;
}

function safeSkillEnv(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TERM"]
      .map((key) => [key, env[key]] as const)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
  );
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`SKILL.md ${name} is required`);
  return value;
}

function listValue(value: string | undefined) {
  return value
    ? value
        .replace(/^\[|\]$/gu, "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function boolValue(value: string | undefined) {
  return value === "true";
}

function validateName(value: string) {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(value))
    throw new Error("invalid skill name");
}
