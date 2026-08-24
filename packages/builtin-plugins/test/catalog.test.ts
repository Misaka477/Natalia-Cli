import { expect, test } from "bun:test";
import {
  AGENT_PLUGIN_ID,
  ASK_PLUGIN_ID,
  builtinPluginCatalog,
  CHECKPOINT_PLUGIN_ID,
  checkpointPluginEntry,
  computeBuiltinFeatureGates,
  FS_READ_PLUGIN_ID,
  FS_WRITE_PLUGIN_ID,
  MCP_PLUGIN_ID,
  mcpPluginEntry,
  PDF_PLUGIN_ID,
  PROCESS_PLUGIN_ID,
  providerModelPluginEntry,
  compactionPluginEntry,
  SANDBOX_PLUGIN_ID,
  sandboxPluginEntry,
  SEARCH_PLUGIN_ID,
  SHELL_PLUGIN_ID,
  SKILLS_PLUGIN_ID,
  skillsPluginEntry,
  terminalPluginEntry,
  TERMINAL_PLUGIN_ID,
  TODO_PLUGIN_ID,
  WEB_PLUGIN_ID,
  workspacePluginEntry,
} from "../src";
import { PROVIDER_MODEL_PLUGIN_ID } from "@natalia/provider-model-plugin";
import { CONTEXT_LEDGER_PLUGIN_ID } from "@natalia/context-ledger-plugin";
import { WORK_LEDGER_PLUGIN_ID } from "@natalia/work-ledger-plugin";
import { GOVERNANCE_LEDGER_PLUGIN_ID } from "@natalia/governance-ledger-plugin";
import { TURN_ORCHESTRATION_PLUGIN_ID } from "@natalia/turn-orchestration-plugin";
import { RETRY_PLUGIN_ID } from "@natalia/retry-plugin";
import { ATTACHMENT_PLUGIN_ID } from "@natalia/attachment-plugin";
import { COMPACTION_PLUGIN_ID } from "@natalia/compaction-plugin";
import { RUNTIME_UI_PLUGIN_ID } from "@natalia/runtime-ui-plugin";
import { WORKSPACE_PLUGIN_ID } from "@natalia/workspace-plugin";
import { LOCAL_TOOLS_PLUGIN_ID } from "@natalia/local-tools-plugin";
import { TEAM_PLUGIN_ID } from "@natalia/team-plugin";
import { pluginManifestSchema } from "@natalia/plugin";

test("every static catalog manifest exactly matches its factory", () => {
  const noop = () => undefined;
  const catalog = builtinPluginCatalog({
    agentEnabled: true,
    askEnabled: true,
    fsReadEnabled: true,
    fsWriteEnabled: true,
    pdfEnabled: true,
    processEnabled: true,
    sandboxEnabled: true,
    searchEnabled: true,
    shellEnabled: true,
    terminalEnabled: true,
    todoEnabled: true,
    webEnabled: true,
    skills: { workspaceRoot: "/tmp" },
    taskModule: {} as never,
    runtimeConfig: {} as never,
    localTools: { roots: [] },
    workspace: { workspaceRoot: "/tmp", listPaths: async () => [] },
    terminal: {
      workspaceRoot: "/tmp",
      publish: noop,
      onPerformance: noop,
      runtimeID: () => "test",
      userRuntimeHome: () => undefined,
      windowMode: () => "auto",
    },
    sandbox: { workspaceRoot: "/tmp" },
    mcp: {
      servers: () => ({}),
      workspaceRoot: "/tmp",
      enabled: () => true,
      publish: noop,
    },
    checkpoint: { workspaceRoot: "/tmp" },
    subagents: { workDir: "/tmp" },
    attachment: { enabled: true, workspaceRoot: "/tmp" },
    sessionStore: {
      workspaceRoot: "/tmp",
      sessionID: () => "test" as never,
    },
    team: { enabled: true },
    toolPipeline: { enabled: true },
    collaboration: { waiter: {} as never, tools: {} as never },
    retry: { enabled: true, policy: () => ({}) },
    contextLedger: { enabled: true },
    compaction: { enabled: true },
    runtimeUi: { enabled: true, controller: {} as never },
    providerModel: { enabled: true, controller: {} as never },
    taskWorkflow: { enabled: true, controller: {} as never },
    workLedger: { enabled: true, controller: {} as never },
    governanceLedger: { enabled: true },
    turnOrchestration: { enabled: true, controller: {} as never },
  });

  for (const entry of catalog)
    expect(pluginManifestSchema.parse(entry.manifest)).toEqual(
      pluginManifestSchema.parse(entry.create().manifest),
    );
});

test("built-in plugin catalog is lazy and has unique matching ids", () => {
  const catalog = builtinPluginCatalog({
    agentEnabled: true,
    askEnabled: true,
    fsReadEnabled: true,
    fsWriteEnabled: true,
    pdfEnabled: true,
    processEnabled: true,
    sandboxEnabled: true,
    searchEnabled: true,
    shellEnabled: true,
    terminalEnabled: true,
    todoEnabled: true,
    webEnabled: true,
  });
  expect(catalog.map((entry) => entry.id)).toEqual([
    ASK_PLUGIN_ID,
    TODO_PLUGIN_ID,
    SEARCH_PLUGIN_ID,
    FS_READ_PLUGIN_ID,
    FS_WRITE_PLUGIN_ID,
    WEB_PLUGIN_ID,
    SHELL_PLUGIN_ID,
    AGENT_PLUGIN_ID,
    TERMINAL_PLUGIN_ID,
    SANDBOX_PLUGIN_ID,
    PROCESS_PLUGIN_ID,
    SKILLS_PLUGIN_ID,
    PDF_PLUGIN_ID,
    LOCAL_TOOLS_PLUGIN_ID,
    WORKSPACE_PLUGIN_ID,
    "natalia-terminal",
    "natalia-sandbox",
    MCP_PLUGIN_ID,
    CHECKPOINT_PLUGIN_ID,
    TEAM_PLUGIN_ID,
    COMPACTION_PLUGIN_ID,
    PROVIDER_MODEL_PLUGIN_ID,
  ]);
  expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
  expect(catalog.every((entry) => typeof entry.fingerprint === "string")).toBe(
    true,
  );
  expect(catalog.every((entry) => entry.manifest.id === entry.id)).toBe(true);
  expect(catalog.find((entry) => entry.id === SKILLS_PLUGIN_ID)?.enabled).toBe(
    false,
  );
  expect(
    catalog.find((entry) => entry.id === LOCAL_TOOLS_PLUGIN_ID)?.enabled,
  ).toBe(false);
  expect(
    catalog.find((entry) => entry.id === WORKSPACE_PLUGIN_ID)?.enabled,
  ).toBe(false);
  expect(catalog.find((entry) => entry.id === MCP_PLUGIN_ID)?.enabled).toBe(
    false,
  );
  expect(
    catalog.find((entry) => entry.id === "natalia-terminal")?.enabled,
  ).toBe(false);
  expect(
    catalog.find((entry) => entry.id === CHECKPOINT_PLUGIN_ID)?.enabled,
  ).toBe(false);
  expect(catalog.find((entry) => entry.id === TEAM_PLUGIN_ID)?.enabled).toBe(
    false,
  );
  for (const entry of catalog.filter((candidate) => candidate.enabled))
    expect(entry.create().manifest.id).toBe(entry.id);
});

function featureGates(config: any, hasCustomTools = false) {
  return computeBuiltinFeatureGates({
    config,
    hasCustomTools,
  });
}

test("built-in feature gates honor custom registries and config switches", () => {
  const custom = featureGates({ plugins: { enabled: {} } }, true);
  expect(custom.askEnabled).toBe(false);
  expect(custom.pdfEnabled).toBe(true);

  const configured = featureGates({
    plugins: {
      enabled: { [ASK_PLUGIN_ID]: false, [TODO_PLUGIN_ID]: false },
    },
  });
  expect(configured.askEnabled).toBe(false);
  expect(configured.todoEnabled).toBe(false);
  expect(configured.searchEnabled).toBe(true);
});

test("PDF feature gate follows only desired plugin config", () => {
  expect(
    computeBuiltinFeatureGates({
      config: { plugins: { enabled: { [PDF_PLUGIN_ID]: true } } } as any,
      hasCustomTools: false,
    }).pdfEnabled,
  ).toBe(true);
});

test("skills catalog entry stays stable while disabled", () => {
  const disabled = skillsPluginEntry(undefined);
  expect(disabled.id).toBe(SKILLS_PLUGIN_ID);
  expect(disabled.enabled).toBe(false);
  expect(() => disabled.create()).toThrow("skills plugin is disabled");

  const enabled = skillsPluginEntry({ workspaceRoot: "/tmp/workspace" });
  expect(enabled.enabled).toBe(true);
  expect(enabled.create().manifest.id).toBe(SKILLS_PLUGIN_ID);
});

test("catalog fingerprints are stable and change with owner config identity", () => {
  const first = skillsPluginEntry({
    workspaceRoot: "/tmp/workspace",
    remoteURLs: ["https://example.test/one"],
  });
  const same = skillsPluginEntry({
    remoteURLs: ["https://example.test/one"],
    workspaceRoot: "/tmp/workspace",
  });
  const changed = skillsPluginEntry({
    workspaceRoot: "/tmp/workspace",
    remoteURLs: ["https://example.test/two"],
  });
  expect(first.fingerprint).toBe(same.fingerprint);
  expect(first.fingerprint).not.toBe(changed.fingerprint);
});

test("checkpoint catalog entry stays stable while disabled", () => {
  const disabled = checkpointPluginEntry(undefined);
  expect(disabled.id).toBe(CHECKPOINT_PLUGIN_ID);
  expect(disabled.enabled).toBe(false);
  expect(() => disabled.create()).toThrow("checkpoint plugin is disabled");

  const enabled = checkpointPluginEntry({ workspaceRoot: "/tmp/workspace" });
  expect(enabled.enabled).toBe(true);
  expect(enabled.create().manifest.id).toBe(CHECKPOINT_PLUGIN_ID);
});

test("MCP catalog entry stays stable while disabled", () => {
  const disabled = mcpPluginEntry(undefined);
  expect(disabled.id).toBe(MCP_PLUGIN_ID);
  expect(disabled.enabled).toBe(false);
  expect(() => disabled.create()).toThrow("MCP plugin is disabled");

  const enabled = mcpPluginEntry({
    servers: () => ({}),
    workspaceRoot: "/tmp/workspace",
    enabled: () => true,
    publish: () => undefined,
  });
  expect(enabled.enabled).toBe(true);
  expect(enabled.create().manifest.id).toBe(MCP_PLUGIN_ID);
});

test("sandbox controller catalog entry stays stable while disabled", () => {
  const disabled = sandboxPluginEntry(undefined);
  expect(disabled.id).toBe("natalia-sandbox");
  expect(disabled.enabled).toBe(false);
  expect(() => disabled.create()).toThrow("sandbox plugin is disabled");

  const enabled = sandboxPluginEntry({ workspaceRoot: "/tmp/workspace" });
  expect(enabled.enabled).toBe(true);
  expect(enabled.create().manifest.id).toBe("natalia-sandbox");
});

test("terminal controller catalog entry stays stable while disabled", () => {
  const disabled = terminalPluginEntry(undefined);
  expect(disabled.id).toBe("natalia-terminal");
  expect(disabled.enabled).toBe(false);
  expect(() => disabled.create()).toThrow("terminal plugin is disabled");

  const enabled = terminalPluginEntry({
    workspaceRoot: "/tmp/workspace",
    publish: () => undefined,
    onPerformance: () => undefined,
    runtimeID: () => "runtime-test",
    userRuntimeHome: () => undefined,
    windowMode: () => "auto",
  });
  expect(enabled.enabled).toBe(true);
  expect(enabled.create().manifest.id).toBe("natalia-terminal");
});

test("provider-model catalog construction stays lazy", () => {
  let initialized = 0;
  const catalog = builtinPluginCatalog({
    agentEnabled: false,
    askEnabled: false,
    fsReadEnabled: false,
    fsWriteEnabled: false,
    pdfEnabled: false,
    processEnabled: false,
    sandboxEnabled: false,
    searchEnabled: false,
    shellEnabled: false,
    terminalEnabled: false,
    todoEnabled: false,
    webEnabled: false,
    providerModel: {
      enabled: false,
      controller: {
        initialize: () => {
          initialized += 1;
        },
      } as never,
    },
  });
  const entry = catalog.find(
    (candidate) => candidate.id === PROVIDER_MODEL_PLUGIN_ID,
  );
  expect(entry?.enabled).toBe(false);
  expect(initialized).toBe(0);
  expect(entry?.create().manifest.id).toBe(PROVIDER_MODEL_PLUGIN_ID);
  expect(initialized).toBe(0);
});

test("provider-model catalog entry stays stable while disabled", () => {
  const disabled = providerModelPluginEntry(undefined);
  expect(disabled.id).toBe(PROVIDER_MODEL_PLUGIN_ID);
  expect(disabled.enabled).toBe(false);
  expect(() => disabled.create()).toThrow("provider-model plugin is disabled");

  const configured = providerModelPluginEntry({
    enabled: false,
    controller: {} as never,
  });
  expect(configured.enabled).toBe(false);
  expect(configured.create().manifest.id).toBe(PROVIDER_MODEL_PLUGIN_ID);
});

test("compaction catalog entry stays stable while disabled", () => {
  const disabled = compactionPluginEntry(undefined);
  expect(disabled.id).toBe(COMPACTION_PLUGIN_ID);
  expect(disabled.enabled).toBe(false);
  expect(() => disabled.create()).toThrow("compaction plugin is disabled");

  const configured = compactionPluginEntry({ enabled: false });
  expect(configured.enabled).toBe(false);
  expect(configured.create().manifest.id).toBe(COMPACTION_PLUGIN_ID);
});

test("workspace catalog construction stays lazy", () => {
  let listed = 0;
  const catalog = builtinPluginCatalog({
    agentEnabled: false,
    askEnabled: false,
    fsReadEnabled: false,
    fsWriteEnabled: false,
    pdfEnabled: false,
    processEnabled: false,
    sandboxEnabled: false,
    searchEnabled: false,
    shellEnabled: false,
    terminalEnabled: false,
    todoEnabled: false,
    webEnabled: false,
    workspace: {
      workspaceRoot: "/tmp/workspace",
      listPaths: async () => {
        listed += 1;
        return [];
      },
    },
  });
  const entry = catalog.find(
    (candidate) => candidate.id === WORKSPACE_PLUGIN_ID,
  );

  expect(entry?.enabled).toBe(true);
  expect(listed).toBe(0);
  expect(entry?.create().manifest.id).toBe(WORKSPACE_PLUGIN_ID);
  expect(listed).toBe(0);
});

test("workspace catalog entry stays stable while disabled", () => {
  const disabled = workspacePluginEntry(undefined);
  expect(disabled.id).toBe(WORKSPACE_PLUGIN_ID);
  expect(disabled.enabled).toBe(false);
  expect(() => disabled.create()).toThrow("workspace plugin is disabled");

  const enabled = workspacePluginEntry({
    workspaceRoot: "/tmp/workspace",
    listPaths: async () => [],
  });
  expect(enabled.enabled).toBe(true);
  expect(enabled.create().manifest.id).toBe(WORKSPACE_PLUGIN_ID);
});

test("ledger catalog entries stay lazy and preserve dependency order", () => {
  let openFindingReads = 0;
  const catalog = builtinPluginCatalog({
    agentEnabled: false,
    askEnabled: false,
    fsReadEnabled: false,
    fsWriteEnabled: false,
    pdfEnabled: false,
    processEnabled: false,
    sandboxEnabled: false,
    searchEnabled: false,
    shellEnabled: false,
    terminalEnabled: false,
    todoEnabled: false,
    webEnabled: false,
    contextLedger: { enabled: false },
    workLedger: {
      enabled: false,
      controller: {
        openFindingIDs: () => {
          openFindingReads += 1;
          return new Set();
        },
      },
    },
    governanceLedger: { enabled: false },
  });
  const ledgerEntries = catalog.filter((entry) =>
    [
      CONTEXT_LEDGER_PLUGIN_ID,
      WORK_LEDGER_PLUGIN_ID,
      GOVERNANCE_LEDGER_PLUGIN_ID,
    ].includes(entry.id),
  );
  expect(ledgerEntries.map((entry) => entry.id)).toEqual([
    CONTEXT_LEDGER_PLUGIN_ID,
    WORK_LEDGER_PLUGIN_ID,
    GOVERNANCE_LEDGER_PLUGIN_ID,
  ]);
  expect(ledgerEntries.every((entry) => !entry.enabled)).toBe(true);
  for (const entry of ledgerEntries)
    expect(entry.create().manifest.id).toBe(entry.id);
  expect(openFindingReads).toBe(0);
});

test("turn orchestration catalog construction stays lazy", () => {
  let sessionReads = 0;
  const catalog = builtinPluginCatalog({
    agentEnabled: false,
    askEnabled: false,
    fsReadEnabled: false,
    fsWriteEnabled: false,
    pdfEnabled: false,
    processEnabled: false,
    sandboxEnabled: false,
    searchEnabled: false,
    shellEnabled: false,
    terminalEnabled: false,
    todoEnabled: false,
    webEnabled: false,
    turnOrchestration: {
      enabled: false,
      controller: {
        session: () => {
          sessionReads += 1;
          return undefined;
        },
      } as never,
    },
  });
  const entry = catalog.find(
    (candidate) => candidate.id === TURN_ORCHESTRATION_PLUGIN_ID,
  );
  expect(entry?.enabled).toBe(false);
  expect(entry?.create().manifest.id).toBe(TURN_ORCHESTRATION_PLUGIN_ID);
  expect(sessionReads).toBe(0);
});

test("retry catalog construction stays lazy and precedes provider-model", () => {
  let policyReads = 0;
  const catalog = builtinPluginCatalog({
    agentEnabled: false,
    askEnabled: false,
    fsReadEnabled: false,
    fsWriteEnabled: false,
    pdfEnabled: false,
    processEnabled: false,
    sandboxEnabled: false,
    searchEnabled: false,
    shellEnabled: false,
    terminalEnabled: false,
    todoEnabled: false,
    webEnabled: false,
    retry: {
      enabled: false,
      policy: () => {
        policyReads += 1;
        return undefined;
      },
    },
    providerModel: {
      enabled: false,
      controller: {} as never,
    },
  });
  const retryIndex = catalog.findIndex((entry) => entry.id === RETRY_PLUGIN_ID);
  const providerIndex = catalog.findIndex(
    (entry) => entry.id === PROVIDER_MODEL_PLUGIN_ID,
  );
  expect(retryIndex).toBeGreaterThanOrEqual(0);
  expect(retryIndex).toBeLessThan(providerIndex);
  expect(catalog[retryIndex]?.enabled).toBe(false);
  expect(catalog[retryIndex]?.create().manifest.id).toBe(RETRY_PLUGIN_ID);
  expect(policyReads).toBe(0);
});

test("attachment catalog precedes session and provider consumers", () => {
  const catalog = builtinPluginCatalog({
    agentEnabled: false,
    askEnabled: false,
    fsReadEnabled: false,
    fsWriteEnabled: false,
    pdfEnabled: false,
    processEnabled: false,
    sandboxEnabled: false,
    searchEnabled: false,
    shellEnabled: false,
    terminalEnabled: false,
    todoEnabled: false,
    webEnabled: false,
    attachment: { enabled: false, workspaceRoot: "/tmp/workspace" },
    sessionStore: {
      workspaceRoot: "/tmp/workspace",
      sessionID: () => "ses_test",
    },
    providerModel: { enabled: false, controller: {} as never },
  });
  const attachmentIndex = catalog.findIndex(
    (entry) => entry.id === ATTACHMENT_PLUGIN_ID,
  );
  const sessionIndex = catalog.findIndex(
    (entry) => entry.id === "natalia-session-store",
  );
  const providerIndex = catalog.findIndex(
    (entry) => entry.id === PROVIDER_MODEL_PLUGIN_ID,
  );
  expect(attachmentIndex).toBeGreaterThanOrEqual(0);
  expect(attachmentIndex).toBeLessThan(sessionIndex);
  expect(attachmentIndex).toBeLessThan(providerIndex);
  expect(catalog[attachmentIndex]?.enabled).toBe(false);
  expect(catalog[attachmentIndex]?.create().manifest.id).toBe(
    ATTACHMENT_PLUGIN_ID,
  );
});

test("compaction catalog follows dependencies and precedes provider-model", () => {
  const catalog = builtinPluginCatalog({
    agentEnabled: false,
    askEnabled: false,
    fsReadEnabled: false,
    fsWriteEnabled: false,
    pdfEnabled: false,
    processEnabled: false,
    sandboxEnabled: false,
    searchEnabled: false,
    shellEnabled: false,
    terminalEnabled: false,
    todoEnabled: false,
    webEnabled: false,
    retry: { enabled: false, policy: () => undefined },
    contextLedger: { enabled: false },
    compaction: { enabled: false },
    providerModel: { enabled: false, controller: {} as never },
  });
  const ids = catalog.map((entry) => entry.id);
  expect(ids.indexOf(RETRY_PLUGIN_ID)).toBeLessThan(
    ids.indexOf(COMPACTION_PLUGIN_ID),
  );
  expect(ids.indexOf(CONTEXT_LEDGER_PLUGIN_ID)).toBeLessThan(
    ids.indexOf(COMPACTION_PLUGIN_ID),
  );
  expect(ids.indexOf(COMPACTION_PLUGIN_ID)).toBeLessThan(
    ids.indexOf(PROVIDER_MODEL_PLUGIN_ID),
  );
  expect(
    catalog.find((entry) => entry.id === COMPACTION_PLUGIN_ID)?.enabled,
  ).toBe(false);
});

test("runtime UI catalog construction stays lazy and precedes consumers", () => {
  let providerReads = 0;
  const catalog = builtinPluginCatalog({
    agentEnabled: false,
    askEnabled: false,
    fsReadEnabled: false,
    fsWriteEnabled: false,
    pdfEnabled: false,
    processEnabled: false,
    sandboxEnabled: false,
    searchEnabled: false,
    shellEnabled: false,
    terminalEnabled: false,
    todoEnabled: false,
    webEnabled: false,
    runtimeUi: {
      enabled: false,
      controller: {
        provider: () => {
          providerReads += 1;
          return undefined;
        },
      } as never,
    },
    providerModel: { enabled: false, controller: {} as never },
  });
  const entry = catalog.find(
    (candidate) => candidate.id === RUNTIME_UI_PLUGIN_ID,
  );
  expect(entry?.enabled).toBe(false);
  expect(entry?.create().manifest.id).toBe(RUNTIME_UI_PLUGIN_ID);
  expect(providerReads).toBe(0);
  expect(catalog.indexOf(entry!)).toBeLessThan(
    catalog.findIndex((candidate) => candidate.id === PROVIDER_MODEL_PLUGIN_ID),
  );
});
