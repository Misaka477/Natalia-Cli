import { expect, test } from "bun:test";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import type { RuntimeClient } from "@natalia/contracts";
import { onMount } from "solid-js";
import {
  DialogPluginManager,
  type PluginInstaller,
} from "../src/component/DialogPluginManager";
import { ToastProvider, ToastRegion } from "../src/context/toast";
import { DialogProvider, useDialog } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

const officialRow = {
  id: "natalia-tool-ask",
  name: "Ask",
  version: "1.2.3",
  scope: "workspace",
  enabled: true,
  installed: true,
  source: { type: "path", path: "/opt/natalia/plugins/natalia-tool-ask" },
  packageName: "@natalia/plugin-tool-ask",
} as const;

const workspaceRoot = "/workspaces/project";
const distributionRoot = "/opt/natalia/plugins";
const pluginStoreRoot = "/opt/natalia/plugin-store";

function installer(overrides: Partial<PluginInstaller> = {}) {
  return {
    list: async () => [officialRow],
    install: async () => ({ installed: true }),
    enable: async () => ({ pluginID: officialRow.id, enabled: false }),
    uninstall: async () => ({ uninstalled: true }),
    reinstallOfficial: async () => ({ installed: true }),
    doctor: async () => [],
    reconcile: async () => ({ reconciled: true, findings: [], remaining: [] }),
    ...overrides,
  } as unknown as PluginInstaller;
}

async function mount(input: {
  backend: Pick<RuntimeClient, "reloadConfig">;
  installer: PluginInstaller;
}) {
  const setup = await createTestRenderer({ width: 110, height: 30 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogPluginManager
          workspaceRoot={workspaceRoot}
          pluginStoreRoot={pluginStoreRoot}
          distributionRoot={distributionRoot}
          backend={input.backend}
          installer={input.installer}
        />
      )),
    );
    return <ToastRegion />;
  }
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ToastProvider>
          <DialogProvider>
            <Harness />
          </DialogProvider>
        </ToastProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  return {
    setup,
    keys: createMockKeys(setup.renderer, { kittyKeyboard: true }),
    async renderOnce() {
      await Bun.sleep(20);
      await setup.renderOnce();
    },
    dispose() {
      disposeKeymap();
      setup.renderer.destroy();
    },
  };
}

test("plugin manager renders physical catalog rows and official actions", async () => {
  const listInputs: Parameters<PluginInstaller["list"]>[0][] = [];
  const mounted = await mount({
    backend: { reloadConfig: async () => ({ applied: true }) },
    installer: installer({
      list: async (input) => {
        listInputs.push(input);
        return [officialRow];
      },
    }),
  });
  try {
    await mounted.renderOnce();
    let frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Installed Plugins");
    expect(frame).toContain("Audit Plugin Store");
    expect(frame).toContain("Repair Plugin Store");
    expect(frame).toContain("Ask 1.2.3 · enabled");
    expect(frame).not.toContain("runtime synthetic");
    expect(listInputs).toEqual([{ pluginStoreRoot, workspaceRoot }]);
    expect(pluginStoreRoot).not.toContain(workspaceRoot);

    mounted.keys.pressArrow("down");
    mounted.keys.pressArrow("down");
    mounted.keys.pressArrow("down");
    mounted.keys.pressEnter();
    await mounted.renderOnce();
    frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Reinstall Official Plugin");
    expect(frame).toContain("Uninstall");
  } finally {
    mounted.dispose();
  }
});

test("plugin mutation reports committed state when runtime reload is refused", async () => {
  let mutationInput: Parameters<PluginInstaller["enable"]>[0] | undefined;
  const mounted = await mount({
    backend: {
      reloadConfig: async () => ({
        applied: false,
        reason: "runtime config cannot be applied while a turn is running",
      }),
    },
    installer: installer({
      enable: async (input) => {
        mutationInput = input;
        return { pluginID: input.pluginID, enabled: input.enabled };
      },
    }),
  });
  try {
    await mounted.renderOnce();
    mounted.keys.pressArrow("down");
    mounted.keys.pressArrow("down");
    mounted.keys.pressArrow("down");
    mounted.keys.pressEnter();
    await mounted.renderOnce();
    mounted.keys.pressEnter();
    await mounted.renderOnce();

    expect(mutationInput).toEqual({
      pluginStoreRoot,
      workspaceRoot,
      pluginID: officialRow.id,
      enabled: false,
    });
    expect(mutationInput!.pluginStoreRoot).not.toContain(workspaceRoot);
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("disabled, but the runtime did not");
    expect(frame).toContain("apply it: runtime config cannot be applied");
    expect(frame).toContain("turn is running");
  } finally {
    mounted.dispose();
  }
});

test("official reinstall uses the distribution sibling store, not the workspace", async () => {
  let reinstallInput:
    | Parameters<PluginInstaller["reinstallOfficial"]>[0]
    | undefined;
  const mounted = await mount({
    backend: { reloadConfig: async () => ({ applied: true }) },
    installer: installer({
      reinstallOfficial: async (input) => {
        reinstallInput = input;
        return { installed: true } as never;
      },
    }),
  });
  try {
    await mounted.renderOnce();
    mounted.keys.pressArrow("down");
    mounted.keys.pressArrow("down");
    mounted.keys.pressArrow("down");
    mounted.keys.pressEnter();
    await mounted.renderOnce();
    mounted.keys.pressArrow("down");
    mounted.keys.pressEnter();
    await mounted.renderOnce();

    expect(reinstallInput).toEqual({
      pluginStoreRoot,
      distributionRoot,
      pluginID: officialRow.id,
    });
    expect(reinstallInput).not.toHaveProperty("workspaceRoot");
    expect(reinstallInput!.pluginStoreRoot).not.toContain(workspaceRoot);
  } finally {
    mounted.dispose();
  }
});

test("plugin manager audits the instance store", async () => {
  let doctorRoot: string | undefined;
  const mounted = await mount({
    backend: { reloadConfig: async () => ({ applied: true }) },
    installer: installer({
      doctor: async (pluginStoreRoot) => {
        doctorRoot = pluginStoreRoot;
        return [
          {
            pluginID: officialRow.id,
            code: "package_missing",
            message: "plugin natalia-tool-ask package is missing",
          },
        ];
      },
    }),
  });
  try {
    await mounted.renderOnce();
    mounted.keys.pressArrow("down");
    mounted.keys.pressEnter();
    await mounted.renderOnce();
    expect(doctorRoot).toBe(pluginStoreRoot);
    expect(mounted.setup.captureCharFrame()).toContain("Plugin Store Audit");
    expect(mounted.setup.captureCharFrame()).toContain("natalia-tool-ask");
    expect(mounted.setup.captureCharFrame()).toContain("package_missing");
  } finally {
    mounted.dispose();
  }
});

test("plugin manager repairs the instance store", async () => {
  let reconcileRoot: string | undefined;
  const mounted = await mount({
    backend: { reloadConfig: async () => ({ applied: true }) },
    installer: installer({
      reconcile: async (pluginStoreRoot) => {
        reconcileRoot = pluginStoreRoot;
        return { reconciled: true, findings: [], remaining: [] };
      },
    }),
  });
  try {
    await mounted.renderOnce();
    mounted.keys.pressArrow("down");
    mounted.keys.pressArrow("down");
    mounted.keys.pressEnter();
    await mounted.renderOnce();
    expect(mounted.setup.captureCharFrame()).toContain("Repair Plugin Store");
    mounted.keys.pressArrow("right");
    mounted.keys.pressEnter();
    await mounted.renderOnce();
    expect(reconcileRoot).toBe(pluginStoreRoot);
    expect(mounted.setup.captureCharFrame()).toContain("Plugin store repaired");
  } finally {
    mounted.dispose();
  }
});
