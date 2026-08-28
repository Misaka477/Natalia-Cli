import type {
  ApprovalResponse,
  ChatModelProfile,
  QuestionResponse,
  RuntimeEvent,
  RuntimeClient,
  RuntimeModelCatalogEntry,
  RuntimeModelSelection,
  RuntimeReasoningEffort,
  RuntimeSessionSummary,
  RuntimeWorkspaceMatch,
  RuntimeWorkspaceListPage,
  RuntimeWorkspaceContent,
  ConfigV3,
  WorkspaceSummary,
  WorkspacePermissionSettings,
  WorkspaceToolSettings,
} from "@natalia/contracts";
import { callRuntimeRPC } from "@natalia/transport";

export type WebRuntimeOptions = {
  url: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
};

/**
 * Real browser runtime client. It speaks the framework RPC protocol to a
 * running Natalia runtime/daemon and consumes the /events SSE stream.
 */
export function createWebRuntimeClient(
  options: WebRuntimeOptions,
): RuntimeClient {
  const call = <T>(method: string, params?: Record<string, unknown>) =>
    callRuntimeRPC<T>({
      url: options.url,
      token: options.token,
      method,
      params,
      fetch: options.fetch,
    });

  const starts: Array<(event: RuntimeEvent) => void> = [];
  let started = false;

  async function start(onEvent: (event: RuntimeEvent) => void) {
    starts.push(onEvent);
    if (started) return;
    started = true;

    const response = await (options.fetch ?? globalThis.fetch)(
      new URL("/events", options.url),
      {
        headers: options.token
          ? { authorization: `Bearer ${options.token}` }
          : undefined,
        signal: (globalThis as { __NATALIA_ABORT?: AbortController }).__NATALIA_ABORT?.signal,
      },
    );
    if (!response.ok || !response.body) return;

    const decoder = new TextDecoder();
    let buffer = "";
    let current: RuntimeEvent | null = null;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            current = JSON.parse(line.slice(6)) as RuntimeEvent;
          } catch {
            current = null;
          }
        } else if (line === "" && current) {
          for (const listener of starts) listener(current);
          current = null;
        }
      }
    }
  }

  return {
    start,
    async submit(text) {
      return (await call("submit", { text })) as never;
    },
    async submitInput(input) {
      return (await call("submit.input", { ...(input as Record<string, unknown>) })) as never;
    },
    async chatSubmit(input) {
      return (await call("chat.submit", { ...(input as Record<string, unknown>) })) as { messageID: string };
    },
    async chatAbort() {
      return (await call("chat.abort")) as { aborted: boolean };
    },
    cancel(reason) {
      void call("cancel", { reason });
    },
    async modelCatalog() {
      return (await call<RuntimeModelCatalogEntry[]>("model.catalog")) as never;
    },
    async modelSelection() {
      return (await call<RuntimeModelSelection>("model.selection")) as never;
    },
    async selectModel(modelID, variant) {
      await call("model.select", { modelID, variant });
    },
    async reasoningEffort() {
      return (await call<RuntimeReasoningEffort>("model.reasoning")) as never;
    },
    async setReasoningEffort(effort) {
      await call("model.reasoning.set", { effort });
    },
    async chatModelProfile() {
      return (await call<ChatModelProfile>("chat.model.profile")) as never;
    },
    async setChatModelProfile(profile) {
      return (await call("chat.model.profile.set", { profile })) as never;
    },
    async checkpointList() {
      return (await call("checkpoint.list")) as never;
    },
    async checkpointRollback(input) {
      return (await call("checkpoint.rollback", { ...(input as Record<string, unknown>) })) as never;
    },
    snapshot() {
      void call("snapshot");
      return {
        type: "snapshot.created",
        id: "snap_web",
        files: [],
      } as never;
    },
    diagnostic(message, level) {
      void call("diagnostic", { message, level });
    },
    lastSubmission() {
      return undefined;
    },
    respondApproval(response: ApprovalResponse) {
      void call("approval", { ...response });
      return { accepted: true };
    },
    respondQuestion(response: QuestionResponse) {
      void call("question", { ...response });
      return { accepted: true };
    },
    async sessionList() {
      return (await call<RuntimeSessionSummary[]>("session.list")) as never;
    },
    async sessionNew(input) {
      return (await call("session.new", { ...(input as Record<string, unknown>) })) as never;
    },
    async sessionDuplicate(id, title) {
      return (await call("session.duplicate", { id, title })) as never;
    },
    async workspaceRoots() {
      return (await call<WorkspaceSummary[]>("workspace.roots")) as never;
    },
    async workspaceAdd(input) {
      return (await call<WorkspaceSummary>("workspace.add", { ...input })) as never;
    },
    async workspaceRemove(workspaceID) {
      return (await call("workspace.remove", { workspaceID })) as { removed: boolean };
    },
    async workspaceActivate(workspaceID) {
      return (await call<WorkspaceSummary>("workspace.activate", { workspaceID })) as never;
    },
    async workspacePermissionGet(workspaceID) {
      return (await call<WorkspacePermissionSettings>("workspace.permission.get", { workspaceID })) as never;
    },
    async workspacePermissionSet(workspaceID, settings) {
      return (await call<WorkspacePermissionSettings>("workspace.permission.set", { workspaceID, settings })) as never;
    },
    async workspaceToolGet(workspaceID) {
      return (await call<WorkspaceToolSettings>("workspace.tool.get", { workspaceID })) as never;
    },
    async workspaceToolSet(workspaceID, settings) {
      return (await call<WorkspaceToolSettings>("workspace.tool.set", { workspaceID, settings })) as never;
    },
    async workspaceSearch(input) {
      return (await call<RuntimeWorkspaceMatch[]>("workspace.search", { ...input })) as never;
    },
    async workspaceList(input) {
      return (await call<RuntimeWorkspaceListPage>("workspace.list", { ...input })) as never;
    },
    async workspaceRead(input) {
      return (await call<RuntimeWorkspaceContent>("workspace.read", { ...input })) as never;
    },
    async configGet() {
      return (await call<ConfigV3>("config.get")) as never;
    },
    async updateConfig(input) {
      return (await call("config.update", { ...input })) as never;
    },
    async mcpServerAdd(input) {
      return (await call("mcp.server.add", { ...input })) as never;
    },
    async mcpServerRemove(name) {
      return (await call("mcp.server.remove", { name })) as never;
    },
    async providerAdd(input) {
      return (await call("provider.add", { ...input })) as never;
    },
    async saveFlowDocument(input) {
      return (await call("flow.save", { ...(input as Record<string, unknown>) })) as never;
    },
    async deleteFlowDocument(input) {
      return (await call("flow.delete", { ...(input as Record<string, unknown>) })) as never;
    },
    async saveTaskDocument(input) {
      return (await call("task.save", { ...(input as Record<string, unknown>) })) as never;
    },
    async deleteTaskDocument(input) {
      return (await call("task.delete", { ...(input as Record<string, unknown>) })) as never;
    },
    async dispose() {},
  };
}
