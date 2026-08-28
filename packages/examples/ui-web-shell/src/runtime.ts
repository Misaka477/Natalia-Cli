import type {
  ApprovalResponse,
  QuestionResponse,
  RuntimeClient,
  RuntimeEvent,
} from "@natalia/contracts";

type WorkerResponse =
  | { type: "runtime.event"; event: RuntimeEvent }
  | { type: "runtime.response"; id: string; value?: unknown; error?: string };

/**
 * Browser RuntimeClient over a dedicated worker. The host never constructs
 * the fixture; it only speaks the worker port.
 */
export function createWebWorkerRuntime(): RuntimeClient {
  const worker = new Worker(new URL("./runtime-worker.ts", import.meta.url), {
    type: "module",
  });
  const pending = new Map<
    string,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  let sequence = 0;
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const buffered: RuntimeEvent[] = [];

  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.type === "runtime.event") {
      if (sink) sink(message.event);
      else buffered.push(message.event);
      return;
    }
    if (message.type !== "runtime.response") return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error));
    else request.resolve(message.value);
  });

  const call = (method: string, value?: unknown) =>
    new Promise<unknown>((resolve, reject) => {
      const id = `req_${(sequence += 1)}`;
      pending.set(id, { resolve, reject });
      worker.postMessage({ type: "runtime.request", id, method, value });
    });

  return {
    start(onEvent) {
      sink = onEvent;
      for (const event of buffered.splice(0)) onEvent(event);
    },
    async submit(text) {
      return (await call("submit", text)) as Awaited<
        ReturnType<RuntimeClient["submit"]>
      >;
    },
    async submitInput(input) {
      return (await call("submit.input", input)) as Awaited<
        ReturnType<RuntimeClient["submit"]>
      >;
    },
    async chatSubmit(input) {
      return (await call("chat.submit", input)) as { messageID: string };
    },
    async chatAbort() {
      return (await call("chat.abort")) as { aborted: boolean };
    },
    cancel(reason) {
      void call("cancel", reason);
    },
    async modelCatalog() {
      return (await call("model.catalog")) as never;
    },
    async modelSelection() {
      return (await call("model.selection")) as never;
    },
    async selectModel(modelID, variant) {
      await call("model.select", { modelID, variant });
    },
    async reasoningEffort() {
      return (await call("model.reasoning")) as never;
    },
    async setReasoningEffort(effort) {
      await call("model.reasoning.set", effort);
    },
    async chatModelProfile() {
      return (await call("chat.model.profile")) as never;
    },
    async setChatModelProfile(profile) {
      return (await call("chat.model.profile.set", profile)) as never;
    },
    async checkpointList() {
      return (await call("checkpoint.list")) as never;
    },
    async checkpointRollback(input) {
      return (await call("checkpoint.rollback", input)) as never;
    },
    snapshot() {
      void call("snapshot");
      return {
        type: "snapshot.created",
        id: "snap_web",
        files: [],
      };
    },
    diagnostic(message, level) {
      void call("diagnostic", { message, level });
    },
    lastSubmission() {
      return undefined;
    },
    respondApproval(response: ApprovalResponse) {
      void call("approval", response);
      return { accepted: true };
    },
    respondQuestion(response: QuestionResponse) {
      void call("question", response);
      return { accepted: true };
    },
    async sessionList() {
      return (await call("session.list")) as never;
    },
    async sessionNew(input) {
      return (await call("session.new", input)) as never;
    },
    async sessionDuplicate(id, title) {
      return (await call("session.duplicate", { id, title })) as never;
    },
    async workspaceSearch(input) {
      return (await call("workspace.search", input)) as never;
    },
    async workspaceList(input) {
      return (await call("workspace.list", input)) as never;
    },
    async workspaceRead(input) {
      return (await call("workspace.read", input)) as never;
    },
    async configGet() {
      return (await call("config.get")) as never;
    },
    async updateConfig(input) {
      return (await call("config.update", input)) as never;
    },
    async mcpServerAdd(input) {
      return (await call("mcp.server.add", input)) as never;
    },
    async mcpServerRemove(name) {
      return (await call("mcp.server.remove", name)) as never;
    },
    async saveFlowDocument(input) {
      return (await call("flow.save", input)) as never;
    },
    async deleteFlowDocument(input) {
      return (await call("flow.delete", input)) as never;
    },
    async dispose() {
      worker.terminate();
    },
  };
}
