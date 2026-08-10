import { discoverSkills, SkillRegistry, type Skill } from "@natalia/skills";

/**
 * The skills resource controller — cut of the resource controllers split
 * (mainline plan §15). It owns the `SkillRegistry` and its lifecycle
 * (discovery at startup). The *active* skill is session state and stays in
 * the runtime closure — this module only owns the registry and its reads.
 * Multi-session shape (plan §41.9): `userRoot()` and `remoteURLs()` are
 * accessors; when sessions become per-session maps only their
 * implementations change.
 */
export function createSkillsController(input: {
  workspaceRoot: string;
  userRoot(): string | undefined;
  remoteURLs(): string[] | undefined;
}) {
  let registry: SkillRegistry | undefined;

  async function init() {
    registry = await discoverSkills({
      workspaceRoot: input.workspaceRoot,
      userRoot: input.userRoot(),
      remoteURLs: input.remoteURLs(),
    });
  }

  function enabled() {
    return registry !== undefined;
  }

  function get(): SkillRegistry {
    if (!registry) throw new Error("skill registry is not initialized");
    return registry;
  }

  /** The discovered skills, or an empty list before discovery. */
  function list(): Skill[] {
    return registry?.list() ?? [];
  }

  function resolve(name: string): Skill {
    return get().resolve(name);
  }

  return { init, enabled, get, list, resolve };
}
