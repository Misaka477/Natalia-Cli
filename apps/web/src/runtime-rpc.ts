import type {
  ApprovalResponse,
  ChatModelProfile,
  QuestionResponse,
  RuntimeEvent,
  RuntimeClient,
  RuntimeModelCatalogEntry,
  RuntimeModelSelection,
  RuntimeReasoningEffort,
  RuntimeHistory,
  RuntimeHistoryEvent,
  RuntimeSessionSummary,
  RuntimeWorkspaceMatch,
  RuntimeWorkspaceListPage,
  RuntimeWorkspaceContent,
  ConfigV3,
  WorkspaceSummary,
  WorkspacePermissionSettings,
  WorkspaceToolSettings,
} from "@natalia/contracts";
import { callRuntimeRPC } from "@natalia/transport";

export const RPC_METHOD_ROUTES: Record<string, string> = {
  submit: "prompt",
  submitAndWait: "submit.andWait",
  cancel: "cancel",
  snapshot: "snapshot",
  respondApproval: "approval.respond",
  respondQuestion: "question.respond",
  pendingInteractive: "interactive.pending",
  history: "session.history",
  messages: "session.messages",
  pause: "pause",
  resume: "resume",
  canReloadConfig: "config.canReload",
  reloadConfig: "config.reload",
  updateConfig: "config.update",
  configGet: "config.get",
  settingsGet: "settings.get",
  settingsSet: "settings.set",
  agents: "agent.list",
  selectAgent: "agent.select",
  modelCatalog: "model.catalog",
  modelSelection: "model.selection",
  selectModel: "model.select",
  reasoningEffort: "model.reasoning",
  setReasoningEffort: "model.reasoning.set",
  skills: "skills.list",
  workspaceFiles: "workspace.files",
  workspaceSearch: "workspace.search",
  workspaceList: "workspace.list",
  workspaceRead: "workspace.read",
  workspaceGlob: "workspace.glob",
  workspaceWrite: "workspace.write",
  workspaceRoots: "workspace.roots",
  workspaceAdd: "workspace.add",
  workspaceRemove: "workspace.remove",
  workspaceActivate: "workspace.activate",
  workspacePermissionGet: "workspace.permission.get",
  workspacePermissionSet: "workspace.permission.set",
  workspaceToolGet: "workspace.tool.get",
  workspaceToolSet: "workspace.tool.set",
  checkpointList: "checkpoint.list",
  checkpointPreview: "checkpoint.preview",
  checkpointRollback: "checkpoint.rollback",
  sandboxList: "sandbox.list",
  sandboxDiff: "sandbox.diff",
  sandboxResources: "sandbox.resources",
  sandboxResourceOutput: "sandbox.resource.output",
  sandboxMerge: "sandbox.merge",
  sandboxDelete: "sandbox.delete",
  sandboxResourceStop: "sandbox.resource.stop",
  sessionList: "session.list",
  sessionTouch: "session.touch",
  sessionRename: "session.rename",
  sessionPin: "session.pin",
  sessionDuplicate: "session.duplicate",
  sessionFork: "session.fork",
  sessionDelete: "session.delete",
  sessionNew: "session.new",
  sessionArchive: "session.archive",
  sessionRestore: "session.restore",
  sessionExport: "session.export",
  sessionAttach: "session.attach",
  mcpCatalog: "mcp.catalog",
  getMcpPrompt: "mcp.prompt",
  readMcpResource: "mcp.resource",
  mcpServerAdd: "mcp.server.add",
  mcpServerRemove: "mcp.server.remove",
  permissionList: "permission.list",
  permissionSave: "permission.save",
  permissionDelete: "permission.delete",
  agentCreate: "agent.create",
  agentUpdate: "agent.update",
  agentDelete: "agent.delete",
  providerDiscover: "provider.discover",
  providerAdd: "provider.add",
  providerRemove: "provider.remove",
  pluginUnload: "plugin.unload",
  pluginReload: "plugin.reload",
  pluginInstall: "plugin.install",
  pluginUninstall: "plugin.uninstall",
  pluginSetEnabled: "plugin.set-enabled",
  pluginCatalog: "plugin.catalog",
  toolFamilyReload: "tools.reload",
  plugins: "plugin.list",
  commandCatalog: "command.catalog",
  commandExecute: "command.execute",
  taskOverview: "task.overview",
  flowOverview: "flow.overview",
  documentCatalog: "document.catalog",
  runtimeStatus: "runtime.status",
  diagnostics: "diagnostics.list",
  workGraphNodes: "workgraph.nodes",
  workGraphEdges: "workgraph.edges",
  nativeTerminalList: "nativeTerminal.list",
  nativeTerminalRead: "nativeTerminal.read",
  nativeTerminalStop: "nativeTerminal.stop",
  nativeTerminalClaimHumanInput: "nativeTerminal.claimHumanInput",
  nativeTerminalOpenHub: "nativeTerminal.openHub",
  nativeTerminalRevokeApprovalScope: "nativeTerminal.revokeApprovalScope",
  nativeTerminalReleaseHumanControl: "nativeTerminal.releaseHumanControl",
  nativeTerminalBeginSecureInput: "nativeTerminal.beginSecureInput",
  nativeTerminalEndSecureInput: "nativeTerminal.endSecureInput",
  nativeTerminalStart: "nativeTerminal.start",
  nativeTerminalWrite: "nativeTerminal.write",
  nativeTerminalResize: "nativeTerminal.resize",
  constitutionRules: "constitution.rules",
  decisionRecords: "decision.records",
  recordDecision: "decision.record",
  evidenceRecords: "evidence.records",
  recordValidation: "evidence.record",
  completions: "completion.records",
  recordCompletion: "completion.record",
  driftFindings: "drift.findings",
  evaluateDrift: "drift.evaluate",
  acknowledgeDriftFinding: "drift.acknowledge",
  confirmedWorkspaceChanges: "observation.confirmed",
  workspaceDiff: "workspace.diff",
  workspaceGitDiff: "workspace.git.diff",
  gitRefs: "git.refs",
  teamPRList: "team.pr.list",
  registeredTools: "tools.registered",
  requestOverride: "constitution.override.request",
  approveOverride: "constitution.override.approve",
  projectionContributions: "projections.list",
  mailboxList: "mailbox.list",
  mailboxSend: "mailbox.send",
  mailboxDeliver: "mailbox.deliver",
  mailboxAcknowledge: "mailbox.acknowledge",
  mailboxDefer: "mailbox.defer",
  mailboxSupersede: "mailbox.supersede",
  planList: "plan.list",
  planCreate: "plan.create",
  planUpdate: "plan.update",
  planPropose: "plan.propose",
  planAccept: "plan.accept",
  planQueue: "plan.queue",
  planActivate: "plan.activate",
  planSupersede: "plan.supersede",
  planCompleted: "plan.complete",
  capabilities: "capabilities",
  sessionSnapshot: "session.snapshot",
  submitInput: "submit.input",
  chatMessages: "chat.messages",
  chatSubmit: "chat.submit",
  chatAbort: "chat.abort",
  chatRollback: "chat.rollback",
  saveFlowDocument: "flow.save",
  deleteFlowDocument: "flow.delete",
  saveTaskDocument: "task.save",
  deleteTaskDocument: "task.delete",
  taskSchedule: "task.schedule",
  taskUnschedule: "task.unschedule",
  taskPermissionPreview: "task.preview",
  taskPermissionPreviewDocument: "task.preview-document",
  loadTaskDocument: "task.load",
  loadFlowDocument: "flow.load",
  installExampleDocuments: "flow.install-examples",
  previewSystemdCalendar: "task.preview-calendar",
  permissionProfileUsage: "task.permission-usage",
  decomposeFlowConditions: "flow.decompose-conditions",
};

const RPC_PARAM_NAMES: Record<string, string[]> = {
  checkpointPreview: ["id"],
  sessionTouch: ["id"],
  sessionRename: ["id", "title"],
  sessionPin: ["id", "pinned"],
  sessionDuplicate: ["id", "title"],
  sessionFork: ["id", "turnID", "title"],
  sessionDelete: ["id"],
  sessionArchive: ["id"],
  sessionRestore: ["id"],
  sessionExport: ["id"],
  sessionAttach: ["id"],
  sandboxDiff: ["id"],
  sandboxDelete: ["id"],
  sandboxResourceOutput: ["id", "resourceID", "maxBytes"],
  sandboxResourceStop: ["id", "resourceID"],
  mcpServerRemove: ["name"],
  permissionDelete: ["name"],
  agentDelete: ["name"],
  providerRemove: ["name"],
  pluginUnload: ["id"],
  pluginReload: ["id"],
  nativeTerminalRead: ["id"],
  nativeTerminalStop: ["id"],
  nativeTerminalClaimHumanInput: ["id"],
  nativeTerminalRevokeApprovalScope: ["id"],
  nativeTerminalReleaseHumanControl: ["id"],
  nativeTerminalBeginSecureInput: ["id"],
  nativeTerminalEndSecureInput: ["id"],
  nativeTerminalWrite: ["id", "input", "idempotencyKey"],
  nativeTerminalResize: ["id", "rows", "cols"],
  nativeTerminalStart: ["command", "cwd", "id", "sessionID", "agentID"],
  taskPermissionPreview: ["path"],
  taskPermissionPreviewDocument: ["path"],
  loadTaskDocument: ["path"],
  loadFlowDocument: ["path"],
  previewSystemdCalendar: ["calendar"],
  diagnostics: ["limit"],
  diagnosticsList: ["limit"],
  getMcpPrompt: ["server", "prompt"],
  readMcpResource: ["server", "resource"],
  taskSchedule: ["path", "calendar", "scope", "executable", "cliEntry"],
  taskUnschedule: ["path"],
  providerDiscover: ["type", "baseURL", "apiKey"],
  providerAdd: ["name", "type", "baseURL", "apiKey"],
  saveFlowDocument: ["path", "document"],
  deleteFlowDocument: ["path"],
  saveTaskDocument: ["path", "document"],
  deleteTaskDocument: ["path"],
  agentCreate: ["name", "config"],
  agentUpdate: ["name", "config"],
  permissionSave: ["name", "profile"],
  mcpServerAdd: ["name", "config"],
  commandExecute: ["command", "args"],
  recordDecision: ["decision"],
  recordValidation: ["evidence"],
  recordCompletion: ["completion"],
  evaluateDrift: ["findingID"],
  acknowledgeDriftFinding: ["findingID"],
  requestOverride: ["request"],
  approveOverride: ["approval"],
  mailboxSend: ["message"],
  mailboxDeliver: ["messageID"],
  mailboxAcknowledge: ["messageID"],
  mailboxDefer: ["messageID"],
  mailboxSupersede: ["messageID"],
  planCreate: ["plan"],
  planUpdate: ["plan"],
  planPropose: ["plan"],
  planAccept: ["plan"],
  planQueue: ["plan"],
  planActivate: ["plan"],
  planSupersede: ["plan"],
  planCompleted: ["plan"],
  installExampleDocuments: ["includeTasks"],
  permissionProfileUsage: ["workspaceRoot"],
  decomposeFlowConditions: ["flow"],
};

function buildParams(member: string, args: unknown[]) {
  const names = RPC_PARAM_NAMES[member];
  if (!names) {
    if (args.length === 0) return undefined;
    const first = args[0];
    if (typeof first === "object" && first !== null) return first as Record<string, unknown>;
    return { value: first };
  }
  const params: Record<string, unknown> = {};
  for (let index = 0; index < names.length; index++) params[names[index]] = args[index];
  return params;
}

const HISTORY_PAGE_SIZE = 2000;
const HISTORY_PARALLELISM = 8;

export type WebRuntimeOptions = {
  url: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
};

/**
 * Real browser runtime client. It speaks the framework RPC protocol to a
 * running Natalia runtime/daemon and consumes the /events SSE stream.
 */
export function createWebRuntimeClient(
  options: WebRuntimeOptions,
): RuntimeClient {
  const call = <T>(method: string, params?: Record<string, unknown>) =>
    callRuntimeRPC<T>({
      url: options.url,
      token: options.token,
      method,
      params,
      fetch: options.fetch,
    });

  const starts: Array<(event: RuntimeEvent) => void> = [];
  let started = false;

  const historyCache = new Map<string, RuntimeHistoryEvent[]>();
  const HISTORY_CACHE_LIMIT = 3;

  async function replayHistory(sessionID?: string, total?: number) {
    const replayGlobal = globalThis as unknown as {
      __nataliaReplayingHistory?: boolean;
    };
    replayGlobal.__nataliaReplayingHistory = true;
    try {
      if (total && total > 0) {
        // Fast path: we already fetched this session recently and the event
        // count has not grown, so replay the cached events instead of issuing
        // another batch of RPCs.
        const cached = sessionID ? historyCache.get(sessionID) : undefined;
        if (cached && cached.length >= total) {
          for (const entry of cached)
            for (const listener of starts) listener(entry.event);
          return;
        }
        // If the session list told us the event count, fetch all pages in
        // parallel instead of walking one after another. This turns N serial
        // RPC round-trips into a single parallel batch.
        const pages = Math.ceil(total / HISTORY_PAGE_SIZE);
        const pageResults: RuntimeHistory[] = new Array(pages);
        // Avoid opening hundreds of simultaneous RPCs on very long sessions;
        // fetch in bounded parallel batches.
        for (let start = 0; start < pages; start += HISTORY_PARALLELISM) {
          const end = Math.min(start + HISTORY_PARALLELISM, pages);
          const batch = await Promise.all(
            Array.from({ length: end - start }, (_, index) =>
              call<RuntimeHistory>("session.history", {
                offset: (start + index) * HISTORY_PAGE_SIZE,
                limit: HISTORY_PAGE_SIZE,
              }),
            ),
          );
          for (let index = 0; index < batch.length; index++)
            pageResults[start + index] = batch[index]!;
        }
        if (sessionID) {
          const entries = pageResults.flatMap((page) => page.events);
          if (historyCache.size >= HISTORY_CACHE_LIMIT) {
            const oldest = historyCache.keys().next().value;
            if (oldest !== undefined) historyCache.delete(oldest);
          }
          historyCache.set(sessionID, entries);
        }
        for (const page of pageResults) {
          for (const entry of page.events)
            for (const listener of starts) listener(entry.event);
        }
      } else {
        let after = 0;
        while (true) {
          const page = await call<RuntimeHistory>("session.history", {
            after,
            limit: HISTORY_PAGE_SIZE,
          });
          for (const entry of page.events)
            for (const listener of starts) listener(entry.event);
          if (!page.hasMore || !page.events.length) break;
          after = page.events[page.events.length - 1]!.seq;
        }
      }
    } catch (error) {
      console.log("[web-runtime] history replay failed", error);
    } finally {
      replayGlobal.__nataliaReplayingHistory = false;
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("natalia:history-replay-complete"));
    }
  }

  async function start(onEvent: (event: RuntimeEvent) => void) {
    console.log("[web-runtime] start called", "listener added");
    starts.push(onEvent);
    if (started) return;
    started = true;

    const response = await (options.fetch ?? globalThis.fetch)(
      new URL("/events", options.url),
      {
        headers: options.token
          ? { authorization: `Bearer ${options.token}` }
          : undefined,
        signal: (globalThis as { __NATALIA_ABORT?: AbortController }).__NATALIA_ABORT?.signal,
      },
    );
    if (!response.ok || !response.body) return;

    // On page load, prefer the most recent non-archived session over the
    // runtime's deterministic default session. This makes a reload/reopen
    // resume the last conversation (session.list is ordered by last activity,
    // with pinned sessions first). If the list/attach is unavailable, keep the
    // runtime's current session.
    let newest: RuntimeSessionSummary | undefined;
    try {
      const sessions = await call<RuntimeSessionSummary[]>("session.list");
      newest = sessions.find((session) => !session.archived);
      if (newest) {
        await call("session.attach", { id: newest.id });
        if (typeof window !== "undefined")
          window.dispatchEvent(
            new CustomEvent("natalia:recent-session-restored", {
              detail: { sessionID: newest.id },
            }),
          );
      }
    } catch (error) {
      console.log("[web-runtime] recent session restore failed", error);
    }

    // Replay the full durable session so a reloaded page sees previous
    // messages. If the session list gave us the event count, fetch all pages in
    // parallel; otherwise fall back to the sequential after-cursor walk.
    await replayHistory(newest?.id, newest?.events);

    const decoder = new TextDecoder();
    let buffer = "";
    let current: RuntimeEvent | null = null;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            current = JSON.parse(line.slice(6)) as RuntimeEvent;
            console.log("[web-runtime] sse event", current.type);
          } catch {
            current = null;
          }
        } else if (line === "" && current) {
          for (const listener of starts) listener(current);
          current = null;
        }
      }
    }
  }

  const impl: RuntimeClient = {
    start,
    async submit(text) {
      console.log("[web-runtime] submit", text);
      return (await call("prompt", { text })) as never;
    },
    async submitInput(input) {
      return (await call("submit.input", { ...(input as Record<string, unknown>) })) as never;
    },
    async submitAndWait(input) {
      return (await call(
        "submit.andWait",
        typeof input === "string"
          ? { text: input }
          : { ...(input as Record<string, unknown>) },
      )) as never;
    },
    async chatSubmit(input) {
      return (await call("chat.submit", { ...(input as Record<string, unknown>) })) as { messageID: string };
    },
    async chatAbort() {
      return (await call("chat.abort")) as { aborted: boolean };
    },
    cancel(reason) {
      void call("cancel", { reason });
    },
    async modelCatalog() {
      return (await call<RuntimeModelCatalogEntry[]>("model.catalog")) as never;
    },
    async modelSelection() {
      return (await call<RuntimeModelSelection>("model.selection")) as never;
    },
    async selectModel(modelID, variant) {
      await call("model.select", { modelID, variant });
    },
    async reasoningEffort() {
      return (await call<RuntimeReasoningEffort>("model.reasoning")) as never;
    },
    async setReasoningEffort(effort) {
      await call("model.reasoning.set", { effort });
    },
    async chatModelProfile() {
      return (await call<ChatModelProfile>("chat.model.profile")) as never;
    },
    async setChatModelProfile(profile) {
      return (await call("chat.model.profile.set", { profile })) as never;
    },
    async checkpointList() {
      return (await call("checkpoint.list")) as never;
    },
    async checkpointRollback(input) {
      return (await call("checkpoint.rollback", { ...(input as Record<string, unknown>) })) as never;
    },
    snapshot() {
      void call("snapshot");
      return {
        type: "snapshot.created",
        id: "snap_web",
        files: [],
      } as never;
    },
    diagnostic(message, level) {
      void call("diagnostic", { message, level });
    },
    lastSubmission() {
      return undefined;
    },
    respondApproval(response: ApprovalResponse) {
      void call("approval.respond", { ...response });
      return { accepted: true };
    },
    respondQuestion(response: QuestionResponse) {
      void call("question.respond", { ...response });
      return { accepted: true };
    },
    async sessionList() {
      return (await call<RuntimeSessionSummary[]>("session.list")) as never;
    },
    async sessionNew(input) {
      return (await call("session.new", { ...(input as Record<string, unknown>) })) as never;
    },
    async sessionAttach(id) {
      const result = await call<RuntimeSessionSummary>("session.attach", { id });
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("natalia:session-switch-reset"));
      // Resolve the target's event count so the switch replay can fetch pages
      // in parallel too. If lookup fails, replayHistory falls back to the
      // sequential cursor walk.
      let total: number | undefined;
      try {
        const sessions = await call<RuntimeSessionSummary[]>("session.list");
        total = sessions.find((session) => session.id === id)?.events;
      } catch {
        total = undefined;
      }
      await replayHistory(id, total);
      return result as never;
    },
    async sessionDuplicate(id, title) {
      return (await call("session.duplicate", { id, title })) as never;
    },
    async workspaceRoots() {
      return (await call<WorkspaceSummary[]>("workspace.roots")) as never;
    },
    async workspaceAdd(input) {
      return (await call<WorkspaceSummary>("workspace.add", { ...input })) as never;
    },
    async workspaceRemove(workspaceID) {
      return (await call("workspace.remove", { workspaceID })) as { removed: boolean };
    },
    async workspaceActivate(workspaceID) {
      return (await call<WorkspaceSummary>("workspace.activate", { workspaceID })) as never;
    },
    async workspacePermissionGet(workspaceID) {
      return (await call<WorkspacePermissionSettings>("workspace.permission.get", { workspaceID })) as never;
    },
    async workspacePermissionSet(workspaceID, settings) {
      return (await call<WorkspacePermissionSettings>("workspace.permission.set", { workspaceID, settings })) as never;
    },
    async workspaceToolGet(workspaceID) {
      return (await call<WorkspaceToolSettings>("workspace.tool.get", { workspaceID })) as never;
    },
    async workspaceToolSet(workspaceID, settings) {
      return (await call<WorkspaceToolSettings>("workspace.tool.set", { workspaceID, settings })) as never;
    },
    async workspaceSearch(input) {
      return (await call<RuntimeWorkspaceMatch[]>("workspace.search", { ...input })) as never;
    },
    async workspaceList(input) {
      return (await call<RuntimeWorkspaceListPage>("workspace.list", { ...input })) as never;
    },
    async workspaceRead(input) {
      return (await call<RuntimeWorkspaceContent>("workspace.read", { ...input })) as never;
    },
    async workspaceWrite(input) {
      return (await call("workspace.write", { ...input })) as never;
    },
    async configGet() {
      return (await call<ConfigV3>("config.get")) as never;
    },
    async updateConfig(input) {
      return (await call("config.update", { ...input })) as never;
    },
    async mcpServerAdd(input) {
      return (await call("mcp.server.add", { ...input })) as never;
    },
    async mcpServerRemove(name) {
      return (await call("mcp.server.remove", { name })) as never;
    },
    async providerAdd(input) {
      return (await call("provider.add", { ...input })) as never;
    },
    async saveFlowDocument(input) {
      return (await call("flow.save", { ...(input as Record<string, unknown>) })) as never;
    },
    async deleteFlowDocument(input) {
      return (await call("flow.delete", { ...(input as Record<string, unknown>) })) as never;
    },
    async saveTaskDocument(input) {
      return (await call("task.save", { ...(input as Record<string, unknown>) })) as never;
    },
    async deleteTaskDocument(input) {
      return (await call("task.delete", { ...(input as Record<string, unknown>) })) as never;
    },
    async dispose() {},
  };

  return new Proxy(impl, {
    get(target, prop) {
      if (prop in target) return (target as Record<PropertyKey, unknown>)[prop];
      const member = String(prop);
      const route = RPC_METHOD_ROUTES[member];
      if (!route) return undefined;
      return async (...args: unknown[]) =>
        call<unknown>(route, buildParams(member, args));
    },
  }) as RuntimeClient;
}
