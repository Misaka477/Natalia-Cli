import type {
  ApprovalResponse,
  QuestionResponse,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";

export type NataliaSDKOptions = {
  baseURL: string;
  token?: string;
  fetch?: typeof fetch;
};

export type NataliaSDK = {
  prompt(
    text: string,
    options?: { delivery?: "steer" | "queue"; attachments?: string[] },
  ): Promise<SubmittedTurn>;
  cancel(reason?: string): Promise<void>;
  pause(reason?: string): Promise<void>;
  resume(): Promise<void>;
  selectAgent(name?: string): Promise<void>;
  respondApproval(response: ApprovalResponse): Promise<void>;
  respondQuestion(response: QuestionResponse): Promise<void>;
  pendingInteractive(): Promise<{
    approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>;
    questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>;
  }>;
  checkpoint(): Promise<SubmittedTurn>;
  checkpoints(limit?: number): Promise<SubmittedTurn>;
  rollback(
    checkpointID: string,
    options?: { dryRun?: boolean },
  ): Promise<SubmittedTurn>;
  snapshot(): Promise<RuntimeEvent>;
  history(options?: { after?: number; limit?: number }): Promise<{
    events: Array<{ seq: number; event: RuntimeEvent }>;
    hasMore: boolean;
  }>;
  mcpCatalog(): Promise<import("@natalia/contracts").MCPCatalogSnapshot>;
  mcpPrompt(
    server: string,
    name: string,
    arguments_?: Record<string, string>,
  ): Promise<unknown>;
  mcpResource(server: string, uri: string): Promise<unknown>;
  plugins(): Promise<import("@natalia/contracts").PluginStatus[]>;
  runtimeStatus(): Promise<import("@natalia/contracts").RuntimeStatusSnapshot>;
  diagnostics(
    limit?: number,
  ): Promise<import("@natalia/contracts").RuntimeDiagnostic[]>;
  health(): Promise<{ ok: boolean }>;
  events(options?: {
    since?: number;
    signal?: AbortSignal;
  }): AsyncIterable<RuntimeEvent>;
};

export function createNataliaSDK(options: NataliaSDKOptions): NataliaSDK {
  const baseURL = options.baseURL.replace(/\/+$/u, "");
  const fetchImpl = options.fetch ?? fetch;
  let nextID = 1;
  async function call<T>(method: string, params: Record<string, unknown>) {
    const response = await fetchImpl(`${baseURL}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextID++, method, params }),
    });
    const body = (await response.json()) as {
      result?: T;
      error?: { message: string };
    };
    if (!response.ok || body.error)
      throw new Error(
        body.error?.message ?? `SDK request failed: ${response.status}`,
      );
    return body.result as T;
  }
  return {
    prompt: async (text, promptOptions = {}) =>
      await call<SubmittedTurn>("prompt", { text, ...promptOptions }),
    cancel: async (reason) => {
      await call("cancel", reason ? { reason } : {});
    },
    pause: async (reason) => {
      await call("pause", reason ? { reason } : {});
    },
    resume: async () => {
      await call("resume", {});
    },
    selectAgent: async (name) => {
      await call("agent.select", name === undefined ? {} : { name });
    },
    respondApproval: async (response) => {
      await call(
        "approval.respond",
        response as unknown as Record<string, unknown>,
      );
    },
    respondQuestion: async (response) => {
      await call(
        "question.respond",
        response as unknown as Record<string, unknown>,
      );
    },
    pendingInteractive: async () => await call("interactive.pending", {}),
    checkpoint: async () =>
      await call<SubmittedTurn>("prompt", { text: "/checkpoint" }),
    checkpoints: async (limit) =>
      await call<SubmittedTurn>("prompt", {
        text: limit ? `/checkpoints --limit ${limit}` : "/checkpoints",
      }),
    rollback: async (checkpointID, rollbackOptions = {}) =>
      await call<SubmittedTurn>("prompt", {
        text: `/rollback ${checkpointID}${rollbackOptions.dryRun ? " --dry-run" : ""}`,
      }),
    snapshot: async () => await call<RuntimeEvent>("snapshot", {}),
    history: async (historyOptions = {}) =>
      await call("session.history", historyOptions),
    mcpCatalog: async () => await call("mcp.catalog", {}),
    mcpPrompt: async (server, name, arguments_ = {}) =>
      await call("mcp.prompt", { server, name, arguments: arguments_ }),
    mcpResource: async (server, uri) =>
      await call("mcp.resource", { server, uri }),
    plugins: async () => await call("plugin.list", {}),
    runtimeStatus: async () => await call("runtime.status", {}),
    diagnostics: async (limit) =>
      await call("diagnostics.list", limit === undefined ? {} : { limit }),
    health: async () => {
      const response = await fetchImpl(`${baseURL}/healthz`);
      if (!response.ok) throw new Error(`health failed: ${response.status}`);
      return (await response.json()) as { ok: boolean };
    },
    events: (eventOptions = {}) =>
      eventStream({
        baseURL,
        fetchImpl,
        token: options.token,
        ...eventOptions,
      }),
  };
}

async function* eventStream(input: {
  baseURL: string;
  fetchImpl: typeof fetch;
  token?: string;
  since?: number;
  signal?: AbortSignal;
}): AsyncIterable<RuntimeEvent> {
  const response = await input.fetchImpl(
    `${input.baseURL}/events${input.since ? `?since=${input.since}` : ""}`,
    {
      headers: input.token ? { authorization: `Bearer ${input.token}` } : {},
      signal: input.signal,
    },
  );
  if (!response.ok) throw new Error(`events failed: ${response.status}`);
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const event = parseRuntimeEvent(part);
      if (event) yield event;
    }
  }
}

function parseRuntimeEvent(part: string) {
  for (const line of part.split("\n")) {
    if (!line.startsWith("data:")) continue;
    return JSON.parse(line.slice("data:".length).trim()) as RuntimeEvent;
  }
  return undefined;
}
