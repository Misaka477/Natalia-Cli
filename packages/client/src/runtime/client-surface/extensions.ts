import type { RuntimeServiceClient } from "@natalia/runtime-services";
import { manifestIntegrationPoints } from "@natalia/plugin";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  | "plugins"
  | "commandCatalog"
  | "capabilities"
  | "pluginUnload"
  | "pluginReload"
  | "toolFamilyReload"
>;
export function createExtensionsSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async plugins() {
      await ctx.ports.getReady();
      return ctx.ports
        .getPluginsController()
        .list()
        .map((plugin) => ({
          id: plugin.id,
          version: plugin.version,
          name: plugin.name,
          description: plugin.description,
          capabilities: manifestIntegrationPoints(plugin),
        }));
    },
    async commandCatalog() {
      // The catalog reads the plugin registry and capability contributions,
      // which only exist after initialize; on a cold start the request could
      // otherwise race ahead of it.
      await ctx.ports.getReady();
      return ctx.ports.commandCatalogEntries().map((command) => ({
        name: command.name,
        title: command.title,
        category: command.category,
      }));
    },
    async pluginUnload(id) {
      await ctx.ports.getReady();
      const before = new Set(ctx.ports.getTools().keys());
      const result = await ctx.ports.getPluginsController().unload(id);
      // The plugin's tool disposers removed its tools from the registry; publish
      // tool.unregistered for the ones that disappeared so the projected tool
      // catalog stops reporting them (P5 dynamic unload).
      for (const name of before) {
        if (ctx.ports.getTools().has(name)) continue;
        ctx.ports.publish({
          type: "tool.unregistered",
          id: `tool:${name}`,
          name,
        });
      }
      return result;
    },
    async pluginReload(id) {
      await ctx.ports.getReady();
      return await ctx.ports.getPluginsController().reload(id);
    },
    async toolFamilyReload(id) {
      await ctx.ports.getReady();
      return await ctx.ports.hotReloadToolFamily(id);
    },
    async capabilities() {
      // The built-in catalogue registers during initialize; a query that skips
      // `ready` would answer before those records exist.
      await ctx.ports.getReady();
      if (!ctx.ports.getCapabilityRegistry()) return [];
      return [
        ...(ctx.ports.getWorkspaceCapabilityView()?.list() ?? []),
        ...ctx.ports.getCapabilityRegistry().list(),
      ].map((record) => {
        // The effective contributions this capability owns, as metadata only.
        // Payloads stay on the host side: a tool definition or a settings value
        // must not leak through the query surface. Contributions that lost an
        // override are not effective and are omitted.
        const contributions = record.grants.flatMap((grant) =>
          ctx.ports
            .getCapabilityRegistry()
            .contributions<unknown>(grant)
            .filter((entry) => entry.capabilityID === record.id)
            .map((entry) => ({ kind: entry.kind, name: entry.name })),
        );
        return {
          id: record.id,
          name: record.name,
          version: record.version,
          scope: record.scope,
          grants: record.grants,
          precedence: record.precedence,
          provides: contributions
            .filter((entry) => entry.kind === "services")
            .map((entry) => entry.name),
          contributions,
        };
      });
    },
  };
}
