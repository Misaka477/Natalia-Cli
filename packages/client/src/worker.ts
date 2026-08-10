import type {
  ApprovalResponse,
  QuestionResponse,
  RuntimeClient,
  RuntimeEvent,
  SubmitInput,
  SubmittedTurn,
} from "@natalia/contracts";

type WorkerRequest = {
  type: "runtime.request";
  id: string;
  method:
    | "submit"
    | "cancel"
    | "pause"
    | "resume"
    | "runtime.status"
    | "snapshot"
    | "diagnostic"
    | "approval"
    | "question"
    | "interactive.pending"
    | "config.reload"
    | "dispose"
    | "history"
    | "diagnostics"
    | "messages"
    | "agents"
    | "model.catalog"
    | "model.selection"
    | "model.select"
    | "skills"
    | "workspace.files"
    | "workspace.search"
    | "workspace.list"
    | "workspace.read"
    | "workspace.glob"
    | "terminal.list"
    | "terminal.read"
    | "terminal.write"
    | "terminal.key"
    | "terminal.resize"
    | "terminal.attach"
    | "terminal.detach"
    | "terminal.stop"
    | "native-terminal.list"
    | "native-terminal.read"
    | "native-terminal.open-hub"
    | "native-terminal.release-human-control"
    | "native-terminal.revoke-approval-scope"
    | "native-terminal.stop"
    | "session.list"
    | "session.touch"
    | "session.rename"
    | "session.pin"
    | "session.duplicate"
    | "session.delete";
  value?: unknown;
};

type WorkerResponse = {
  type: "runtime.response";
  id: string;
  value?: unknown;
  error?: string;
};

type WorkerEvent = { type: "runtime.event"; event: RuntimeEvent };

export type RuntimeWorkerPort = {
  postMessage(value: unknown): void;
  addEventListener(
    type: "message",
    handler: (event: MessageEvent<unknown>) => void,
  ): void;
  removeEventListener(
    type: "message",
    handler: (event: MessageEvent<unknown>) => void,
  ): void;
};

export function createWorkerRuntimeClient(
  port: RuntimeWorkerPort,
): RuntimeClient {
  const pending = new Map<
    string,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  let sequence = 0;
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const onMessage = (event: MessageEvent<unknown>) => {
    const message = event.data as WorkerResponse | WorkerEvent;
    if (message.type === "runtime.event") {
      sink?.(message.event);
      return;
    }
    if (message.type !== "runtime.response") return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error));
    else request.resolve(message.value);
  };
  port.addEventListener("message", onMessage);
  /**
   * Notifications have no caller waiting on them, so a rejected worker request
   * would become an unhandled rejection and take down the host process. The
   * runtime already reports its own problems through the event stream, so a
   * failed notification is reported the same way instead of crashing.
   */
  const notify = (method: WorkerRequest["method"], value?: unknown) => {
    void request(method, value).catch((error: unknown) => {
      sink?.({
        type: "diagnostic",
        level: "warning",
        message: `runtime ${method} failed: ${error instanceof Error ? error.message : String(error)}`,
        at: new Date().toISOString(),
      });
    });
  };
  const request = (method: WorkerRequest["method"], value?: unknown) => {
    const id = `wrk_${(++sequence).toString(36)}`;
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      port.postMessage({
        type: "runtime.request",
        id,
        method,
        value,
      } satisfies WorkerRequest);
    });
  };
  return {
    start(onEvent) {
      sink = onEvent;
    },
    async submit(text) {
      return (await request("submit", { text })) as SubmittedTurn;
    },
    async submitInput(input) {
      return (await request("submit", input)) as SubmittedTurn;
    },
    async pendingInteractive() {
      return (await request("interactive.pending")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["pendingInteractive"]>>
      >;
    },
    async reloadConfig() {
      return (await request("config.reload")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["reloadConfig"]>>
      >;
    },
    async runtimeStatus() {
      return (await request("runtime.status")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["runtimeStatus"]>>
      >;
    },
    async history(options) {
      return (await request("history", options)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["history"]>>
      >;
    },
    async messages(options) {
      return (await request("messages", options)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["messages"]>>
      >;
    },
    async agents() {
      return (await request("agents")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["agents"]>>
      >;
    },
    async modelCatalog() {
      return (await request("model.catalog")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["modelCatalog"]>>
      >;
    },
    async modelSelection() {
      return (await request("model.selection")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["modelSelection"]>>
      >;
    },
    async selectModel(modelID, variant) {
      await request("model.select", { modelID, variant });
    },
    async skills() {
      return (await request("skills")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["skills"]>>
      >;
    },
    async workspaceFiles(input) {
      return (await request("workspace.files", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["workspaceFiles"]>>
      >;
    },
    async workspaceSearch(input) {
      return (await request("workspace.search", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["workspaceSearch"]>>
      >;
    },
    async workspaceList(input) {
      return (await request("workspace.list", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["workspaceList"]>>
      >;
    },
    async workspaceRead(input) {
      return (await request("workspace.read", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["workspaceRead"]>>
      >;
    },
    async workspaceGlob(input) {
      return (await request("workspace.glob", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["workspaceGlob"]>>
      >;
    },
    async terminalList() {
      return (await request("terminal.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["terminalList"]>>
      >;
    },
    async terminalRead(input) {
      return (await request("terminal.read", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["terminalRead"]>>
      >;
    },
    async terminalWrite(input) {
      return (await request("terminal.write", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["terminalWrite"]>>
      >;
    },
    async terminalKey(input) {
      return (await request("terminal.key", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["terminalKey"]>>
      >;
    },
    async terminalResize(input) {
      return (await request("terminal.resize", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["terminalResize"]>>
      >;
    },
    async terminalAttach(id) {
      return (await request("terminal.attach", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["terminalAttach"]>>
      >;
    },
    async terminalDetach(id) {
      return (await request("terminal.detach", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["terminalDetach"]>>
      >;
    },
    async terminalStop(id) {
      return (await request("terminal.stop", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["terminalStop"]>>
      >;
    },
    async nativeTerminalList() {
      return (await request("native-terminal.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalList"]>>
      >;
    },
    async nativeTerminalRead(id) {
      return (await request("native-terminal.read", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalRead"]>>
      >;
    },
    async nativeTerminalOpenHub() {
      return (await request("native-terminal.open-hub")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalOpenHub"]>>
      >;
    },
    async nativeTerminalReleaseHumanControl(id) {
      return (await request(
        "native-terminal.release-human-control",
        id,
      )) as Awaited<
        ReturnType<
          NonNullable<RuntimeClient["nativeTerminalReleaseHumanControl"]>
        >
      >;
    },
    async nativeTerminalRevokeApprovalScope(id) {
      return (await request(
        "native-terminal.revoke-approval-scope",
        id,
      )) as Awaited<
        ReturnType<
          NonNullable<RuntimeClient["nativeTerminalRevokeApprovalScope"]>
        >
      >;
    },
    async nativeTerminalStop(id) {
      return (await request("native-terminal.stop", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalStop"]>>
      >;
    },
    async sessionList() {
      return (await request("session.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sessionList"]>>
      >;
    },
    async sessionTouch(id) {
      await request("session.touch", id);
    },
    async sessionRename(id, title) {
      return (await request("session.rename", { id, title })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sessionRename"]>>
      >;
    },
    async sessionPin(id, pinned) {
      return (await request("session.pin", { id, pinned })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sessionPin"]>>
      >;
    },
    async sessionDuplicate(id, title) {
      return (await request("session.duplicate", { id, title })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sessionDuplicate"]>>
      >;
    },
    async sessionDelete(id) {
      return (await request("session.delete", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sessionDelete"]>>
      >;
    },
    async dispose() {
      await request("dispose");
      port.removeEventListener("message", onMessage);
    },
    cancel(reason) {
      notify("cancel", reason);
    },
    pause(reason) {
      notify("pause", reason);
    },
    resume() {
      notify("resume");
    },
    snapshot() {
      const id = `snap_worker_${Date.now().toString(36)}`;
      notify("snapshot");
      return { type: "snapshot.created", id, files: [] };
    },
    async diagnostics(limit) {
      return (await request("diagnostics", limit)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["diagnostics"]>>
      >;
    },
    diagnostic(message, level) {
      notify("diagnostic", { message, level });
    },
    lastSubmission() {
      return undefined;
    },
    respondApproval(response) {
      notify("approval", response);
    },
    respondQuestion(response) {
      notify("question", response);
    },
  };
}

export function attachRuntimeClientWorker(
  port: RuntimeWorkerPort,
  client: RuntimeClient,
  options?: { reload?: () => RuntimeClient },
) {
  let activeClient = client;
  const forwardEvent = (event: RuntimeEvent) => {
    port.postMessage({ type: "runtime.event", event } satisfies WorkerEvent);
  };
  activeClient.start(forwardEvent);
  port.addEventListener("message", async (event: MessageEvent<unknown>) => {
    const request = event.data as WorkerRequest;
    if (request.type !== "runtime.request") return;
    try {
      let value: unknown;
      if (request.method === "config.reload") {
        // Reload in this channel means rebuilding the runtime, so a refusal is
        // reported rather than thrown: being told "not now, a turn is running" is
        // an ordinary answer, and an exception would make callers treat it as a
        // transport failure.
        const rebuild = options?.reload;
        const precheck = rebuild
          ? await activeClient.canReloadConfig?.()
          : undefined;
        const blocked = !rebuild
          ? "this runtime host cannot rebuild the runtime"
          : precheck && !precheck.allowed
            ? (precheck.reason ?? "runtime config cannot be applied now")
            : undefined;
        if (blocked || !rebuild) {
          value = { applied: false, reason: blocked };
        } else {
          await activeClient.dispose?.();
          activeClient = rebuild();
          activeClient.start(forwardEvent, { replay: "none" });
          await activeClient.runtimeStatus?.();
          value = { applied: true };
        }
      } else {
        value = await handleWorkerRequest(activeClient, request);
      }
      port.postMessage({
        type: "runtime.response",
        id: request.id,
        value,
      } satisfies WorkerResponse);
    } catch (error) {
      port.postMessage({
        type: "runtime.response",
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies WorkerResponse);
    }
  });
}

async function handleWorkerRequest(
  client: RuntimeClient,
  request: WorkerRequest,
) {
  if (request.method === "submit") {
    const input =
      request.value && typeof request.value === "object"
        ? (request.value as SubmitInput)
        : { text: String(request.value ?? "") };
    return client.submitInput
      ? await client.submitInput(input)
      : await client.submit(input.text);
  }
  if (request.method === "interactive.pending") {
    if (!client.pendingInteractive)
      throw new Error("RuntimeClient does not support interactive.pending");
    return await client.pendingInteractive();
  }
  if (request.method === "runtime.status")
    return await client.runtimeStatus?.();
  if (request.method === "history") return await client.history?.();
  if (request.method === "messages")
    return await client.messages?.(request.value as never);
  if (request.method === "agents") return await client.agents?.();
  if (request.method === "model.catalog") return await client.modelCatalog?.();
  if (request.method === "model.selection")
    return await client.modelSelection?.();
  if (request.method === "model.select") {
    const input = request.value as { modelID?: string; variant?: string };
    return await client.selectModel?.(input.modelID, input.variant);
  }
  if (request.method === "skills") return await client.skills?.();
  if (request.method === "workspace.files")
    return await client.workspaceFiles?.(request.value as never);
  if (request.method === "workspace.search")
    return await client.workspaceSearch?.(request.value as never);
  if (request.method === "workspace.list")
    return await client.workspaceList?.(request.value as never);
  if (request.method === "workspace.read")
    return await client.workspaceRead?.(request.value as never);
  if (request.method === "workspace.glob")
    return await client.workspaceGlob?.(request.value as never);
  if (request.method === "terminal.list") return await client.terminalList?.();
  if (request.method === "terminal.read")
    return await client.terminalRead?.(request.value as never);
  if (request.method === "terminal.write")
    return await client.terminalWrite?.(request.value as never);
  if (request.method === "terminal.key")
    return await client.terminalKey?.(request.value as never);
  if (request.method === "terminal.resize")
    return await client.terminalResize?.(request.value as never);
  if (request.method === "terminal.attach")
    return await client.terminalAttach?.(request.value as string);
  if (request.method === "terminal.detach")
    return await client.terminalDetach?.(request.value as string);
  if (request.method === "terminal.stop")
    return await client.terminalStop?.(request.value as string);
  if (request.method === "native-terminal.list")
    return await client.nativeTerminalList?.();
  if (request.method === "native-terminal.read")
    return await client.nativeTerminalRead?.(request.value as string);
  if (request.method === "native-terminal.open-hub")
    return await client.nativeTerminalOpenHub?.();
  if (request.method === "native-terminal.release-human-control")
    return await client.nativeTerminalReleaseHumanControl?.(
      request.value as string,
    );
  if (request.method === "diagnostics")
    return await client.diagnostics?.(request.value as number | undefined);
  if (request.method === "native-terminal.revoke-approval-scope")
    return await client.nativeTerminalRevokeApprovalScope?.(
      request.value as string,
    );
  if (request.method === "native-terminal.stop")
    return await client.nativeTerminalStop?.(request.value as string);
  if (request.method === "cancel")
    return client.cancel(
      typeof request.value === "string" ? request.value : undefined,
    );
  if (request.method === "pause")
    return client.pause?.(
      typeof request.value === "string" ? request.value : undefined,
    );
  if (request.method === "resume") return client.resume?.();
  if (request.method === "snapshot") return client.snapshot();
  if (request.method === "diagnostic") {
    const input = request.value as { message?: unknown; level?: unknown };
    return client.diagnostic(
      typeof input.message === "string" ? input.message : "runtime diagnostic",
      input.level === "info" || input.level === "error"
        ? input.level
        : "warning",
    );
  }
  if (request.method === "dispose") return await client.dispose?.();
  if (request.method === "session.list") return await client.sessionList?.();
  if (request.method === "session.touch")
    return await client.sessionTouch?.(request.value as string);
  if (request.method === "session.rename") {
    const input = request.value as { id: string; title: string };
    return await client.sessionRename?.(input.id, input.title);
  }
  if (request.method === "session.pin") {
    const input = request.value as { id: string; pinned: boolean };
    return await client.sessionPin?.(input.id, input.pinned);
  }
  if (request.method === "session.duplicate") {
    const input = request.value as { id: string; title?: string };
    return await client.sessionDuplicate?.(input.id, input.title);
  }
  if (request.method === "session.delete")
    return await client.sessionDelete?.(request.value as string);
  if (request.method === "approval")
    return client.respondApproval(request.value as ApprovalResponse);
  return client.respondQuestion(request.value as QuestionResponse);
}
