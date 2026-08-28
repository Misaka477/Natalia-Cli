import { createWebFixtureRuntime } from "./runtime-fixture";

const runtime = createWebFixtureRuntime();
runtime.start((event) => {
  postMessage({ type: "runtime.event", event });
});

type WorkerRequest = {
  type: "runtime.request";
  id: string;
  method: string;
  value?: unknown;
};

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message?.type !== "runtime.request") return;
  void handle(message);
});

async function handle(request: WorkerRequest) {
  try {
    const value = await dispatch(request.method, request.value);
    postMessage({ type: "runtime.response", id: request.id, value });
  } catch (error) {
    postMessage({
      type: "runtime.response",
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function dispatch(method: string, value: unknown) {
  if (method === "submit") return runtime.submit(String(value ?? ""));
  if (method === "submit.input") return runtime.submitInput?.(value as never);
  if (method === "chat.submit")
    return runtime.chatSubmit?.(value as { text: string });
  if (method === "chat.abort") return runtime.chatAbort?.();
  if (method === "cancel") {
    runtime.cancel(typeof value === "string" ? value : undefined);
    return;
  }
  if (method === "model.catalog") return runtime.modelCatalog?.();
  if (method === "model.selection") return runtime.modelSelection?.();
  if (method === "model.select") {
    const input = (value ?? {}) as { modelID?: string; variant?: string };
    return runtime.selectModel?.(input.modelID, input.variant);
  }
  if (method === "model.reasoning") return runtime.reasoningEffort?.();
  if (method === "model.reasoning.set")
    return runtime.setReasoningEffort?.(value as never);
  if (method === "chat.model.profile") return runtime.chatModelProfile?.();
  if (method === "chat.model.profile.set")
    return runtime.setChatModelProfile?.(value as never);
  if (method === "checkpoint.list") return runtime.checkpointList?.();
  if (method === "checkpoint.rollback")
    return runtime.checkpointRollback?.(value as never);
  if (method === "approval") return runtime.respondApproval(value as never);
  if (method === "question") return runtime.respondQuestion(value as never);
  if (method === "session.list") return runtime.sessionList?.();
  if (method === "session.new") return runtime.sessionNew?.(value as never);
  if (method === "session.duplicate") return runtime.sessionDuplicate?.(value as never);
  if (method === "workspace.search") return runtime.workspaceSearch?.(value as never);
  if (method === "workspace.list") return runtime.workspaceList?.(value as never);
  if (method === "workspace.read") return runtime.workspaceRead?.(value as never);
  if (method === "config.get") return runtime.configGet?.();
  if (method === "config.update") return runtime.updateConfig?.(value as never);
  if (method === "mcp.server.add") return runtime.mcpServerAdd?.(value as never);
  if (method === "mcp.server.remove") return runtime.mcpServerRemove?.(value as never);
  if (method === "flow.save") return runtime.saveFlowDocument?.(value as never);
  if (method === "provider.add") return runtime.providerAdd?.(value as never);
  if (method === "flow.delete") return runtime.deleteFlowDocument?.(value as never);
  if (method === "task.save") return runtime.saveTaskDocument?.(value as never);
  if (method === "task.delete") return runtime.deleteTaskDocument?.(value as never);
  if (method === "plugin.install") {
    const input = (value ?? {}) as { spec?: string };
    return (runtime as typeof runtime & {
      pluginInstall(input: { spec: string }): Promise<unknown>;
    }).pluginInstall?.({ spec: String(input.spec ?? "") });
  }
  if (method === "plugin.uninstall") {
    return (runtime as typeof runtime & {
      pluginUninstall(pluginID: string): Promise<unknown>;
    }).pluginUninstall?.(String(value ?? ""));
  }
  if (method === "snapshot") return runtime.snapshot();
  if (method === "diagnostic") {
    const input = (value ?? {}) as { message?: unknown; level?: unknown };
    runtime.diagnostic(
      typeof input.message === "string" ? input.message : "runtime diagnostic",
      input.level === "info" || input.level === "error"
        ? input.level
        : "warning",
    );
    return;
  }
  throw new Error(`worker channel does not route ${method}`);
}
