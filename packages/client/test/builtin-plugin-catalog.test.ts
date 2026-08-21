import { expect, test } from "bun:test";
import {
  AGENT_PLUGIN_ID,
  ASK_PLUGIN_ID,
  builtinPluginCatalog,
  FS_READ_PLUGIN_ID,
  FS_WRITE_PLUGIN_ID,
  PDF_PLUGIN_ID,
  PROCESS_PLUGIN_ID,
  SANDBOX_PLUGIN_ID,
  SEARCH_PLUGIN_ID,
  SHELL_PLUGIN_ID,
  SKILLS_PLUGIN_ID,
  TERMINAL_PLUGIN_ID,
  TODO_PLUGIN_ID,
  WEB_PLUGIN_ID,
} from "../src/builtin-plugins/catalog";
import { PROVIDER_MODEL_PLUGIN_ID } from "../src/builtin-plugins/provider-model-plugin";
import { CONTEXT_LEDGER_PLUGIN_ID } from "../src/builtin-plugins/context-ledger-plugin";
import { WORK_LEDGER_PLUGIN_ID } from "../src/builtin-plugins/work-ledger-plugin";
import { GOVERNANCE_LEDGER_PLUGIN_ID } from "../src/builtin-plugins/governance-ledger-plugin";
import { TURN_ORCHESTRATION_PLUGIN_ID } from "../src/builtin-plugins/turn-orchestration-plugin";

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
  ]);
  expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
  expect(catalog.find((entry) => entry.id === SKILLS_PLUGIN_ID)?.enabled).toBe(
    false,
  );
  for (const entry of catalog.filter((candidate) => candidate.enabled))
    expect(entry.create().manifest.id).toBe(entry.id);
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
