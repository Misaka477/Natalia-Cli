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
    async chatSubmit(input) {
      return (await call("chat.submit", input)) as { messageID: string };
    },
    cancel(reason) {
      void call("cancel", reason);
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
    respondApproval(_response: ApprovalResponse) {
      return { accepted: true };
    },
    respondQuestion(_response: QuestionResponse) {
      return { accepted: true };
    },
    async dispose() {
      worker.terminate();
    },
  };
}
