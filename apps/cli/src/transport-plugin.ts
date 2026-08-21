import { CapabilityRegistry } from "@natalia/capability";
import { createPluginRegistry, type Plugin } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createRuntimeHttpServer,
  type RuntimeHttpServer,
  type RuntimeHttpServerOptions,
} from "@natalia/transport/host";

export const TRANSPORT_PLUGIN_ID = "natalia-transport";
export const HTTP_TRANSPORT_SERVICE = "transport.http.server";

export function createHttpTransportPlugin(
  options: RuntimeHttpServerOptions,
): Plugin {
  let server: RuntimeHttpServer | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: TRANSPORT_PLUGIN_ID,
      version: "1.0.0",
      name: "Transport",
      description: "Process-level HTTP runtime transport provider.",
      entry: "natalia:transport",
      scope: "process",
      provides: [HTTP_TRANSPORT_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      server = createRuntimeHttpServer(options);
      try {
        api.services.provide(HTTP_TRANSPORT_SERVICE, server);
      } catch (error) {
        server.stop(true);
        server = undefined;
        throw error;
      }
    },
    dispose() {
      server?.stop(true);
      server = undefined;
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
        grants: ["services"],
        // Services arrive during plugin setup, after this ownership record is
        // active. The plugin registry separately enforces manifest.provides.
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
    service: (name) => kernel.service(name),
  });
  await registry.loadBuiltin(createHttpTransportPlugin(serverOptions));
  const server = kernel.service<RuntimeHttpServer>(HTTP_TRANSPORT_SERVICE);
  if (!server) throw new Error("transport plugin failed to load");
  let closed = false;
  return {
    server,
    async close() {
      if (closed) return;
      closed = true;
      await registry.unloadAll();
    },
  };
}
