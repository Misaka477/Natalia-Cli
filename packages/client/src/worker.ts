import { describeRuntimeCapabilities } from "@natalia/contracts";
import type {
  ApprovalResponse,
  QuestionResponse,
  RuntimeClient,
  RuntimeEvent,
  SubmitInput,
  SubmittedTurn,
} from "@natalia/contracts";

/**
 * The worker channel's route table, mirroring `handleWorkerRequest` below.
 * Same discipline as the RPC route table: reachability for the worker channel
 * is computed from this, and the channel's gaps (checkpoint, secure-input
 * control, MCP, work graph...) show up in the report instead of being silent.
 * A test asserts this table matches the handler dispatch.
 */
export const WORKER_ROUTE_MEMBERS = {
  submit: "submit",
  cancel: "cancel",
  pause: "pause",
  resume: "resume",
  "runtime.status": "runtimeStatus",
  "runtime.availability": null,
  "flow.save": "saveFlowDocument",
  "flow.delete": "deleteFlowDocument",
  "task.preview": "taskPermissionPreview",
  snapshot: "snapshot",
  diagnostic: "diagnostic",
  approval: "respondApproval",
  question: "respondQuestion",
  "interactive.pending": "pendingInteractive",
  "config.reload": "reloadConfig",
  "config.update": "updateConfig",
  dispose: "dispose",
  history: "history",
  diagnostics: "diagnostics",
  messages: "messages",
  agents: "agents",
  "model.catalog": "modelCatalog",
  "model.selection": "modelSelection",
  "model.select": "selectModel",
  skills: "skills",
  "workspace.files": "workspaceFiles",
  "workspace.search": "workspaceSearch",
  "workspace.list": "workspaceList",
  "workspace.read": "workspaceRead",
  "workspace.glob": "workspaceGlob",
  "mcp.catalog": "mcpCatalog",
  "mcp.prompt": "getMcpPrompt",
  "mcp.resource": "readMcpResource",
  "native-terminal.list": "nativeTerminalList",
  "native-terminal.read": "nativeTerminalRead",
  "native-terminal.open-hub": "nativeTerminalOpenHub",
  "native-terminal.release-human-control": "nativeTerminalReleaseHumanControl",
  "native-terminal.revoke-approval-scope": "nativeTerminalRevokeApprovalScope",
  "native-terminal.stop": "nativeTerminalStop",
  "native-terminal.begin-secure-input": "nativeTerminalBeginSecureInput",
  "native-terminal.end-secure-input": "nativeTerminalEndSecureInput",
  "checkpoint.list": "checkpointList",
  "checkpoint.preview": "checkpointPreview",
  "checkpoint.rollback": "checkpointRollback",
  "session.list": "sessionList",
  "session.touch": "sessionTouch",
  "session.rename": "sessionRename",
  "session.pin": "sessionPin",
  "session.duplicate": "sessionDuplicate",
  "session.delete": "sessionDelete",
} as const satisfies Readonly<Record<string, keyof RuntimeClient | null>>;

/** The member names this channel routes, for reachability reporting. */
export const WORKER_ROUTED_MEMBERS: ReadonlySet<string> = new Set(
  (Object.values(WORKER_ROUTE_MEMBERS) as Array<string | null>).filter(
    (member): member is string => typeof member === "string",
  ),
);

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
    | "config.update"
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
    | "mcp.catalog"
    | "mcp.prompt"
    | "mcp.resource"
    | "native-terminal.list"
    | "native-terminal.read"
    | "native-terminal.open-hub"
    | "native-terminal.release-human-control"
    | "native-terminal.revoke-approval-scope"
    | "native-terminal.stop"
    | "native-terminal.begin-secure-input"
    | "native-terminal.end-secure-input"
    | "checkpoint.list"
    | "checkpoint.preview"
    | "checkpoint.rollback"
    | "session.list"
    | "session.touch"
    | "session.rename"
    | "session.pin"
    | "session.duplicate"
    | "session.delete"
    | "runtime.availability"
    | "flow.save"
    | "flow.delete"
    | "task.preview";
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

export type WorkerRuntimeClient = RuntimeClient & {
  availability(): Promise<import("@natalia/contracts").RuntimeCapabilityReport>;
};

export function createWorkerRuntimeClient(
  port: RuntimeWorkerPort,
): WorkerRuntimeClient {
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
    /** What this channel can reach: the worker route table intersected with the runtime. */
    async availability() {
      return (await request("runtime.availability")) as Awaited<
        ReturnType<typeof describeRuntimeCapabilities>
      >;
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
    async mcpCatalog() {
      return (await request("mcp.catalog")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["mcpCatalog"]>>
      >;
    },
    async getMcpPrompt(server, name, arguments_) {
      return (await request("mcp.prompt", {
        server,
        name,
        arguments_,
      })) as Awaited<ReturnType<NonNullable<RuntimeClient["getMcpPrompt"]>>>;
    },
    async readMcpResource(server, uri) {
      return (await request("mcp.resource", { server, uri })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["readMcpResource"]>>
      >;
    },
    async saveFlowDocument(input) {
      return (await request("flow.save", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["saveFlowDocument"]>>
      >;
    },
    async deleteFlowDocument(input) {
      return (await request("flow.delete", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["deleteFlowDocument"]>>
      >;
    },
    async taskPermissionPreview(input) {
      return (await request("task.preview", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["taskPermissionPreview"]>>
      >;
    },
    async updateConfig(input) {
      return (await request("config.update", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["updateConfig"]>>
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
    async nativeTerminalBeginSecureInput(id) {
      return (await request(
        "native-terminal.begin-secure-input",
        id,
      )) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalBeginSecureInput"]>>
      >;
    },
    async nativeTerminalEndSecureInput(id) {
      return (await request("native-terminal.end-secure-input", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalEndSecureInput"]>>
      >;
    },
    async checkpointList() {
      return (await request("checkpoint.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["checkpointList"]>>
      >;
    },
    async checkpointPreview(id) {
      return (await request("checkpoint.preview", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["checkpointPreview"]>>
      >;
    },
    async checkpointRollback(input) {
      return (await request("checkpoint.rollback", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["checkpointRollback"]>>
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
    // A round trip rather than a notification: these answer whether the runtime
    // actually paused, and a channel that cannot see the answer would have to
    // make one up.
    async pause(reason) {
      return (await request("pause", reason)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["pause"]>>
      >;
    },
    async resume() {
      return (await request("resume")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["resume"]>>
      >;
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
    async respondApproval(response) {
      return (await request("approval", response)) as Awaited<
        ReturnType<RuntimeClient["respondApproval"]>
      >;
    },
    async respondQuestion(response) {
      return (await request("question", response)) as Awaited<
        ReturnType<RuntimeClient["respondQuestion"]>
      >;
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
      } else if (request.method === "config.update") {
        // The write-apply path, unlike the rebuild path above: the patch lands
        // on disk and the runtime applies it in place.
        value = await activeClient.updateConfig?.(
          request.value as {
            patch: Record<string, unknown>;
            scope?: "project" | "global";
          },
        );
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

export async function handleWorkerRequest(
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
  if (request.method === "mcp.catalog") return await client.mcpCatalog?.();
  if (request.method === "mcp.prompt")
    return await client.getMcpPrompt?.(
      (request.value as { server: string }).server,
      (request.value as { name: string }).name,
      (request.value as { arguments_?: Record<string, string> }).arguments_,
    );
  if (request.method === "mcp.resource")
    return await client.readMcpResource?.(
      (request.value as { server: string }).server,
      (request.value as { uri: string }).uri,
    );
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
  if (request.method === "native-terminal.begin-secure-input")
    return await client.nativeTerminalBeginSecureInput?.(
      request.value as string,
    );
  if (request.method === "native-terminal.end-secure-input")
    return await client.nativeTerminalEndSecureInput?.(request.value as string);
  if (request.method === "checkpoint.list")
    return await client.checkpointList?.();
  if (request.method === "checkpoint.preview")
    return await client.checkpointPreview?.(request.value as string);
  if (request.method === "checkpoint.rollback")
    return await client.checkpointRollback?.(
      request.value as { id: string; dryRun?: boolean },
    );
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
  if (request.method === "question")
    return client.respondQuestion(request.value as QuestionResponse);
  if (request.method === "runtime.availability")
    return describeRuntimeCapabilities(client, {
      name: "worker",
      routedMembers: WORKER_ROUTED_MEMBERS,
    });
  if (request.method === "flow.save")
    return await client.saveFlowDocument?.(
      request.value as {
        path?: string;
        document: import("@natalia/contracts").NataliaFlowDocumentInput;
      },
    );
  if (request.method === "flow.delete")
    return await client.deleteFlowDocument?.(request.value as { path: string });
  if (request.method === "task.preview")
    return await client.taskPermissionPreview?.(
      request.value as { path: string },
    );
  throw new Error(`worker channel does not route ${request.method}`);
}
