import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import {
  authorizeSkillTool,
  createSkillLoadTool,
  discoverSkills,
  formatSkillForModel,
  readSkillResource,
  resolveSkillResource,
  runSkillScript,
  pullRemoteSkills,
} from "../src/skills";

test("discovers native project skills and enforces policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-skills-"));
  const skillRoot = join(root, ".natalia", "skills", "review");
  await mkdir(skillRoot, { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: review\ndescription: Review code\nallowed-tools: [read_file, grep]\nsandbox-required: true\nresources: [notes.txt]\nscripts: {smoke: printf skill-ok}\n---\nUse careful review.",
  );
  await writeFile(join(skillRoot, "notes.txt"), "resource-ok");
  const registry = await discoverSkills({ workspaceRoot: root });
  const skill = registry.resolve("review");
  expect(skill.body).toBe("Use careful review.");
  expect(skill.resources).toEqual(["notes.txt"]);
  expect(await readSkillResource(skill, "notes.txt")).toBe("resource-ok");
  expect((await runSkillScript(skill, "smoke")).stdout).toBe("skill-ok");
  expect(authorizeSkillTool(skill, "read_file", { mode: "sandbox" })).toBe(
    true,
  );
  expect(authorizeSkillTool(skill, "write_file", { mode: "sandbox" })).toBe(
    false,
  );
  expect(() => resolveSkillResource(skill, "../escape")).toThrow("escapes");
});

test("remote skill cache reuses a version and atomically refreshes it", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-remote-skill-"));
  let version = "1";
  let body = "First";
  let downloads = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/skills/index.json")
        return Response.json({
          skills: [
            { name: "remote", version, files: ["SKILL.md", "refs/guide.md"] },
          ],
        });
      downloads++;
      if (url.pathname === "/skills/remote/SKILL.md")
        return new Response(
          `---\nname: remote\ndescription: Remote\n---\n${body}`,
        );
      if (url.pathname === "/skills/remote/refs/guide.md")
        return new Response("guide");
      return new Response("missing", { status: 404 });
    },
  });
  try {
    const input = {
      url: `${server.url}skills/`,
      cacheRoot: join(root, "cache"),
    };
    const first = await pullRemoteSkills(input);
    expect(await readFile(join(first[0]!, "SKILL.md"), "utf8")).toContain(
      "First",
    );
    const cachedDownloads = downloads;
    await pullRemoteSkills(input);
    expect(downloads).toBe(cachedDownloads);
    version = "2";
    body = "Second";
    const refreshed = await pullRemoteSkills(input);
    expect(await readFile(join(refreshed[0]!, "SKILL.md"), "utf8")).toContain(
      "Second",
    );
  } finally {
    server.stop(true);
  }
});

test("skill load tool injects bounded model content for a discovered skill", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-skill-tool-"));
  const skillRoot = join(root, ".natalia", "skills", "review");
  await mkdir(skillRoot, { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: review\ndescription: Review\n---\nReview guidance",
  );
  const registry = await discoverSkills({ workspaceRoot: root });
  let loaded = "";
  const tool = createSkillLoadTool({
    registry: () => registry,
    onLoad: (_skill, output) => (loaded = output),
  });
  const output = await tool.execute(
    { name: "review" },
    { workspaceRoot: root },
  );
  expect(output).toContain('<skill_content name="review">');
  expect(loaded).toBe(output);
});

test("formats selected skill content with a bounded local file sample", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-skill-format-"));
  const skillRoot = join(root, ".natalia", "skills", "review");
  await mkdir(join(skillRoot, "references"), { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: review\ndescription: Review\n---\nReview guidance",
  );
  await writeFile(join(skillRoot, "references", "guide.md"), "guide");
  const skill = (await discoverSkills({ workspaceRoot: root })).resolve(
    "review",
  );
  const output = await formatSkillForModel(skill);
  expect(output).toContain('<skill_content name="review">');
  expect(output).toContain(`Base directory for this skill: ${skillRoot}`);
  expect(output).toContain("<file>references/guide.md</file>");
});

test("formats a removed skill without failing the active tool invocation", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-skill-removed-"));
  const skillRoot = join(root, ".natalia", "skills", "review");
  await mkdir(skillRoot, { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: review\ndescription: Review\n---\nReview guidance",
  );
  const skill = (await discoverSkills({ workspaceRoot: root })).resolve(
    "review",
  );
  await rm(skillRoot, { recursive: true });
  await expect(formatSkillForModel(skill)).resolves.toContain(
    "<skill_files>\n</skill_files>",
  );
});

test("project skill source overrides a user skill with the same name", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-skill-precedence-"));
  const project = join(root, ".natalia", "skills", "review");
  const user = join(root, "user", "review");
  await mkdir(project, { recursive: true });
  await mkdir(user, { recursive: true });
  await writeFile(
    join(project, "SKILL.md"),
    "---\nname: review\ndescription: Project\n---\nProject guidance",
  );
  await writeFile(
    join(user, "SKILL.md"),
    "---\nname: review\ndescription: User\n---\nUser guidance",
  );
  const registry = await discoverSkills({
    workspaceRoot: root,
    userRoot: join(root, "user"),
  });
  expect(registry.resolve("review").body).toBe("Project guidance");
  expect(registry.list().map((skill) => skill.qualifiedName)).toEqual([
    "project:review",
    "user:review",
  ]);
});

// --- Discovery D4: the validated skill write (the review's only door) ---

import { mkdtempSync, readFileSync } from "node:fs";
import { parseSkill } from "../src/skills";
import { validateSkillProposal } from "../src/skill-write";

test("the proposal whitelist accepts create/update and rejects everything else by kind", () => {
  const good = validateSkillProposal({
    kind: "create",
    name: "release-notes",
    description: "Draft release notes",
    content: "# Release notes\nBody.",
  });
  expect(good.ok).toBe(true);
  // The action whitelist bites: only these two words can even be parsed.
  for (const kind of ["delete", "execute", "write_file", "patch", 7, null]) {
    const rejected = validateSkillProposal({
      kind,
      name: "x",
      description: "d",
      content: "c",
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.reason).toContain("whitelisted");
  }
});

test("name, description, content and size rules bite; frontmatter is rebuilt", () => {
  const base = {
    kind: "create",
    name: "ok-name",
    description: "d",
    content: "body",
  };
  expect(validateSkillProposal({ ...base, name: "../escape" }).ok).toBe(false);
  expect(validateSkillProposal({ ...base, name: "UPPER" }).ok).toBe(false);
  expect(validateSkillProposal({ ...base, description: "   " }).ok).toBe(false);
  expect(validateSkillProposal({ ...base, content: "" }).ok).toBe(false);
  const oversized = validateSkillProposal({
    ...base,
    content: "x".repeat(64_001),
  });
  expect(oversized.ok).toBe(false);
  // Rebuilt (never pasted): a name smuggled inside the body's frontmatter
  // cannot override the validated name.
  const tricky = validateSkillProposal({
    ...base,
    description: 'a: "quoted: value"\nname: smuggled',
    content: "---\nname: smuggled\n---\ninjected",
  });
  expect(tricky.ok).toBe(true);
  if (tricky.ok) {
    expect(tricky.skillmd).toContain("name: ok-name");
    expect(tricky.skillmd.indexOf("name: smuggled")).toBeGreaterThan(
      tricky.skillmd.indexOf("---"),
    );
    // The validated description sits on ONE quoted line — it cannot open a
    // second frontmatter block that the loader would read as fields.
    expect(tricky.skillmd.split("\n")[2]).toContain("description:");
    expect(tricky.skillmd.split("\n").length).toBeGreaterThan(4);
    const parsed = parseSkill(tricky.skillmd, {
      root: "/tmp/x",
      source: "project",
    });
    expect(parsed.name).toBe("ok-name");
    expect(parsed.body).toContain("injected");
  }
});

test("upsertSkill writes under the project root, reloads, and reports created vs update", async () => {
  const ws = mkdtempSync(join(tmpdir(), "skill-upsert-"));
  const registry = await discoverSkills({ workspaceRoot: ws });
  // No origin stamped scenario is covered by discoverSkills always stamping.
  const created = await registry.upsertSkill({
    kind: "create",
    name: "d4-review-skill",
    description: "Sedimented by the review loop",
    content: "# When to use\nAlways.",
  });
  expect(created).toEqual({ created: true, name: "d4-review-skill" });
  const file = join(ws, ".natalia", "skills", "d4-review-skill", "SKILL.md");
  expect(readFileSync(file, "utf8")).toContain("Sedimented by the review loop");
  // Immediately visible through the same service surface the model uses.
  expect(registry.resolve("d4-review-skill").name).toBe("d4-review-skill");
  const updated = await registry.upsertSkill({
    kind: "update",
    name: "d4-review-skill",
    description: "Updated description",
    content: "# Updated body",
  });
  expect(updated.created).toBe(false);
  expect(readFileSync(file, "utf8")).toContain("Updated body");
  // A rejected proposal never touches disk and throws with its reason.
  await expect(
    registry.upsertSkill({ kind: "rm", name: "d4-review-skill" }),
  ).rejects.toThrow(/whitelisted/u);
  expect(readFileSync(file, "utf8")).toContain("Updated body");
});
