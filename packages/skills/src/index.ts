import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { RuntimeTool } from "@natalia/tools";

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
  source: "project" | "user" | "remote";
};

export type SkillPolicy = {
  mode: "default" | "restricted" | "sandbox" | "full";
  allowedTools?: string[];
};

export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private selected = new Map<string, Skill>();

  register(skill: Skill) {
    if (this.skills.has(skill.qualifiedName))
      throw new Error(`duplicate skill: ${skill.qualifiedName}`);
    this.skills.set(skill.qualifiedName, skill);
    // Sources are applied in order; later user/project sources override names.
    this.selected.set(skill.name, skill);
  }

  resolve(name: string) {
    const direct = this.skills.get(name);
    if (direct) return direct;
    const selected = this.selected.get(name);
    if (!selected) throw new Error(`skill not found: ${name}`);
    return selected;
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
  remoteURLs?: string[];
  cacheRoot?: string;
  fetch?: typeof fetch;
}) {
  const registry = new SkillRegistry();
  for (const url of input.remoteURLs ?? []) {
    const roots = await pullRemoteSkills({
      url,
      cacheRoot:
        input.cacheRoot ??
        join(resolve(input.workspaceRoot), ".natalia", "cache", "skills"),
      fetch: input.fetch,
    });
    for (const root of roots) await discoverSkillRoot(registry, root, "remote");
  }
  if (input.userRoot)
    await discoverRoot(registry, resolve(input.userRoot), "user");
  await discoverRoot(
    registry,
    join(resolve(input.workspaceRoot), ".natalia", "skills"),
    "project",
  );
  return registry;
}

export function parseSkill(
  content: string,
  input: { root: string; source: "project" | "user" | "remote" },
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

export async function formatSkillForModel(skill: Skill) {
  const files = (
    await readdir(skill.root, { recursive: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    })
  )
    .filter((path) => path !== "SKILL.md")
    .sort()
    .slice(0, 10);
  return [
    `<skill_content name="${skill.name}">`,
    `# Skill: ${skill.name}`,
    "",
    skill.body,
    "",
    `Base directory for this skill: ${skill.root}`,
    "Relative paths in this skill are relative to this base directory.",
    "Note: file list is sampled.",
    "",
    "<skill_files>",
    ...files.map((file) => `<file>${file}</file>`),
    "</skill_files>",
    "</skill_content>",
  ].join("\n");
}

export function createSkillLoadTool(options: {
  registry: () => SkillRegistry | undefined;
  onLoad?: (skill: Skill, output: string) => void;
}): RuntimeTool {
  return {
    name: "skill_load",
    description: "Load a discovered local skill into the current conversation.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
    async execute(input) {
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new Error("skill_load arguments must be an object");
      const name = (input as Record<string, unknown>).name;
      if (typeof name !== "string")
        throw new Error("skill_load.name must be a string");
      const registry = options.registry();
      if (!registry) throw new Error("skill registry is not initialized");
      const skill = registry.resolve(name);
      const output = await formatSkillForModel(skill);
      options.onLoad?.(skill, output);
      return output;
    },
  };
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
  source: "project" | "user" | "remote",
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

async function discoverSkillRoot(
  registry: SkillRegistry,
  root: string,
  source: "project" | "user" | "remote",
) {
  registry.register(
    parseSkill(await readFile(join(root, "SKILL.md"), "utf8"), {
      root,
      source,
    }),
  );
}

export async function pullRemoteSkills(input: {
  url: string;
  cacheRoot: string;
  fetch?: typeof fetch;
}) {
  const base = new URL(input.url.endsWith("/") ? input.url : `${input.url}/`);
  if (!/^https?:$/u.test(base.protocol))
    throw new Error("remote skill URL must use HTTP or HTTPS");
  const fetchImpl = input.fetch ?? fetch;
  const response = await fetchImpl(new URL("index.json", base));
  if (!response.ok)
    throw new Error(`remote skill index failed: ${response.status}`);
  const index = await response.json();
  if (
    !index ||
    typeof index !== "object" ||
    !Array.isArray((index as { skills?: unknown }).skills)
  )
    throw new Error("remote skill index must contain a skills array");
  const sourceRoot = join(resolve(input.cacheRoot), cacheKey(base.href));
  const roots: string[] = [];
  for (const entry of (index as { skills: unknown[] }).skills) {
    if (!entry || typeof entry !== "object") continue;
    const skill = entry as {
      name?: unknown;
      version?: unknown;
      files?: unknown;
    };
    if (
      typeof skill.name !== "string" ||
      !safeSegment(skill.name) ||
      !Array.isArray(skill.files)
    )
      continue;
    const files = skill.files.filter(
      (file): file is string => typeof file === "string",
    );
    if (!files.includes("SKILL.md") || !files.every(safeRelativePath)) continue;
    const root = join(sourceRoot, skill.name);
    const versionPath = join(root, ".natalia-version");
    const version =
      typeof skill.version === "string" ? skill.version : undefined;
    const current = await readOptional(versionPath);
    if (
      (await Bun.file(join(root, "SKILL.md")).exists()) &&
      (!version || current === version)
    ) {
      roots.push(root);
      continue;
    }
    const staging = `${root}.tmp-${crypto.randomUUID()}`;
    try {
      for (const file of files) {
        const resource = new URL(
          file,
          new URL(`${encodeURIComponent(skill.name)}/`, base),
        );
        if (resource.origin !== base.origin)
          throw new Error("remote skill resource crosses origin");
        const downloaded = await fetchImpl(resource);
        if (!downloaded.ok)
          throw new Error(`remote skill file failed: ${downloaded.status}`);
        const destination = join(staging, file);
        await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
        await writeFile(
          destination,
          new Uint8Array(await downloaded.arrayBuffer()),
          { mode: 0o600 },
        );
      }
      if (version)
        await writeFile(join(staging, ".natalia-version"), version, {
          mode: 0o600,
        });
      const backup = `${root}.old-${crypto.randomUUID()}`;
      const exists = await Bun.file(join(root, "SKILL.md")).exists();
      if (exists) await rename(root, backup);
      await rename(staging, root);
      if (exists) await rm(backup, { recursive: true, force: true });
      roots.push(root);
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      if (await Bun.file(join(root, "SKILL.md")).exists()) roots.push(root);
      else throw error;
    }
  }
  return roots;
}

function cacheKey(url: string) {
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
}

function safeSegment(value: string) {
  return (
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !/[\\/\0]/u.test(value)
  );
}

function safeRelativePath(value: string) {
  if (
    !value ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.includes("?") ||
    value.includes("#") ||
    isAbsolute(value)
  )
    return false;
  return value.split("/").every((segment) => safeSegment(segment));
}

async function readOptional(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
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
