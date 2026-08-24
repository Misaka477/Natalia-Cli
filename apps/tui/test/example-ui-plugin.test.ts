import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import {
  createExampleUiPlugin,
  EXAMPLE_UI_ADAPTER,
} from "@natalia/example-ui-plugin";
import {
  createPluginAdapterMaterializer,
  createPluginRegistry,
  createUiAdapterMountInput,
} from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";

test("an installed UI package mounts through the public adapter port", async () => {
  const output: string[] = [];
  const kernel = new CapabilityRegistry();
  const registry = createPluginRegistry({
    tools: createToolRegistry([]),
    registerOwner: (manifest) =>
      kernel.registerOwner({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        scope: manifest.scope,
        grants: ["adapters"],
      }),
  });
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const submissions: string[] = [];
  const runtime = {
    start(listener: (event: RuntimeEvent) => void) {
      sink = listener;
    },
    commandCatalog: async () => [{ name: "status", title: "Status" }],
    async submit(text: string) {
      submissions.push(text);
      return { id: "turn_fixture" };
    },
  } as RuntimeClient;
  await registry.load(createExampleUiPlugin((line) => output.push(line)));
  expect(output).toEqual([]);
  const materializer = createPluginAdapterMaterializer(kernel);
  const mountInput = createUiAdapterMountInput(runtime);
  await materializer.materialize(EXAMPLE_UI_ADAPTER, mountInput);
  await mountInput.commands.execute("status");
  runtime.commandCatalog = async () => [];
  await expect(mountInput.commands.execute("status")).rejects.toThrow(
    "command unavailable: status",
  );
  await expect(mountInput.commands.execute("missing")).rejects.toThrow(
    "command unavailable: missing",
  );
  const event = {
    type: "session.created",
    sessionID: "ses_fixture",
    title: "Fixture",
  } as const;
  sink?.(event);
  await materializer.close();
  sink?.(event);
  expect(output).toEqual([
    "ready commands=1",
    "event session.created",
    "stopped",
  ]);
  expect(submissions).toEqual(["/status"]);
  await registry.unloadAll();
});
