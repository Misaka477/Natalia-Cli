import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { updateConfig } from "@natalia/config";
import { createConfigReload } from "../src/runtime/config-reload";
import { createToolPublish } from "../src/runtime/tool-publish";
import type { RuntimeContext } from "../src/runtime/context";

// A config reload mutates live runtime state in place; if a later step throws,
// rollbackReload puts the previous state back. This exercises that path — which
// otherwise has no direct test — and pins one piece of it: the agent_spawn tool
// description is re-derived from the agent registry during a reload, so the
// rollback must re-derive it from the registry it restores, not leave the failed
// config's subagent types advertised.

async function harness() {
  const root = await mkdtemp(join(tmpdir(), "natalia-reload-rollback-"));
  const agentSpawn = { name: "agent_spawn", description: "seed" };
  const tools = new Map<
    string,
    { name: string; description: string; requiresApproval?: boolean }
  >([["agent_spawn", agentSpawn]]);
  let config: unknown;
  let registry: unknown;
  let failPermissionSettings = false;
  let failContextConfig = false;
  const published: Array<{ type: string; name: string }> = [];

  const ctx = {
    state: { tools, frameworkServices: undefined, pluginStoreRoot: undefined },
    ports: {
      getWorkspaceRoot: () => root,
      getTsRuntimeConfig: () => config,
      setTsRuntimeConfig: (next: unknown) => {
        config = next;
      },
      getMaxSteps: () => 0,
      setMaxSteps: () => {},
      getRetryPolicy: () => ({}),
      setRetryPolicy: () => {},
      getProviderConcurrencyLimiter: () => ({}),
      setProviderConcurrencyLimiter: () => {},
      getSelectedAgent: () => undefined,
      setSelectedAgent: () => {},
      getAgentRegistry: () => registry,
      setAgentRegistry: (next: unknown) => {
        registry = next;
      },
      getExecutionBySession: () => new Map(),
      getInteractive: () => undefined,
      // The reload re-derives the spawn description before this runs, so making
      // it throw on the second call fails the reload right after that mutation.
      reloadPermissionSettings: () => {
        if (failPermissionSettings)
          throw new Error("injected permission-settings failure");
      },
      getPermissionMode: () => "default",
      setPermissionMode: () => {},
      getSelectedPermissionProfile: () => undefined,
      setSelectedPermissionProfile: () => {},
      getDefaultPermissionMode: () => "default",
      getDefaultPermissionProfile: () => undefined,
      setDefaultPermissionMode: () => {},
      setDefaultPermissionProfile: () => {},
      getProvider: () => ({}),
      setProvider: () => {},
      getProviderSource: () => "ts_config",
      setProviderSource: () => {},
      getRuntimeContextConfig: () => ({}),
      setRuntimeContextConfig: () => {},
      applyAgentPolicy: () => {},
      getPluginsController: () => ({
        reconcileDesired: async (
          _entries: unknown,
          plugins: { enabled?: Record<string, boolean> } | undefined,
        ) => {
          tools.clear();
          tools.set("agent_spawn", agentSpawn);
          if (plugins?.enabled?.beta)
            tools.set("beta_tool", { name: "beta_tool", description: "" });
        },
      }),
      runPluginLifecyclePostReconcile: async () => {},
      publish: (event: { type: string; name?: string }) => {
        if (
          event.type === "tool.registered" ||
          event.type === "tool.unregistered"
        )
          published.push({ type: event.type, name: event.name ?? "" });
      },
      publishForSession: () => {},
      scheduleRuntimeStatusSnapshot: () => {},
      resolveService: () => undefined,
      getTools: () => tools,
      getCapabilityRegistry: () => ({
        ownerOf: () => undefined,
        scopeOf: () => undefined,
      }),
      getContextWindowResolver: () => ({}),
      refreshExecutionContextConfig: async () => {},
      modelRefKeyForSelection: () => "key",
      resolveContextStatusConfig: async () => {
        if (failContextConfig)
          throw new Error("injected context-config failure");
        return {};
      },
      applyAgentProvider: () => {},
      publishToolCatalogChanges: () => {},
    },
  } as unknown as RuntimeContext;
  const options = { globalConfigPath: join(root, "absent-global.json") };
  // Use the real tool-catalog publisher so the diff is actually emitted.
  ctx.ports.publishToolCatalogChanges = createToolPublish(
    ctx,
    options,
  ).publishToolCatalogChanges;
  const reload = createConfigReload(ctx, options);
  return {
    root,
    agentSpawn,
    published,
    setFailPermissionSettings: (value: boolean) => {
      failPermissionSettings = value;
    },
    setFailContextConfig: (value: boolean) => {
      failContextConfig = value;
    },
    reload,
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}

const alpha = { mode: "subagent", description: "Alpha explorer" } as const;
const beta = { mode: "subagent", description: "Beta reviewer" } as const;

test("a failed config reload restores the agent_spawn description to the prior config", async () => {
  const h = await harness();
  try {
    await updateConfig(h.root, { version: 3, agents: { alpha } });
    const first = await h.reload.applyConfigFromDisk();
    expect(first.applied).toBe(true);
    expect(h.agentSpawn.description).toContain("alpha");
    expect(h.agentSpawn.description).not.toContain("beta");

    // Add a second subagent type, then make the reload fail after the spawn
    // description has already been re-derived from the new registry.
    await updateConfig(h.root, { agents: { alpha, beta } });
    h.setFailPermissionSettings(true);
    const second = await h.reload.applyConfigFromDisk();
    expect(second.applied).toBe(false);

    // Rolled back to the first config: beta must no longer be advertised.
    expect(h.agentSpawn.description).not.toContain("beta");
    expect(h.agentSpawn.description).toContain("alpha");
  } finally {
    await h.dispose();
  }
});

test("a failed reload re-publishes the tool catalog so the projection matches the rollback", async () => {
  const h = await harness();
  try {
    await updateConfig(h.root, { version: 3, agents: { alpha } });
    expect((await h.reload.applyConfigFromDisk()).applied).toBe(true);

    // Config B enables an extra plugin tool; fail the reload only after the new
    // tool catalog has been published (at context-config resolution).
    await updateConfig(h.root, {
      agents: { alpha },
      plugins: { enabled: { beta: true } },
    });
    h.setFailContextConfig(true);
    expect((await h.reload.applyConfigFromDisk()).applied).toBe(false);

    // The failed reload advertised beta_tool; the rollback must retract it so
    // the UI stops projecting a tool the restored registry no longer has.
    expect(h.published).toContainEqual({
      type: "tool.unregistered",
      name: "beta_tool",
    });
  } finally {
    await h.dispose();
  }
});
