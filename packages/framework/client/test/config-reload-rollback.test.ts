import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { updateConfig } from "@natalia/config";
import { createConfigReload } from "../src/runtime/config-reload";
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
  const tools = new Map<string, { description: string }>([
    ["agent_spawn", agentSpawn],
  ]);
  let config: unknown;
  let registry: unknown;
  let failPermissionSettings = false;

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
      getPluginsController: () => ({ reconcileDesired: async () => {} }),
      runPluginLifecyclePostReconcile: async () => {},
      publish: () => {},
      publishForSession: () => {},
      scheduleRuntimeStatusSnapshot: () => {},
      resolveService: () => undefined,
      getTools: () => tools,
      getContextWindowResolver: () => ({}),
      refreshExecutionContextConfig: async () => {},
      modelRefKeyForSelection: () => "key",
      resolveContextStatusConfig: async () => ({}),
      applyAgentProvider: () => {},
      publishToolCatalogChanges: () => {},
    },
  } as unknown as RuntimeContext;

  const reload = createConfigReload(ctx, {
    globalConfigPath: join(root, "absent-global.json"),
  });
  return {
    root,
    agentSpawn,
    setFailPermissionSettings: (value: boolean) => {
      failPermissionSettings = value;
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
