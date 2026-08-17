import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import { configV3Schema } from "@natalia/contracts";
import { resolveConfig, updateGlobalConfig } from "@natalia/config";
import { createSignal, onMount } from "solid-js";
import { DialogModel } from "../src/component/DialogModel";
import { listModelConfigs } from "../src/component/DialogModel";
import { LocalProvider } from "../src/context/local";
import { ToastProvider } from "../src/context/toast";
import { DialogProvider, useDialog } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

function configuredModels(modelIDs: string[]) {
  return configV3Schema.parse({
    version: 3,
    providers: {
      example: {
        name: "Example Provider",
        driver: "openai",
        connection: { apiKey: "test" },
      },
    },
    catalog: {
      providers: {
        example: {
          models: Object.fromEntries(
            modelIDs.map((modelID) => [modelID, { name: modelID }]),
          ),
        },
      },
    },
  });
}

test("model options exclude overrides whose provider no longer exists", () => {
  const config = configV3Schema.parse({
    version: 3,
    modelOverrides: { "removed/orphan": { enabled: true } },
  });
  expect(listModelConfigs(config)).toEqual([]);
});

test("an open default-model picker reloads after configured models change", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-dialog-model-"));
  const globalPath = join(root, "global.json");
  const setup = await createTestRenderer({ width: 120, height: 30 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const [revision, setRevision] = createSignal(0);
  const initial = configuredModels(["initial-model"]);
  await updateGlobalConfig(
    { providers: initial.providers, catalog: initial.catalog },
    globalPath,
  );

  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogModel
          workspaceRoot={root}
          globalPath={globalPath}
          configRevision={revision}
        />
      )),
    );
    return null;
  }

  try {
    await render(
      () => (
        <KeymapProvider keymap={keymap}>
          <ToastProvider>
            <LocalProvider>
              <DialogProvider>
                <Harness />
              </DialogProvider>
            </LocalProvider>
          </ToastProvider>
        </KeymapProvider>
      ),
      setup.renderer,
    );
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    const renderOnce = async () => {
      await Bun.sleep(30);
      await setup.renderOnce();
    };

    await renderOnce();
    let frame = setup.captureCharFrame();
    expect(frame).toContain("Select default model");
    expect(frame).toContain("initial-model");
    expect(frame).toContain("Enter default");
    expect(frame).not.toContain("new-live-model");

    const changed = configuredModels(["initial-model", "new-live-model"]);
    await updateGlobalConfig(
      { providers: changed.providers, catalog: changed.catalog },
      globalPath,
    );
    setRevision((value) => value + 1);
    await renderOnce();
    frame = setup.captureCharFrame();
    expect(frame).toContain("new-live-model");

    await keys.typeText("new-live-model");
    keys.pressEnter();
    await renderOnce();
    expect(
      (await resolveConfig({ workspaceRoot: root, globalPath })).config
        .defaultModel,
    ).toEqual({ provider: "example", model: "new-live-model" });
    const persisted = JSON.parse(await readFile(globalPath, "utf8"));
    expect(Object.keys(persisted).sort()).toEqual(
      ["catalog", "defaultModel", "providers"].sort(),
    );
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
    await rm(root, { recursive: true, force: true });
  }
});
