import { describeRuntimeCapabilities } from "@natalia/contracts";
import type {
  ApprovalResponse,
  QuestionResponse,
  RuntimeClient,
  RuntimeEvent,
  RuntimeReasoningEffort,
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
  "task.save": "saveTaskDocument",
  "task.delete": "deleteTaskDocument",
  "task.schedule": "taskSchedule",
  "task.unschedule": "taskUnschedule",
  "task.preview": "taskPermissionPreview",
  "task.preview-document": "taskPermissionPreviewDocument",
  "task.load": "loadTaskDocument",
  "flow.load": "loadFlowDocument",
  "flow.install-examples": "installExampleDocuments",
  "task.preview-calendar": "previewSystemdCalendar",
  "task.permission-usage": "permissionProfileUsage",
  "flow.decompose-conditions": "decomposeFlowConditions",
  "task.overview": "taskOverview",
  "flow.overview": "flowOverview",
  "document.catalog": "documentCatalog",
  "command.catalog": "commandCatalog",
  "command.execute": "commandExecute",
  snapshot: "snapshot",
  diagnostic: "diagnostic",
  approval: "respondApproval",
  question: "respondQuestion",
  "interactive.pending": "pendingInteractive",
  "config.reload": "reloadConfig",
  "config.update": "updateConfig",
  "config.get": "configGet",
  dispose: "dispose",
  history: "history",
  diagnostics: "diagnostics",
  messages: "messages",
  agents: "agents",
  "model.catalog": "modelCatalog",
  "model.selection": "modelSelection",
  "model.select": "selectModel",
  "model.reasoning": "reasoningEffort",
  "model.reasoning.set": "setReasoningEffort",
  "permission.list": "permissionList",
  "permission.save": "permissionSave",
  "permission.delete": "permissionDelete",
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
  "session.attach": "sessionAttach",
  "session.fork": "sessionFork",
  "sandbox.list": "sandboxList",
  "sandbox.diff": "sandboxDiff",
  "sandbox.resources": "sandboxResources",
  "sandbox.resource-output": "sandboxResourceOutput",
  "sandbox.resource-stop": "sandboxResourceStop",
  "sandbox.merge": "sandboxMerge",
  "sandbox.delete": "sandboxDelete",
  "agent.select": "selectAgent",
  "session.snapshot": "sessionSnapshot",
  "plan.list": "planList",
  "plan.accept": "planAccept",
  "mailbox.list": "mailboxList",
  "mailbox.send": "mailboxSend",
  "mailbox.acknowledge": "mailboxAcknowledge",
  "drift.list": "driftFindings",
  completions: "completions",
  "constitution.list": "constitutionRules",
  "decision.list": "decisionRecords",
  "evidence.list": "evidenceRecords",
  "projections.list": "projectionContributions",
  "constitution.override.request": "requestOverride",
  "constitution.override.approve": "approveOverride",
  "chat.messages": "chatMessages",
  "chat.submit": "chatSubmit",
  "chat.abort": "chatAbort",
  "chat.rollback": "chatRollback",
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
    | "config.get"
    | "dispose"
    | "history"
    | "diagnostics"
    | "messages"
    | "agents"
    | "model.catalog"
    | "model.selection"
    | "model.select"
    | "model.reasoning"
    | "model.reasoning.set"
    | "permission.list"
    | "permission.save"
    | "permission.delete"
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
    | "session.attach"
    | "session.fork"
    | "sandbox.list"
    | "sandbox.diff"
    | "sandbox.resources"
    | "sandbox.resource-output"
    | "sandbox.resource-stop"
    | "sandbox.merge"
    | "sandbox.delete"
    | "agent.select"
    | "runtime.availability"
    | "session.snapshot"
    | "plan.list"
    | "plan.accept"
    | "mailbox.list"
    | "mailbox.send"
    | "mailbox.acknowledge"
    | "drift.list"
    | "completions"
    | "constitution.list"
    | "decision.list"
    | "evidence.list"
    | "projections.list"
    | "constitution.override.request"
    | "constitution.override.approve"
    | "chat.messages"
    | "chat.abort"
    | "chat.submit"
    | "chat.rollback"
    | "flow.save"
    | "flow.delete"
    | "task.save"
    | "task.delete"
    | "task.schedule"
    | "task.unschedule"
    | "task.preview"
    | "task.preview-document"
    | "task.load"
    | "flow.load"
    | "flow.install-examples"
    | "task.preview-calendar"
    | "task.permission-usage"
    | "flow.decompose-conditions"
    | "task.overview"
    | "flow.overview"
    | "document.catalog"
    | "command.catalog"
    | "command.execute";
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
  start?(): void;
  close?(): void;
  addEventListener(
    type: "message",
    handler: (event: MessageEvent<unknown>) => void,
  ): void;
  addEventListener(type: "close", handler: (event: Event) => void): void;
  removeEventListener(
    type: "message",
    handler: (event: MessageEvent<unknown>) => void,
  ): void;
  removeEventListener(type: "close", handler: (event: Event) => void): void;
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
  // The worker can exit underneath the TUI (provider connection loss, crash,
  // dispose). Surface that through the event stream instead of leaving a
  // silently dead backend whose every next request fails.
  port.addEventListener("close", () => {
    if (!sink) return;
    sink({
      type: "diagnostic",
      level: "error",
      message: "runtime worker exited; the session backend is unavailable",
      at: new Date().toISOString(),
    });
  });
  port.start?.();
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
      try {
        port.postMessage({
          type: "runtime.request",
          id,
          method,
          value,
        } satisfies WorkerRequest);
      } catch (error) {
        // The worker can exit underneath the TUI (provider connection loss,
        // crash, dispose). Reject immediately and do not strand the pending
        // entry; callers that await receive the error, callers that fire and
        // forget must catch it themselves.
        pending.delete(id);
        reject(error);
      }
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
    async reasoningEffort() {
      return (await request("model.reasoning")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["reasoningEffort"]>>
      >;
    },
    async setReasoningEffort(effort) {
      await request("model.reasoning.set", { effort });
    },
    async permissionList() {
      return (await request("permission.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["permissionList"]>>
      >;
    },
    async permissionSave(input) {
      return (await request("permission.save", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["permissionSave"]>>
      >;
    },
    async permissionDelete(name) {
      return (await request("permission.delete", name)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["permissionDelete"]>>
      >;
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
    async saveTaskDocument(input) {
      return (await request("task.save", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["saveTaskDocument"]>>
      >;
    },
    async deleteTaskDocument(input) {
      return (await request("task.delete", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["deleteTaskDocument"]>>
      >;
    },
    async taskSchedule(input) {
      return (await request("task.schedule", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["taskSchedule"]>>
      >;
    },
    async taskUnschedule(input) {
      return (await request("task.unschedule", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["taskUnschedule"]>>
      >;
    },
    async taskPermissionPreview(input) {
      return (await request("task.preview", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["taskPermissionPreview"]>>
      >;
    },
    async taskPermissionPreviewDocument(input) {
      return (await request("task.preview-document", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["taskPermissionPreviewDocument"]>>
      >;
    },
    async loadTaskDocument(input) {
      return (await request("task.load", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["loadTaskDocument"]>>
      >;
    },
    async loadFlowDocument(input) {
      return (await request("flow.load", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["loadFlowDocument"]>>
      >;
    },
    async installExampleDocuments(input) {
      return (await request("flow.install-examples", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["installExampleDocuments"]>>
      >;
    },
    async previewSystemdCalendar(input) {
      return (await request("task.preview-calendar", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["previewSystemdCalendar"]>>
      >;
    },
    async permissionProfileUsage() {
      return (await request("task.permission-usage")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["permissionProfileUsage"]>>
      >;
    },
    async decomposeFlowConditions(input) {
      return (await request("flow.decompose-conditions", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["decomposeFlowConditions"]>>
      >;
    },
    async taskOverview() {
      return (await request("task.overview")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["taskOverview"]>>
      >;
    },
    async flowOverview() {
      return (await request("flow.overview")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["flowOverview"]>>
      >;
    },
    async documentCatalog() {
      return (await request("document.catalog")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["documentCatalog"]>>
      >;
    },
    async commandCatalog() {
      return (await request("command.catalog")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["commandCatalog"]>>
      >;
    },
    async commandExecute(input) {
      await request("command.execute", input);
    },
    async updateConfig(input) {
      return (await request("config.update", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["updateConfig"]>>
      >;
    },
    async configGet() {
      return (await request("config.get")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["configGet"]>>
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
    async sessionAttach(id) {
      return (await request("session.attach", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sessionAttach"]>>
      >;
    },
    async sessionFork(id, turnID, title) {
      return (await request("session.fork", { id, turnID, title })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sessionFork"]>>
      >;
    },
    async sandboxList() {
      return (await request("sandbox.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxList"]>>
      >;
    },
    async sandboxDiff(id) {
      return (await request("sandbox.diff", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxDiff"]>>
      >;
    },
    async sandboxResources(id) {
      return (await request("sandbox.resources", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxResources"]>>
      >;
    },
    async sandboxResourceOutput(input) {
      return (await request("sandbox.resource-output", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxResourceOutput"]>>
      >;
    },
    async sandboxResourceStop(input) {
      return (await request("sandbox.resource-stop", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxResourceStop"]>>
      >;
    },
    async sandboxMerge(id) {
      return (await request("sandbox.merge", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxMerge"]>>
      >;
    },
    async sandboxDelete(id) {
      return (await request("sandbox.delete", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxDelete"]>>
      >;
    },
    async selectAgent(name) {
      return (await request("agent.select", name)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["selectAgent"]>>
      >;
    },
    async sessionSnapshot() {
      return (await request("session.snapshot")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sessionSnapshot"]>>
      >;
    },
    async planList() {
      return (await request("plan.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["planList"]>>
      >;
    },
    async planAccept(planID) {
      return (await request("plan.accept", planID)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["planAccept"]>>
      >;
    },
    async mailboxList() {
      return (await request("mailbox.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["mailboxList"]>>
      >;
    },
    async mailboxSend(input) {
      return (await request("mailbox.send", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["mailboxSend"]>>
      >;
    },
    async mailboxAcknowledge(messageID) {
      return (await request("mailbox.acknowledge", messageID)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["mailboxAcknowledge"]>>
      >;
    },
    async driftFindings() {
      return (await request("drift.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["driftFindings"]>>
      >;
    },
    async completions() {
      return (await request("completions")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["completions"]>>
      >;
    },
    async constitutionRules() {
      return (await request("constitution.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["constitutionRules"]>>
      >;
    },
    async decisionRecords() {
      return (await request("decision.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["decisionRecords"]>>
      >;
    },
    async evidenceRecords() {
      return (await request("evidence.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["evidenceRecords"]>>
      >;
    },
    async projectionContributions() {
      return (await request("projections.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["projectionContributions"]>>
      >;
    },
    async requestOverride(input) {
      return (await request("constitution.override.request", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["requestOverride"]>>
      >;
    },
    async approveOverride(input) {
      return (await request("constitution.override.approve", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["approveOverride"]>>
      >;
    },
    async chatMessages() {
      return (await request("chat.messages")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["chatMessages"]>>
      >;
    },
    async chatSubmit(input) {
      return (await request("chat.submit", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["chatSubmit"]>>
      >;
    },
    async chatAbort() {
      return (await request("chat.abort")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["chatAbort"]>>
      >;
    },
    async chatRollback(input) {
      return (await request("chat.rollback", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["chatRollback"]>>
      >;
    },
    async dispose() {
      await request("dispose");
      port.removeEventListener("message", onMessage);
      port.close?.();
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
  options?: {
    reload?: () => RuntimeClient;
    disposeHost?: () => void | Promise<void>;
  },
) {
  let activeClient = client;
  const forwardEvent = (event: RuntimeEvent) => {
    port.postMessage({ type: "runtime.event", event } satisfies WorkerEvent);
  };
  activeClient.start(forwardEvent);
  port.addEventListener("message", (event: MessageEvent<unknown>) => {
    const request = event.data as WorkerRequest;
    if (request.type !== "runtime.request") return;
    void handlePortRequest(request);
  });
  port.start?.();

  async function handlePortRequest(request: WorkerRequest) {
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
      } else if (request.method === "config.get") {
        value = await activeClient.configGet?.();
      } else if (request.method === "dispose") {
        value = await activeClient.dispose?.();
        await options?.disposeHost?.();
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
  }
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
  if (request.method === "model.reasoning")
    return await client.reasoningEffort?.();
  if (request.method === "model.reasoning.set") {
    const input = request.value as { effort?: RuntimeReasoningEffort };
    return await client.setReasoningEffort?.(input.effort);
  }
  if (request.method === "permission.list")
    return await client.permissionList?.();
  if (request.method === "permission.save")
    return await client.permissionSave?.(request.value as never);
  if (request.method === "permission.delete")
    return await client.permissionDelete?.(request.value as string);
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
  if (request.method === "session.attach")
    return await client.sessionAttach?.(request.value as string);
  if (request.method === "session.fork") {
    const input = request.value as {
      id: string;
      turnID: string;
      title?: string;
    };
    return await client.sessionFork?.(input.id, input.turnID, input.title);
  }
  if (request.method === "sandbox.list") return await client.sandboxList?.();
  if (request.method === "sandbox.diff")
    return await client.sandboxDiff?.(request.value as string);
  if (request.method === "sandbox.resources")
    return await client.sandboxResources?.(request.value as string);
  if (request.method === "sandbox.resource-output")
    return await client.sandboxResourceOutput?.(
      request.value as { id: string; resourceID: string; maxBytes?: number },
    );
  if (request.method === "sandbox.resource-stop")
    return await client.sandboxResourceStop?.(
      request.value as { id: string; resourceID: string },
    );
  if (request.method === "sandbox.merge")
    return await client.sandboxMerge?.(request.value as string);
  if (request.method === "sandbox.delete")
    return await client.sandboxDelete?.(request.value as string);
  if (request.method === "agent.select")
    return await client.selectAgent?.(request.value as string);
  if (request.method === "session.snapshot")
    return await client.sessionSnapshot?.();
  if (request.method === "plan.list") return await client.planList?.();
  if (request.method === "plan.accept")
    return await client.planAccept?.(request.value as string);
  if (request.method === "mailbox.list") return await client.mailboxList?.();
  if (request.method === "mailbox.send")
    return await client.mailboxSend?.(request.value as never);
  if (request.method === "mailbox.acknowledge")
    return await client.mailboxAcknowledge?.(request.value as string);
  if (request.method === "drift.list") return await client.driftFindings?.();
  if (request.method === "completions") return await client.completions?.();
  if (request.method === "constitution.list")
    return await client.constitutionRules?.();
  if (request.method === "decision.list")
    return await client.decisionRecords?.();
  if (request.method === "evidence.list")
    return await client.evidenceRecords?.();
  if (request.method === "projections.list")
    return await client.projectionContributions?.();
  if (request.method === "constitution.override.request")
    return await client.requestOverride?.(request.value as never);
  if (request.method === "constitution.override.approve")
    return await client.approveOverride?.(request.value as never);
  if (request.method === "chat.messages") return await client.chatMessages?.();
  if (request.method === "chat.submit")
    return await client.chatSubmit?.(request.value as { text: string });
  if (request.method === "chat.abort") return await client.chatAbort?.();
  if (request.method === "chat.rollback")
    return await client.chatRollback?.(
      request.value as { toMessageID: string },
    );
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
  if (request.method === "task.save")
    return await client.saveTaskDocument?.(request.value as never);
  if (request.method === "task.delete")
    return await client.deleteTaskDocument?.(request.value as { path: string });
  if (request.method === "task.schedule")
    return await client.taskSchedule?.(request.value as never);
  if (request.method === "task.unschedule")
    return await client.taskUnschedule?.(request.value as { path: string });
  if (request.method === "task.preview")
    return await client.taskPermissionPreview?.(
      request.value as { path: string },
    );
  if (request.method === "task.preview-document")
    return await client.taskPermissionPreviewDocument?.(
      request.value as { path: string },
    );
  if (request.method === "task.load")
    return await client.loadTaskDocument?.(request.value as { path: string });
  if (request.method === "flow.load")
    return await client.loadFlowDocument?.(request.value as { path: string });
  if (request.method === "flow.install-examples")
    return await client.installExampleDocuments?.(
      request.value as { includeTasks?: boolean } | undefined,
    );
  if (request.method === "task.preview-calendar")
    return await client.previewSystemdCalendar?.(
      request.value as { calendar: string },
    );
  if (request.method === "task.permission-usage")
    return await client.permissionProfileUsage?.();
  if (request.method === "flow.decompose-conditions")
    return await client.decomposeFlowConditions?.(
      request.value as { modelID: string; objective: string },
    );
  if (request.method === "task.overview") return await client.taskOverview?.();
  if (request.method === "flow.overview") return await client.flowOverview?.();
  if (request.method === "document.catalog")
    return await client.documentCatalog?.();
  if (request.method === "command.catalog")
    return await client.commandCatalog?.();
  if (request.method === "command.execute")
    return await client.commandExecute?.(request.value as never);
  throw new Error(`worker channel does not route ${request.method}`);
}
