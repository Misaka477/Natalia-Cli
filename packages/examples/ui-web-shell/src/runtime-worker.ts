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
  if (method === "chat.submit") {
    const text =
      typeof value === "object" && value && "text" in value
        ? String((value as { text: unknown }).text)
        : String(value ?? "");
    return runtime.chatSubmit?.({ text });
  }
  if (method === "cancel") {
    runtime.cancel(typeof value === "string" ? value : undefined);
    return;
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
