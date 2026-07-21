import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
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
} from "../src";

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

test("later user skill source overrides a project skill with the same name", async () => {
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
  expect(registry.resolve("review").body).toBe("User guidance");
  expect(registry.list()).toHaveLength(1);
});
