/**
 * Tool catalog publishing — runtime/tool-publish.ts.
 *
 * Publishes the capability and tool catalog facts to the event stream, and
 * hot-reloads one out-of-tree tool family through the local-tools plugin.
 * Reads host state through `RuntimeContext` at call time.
 */
import { LOCAL_TOOLS_RELOAD_SERVICE } from "@natalia/runtime-services";
import type { ToolFamily } from "@natalia/tools";
import type { RuntimeContext } from "./context";
import type { RealRuntimeClientOptions } from "../real-runtime";

export function createToolPublish(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  return {
    publishBuiltinCapabilities,
    hotReloadToolFamily,
    publishRegisteredTools,
    publishToolCatalogChanges,
    publishWorkGraphToolCall,
  };

  function publishBuiltinCapabilities() {
    const { publish, getCapabilityRegistry } = ctx.ports;
    for (const record of getCapabilityRegistry().list()) {
      publish({
        type: "capability.loaded",
        id: `cap:${record.id}`,
        apiVersion: 1,
        name: record.name,
        version: record.version,
        scope: record.scope,
        grants: record.grants,
      });
    }
  }

  async function hotReloadToolFamily(familyID: string) {
    const { publish, getTools, getTsRuntimeConfig, getCapabilityRegistry } =
      ctx.ports;
    const tools = getTools();
    if (options.tools || !getTsRuntimeConfig())
      throw new Error("tool family reload is not available");
    // The local-tools plugin owns the family lifecycle; the host only asks it
    // to swap the family and then reports what changed in the tool catalog.
    const reload = getCapabilityRegistry().service<
      (familyID: string) => Promise<ToolFamily>
    >(LOCAL_TOOLS_RELOAD_SERVICE);
    if (!reload)
      throw new Error(
        "local tool families are not loaded (natalia-local-tools)",
      );
    const before = new Set(tools.keys());
    await reload(familyID);
    // Publish what changed so the projected tool catalog stays honest.
    for (const name of before) {
      if (tools.has(name)) continue;
      publish({ type: "tool.unregistered", id: `tool:${name}`, name });
    }
    for (const name of [...tools.keys()]) {
      if (before.has(name)) continue;
      const owner = getCapabilityRegistry().ownerOf("tools", name);
      publish({
        type: "tool.registered",
        id: `tool:${name}`,
        name,
        owner: owner ?? "natalia-runtime",
        scope: (owner && getCapabilityRegistry().scopeOf(owner)) || "session",
        recovery: "fail_closed",
        precedence: 0,
        requiresApproval: tools.get(name)?.requiresApproval ?? false,
      });
    }
    return { reloaded: true };
  }

  function publishRegisteredTools() {
    const { publish, getTools, getCapabilityRegistry } = ctx.ports;
    for (const tool of getTools().values()) {
      const owner = getCapabilityRegistry().ownerOf("tools", tool.name);
      publish({
        type: "tool.registered",
        id: `tool:${tool.name}`,
        name: tool.name,
        owner: owner ?? "natalia-runtime",
        scope: (owner && getCapabilityRegistry().scopeOf(owner)) || "session",
        recovery: "fail_closed",
        precedence: 0,
        requiresApproval: tool.requiresApproval,
      });
    }
  }

  function publishToolCatalogChanges(before: Set<string>) {
    const { publish, getTools, getCapabilityRegistry } = ctx.ports;
    const tools = getTools();
    for (const name of before)
      if (!tools.has(name))
        publish({ type: "tool.unregistered", id: `tool:${name}`, name });
    for (const tool of tools.values()) {
      if (before.has(tool.name)) continue;
      const owner = getCapabilityRegistry().ownerOf("tools", tool.name);
      publish({
        type: "tool.registered",
        id: `tool:${tool.name}`,
        name: tool.name,
        owner: owner ?? "natalia-runtime",
        scope: (owner && getCapabilityRegistry().scopeOf(owner)) || "session",
        recovery: "fail_closed",
        precedence: 0,
        requiresApproval: tool.requiresApproval,
      });
    }
  }

  /**
   * Records a settled tool call in the Work Graph, with the edge to the turn that
   * caused it. Only settled calls: an in-flight call is not yet a fact. The tool
   * name and status are recorded, never arguments or output.
   */
  function publishWorkGraphToolCall(
    turnID: string,
    callID: string,
    toolName: string,
    status: string,
  ) {
    const {
      executionForTurn,
      getActiveExec,
      getSessionID,
      publishForSession,
      getWorkLedgerController,
    } = ctx.ports;
    const exec = executionForTurn(turnID) ?? getActiveExec();
    const ownerSessionID = exec?.session.id ?? getSessionID();
    publishForSession(
      exec,
      getWorkLedgerController().toolCallNode({
        turnID,
        callID,
        toolName,
        status,
        sessionID: ownerSessionID,
      }),
    );
    publishForSession(
      exec,
      getWorkLedgerController().toolCallEdge({ turnID, callID }),
    );
  }
}
