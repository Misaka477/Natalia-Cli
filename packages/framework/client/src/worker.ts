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
  "submitAndWait": "submitAndWait",
  cancel: "cancel",
  pause: "pause",
  resume: "resume",
  "runtime.status": "runtimeStatus",
  "runtime.availability": null,
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
  "workspace.write": "workspaceWrite",
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
  "checkpoint.rename": "checkpointRename",
  "workspace.diff": "workspaceDiff",
  "workspace.git.diff": "workspaceGitDiff",
  "team.pr.list": "teamPRList",
  "git.refs": "gitRefs",
  "session.list": "sessionList",
  "session.touch": "sessionTouch",
  "session.rename": "sessionRename",
  "session.pin": "sessionPin",
  "session.duplicate": "sessionDuplicate",
  "session.delete": "sessionDelete",
  "session.attach": "sessionAttach",
  "session.fork": "sessionFork",
  "session.rollback.messages": "sessionRollbackMessages",
  "sandbox.list": "sandboxList",
  "sandbox.diff": "sandboxDiff",
  "sandbox.resources": "sandboxResources",
  "sandbox.resource-output": "sandboxResourceOutput",
  "sandbox.resource-stop": "sandboxResourceStop",
  "sandbox.merge": "sandboxMerge",
  "sandbox.delete": "sandboxDelete",
  "agent.select": "selectAgent",
  "session.snapshot": "sessionSnapshot",
  "session.subagents": "subagents",
  "subagent.history": "subagentHistory",
  "attachment.upload": "uploadAttachment",
  "attachment.dataUrl": "attachmentDataUrl",
  "planDoc.list": "planDocList",
  "planDoc.read": "planDocRead",
  "planDoc.write": "planDocWrite",
  "planDoc.mark": "planDocMark",
  "planDoc.delete": "planDocDelete",
  "planDoc.status": "planDocStatus",
  "planDoc.updateStatus": "planDocUpdateStatus",
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
  "chat.model.profile": "chatModelProfile",
  "chat.model.profile.set": "setChatModelProfile",
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
    | "submitAndWait"
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
    | "workspace.write"
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
    | "checkpoint.rename"
    | "workspace.diff"
    | "workspace.git.diff"
    | "team.pr.list"
    | "git.refs"
    | "session.list"
    | "session.touch"
    | "session.rename"
    | "session.pin"
    | "session.duplicate"
    | "session.delete"
    | "session.attach"
    | "session.fork"
    | "session.rollback.messages"
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
    | "session.subagents"
    | "subagent.history"
    | "attachment.upload"
    | "attachment.dataUrl"
    | "planDoc.list"
    | "planDoc.read"
    | "planDoc.write"
    | "planDoc.mark"
    | "planDoc.delete"
    | "planDoc.status"
    | "planDoc.updateStatus"
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
    | "chat.model.profile"
    | "chat.model.profile.set"
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
  const bufferedEvents: RuntimeEvent[] = [];
  const onMessage = (event: MessageEvent<unknown>) => {
    const message = event.data as WorkerResponse | WorkerEvent;
    if (message.type === "runtime.event") {
      if (sink) sink(message.event);
      else bufferedEvents.push(message.event);
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
      for (const event of bufferedEvents.splice(0)) onEvent(event);
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
    async submitAndWait(input) {
      return (await request(
        "submitAndWait",
        typeof input === "string" ? { text: input } : input,
      )) as SubmittedTurn;
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
    async workspaceWrite(input) {
      return (await request("workspace.write", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["workspaceWrite"]>>
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

    async nativeTerminalList(sessionID) {
      return (await request("native-terminal.list", sessionID ? { sessionID } : undefined)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalList"]>>
      >;
    },
    async nativeTerminalRead(id, sessionID) {
      return (await request("native-terminal.read", { id, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalRead"]>>
      >;
    },
    async nativeTerminalOpenHub() {
      return (await request("native-terminal.open-hub")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalOpenHub"]>>
      >;
    },
    async nativeTerminalReleaseHumanControl(id, sessionID) {
      return (await request(
        "native-terminal.release-human-control",
        { id, sessionID },
      )) as Awaited<
        ReturnType<
          NonNullable<RuntimeClient["nativeTerminalReleaseHumanControl"]>
        >
      >;
    },
    async nativeTerminalRevokeApprovalScope(id, sessionID) {
      return (await request(
        "native-terminal.revoke-approval-scope",
        { id, sessionID },
      )) as Awaited<
        ReturnType<
          NonNullable<RuntimeClient["nativeTerminalRevokeApprovalScope"]>
        >
      >;
    },
    async nativeTerminalStop(id, sessionID) {
      return (await request("native-terminal.stop", { id, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalStop"]>>
      >;
    },
    async nativeTerminalBeginSecureInput(id, sessionID) {
      return (await request(
        "native-terminal.begin-secure-input",
        { id, sessionID },
      )) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalBeginSecureInput"]>>
      >;
    },
    async nativeTerminalEndSecureInput(id) {
      return (await request("native-terminal.end-secure-input", id)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["nativeTerminalEndSecureInput"]>>
      >;
    },
    async checkpointList(sessionID) {
      return (await request("checkpoint.list", sessionID ? { sessionID } : undefined)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["checkpointList"]>>
      >;
    },
    async workspaceDiff() {
      return (await request("workspace.diff")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["workspaceDiff"]>>
      >;
    },
    async workspaceGitDiff(input) {
      return (await request("workspace.git.diff", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["workspaceGitDiff"]>>
      >;
    },
    async gitRefs() {
      return (await request("git.refs")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["gitRefs"]>>
      >;
    },
    async teamPRList() {
      return (await request("team.pr.list")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["teamPRList"]>>
      >;
    },
    async checkpointPreview(id, sessionID) {
      return (await request("checkpoint.preview", { id, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["checkpointPreview"]>>
      >;
    },
    async checkpointRollback(input) {
      return (await request("checkpoint.rollback", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["checkpointRollback"]>>
      >;
    },
    async checkpointRename(input) {
      return (await request("checkpoint.rename", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["checkpointRename"]>>
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
    async sessionRollbackMessages(id, turnID) {
      return (await request("session.rollback.messages", {
        id,
        turnID,
      })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sessionRollbackMessages"]>>
      >;
    },
    async sandboxList(sessionID) {
      return (await request("sandbox.list", sessionID ? { sessionID } : undefined)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxList"]>>
      >;
    },
    async sandboxDiff(id, sessionID) {
      return (await request("sandbox.diff", { id, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxDiff"]>>
      >;
    },
    async sandboxResources(id, sessionID) {
      return (await request("sandbox.resources", { id, sessionID })) as Awaited<
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
    async sandboxMerge(id, sessionID) {
      return (await request("sandbox.merge", { id, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxMerge"]>>
      >;
    },
    async sandboxDelete(id, sessionID) {
      return (await request("sandbox.delete", { id, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sandboxDelete"]>>
      >;
    },
    async selectAgent(name) {
      return (await request("agent.select", name)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["selectAgent"]>>
      >;
    },
    async sessionSnapshot(sessionID) {
      return (await request("session.snapshot", sessionID ? { sessionID } : undefined)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["sessionSnapshot"]>>
      >;
    },
    async planDocList(sessionID) {
      return (await request("planDoc.list", sessionID ? { sessionID } : undefined)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["planDocList"]>>
      >;
    },
    async planDocRead(input) {
      return (await request("planDoc.read", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["planDocRead"]>>
      >;
    },
    async planDocWrite(input) {
      return (await request("planDoc.write", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["planDocWrite"]>>
      >;
    },
    async planDocMark(input) {
      return (await request("planDoc.mark", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["planDocMark"]>>
      >;
    },
    async planDocDelete(planID, sessionID) {
      return (await request("planDoc.delete", { planID, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["planDocDelete"]>>
      >;
    },
    async planDocStatus(planID, sessionID) {
      return (await request("planDoc.status", { planID, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["planDocStatus"]>>
      >;
    },
    async planDocUpdateStatus(input) {
      return (await request("planDoc.updateStatus", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["planDocUpdateStatus"]>>
      >;
    },
    async mailboxList(sessionID) {
      return (await request("mailbox.list", sessionID ? { sessionID } : undefined)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["mailboxList"]>>
      >;
    },
    async mailboxSend(input) {
      return (await request("mailbox.send", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["mailboxSend"]>>
      >;
    },
    async mailboxAcknowledge(messageID, sessionID) {
      return (await request("mailbox.acknowledge", { messageID, sessionID })) as Awaited<
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
    async chatMessages(channel, sessionID) {
      return (await request("chat.messages", { channel, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["chatMessages"]>>
      >;
    },
    async subagents() {
      return (await request("session.subagents")) as Awaited<
        ReturnType<NonNullable<RuntimeClient["subagents"]>>
      >;
    },
    async subagentHistory(sessionID) {
      return (await request("subagent.history", sessionID)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["subagentHistory"]>>
      >;
    },
    async uploadAttachment(input) {
      return (await request("attachment.upload", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["uploadAttachment"]>>
      >;
    },
    async attachmentDataUrl(input) {
      return (await request("attachment.dataUrl", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["attachmentDataUrl"]>>
      >;
    },
    async chatSubmit(input) {
      return (await request("chat.submit", input)) as Awaited<
        ReturnType<NonNullable<RuntimeClient["chatSubmit"]>>
      >;
    },
    async chatAbort(channel, sessionID) {
      return (await request("chat.abort", { channel, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["chatAbort"]>>
      >;
    },
    async chatRollback(input, channel, sessionID) {
      return (await request("chat.rollback", { input, channel, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["chatRollback"]>>
      >;
    },
    async chatModelProfile(channel, sessionID) {
      return (await request("chat.model.profile", { channel, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["chatModelProfile"]>>
      >;
    },
    async setChatModelProfile(profile, channel, sessionID) {
      return (await request("chat.model.profile.set", { profile, channel, sessionID })) as Awaited<
        ReturnType<NonNullable<RuntimeClient["setChatModelProfile"]>>
      >;
    },
    async dispose() {
      await request("dispose");
      port.removeEventListener("message", onMessage);
      port.close?.();
    },
    cancel(reason, sessionID) {
      notify("cancel", { reason, sessionID });
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
    async diagnostics(limit, sessionID) {
      return (await request("diagnostics", { limit, sessionID })) as Awaited<
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
  if (request.method === "submitAndWait") {
    const input =
      request.value && typeof request.value === "object"
        ? (request.value as SubmitInput)
        : { text: String(request.value ?? "") };
    if (client.submitAndWait)
      return await client.submitAndWait(
        request.value && typeof request.value === "object"
          ? (request.value as SubmitInput)
          : input.text,
      );
    throw new Error("RuntimeClient does not support submitAndWait");
  }
  if (request.method === "interactive.pending") {
    if (!client.pendingInteractive)
      throw new Error("RuntimeClient does not support interactive.pending");
    return await client.pendingInteractive();
  }
  if (request.method === "runtime.status")
    return await client.runtimeStatus?.();
  if (request.method === "history")
    return await client.history?.(request.value as never);
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
  if (request.method === "workspace.write")
    return await client.workspaceWrite?.(request.value as never);
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
    return await client.nativeTerminalList?.(
      (request.value as { sessionID?: string } | undefined)?.sessionID,
    );
  if (request.method === "native-terminal.read") {
    const value = request.value as { id: string; sessionID?: string };
    return await client.nativeTerminalRead?.(value.id, value.sessionID);
  }
  if (request.method === "native-terminal.open-hub")
    return await client.nativeTerminalOpenHub?.();
  if (request.method === "native-terminal.release-human-control") {
    const value = request.value as { id: string; sessionID?: string };
    return await client.nativeTerminalReleaseHumanControl?.(value.id, value.sessionID);
  }
  if (request.method === "diagnostics") {
    const value = request.value as { limit?: number; sessionID?: string } | number | undefined;
    return await client.diagnostics?.(
      typeof value === "number" ? value : value?.limit,
      typeof value === "number" ? undefined : value?.sessionID,
    );
  }
  if (request.method === "native-terminal.revoke-approval-scope") {
    const value = request.value as { id: string; sessionID?: string };
    return await client.nativeTerminalRevokeApprovalScope?.(value.id, value.sessionID);
  }
  if (request.method === "native-terminal.stop") {
    const value = request.value as { id: string; sessionID?: string };
    return await client.nativeTerminalStop?.(value.id, value.sessionID);
  }
  if (request.method === "native-terminal.begin-secure-input") {
    const value = request.value as { id: string; sessionID?: string };
    return await client.nativeTerminalBeginSecureInput?.(value.id, value.sessionID);
  }
  if (request.method === "native-terminal.end-secure-input") {
    const value = request.value as { id: string; sessionID?: string };
    return await client.nativeTerminalEndSecureInput?.(value.id, value.sessionID);
  }
  if (request.method === "checkpoint.list")
    return await client.checkpointList?.(
      (request.value as { sessionID?: string } | undefined)?.sessionID,
    );
  if (request.method === "workspace.diff")
    return await client.workspaceDiff?.();
  if (request.method === "workspace.git.diff")
    return await client.workspaceGitDiff?.(
      request.value as { from?: string; to?: string; path?: string } | undefined,
    );
  if (request.method === "git.refs")
    return await client.gitRefs?.();
  if (request.method === "team.pr.list")
    return await client.teamPRList?.();
  if (request.method === "checkpoint.preview") {
    const value = request.value as { id: string; sessionID?: string };
    return await client.checkpointPreview?.(value.id, value.sessionID);
  }
  if (request.method === "checkpoint.rollback")
    return await client.checkpointRollback?.(
      request.value as { id: string; dryRun?: boolean; sessionID?: string },
    );
  if (request.method === "checkpoint.rename")
    return await client.checkpointRename?.(
      request.value as { id: string; name: string; sessionID?: string },
    );
  if (request.method === "cancel") {
    const value = request.value as { reason?: unknown; sessionID?: string } | string | undefined;
    return client.cancel(
      typeof value === "string"
        ? value
        : typeof value?.reason === "string"
          ? value.reason
          : undefined,
      typeof value === "string" ? undefined : value?.sessionID,
    );
  }
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
  if (request.method === "session.rollback.messages") {
    const input = request.value as { id: string; turnID: string };
    return await client.sessionRollbackMessages?.(input.id, input.turnID);
  }
  if (request.method === "sandbox.list") return await client.sandboxList?.();
  if (request.method === "sandbox.diff")
    return await client.sandboxDiff?.(request.value as string);
  if (request.method === "sandbox.resources")
    return await client.sandboxResources?.(request.value as string);
  if (request.method === "sandbox.resource-output")
    return await client.sandboxResourceOutput?.(
      request.value as { id: string; resourceID: string; maxBytes?: number; sessionID?: string },
    );
  if (request.method === "sandbox.resource-stop")
    return await client.sandboxResourceStop?.(
      request.value as { id: string; resourceID: string; sessionID?: string },
    );
  if (request.method === "sandbox.merge") {
    const value = request.value as { id: string; sessionID?: string };
    return await client.sandboxMerge?.(value.id, value.sessionID);
  }
  if (request.method === "sandbox.delete") {
    const value = request.value as { id: string; sessionID?: string };
    return await client.sandboxDelete?.(value.id, value.sessionID);
  }
  if (request.method === "agent.select")
    return await client.selectAgent?.(request.value as string);
  if (request.method === "session.snapshot")
    return await client.sessionSnapshot?.(
      (request.value as { sessionID?: string } | undefined)?.sessionID,
    );
  if (request.method === "planDoc.list")
    return await client.planDocList?.(
      (request.value as { sessionID?: string } | undefined)?.sessionID,
    );
  if (request.method === "planDoc.read")
    return await client.planDocRead?.(request.value as never);
  if (request.method === "planDoc.write")
    return await client.planDocWrite?.(request.value as never);
  if (request.method === "planDoc.mark")
    return await client.planDocMark?.(request.value as never);
  if (request.method === "planDoc.delete") {
    const value = request.value as { planID: string; sessionID?: string };
    return await client.planDocDelete?.(value.planID, value.sessionID);
  }
  if (request.method === "planDoc.status") {
    const value = request.value as { planID: string; sessionID?: string };
    return await client.planDocStatus?.(value.planID, value.sessionID);
  }
  if (request.method === "planDoc.updateStatus")
    return await client.planDocUpdateStatus?.(request.value as never);
  if (request.method === "mailbox.list")
    return await client.mailboxList?.(
      (request.value as { sessionID?: string } | undefined)?.sessionID,
    );
  if (request.method === "mailbox.send")
    return await client.mailboxSend?.(request.value as never);
  if (request.method === "mailbox.acknowledge") {
    const value = request.value as { messageID: string; sessionID?: string };
    return await client.mailboxAcknowledge?.(value.messageID, value.sessionID);
  }
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
  if (request.method === "chat.messages") {
    const value = request.value as
      | { channel?: import("@natalia/contracts").ChatChannel; sessionID?: string }
      | undefined;
    return await client.chatMessages?.(value?.channel, value?.sessionID);
  }
  if (request.method === "session.subagents")
    return await client.subagents?.();
  if (request.method === "subagent.history")
    return await client.subagentHistory?.(request.value as never);
  if (request.method === "attachment.upload")
    return await client.uploadAttachment?.(request.value as never);
  if (request.method === "attachment.dataUrl")
    return await client.attachmentDataUrl?.(request.value as never);
  if (request.method === "chat.submit")
    return await client.chatSubmit?.(request.value as never);
  if (request.method === "chat.abort") {
    const value = request.value as
      | { channel?: import("@natalia/contracts").ChatChannel; sessionID?: string }
      | undefined;
    return await client.chatAbort?.(value?.channel, value?.sessionID);
  }
  if (request.method === "chat.rollback") {
    const value = request.value as {
      input: { toMessageID: string };
      channel?: import("@natalia/contracts").ChatChannel;
      sessionID?: string;
    };
    return await client.chatRollback?.(value.input, value.channel, value.sessionID);
  }
  if (request.method === "chat.model.profile") {
    const value = request.value as
      | { channel?: import("@natalia/contracts").ChatChannel; sessionID?: string }
      | undefined;
    return await client.chatModelProfile?.(value?.channel, value?.sessionID);
  }
  if (request.method === "chat.model.profile.set") {
    const value = request.value as {
      profile: import("@natalia/contracts").ChatModelProfile;
      channel?: import("@natalia/contracts").ChatChannel;
      sessionID?: string;
    };
    return await client.setChatModelProfile?.(
      value.profile,
      value.channel,
      value.sessionID,
    );
  }
  if (request.method === "approval")
    return client.respondApproval(request.value as ApprovalResponse);
  if (request.method === "question")
    return client.respondQuestion(request.value as QuestionResponse);
  if (request.method === "runtime.availability")
    return describeRuntimeCapabilities(client, {
      name: "worker",
      routedMembers: WORKER_ROUTED_MEMBERS,
    });
  if (request.method === "command.catalog")
    return await client.commandCatalog?.();
  if (request.method === "command.execute")
    return await client.commandExecute?.(request.value as never);
  throw new Error(`worker channel does not route ${request.method}`);
}
