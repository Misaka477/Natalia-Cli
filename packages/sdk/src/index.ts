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
    options?: {
      delivery?: "steer" | "queue";
      attachments?: string[];
      resources?: import("@natalia/contracts").PromptResourceMention[];
      agents?: import("@natalia/contracts").PromptAgentMention[];
    },
  ): Promise<SubmittedTurn>;
  cancel(reason?: string): Promise<void>;
  pause(reason?: string): Promise<void>;
  resume(): Promise<void>;
  selectAgent(name?: string): Promise<void>;
  agents(): Promise<import("@natalia/contracts").RuntimeAgentCatalogEntry[]>;
  modelCatalog(): Promise<
    import("@natalia/contracts").RuntimeModelCatalogEntry[]
  >;
  modelSelection(): Promise<import("@natalia/contracts").RuntimeModelSelection>;
  selectModel(modelID?: string, variant?: string): Promise<void>;
  skills(): Promise<import("@natalia/contracts").RuntimeSkillCatalogEntry[]>;
  workspaceFiles(input?: {
    query?: string;
    type?: "file" | "directory";
    limit?: number;
  }): Promise<import("@natalia/contracts").RuntimeWorkspaceFileEntry[]>;
  workspaceSearch(input: {
    query: string;
    include?: string;
    limit?: number;
  }): Promise<import("@natalia/contracts").RuntimeWorkspaceMatch[]>;
  workspaceList(input?: {
    path?: string;
    offset?: number;
    limit?: number;
  }): Promise<import("@natalia/contracts").RuntimeWorkspaceListPage>;
  workspaceRead(input: {
    path: string;
    offset?: number;
    limit?: number;
  }): Promise<import("@natalia/contracts").RuntimeWorkspaceContent>;
  workspaceGlob(input: {
    pattern: string;
    path?: string;
    limit?: number;
  }): Promise<import("@natalia/contracts").RuntimeWorkspaceFileEntry[]>;
  ptySessions(): Promise<import("@natalia/contracts").RuntimePTYSession[]>;
  ptyRead(input: { id: string; offset?: number; maxChars?: number }): Promise<
    import("@natalia/contracts").RuntimePTYSession & {
      offset: number;
      nextOffset: number;
      totalChars: number;
      truncated: boolean;
    }
  >;
  ptyWrite(input: {
    id: string;
    text: string;
    submit?: boolean;
    sensitive?: boolean;
  }): Promise<import("@natalia/contracts").RuntimePTYSession>;
  ptyKey(input: {
    id: string;
    key: "enter" | "ctrl-c" | "ctrl-d" | "tab" | "esc";
  }): Promise<import("@natalia/contracts").RuntimePTYSession>;
  ptyResize(input: {
    id: string;
    rows: number;
    cols: number;
  }): Promise<import("@natalia/contracts").RuntimePTYSession>;
  ptyAttach(
    id: string,
  ): Promise<import("@natalia/contracts").RuntimePTYSession>;
  ptyDetach(
    id: string,
  ): Promise<import("@natalia/contracts").RuntimePTYSession>;
  ptyStop(id: string): Promise<import("@natalia/contracts").RuntimePTYSession>;
  sessions(): Promise<import("@natalia/contracts").RuntimeSessionSummary[]>;
  touchSession(id: string): Promise<void>;
  renameSession(
    id: string,
    title: string,
  ): Promise<import("@natalia/contracts").RuntimeSessionSummary>;
  pinSession(
    id: string,
    pinned: boolean,
  ): Promise<import("@natalia/contracts").RuntimeSessionSummary>;
  duplicateSession(
    id: string,
    title?: string,
  ): Promise<import("@natalia/contracts").RuntimeSessionSummary>;
  forkSession(
    id: string,
    turnID: string,
    title?: string,
  ): Promise<import("@natalia/contracts").RuntimeSessionSummary>;
  deleteSession(
    id: string,
  ): Promise<{ id: string; removedAttachments: number }>;
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
  checkpointList(): Promise<import("@natalia/contracts").RuntimeCheckpoint[]>;
  checkpointPreview(
    id: string,
  ): Promise<import("@natalia/contracts").CheckpointPreview>;
  checkpointRollback(input: {
    id: string;
    dryRun?: boolean;
  }): Promise<import("@natalia/contracts").CheckpointPreview>;
  sandboxList(): Promise<import("@natalia/contracts").RuntimeSandbox[]>;
  sandboxDiff(
    id: string,
  ): Promise<import("@natalia/contracts").RuntimeSandboxChange[]>;
  sandboxResources(
    id: string,
  ): Promise<import("@natalia/contracts").RuntimeSandboxResource[]>;
  sandboxResourceOutput(input: {
    id: string;
    resourceID: string;
    maxBytes?: number;
  }): Promise<string>;
  sandboxMerge(
    id: string,
  ): Promise<import("@natalia/contracts").RuntimeSandboxChange[]>;
  sandboxDelete(id: string): Promise<{
    pendingChanges: import("@natalia/contracts").RuntimeSandboxChange[];
    runningResources: string[];
  }>;
  sandboxResourceStop(input: {
    id: string;
    resourceID: string;
  }): Promise<import("@natalia/contracts").RuntimeSandboxResource>;
  snapshot(): Promise<RuntimeEvent>;
  history(options?: { after?: number; limit?: number }): Promise<{
    events: Array<{ seq: number; event: RuntimeEvent }>;
    hasMore: boolean;
  }>;
  messages(options?: {
    limit?: number;
    order?: "asc" | "desc";
    cursor?: string;
  }): Promise<import("@natalia/contracts").RuntimeMessagePage>;
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
    agents: async () => await call("agent.list", {}),
    modelCatalog: async () => await call("model.catalog", {}),
    modelSelection: async () => await call("model.selection", {}),
    selectModel: async (modelID, variant) => {
      await call("model.select", {
        ...(modelID === undefined ? {} : { modelID }),
        ...(variant === undefined ? {} : { variant }),
      });
    },
    skills: async () => await call("skills.list", {}),
    workspaceFiles: async (input = {}) => await call("workspace.files", input),
    workspaceSearch: async (input) => await call("workspace.search", input),
    workspaceList: async (input = {}) => await call("workspace.list", input),
    workspaceRead: async (input) => await call("workspace.read", input),
    workspaceGlob: async (input) => await call("workspace.glob", input),
    ptySessions: async () => await call("pty.list", {}),
    ptyRead: async (input) => await call("pty.read", input),
    ptyWrite: async (input) => await call("pty.write", input),
    ptyKey: async (input) => await call("pty.key", input),
    ptyResize: async (input) => await call("pty.resize", input),
    ptyAttach: async (id) => await call("pty.attach", { id }),
    ptyDetach: async (id) => await call("pty.detach", { id }),
    ptyStop: async (id) => await call("pty.stop", { id }),
    sessions: async () => await call("session.list", {}),
    touchSession: async (id) => {
      await call("session.touch", { id });
    },
    renameSession: async (id, title) =>
      await call("session.rename", { id, title }),
    pinSession: async (id, pinned) => await call("session.pin", { id, pinned }),
    duplicateSession: async (id, title) =>
      await call(
        "session.duplicate",
        title === undefined ? { id } : { id, title },
      ),
    forkSession: async (id, turnID, title) =>
      await call(
        "session.fork",
        title === undefined ? { id, turnID } : { id, turnID, title },
      ),
    deleteSession: async (id) => await call("session.delete", { id }),
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
    checkpointList: async () => await call("checkpoint.list", {}),
    checkpointPreview: async (id) => await call("checkpoint.preview", { id }),
    checkpointRollback: async (input) =>
      await call("checkpoint.rollback", input),
    sandboxList: async () => await call("sandbox.list", {}),
    sandboxDiff: async (id) => await call("sandbox.diff", { id }),
    sandboxResources: async (id) => await call("sandbox.resources", { id }),
    sandboxResourceOutput: async (input) =>
      await call("sandbox.resource.output", input),
    sandboxMerge: async (id) => await call("sandbox.merge", { id }),
    sandboxDelete: async (id) => await call("sandbox.delete", { id }),
    sandboxResourceStop: async (input) =>
      await call("sandbox.resource.stop", input),
    snapshot: async () => await call<RuntimeEvent>("snapshot", {}),
    history: async (historyOptions = {}) =>
      await call("session.history", historyOptions),
    messages: async (messageOptions = {}) =>
      await call("session.messages", messageOptions),
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
