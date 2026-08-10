import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSkillsController } from "../src/skills-controller";

test("skills controller reports disabled before init", () => {
  const controller = createSkillsController({
    workspaceRoot: "/tmp/ws",
    userRoot: () => undefined,
    remoteURLs: () => undefined,
  });
  expect(controller.enabled()).toBe(false);
  expect(controller.list()).toEqual([]);
  expect(() => controller.resolve("anything")).toThrow(
    "skill registry is not initialized",
  );
});

test("skills controller discovers and lists skills", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-skills-controller-"));
  await mkdir(join(root, ".natalia", "skills", "review"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "skills", "review", "SKILL.md"),
    "---\nname: review\ndescription: Review guidance\n---\nBody",
  );
  const controller = createSkillsController({
    workspaceRoot: root,
    userRoot: () => undefined,
    remoteURLs: () => undefined,
  });
  await controller.init();
  expect(controller.enabled()).toBe(true);
  const skills = controller.list();
  expect(skills.some((skill) => skill.name === "review")).toBe(true);
  const resolved = controller.resolve("project:review");
  expect(resolved.description).toContain("Review");
});
