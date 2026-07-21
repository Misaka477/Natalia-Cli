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
    | "snapshot"
    | "approval"
    | "question"
    | "interactive.pending"
    | "dispose";
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
    cancel(reason) {
      void request("cancel", reason);
    },
    pause(reason) {
      void request("pause", reason);
    },
    resume() {
      void request("resume");
    },
    snapshot() {
      const id = `snap_worker_${Date.now().toString(36)}`;
      void request("snapshot");
      return { type: "snapshot.created", id, files: [] };
    },
    diagnostic() {},
    lastSubmission() {
      return undefined;
    },
    respondApproval(response) {
      void request("approval", response);
    },
    respondQuestion(response) {
      void request("question", response);
    },
  };
}

export function attachRuntimeClientWorker(
  port: RuntimeWorkerPort,
  client: RuntimeClient,
) {
  client.start((event) => {
    port.postMessage({ type: "runtime.event", event } satisfies WorkerEvent);
  });
  port.addEventListener("message", async (event: MessageEvent<unknown>) => {
    const request = event.data as WorkerRequest;
    if (request.type !== "runtime.request") return;
    try {
      const value = await handleWorkerRequest(client, request);
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
  if (request.method === "approval")
    return client.respondApproval(request.value as ApprovalResponse);
  return client.respondQuestion(request.value as QuestionResponse);
}
