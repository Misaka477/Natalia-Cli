import { CapabilityRegistry } from "@natalia/capability";
import {
  createPluginAdapterMaterializer,
  createPluginRegistry,
  type Plugin,
  type PluginAdapterInstance,
} from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";

export const CLI_PLUGIN_ID = "natalia-cli";
export const CLI_COMMAND_ADAPTER = "command.cli";

type CliCommandAdapterInstance = PluginAdapterInstance & {
  done: Promise<void>;
};

type StartCliCommandAdapter = () => CliCommandAdapterInstance;

export function createCliCommandAdapterPlugin(
  start: StartCliCommandAdapter = startCliCommandAdapter,
): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: CLI_PLUGIN_ID,
      version: "1.0.0",
      name: "CLI",
      description: "Process-level command-line interface adapter.",
      entry: "natalia:cli",
      scope: "process",
      provides: [],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["adapters"],
    },
    setup(api) {
      api.adapters.register({
        name: CLI_COMMAND_ADAPTER,
        adapterType: "command",
        create: start,
      });
    },
  };
}

export async function createCliCommandAdapterHost(
  options: { enabled?: boolean } = {},
  start: StartCliCommandAdapter = startCliCommandAdapter,
) {
  if (options.enabled === false)
    throw new Error(`CLI plugin is disabled (${CLI_PLUGIN_ID})`);
  const kernel = new CapabilityRegistry();
  const registry = createPluginRegistry({
    tools: createToolRegistry([]),
    contribute: (manifest) => {
      const result = kernel.tryLoad({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        scope: manifest.scope,
        grants: ["adapters"],
        provides: [],
      });
      if (!result.ok)
        throw new Error(`CLI capability failed to load: ${result.reason}`);
      return (kind, name, payload) => {
        kernel.contribute(manifest.id, kind, name, payload);
        return () => undefined;
      };
    },
    onUnload: (pluginID) => kernel.unload(pluginID),
  });
  await registry.loadBuiltin(createCliCommandAdapterPlugin(start));
  const materializer = createPluginAdapterMaterializer(kernel);
  let adapter: CliCommandAdapterInstance;
  try {
    adapter = await materializer.materialize<
      undefined,
      CliCommandAdapterInstance
    >(CLI_COMMAND_ADAPTER, undefined);
  } catch (error) {
    await registry.unloadAll();
    throw error;
  }
  let closed = false;
  return {
    done: adapter.done,
    async close() {
      if (closed) return;
      closed = true;
      try {
        await materializer.close();
      } finally {
        await registry.unloadAll();
      }
    },
  };
}

function startCliCommandAdapter(): CliCommandAdapterInstance {
  return {
    done: import("./command-dispatcher").then(() => undefined),
    dispose() {},
  };
}
