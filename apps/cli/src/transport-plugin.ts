import { CapabilityRegistry } from "@natalia/capability";
import {
  createPluginAdapterMaterializer,
  createPluginRegistry,
  type Plugin,
  type PluginAdapterInstance,
} from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createRuntimeHttpServer,
  type RuntimeHttpServer,
  type RuntimeHttpServerOptions,
} from "@natalia/transport/host";

export const TRANSPORT_PLUGIN_ID = "natalia-transport";
export const HTTP_TRANSPORT_ADAPTER = "transport.http.server";

type HttpTransportAdapter = PluginAdapterInstance & {
  server: RuntimeHttpServer;
};

export function createHttpTransportPlugin(
  createServer: (
    options: RuntimeHttpServerOptions,
  ) => RuntimeHttpServer = createRuntimeHttpServer,
): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: TRANSPORT_PLUGIN_ID,
      version: "1.0.0",
      name: "Transport",
      description: "Process-level HTTP runtime transport provider.",
      entry: "natalia:transport",
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
        name: HTTP_TRANSPORT_ADAPTER,
        adapterType: "transport",
        create(options: RuntimeHttpServerOptions): HttpTransportAdapter {
          const server = createServer(options);
          return {
            server,
            dispose: () => server.stop(true),
          };
        },
      });
    },
  };
}

/** Activates the CLI-owned HTTP server through the plugin lifecycle. */
export async function createHttpTransportPluginHost(
  options: RuntimeHttpServerOptions & { enabled?: boolean },
) {
  if (options.enabled === false)
    throw new Error(`transport plugin is disabled (${TRANSPORT_PLUGIN_ID})`);
  const { enabled: _, ...serverOptions } = options;
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
        throw new Error(
          `transport capability failed to load: ${result.reason}`,
        );
      return (kind, name, payload) => {
        kernel.contribute(manifest.id, kind, name, payload);
        return () => undefined;
      };
    },
    onUnload: (pluginID) => kernel.unload(pluginID),
  });
  await registry.loadBuiltin(createHttpTransportPlugin());
  const materializer = createPluginAdapterMaterializer(kernel);
  let adapter: HttpTransportAdapter;
  try {
    adapter = await materializer.materialize<
      RuntimeHttpServerOptions,
      HttpTransportAdapter
    >(HTTP_TRANSPORT_ADAPTER, serverOptions);
  } catch (error) {
    await registry.unloadAll();
    throw error;
  }
  let closed = false;
  return {
    server: adapter.server,
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
