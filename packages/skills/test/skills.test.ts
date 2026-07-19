import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import {
  authorizeSkillTool,
  discoverSkills,
  readSkillResource,
  resolveSkillResource,
  runSkillScript,
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
