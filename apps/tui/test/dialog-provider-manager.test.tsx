import { expect, test } from "bun:test";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import { configV3Schema, type ConfigV3 } from "@natalia/contracts";
import { onMount } from "solid-js";
import { DialogProvider, useDialog } from "../src/dialog/provider";
import {
  deleteProvider,
  DialogProviderManager,
  providerModels,
  setModelContextWindow,
} from "../src/component/DialogProviderManager";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

function config(): ConfigV3 {
  return configV3Schema.parse({
    version: 3,
    checkpoint: {},
    catalog: {
      providers: {
        example: {
          models: {
            "example-model": {
              name: "Example model",
              source: "manual",
              status: "stable",
              capabilities: {
                toolCall: true,
                reasoning: true,
                thinking: true,
                imageInput: false,
                pdfInput: false,
                videoInput: false,
              },
            },
            "other-model": {
              name: "Other model",
              source: "manual",
              status: "stable",
            },
          },
        },
      },
    },
    providers: {
      example: {
        name: "Example Provider",
        driver: "openai",
        enabled: true,
        connection: {},
        requestDefaults: { stream: true, headers: {}, options: {} },
      },
    },
  });
}

test("deleting a provider removes all model references", () => {
  const base = configV3Schema.parse({
    ...config(),
    modelOverrides: { "example/example-model": { enabled: true } },
    defaultModel: { provider: "example", model: "example-model" },
  });
  const next = deleteProvider(base, "example");
  expect(next.providers.example).toBeUndefined();
  expect(next.catalog.providers.example).toBeUndefined();
  expect(next.modelOverrides["example/example-model"]).toBeUndefined();
  expect(next.defaultModel).toBeNull();
});

test("context-window edits are isolated to one provider model", () => {
  const base = config();
  const next = setModelContextWindow(base, "example", "example-model", 131072);
  expect(
    providerModels(next, "example").map((model) => ({
      id: model.modelID,
      contextWindow: model.contextWindow,
    })),
  ).toEqual([
    { id: "example-model", contextWindow: 131072 },
    { id: "other-model", contextWindow: "auto" },
  ]);
  expect(
    base.catalog.providers.example?.models["example-model"]?.limits
      .contextWindow,
  ).toBe("auto");
});

test("Escape returns through provider model screens before closing", async () => {
  const setup = await createTestRenderer({ width: 120, height: 30 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogProviderManager config={config()} onPersist={() => {}} />
      )),
    );
    return null;
  }

  try {
    await render(
      () => (
        <KeymapProvider keymap={keymap}>
          <DialogProvider>
            <Harness />
          </DialogProvider>
        </KeymapProvider>
      ),
      setup.renderer,
    );
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    const renderOnce = async () => {
      await Bun.sleep(20);
      await setup.renderOnce();
    };

    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Providers");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Models: Example Provider");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Model: Example model");
    expect(setup.captureCharFrame()).toContain("Context Window");
    expect(setup.captureCharFrame()).toContain("Auto-detect");
    expect(setup.captureCharFrame().replace(/\s+/gu, " ")).toContain(
      "Escape back",
    );

    keys.pressEscape();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Models: Example Provider");
    keys.pressEscape();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Providers");
    expect(setup.captureCharFrame()).toContain("Example Provider");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});

test("the model editor persists a context window only for the selected model", async () => {
  const setup = await createTestRenderer({ width: 120, height: 30 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  let persisted = config();
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogProviderManager
          config={persisted}
          onPersist={(next) => {
            persisted = next;
          }}
        />
      )),
    );
    return null;
  }

  try {
    await render(
      () => (
        <KeymapProvider keymap={keymap}>
          <DialogProvider>
            <Harness />
          </DialogProvider>
        </KeymapProvider>
      ),
      setup.renderer,
    );
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    const renderOnce = async () => {
      await Bun.sleep(20);
      await setup.renderOnce();
    };

    await renderOnce();
    keys.pressEnter();
    await renderOnce();
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("Context Window");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Context Window: Example model");
    for (let index = 0; index < "auto".length; index++) keys.pressBackspace();
    await keys.typeText("131072");
    keys.pressEnter();
    await renderOnce();

    expect(
      persisted.catalog.providers.example?.models["example-model"]?.limits
        .contextWindow,
    ).toBe(131072);
    expect(
      persisted.catalog.providers.example?.models["other-model"]?.limits
        .contextWindow,
    ).toBe("auto");
    expect(setup.captureCharFrame()).toContain("131,072 tokens");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});
