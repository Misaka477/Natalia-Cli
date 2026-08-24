import { CapabilityRegistry } from "@natalia/capability";
import {
  createPluginAdapterMaterializer,
  createPluginRegistry,
  type Plugin,
  type PluginAdapterInstance,
} from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import { CLI_PLUGIN_MANIFEST } from "@natalia/builtin-plugins";

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
    manifest: CLI_PLUGIN_MANIFEST,
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
    registerOwner: (manifest) => {
      const owner = kernel.registerOwner({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        scope: manifest.scope,
        grants: ["adapters"],
      });
      return owner;
    },
  });
  await registry.load(createCliCommandAdapterPlugin(start));
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
