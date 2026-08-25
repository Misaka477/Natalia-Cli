import { expect, test } from "bun:test";
import { resolveDesiredPluginCatalog } from "@natalia/plugin";
import {
  ASK_PLUGIN_ID,
  runtimePluginCatalog,
} from "../src/runtime/plugin-config";

test("runtime configuration emits ordinary desired plugin entries", async () => {
  const entries = runtimePluginCatalog({
    askEnabled: true,
    fsReadEnabled: false,
    fsWriteEnabled: false,
    pdfEnabled: false,
    processEnabled: false,
    searchEnabled: false,
    shellEnabled: false,
    terminalEnabled: false,
    todoEnabled: false,
    webEnabled: false,
  });
  const ask = entries.find((entry) => entry.id === ASK_PLUGIN_ID);

  expect(ask).toMatchObject({ id: ASK_PLUGIN_ID, enabled: true });
  expect(ask?.load).toBeFunction();
  expect("create" in (ask ?? {})).toBe(false);

  const desired = await resolveDesiredPluginCatalog({
    entries,
    previous: () => undefined,
    onError: () => undefined,
  });
  expect(desired.blocked).toEqual(new Set());
  expect((await ask?.load())?.manifest.id).toBe(ASK_PLUGIN_ID);
});
