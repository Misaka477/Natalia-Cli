import {
  API_VERSION,
  RuntimeRPCError,
  RuntimeVersionMismatchError,
} from "@natalia/contracts";
import type {
  ApprovalResponse,
  QuestionResponse,
  RuntimeClient,
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
  /**
   * These report what the runtime did rather than resolving on the assumption it
   * worked. Nothing running, already paused, an unknown agent, or a selection
   * deferred until the current turn ends are all ordinary answers, and a caller
   * that cannot see them will render the wrong thing.
   */
  pause(reason?: string): Promise<import("@natalia/contracts").PauseOutcome>;
  resume(): Promise<import("@natalia/contracts").ResumeOutcome>;
  selectAgent(
    name?: string,
  ): Promise<import("@natalia/contracts").AgentSelectionOutcome>;
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
  /**
   * Creates a session record. Idempotent by id: an existing id answers
   * `created: false`. A write.
   */
  newSession(
    input?: Parameters<NonNullable<RuntimeClient["sessionNew"]>>[0],
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["sessionNew"]>>>>;
  /** Archives a session record. A write; idempotent. */
  archiveSession(
    id: string,
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["sessionArchive"]>>>>;
  /** Exports a session's journal, every event in sequence. Read-only. */
  exportSession(
    id: string,
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["sessionExport"]>>>>;
  /** Makes an existing durable session active in this hosted runtime. A write. */
  attachSession(
    id: string,
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["sessionAttach"]>>>>;
  /** Lists permission profiles with the active default. Read-only. */
  permissionList(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["permissionList"]>>>
  >;
  /** Creates or replaces a permission profile. A write. */
  permissionSave(
    input: Parameters<NonNullable<RuntimeClient["permissionSave"]>>[0],
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["permissionSave"]>>>>;
  /** Deletes a permission profile. A write; idempotent; the default refuses. */
  permissionDelete(
    name: string,
  ): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["permissionDelete"]>>>
  >;
  /** Adds or replaces an MCP server and reconnects it. A write. */
  mcpServerAdd(
    input: Parameters<NonNullable<RuntimeClient["mcpServerAdd"]>>[0],
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["mcpServerAdd"]>>>>;
  /** Removes an MCP server and disconnects it. A write; idempotent. */
  mcpServerRemove(
    name: string,
  ): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["mcpServerRemove"]>>>
  >;
  /** Creates an agent definition. A write. */
  createAgent(
    input: Parameters<NonNullable<RuntimeClient["agentCreate"]>>[0],
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["agentCreate"]>>>>;
  /** Replaces an agent definition. A write. */
  updateAgent(
    input: Parameters<NonNullable<RuntimeClient["agentUpdate"]>>[0],
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["agentUpdate"]>>>>;
  /** Deletes an agent definition. A write; idempotent; the default refuses. */
  deleteAgent(
    name: string,
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["agentDelete"]>>>>;
  /** Discovers the models a provider endpoint offers. Read-only. */
  discoverProvider(
    input: Parameters<NonNullable<RuntimeClient["providerDiscover"]>>[0],
  ): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["providerDiscover"]>>>
  >;
  /** Adds or replaces a provider. A write. */
  addProvider(
    input: Parameters<NonNullable<RuntimeClient["providerAdd"]>>[0],
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["providerAdd"]>>>>;
  /** Removes a provider. A write; idempotent; referenced providers refuse. */
  removeProvider(
    name: string,
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["providerRemove"]>>>>;
  /** Unloads a plugin. A write; idempotent. */
  unloadPlugin(
    id: string,
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["pluginUnload"]>>>>;
  /** Reloads a plugin from its manifest path. A write. */
  reloadPlugin(
    id: string,
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["pluginReload"]>>>>;
  /**
   * Answering a request that already timed out or was answered elsewhere is
   * dropped by the runtime, and `accepted: false` is how a UI learns that — the
   * model was told the call did not run, so re-rendering it as approved would be
   * wrong.
   */
  respondApproval(
    response: ApprovalResponse,
  ): Promise<import("@natalia/contracts").InteractiveResponseOutcome>;
  respondQuestion(
    response: QuestionResponse,
  ): Promise<import("@natalia/contracts").InteractiveResponseOutcome>;
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
  /**
   * Unattended work, read-only. Each entry reports its own problems rather than
   * failing the whole list, so a broken document does not blank the view.
   */
  /** Commands contributed by capabilities and plugins. */
  commandCatalog(): Promise<import("@natalia/contracts").ContributedCommand[]>;
  /** Replayable causal facts, including the existing epi_* correlation id. */
  workGraphNodes(): Promise<import("@natalia/contracts").WorkGraphNodeView[]>;
  workGraphEdges(): Promise<import("@natalia/contracts").WorkGraphEdgeView[]>;
  /** The native terminal host. P0-D scopes the secure-input members. */
  nativeTerminalList(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["nativeTerminalList"]>>>
  >;
  nativeTerminalRead(
    id: string,
  ): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["nativeTerminalRead"]>>>
  >;
  nativeTerminalStop(
    id: string,
  ): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["nativeTerminalStop"]>>>
  >;
  nativeTerminalOpenHub(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["nativeTerminalOpenHub"]>>>
  >;
  nativeTerminalRevokeApprovalScope(
    id: string,
  ): Promise<
    Awaited<
      ReturnType<
        NonNullable<RuntimeClient["nativeTerminalRevokeApprovalScope"]>
      >
    >
  >;
  nativeTerminalReleaseHumanControl(
    id: string,
  ): Promise<
    Awaited<
      ReturnType<
        NonNullable<RuntimeClient["nativeTerminalReleaseHumanControl"]>
      >
    >
  >;
  nativeTerminalBeginSecureInput(
    id: string,
  ): Promise<
    Awaited<
      ReturnType<NonNullable<RuntimeClient["nativeTerminalBeginSecureInput"]>>
    >
  >;
  nativeTerminalEndSecureInput(
    id: string,
  ): Promise<
    Awaited<
      ReturnType<NonNullable<RuntimeClient["nativeTerminalEndSecureInput"]>>
    >
  >;
  /**
   * Starts a native terminal session. A write: the host must enable terminal
   * writes (`terminalWrite: true`), otherwise this is refused. Remote callers
   * are model-side actors for ownership and secure-input arbitration.
   */
  nativeTerminalStart(
    input: Parameters<NonNullable<RuntimeClient["nativeTerminalStart"]>>[0],
  ): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["nativeTerminalStart"]>>>
  >;
  /**
   * Writes input bytes (control bytes included) to a native terminal session.
   * Refused while a human holds input or secure input is active; a replayed
   * `idempotencyKey` answers `delivery: "duplicate"` instead of writing again.
   */
  nativeTerminalWrite(
    input: Parameters<NonNullable<RuntimeClient["nativeTerminalWrite"]>>[0],
  ): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["nativeTerminalWrite"]>>>
  >;
  /** Resizes a native terminal session. Subject to the secure-input interlock. */
  nativeTerminalResize(
    input: Parameters<NonNullable<RuntimeClient["nativeTerminalResize"]>>[0],
  ): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["nativeTerminalResize"]>>>
  >;
  /** Intelligence queries. Routed and reachable; answer empty until there are writers. */
  constitutionRules(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["constitutionRules"]>>>
  >;
  decisionRecords(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["decisionRecords"]>>>
  >;
  /** Records a durable decision fact (CST3 writer). */
  recordDecision(input: {
    decision: string;
    rationale?: string[];
    alternatives?: { option: string; rejectedReason?: string }[];
    consequences?: string[];
    linkedPlans?: string[];
    linkedConstraints?: string[];
  }): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["recordDecision"]>>>
  >;
  evidenceRecords(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["evidenceRecords"]>>>
  >;
  /** Runs a validation command and records the outcome as durable evidence. */
  recordValidation(input: {
    taskID: string;
    objective: string;
    command: string;
    timeoutSec?: number;
    knownGaps?: string[];
  }): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["recordValidation"]>>>
  >;
  driftFindings(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["driftFindings"]>>>
  >;
  registeredTools(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["registeredTools"]>>>
  >;
  /** Loaded capability records, distinct from `availability()` (what is implemented). */
  capabilities(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["capabilities"]>>>
  >;
  sessionSnapshot(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeClient["sessionSnapshot"]>>>
  >;
  /** Submits a turn with attachments, resources and agent mentions. */
  submitInput(
    input: import("@natalia/contracts").SubmitInput,
  ): Promise<import("@natalia/contracts").SubmittedTurn>;
  /** Creates or updates a flow document. Idempotent by path. */
  saveFlowDocument(input: {
    path?: string;
    document: import("@natalia/contracts").NataliaFlowDocumentInput;
  }): Promise<{
    path: string;
    flowID: string;
    created: boolean;
    updated: boolean;
  }>;
  /** Deletes a flow document. Idempotent: already-gone answers true. */
  deleteFlowDocument(input: { path: string }): Promise<{
    path: string;
    deleted: boolean;
    alreadyDeleted: boolean;
  }>;
  /** Creates or updates a task document. Idempotent by path. */
  saveTaskDocument(input: {
    path?: string;
    document: import("@natalia/contracts").NataliaTaskDocumentInput;
  }): Promise<{
    path: string;
    taskID: string;
    created: boolean;
    updated: boolean;
  }>;
  /** Deletes a task document. Configured timers must be removed first. */
  deleteTaskDocument(input: { path: string }): Promise<{
    path: string;
    deleted: boolean;
    alreadyDeleted: boolean;
  }>;
  taskSchedule(
    input: Parameters<NonNullable<RuntimeClient["taskSchedule"]>>[0],
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["taskSchedule"]>>>>;
  taskUnschedule(
    input: Parameters<NonNullable<RuntimeClient["taskUnschedule"]>>[0],
  ): Promise<Awaited<ReturnType<NonNullable<RuntimeClient["taskUnschedule"]>>>>;
  /** Writes a config patch (the TUI settings menu path) and applies it. */
  updateConfig(input: {
    patch: Record<string, unknown>;
    scope?: "project" | "global";
  }): Promise<{ applied: boolean; reason?: string }>;
  /** Reads the effective interface-preference settings and their sources. */
  settingsGet(): Promise<{
    config: Record<string, unknown>;
    sources: Array<{
      scope: "defaults" | "global" | "project";
      path?: string;
      applied: boolean;
      diagnostic?: string;
    }>;
  }>;
  /** Writes an interface-preference patch to the given scope's file. */
  settingsSet(
    patch: Record<string, unknown>,
    scope: "global" | "project",
  ): Promise<{ applied: boolean }>;
  /**
   * Validates a task document and previews its permissions before delivery.
   * Problems are a value, not an exception.
   */
  taskPermissionPreview(input: { path: string }): Promise<{
    taskID: string;
    displayName: string;
    permissionProfile: string;
    flowID: string;
    flowDisplayName: string;
    enabledModules: number;
    blocked: Array<{ moduleID: string; reason: string }>;
    conditionlessModules: string[];
    problems: string[];
    valid: boolean;
  }>;
  taskOverview(): Promise<import("@natalia/contracts").ScheduledTaskOverview>;
  flowOverview(): Promise<import("@natalia/contracts").FlowOverview>;
  documentCatalog(): Promise<
    import("@natalia/contracts").WorkflowDocumentChoice[]
  >;
  /**
   * What this runtime implements: the required members it has, which capability
   * groups are complete, and which queries answer with nothing because their facts
   * have no producer yet. Ask this instead of feature-detecting member by member —
   * it is the only way to tell "not supported" from "not implemented yet" from
   * "nothing recorded".
   */
  /**
   * Applies the configuration on disk. Refusal is a value, not an exception: a
   * turn running or a prompt pending is an ordinary reason to be told "not now",
   * and re-checked at the moment of application rather than trusted from
   * `canReloadConfig()`, which a turn can invalidate between the two calls.
   */
  reloadConfig(): Promise<{ applied: boolean; reason?: string }>;
  canReloadConfig(): Promise<{ allowed: boolean; reason?: string }>;
  availability(): Promise<import("@natalia/contracts").RuntimeCapabilityReport>;
  runtimeStatus(): Promise<import("@natalia/contracts").RuntimeStatusSnapshot>;
  diagnostics(
    limit?: number,
  ): Promise<import("@natalia/contracts").RuntimeDiagnostic[]>;
  health(): Promise<{ ok: boolean; apiVersion: number }>;
  events(options?: {
    since?: number;
    signal?: AbortSignal;
  }): AsyncIterable<RuntimeEvent>;
};

export function createNataliaSDK(options: NataliaSDKOptions): NataliaSDK {
  const baseURL = options.baseURL.replace(/\/+$/u, "");
  const fetchImpl = options.fetch ?? fetch;
  let nextID = 1;
  let versionCheck: Promise<void> | undefined;

  /**
   * One check per SDK instance, before the first call: ask /healthz what API
   * version this runtime speaks, and refuse to guess when it is newer than
   * this SDK knows. A consumer that keeps going would silently misread a
   * changed protocol; the error names both versions instead.
   */
  async function ensureProtocolVersion() {
    try {
      const response = await fetchImpl(`${baseURL}/healthz`);
      if (!response.ok)
        throw new Error(`protocol check failed: ${response.status}`);
      const body = (await response.json()) as { apiVersion?: number };
      const serverVersion = body.apiVersion;
      if (typeof serverVersion === "number" && serverVersion > API_VERSION)
        throw new RuntimeVersionMismatchError({
          serverVersion,
          supportedVersion: API_VERSION,
        });
    } catch (error) {
      // A version mismatch is permanent; a failed probe is not. Only the
      // former stays cached, so a transient network blip does not poison the
      // SDK for the rest of its life.
      if (error instanceof RuntimeVersionMismatchError) throw error;
      versionCheck = undefined;
      throw error;
    }
  }

  async function call<T>(method: string, params: Record<string, unknown>) {
    versionCheck ??= ensureProtocolVersion();
    await versionCheck;
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
      error?: {
        code: number;
        message: string;
        data?: import("@natalia/contracts").RuntimeFailureData;
      };
    };
    // A failure arrives as a `RuntimeRPCError` carrying the JSON-RPC code and its
    // structured data, so a consumer can tell "this runtime cannot do it" from
    // "my arguments are wrong" from "policy says no" with `failureKind(error)`
    // instead of matching on message text.
    if (body.error)
      throw new RuntimeRPCError({
        code: body.error.code,
        message: body.error.message,
        method,
        data: body.error.data,
      });
    if (!response.ok) throw new Error(`SDK request failed: ${response.status}`);
    return body.result as T;
  }
  return {
    prompt: async (text, promptOptions = {}) =>
      await call<SubmittedTurn>("prompt", { text, ...promptOptions }),
    cancel: async (reason) => {
      await call("cancel", reason ? { reason } : {});
    },
    pause: async (reason) => await call("pause", reason ? { reason } : {}),
    resume: async () => await call("resume", {}),
    selectAgent: async (name) =>
      await call("agent.select", name === undefined ? {} : { name }),
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
    sessions: async () => await call("session.list", {}),
    touchSession: async (id) => {
      await call("session.touch", { id });
    },
    renameSession: async (id, title) =>
      await call("session.rename", { id, title }),
    newSession: async (input = {}) => await call("session.new", input),
    archiveSession: async (id) => await call("session.archive", { id }),
    exportSession: async (id) => await call("session.export", { id }),
    attachSession: async (id) => await call("session.attach", { id }),
    permissionList: async () => await call("permission.list", {}),
    permissionSave: async (input) => await call("permission.save", input),
    permissionDelete: async (name) => await call("permission.delete", { name }),
    mcpServerAdd: async (input) => await call("mcp.server.add", input),
    mcpServerRemove: async (name) => await call("mcp.server.remove", { name }),
    createAgent: async (input) => await call("agent.create", input),
    updateAgent: async (input) => await call("agent.update", input),
    deleteAgent: async (name) => await call("agent.delete", { name }),
    discoverProvider: async (input) => await call("provider.discover", input),
    addProvider: async (input) => await call("provider.add", input),
    removeProvider: async (name) => await call("provider.remove", { name }),
    unloadPlugin: async (id) => await call("plugin.unload", { name: id }),
    reloadPlugin: async (id) => await call("plugin.reload", { name: id }),
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
    respondApproval: async (response) =>
      await call(
        "approval.respond",
        response as unknown as Record<string, unknown>,
      ),
    respondQuestion: async (response) =>
      await call(
        "question.respond",
        response as unknown as Record<string, unknown>,
      ),
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
    commandCatalog: async () => await call("command.catalog", {}),
    workGraphNodes: async () => await call("workgraph.nodes", {}),
    workGraphEdges: async () => await call("workgraph.edges", {}),
    nativeTerminalList: async () => await call("nativeTerminal.list", {}),
    nativeTerminalRead: async (id) => await call("nativeTerminal.read", { id }),
    nativeTerminalStop: async (id) => await call("nativeTerminal.stop", { id }),
    nativeTerminalOpenHub: async () => await call("nativeTerminal.openHub", {}),
    nativeTerminalRevokeApprovalScope: async (id) =>
      await call("nativeTerminal.revokeApprovalScope", { id }),
    nativeTerminalReleaseHumanControl: async (id) =>
      await call("nativeTerminal.releaseHumanControl", { id }),
    nativeTerminalBeginSecureInput: async (id) =>
      await call("nativeTerminal.beginSecureInput", { id }),
    nativeTerminalEndSecureInput: async (id) =>
      await call("nativeTerminal.endSecureInput", { id }),
    nativeTerminalStart: async (input) =>
      await call("nativeTerminal.start", input),
    nativeTerminalWrite: async (input) =>
      await call("nativeTerminal.write", input),
    nativeTerminalResize: async (input) =>
      await call("nativeTerminal.resize", input),
    constitutionRules: async () => await call("constitution.rules", {}),
    decisionRecords: async () => await call("decision.records", {}),
    recordDecision: async (input) =>
      await call("decision.record", {
        decision: input.decision,
        rationale: input.rationale ?? [],
        alternatives: input.alternatives ?? [],
        consequences: input.consequences ?? [],
        linkedPlans: input.linkedPlans ?? [],
        linkedConstraints: input.linkedConstraints ?? [],
      }),
    evidenceRecords: async () => await call("evidence.records", {}),
    recordValidation: async (input) =>
      await call("evidence.record", {
        taskID: input.taskID,
        objective: input.objective,
        command: input.command,
        timeoutSec: input.timeoutSec,
        knownGaps: input.knownGaps ?? [],
      }),
    driftFindings: async () => await call("drift.findings", {}),
    registeredTools: async () => await call("tools.registered", {}),
    capabilities: async () => await call("capabilities", {}),
    sessionSnapshot: async () => await call("session.snapshot", {}),
    submitInput: async (input) => await call("submit.input", input),
    saveFlowDocument: async (input) => await call("flow.save", input),
    deleteFlowDocument: async (input) => await call("flow.delete", input),
    saveTaskDocument: async (input) => await call("task.save", input),
    deleteTaskDocument: async (input) => await call("task.delete", input),
    taskSchedule: async (input) => await call("task.schedule", input),
    taskUnschedule: async (input) => await call("task.unschedule", input),
    taskPermissionPreview: async (input) => await call("task.preview", input),
    updateConfig: async (input) => await call("config.update", input),
    settingsGet: async () => await call("settings.get", {}),
    settingsSet: async (patch, scope) =>
      await call("settings.set", { patch, scope }),
    taskOverview: async () => await call("task.overview", {}),
    flowOverview: async () => await call("flow.overview", {}),
    documentCatalog: async () => await call("document.catalog", {}),
    reloadConfig: async () => await call("config.reload", {}),
    canReloadConfig: async () => await call("config.canReload", {}),
    availability: async () => await call("runtime.availability", {}),
    runtimeStatus: async () => await call("runtime.status", {}),
    diagnostics: async (limit) =>
      await call("diagnostics.list", limit === undefined ? {} : { limit }),
    health: async () => {
      const response = await fetchImpl(`${baseURL}/healthz`);
      if (!response.ok) throw new Error(`health failed: ${response.status}`);
      return (await response.json()) as { ok: boolean; apiVersion: number };
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
    `${input.baseURL}/events${input.since !== undefined ? `?since=${input.since}` : ""}`,
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
