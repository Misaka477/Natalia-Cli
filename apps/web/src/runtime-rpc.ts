import type {
  ApprovalResponse,
  ChatModelProfile,
  QuestionResponse,
  RuntimeEvent,
  RuntimeClient,
  RuntimeModelCatalogEntry,
  RuntimeModelSelection,
  RuntimeReasoningEffort,
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

type ElectronGlobal = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  on<T>(channel: string, listener: (payload: T) => void): () => void;
};

function getElectronGlobal(): ElectronGlobal | undefined {
  return (globalThis as { electron?: ElectronGlobal }).electron;
}

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
  checkpointRename: "checkpoint.rename",
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
  sessionRollbackMessages: "session.rollback.messages",
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
  planDocList: "planDoc.list",
  planDocRead: "planDoc.read",
  planDocWrite: "planDoc.write",
  planDocMark: "planDoc.mark",
  planDocDelete: "planDoc.delete",
  planDocStatus: "planDoc.status",
  capabilities: "capabilities",
  sessionSnapshot: "session.snapshot",
  submitInput: "submit.input",
  chatMessages: "chat.messages",
  subagents: "session.subagents",
  subagentHistory: "subagent.history",
  uploadAttachment: "attachment.upload",
  attachmentDataUrl: "attachment.dataUrl",
  chatSubmit: "chat.submit",
  chatAbort: "chat.abort",
  chatRollback: "chat.rollback",
};

const RPC_PARAM_NAMES: Record<string, string[]> = {
  checkpointPreview: ["id"],
  checkpointRename: ["id", "name"],
  subagentHistory: ["sessionID"],
  sessionTouch: ["id"],
  sessionRename: ["id", "title"],
  sessionPin: ["id", "pinned"],
  sessionDuplicate: ["id", "title"],
  sessionFork: ["id", "turnID", "title"],
  sessionRollbackMessages: ["id", "turnID"],
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
  diagnostics: ["limit"],
  diagnosticsList: ["limit"],
  getMcpPrompt: ["server", "prompt"],
  readMcpResource: ["server", "resource"],
  providerDiscover: ["type", "baseURL", "apiKey"],
  providerAdd: ["name", "type", "baseURL", "apiKey"],
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
  planDocRead: ["input"],
  planDocWrite: ["input"],
  planDocMark: ["input"],
  planDocDelete: ["planID"],
  planDocStatus: ["planID"],
};

function buildParams(member: string, args: unknown[]) {
  const names = RPC_PARAM_NAMES[member];
  if (!names) {
    if (args.length === 0) return undefined;
    const first = args[0];
    if (typeof first === "object" && first !== null)
      return first as Record<string, unknown>;
    return { value: first };
  }
  const params: Record<string, unknown> = {};
  for (let index = 0; index < names.length; index++)
    params[names[index]] = args[index];
  return params;
}


export type WebRuntimeOptions = {
  url: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
};

/**
 * Real browser runtime client.
 *
 * In the plain web shell it speaks the framework RPC protocol to a running
 * Natalia runtime/daemon and consumes the /events SSE stream. Inside the
 * Electron desktop shell the same shape is backed by IPC: method calls go
 * through `runtime_call` and runtime events are forwarded from the main process
 * as `natalia-runtime-event` events.
 */
export function createWebRuntimeClient(
  options: WebRuntimeOptions,
): RuntimeClient {
  const electron = getElectronGlobal();
  const call = <T>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> => {
    if (electron) {
      return electron.invoke<T>("runtime_call", {
        method,
        params: params ?? {},
      });
    }
    return callRuntimeRPC<T>({
      url: options.url,
      token: options.token,
      method,
      params,
      fetch: options.fetch,
    });
  };

  function markStartup(phase: string) {
    const global = globalThis as unknown as {
      __nataliaStartupStart?: number;
      __nataliaStartupTimings?: Record<string, number>;
    };
    global.__nataliaStartupStart ??= performance.now();
    const timings = (global.__nataliaStartupTimings ??= {});
    timings[phase] = performance.now() - global.__nataliaStartupStart;
  }

  const starts: Array<(event: RuntimeEvent) => void> = [];
  let started = false;
  let sessionLoadToken = 0;
  let activeSessionID: string | undefined;
  let liveBufferSessionID: string | undefined;
  const liveBuffer: RuntimeEvent[] = [];

  type SessionLoadGlobal = {
    __nataliaReplayingHistory?: boolean;
    __nataliaSessionLoadToken?: number;
  };

  function sessionLoadGlobal(): SessionLoadGlobal {
    return globalThis as SessionLoadGlobal;
  }

  function isCurrentSessionLoad(token: number) {
    return token === sessionLoadToken;
  }

  function beginSessionLoad(sessionID?: string) {
    const token = ++sessionLoadToken;
    liveBufferSessionID = sessionID;
    liveBuffer.length = 0;
    const load = sessionLoadGlobal();
    load.__nataliaSessionLoadToken = token;
    load.__nataliaReplayingHistory = true;
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("natalia:session-switch-reset"));
    return token;
  }

  function emitLive(event: RuntimeEvent) {
    if (sessionLoadGlobal().__nataliaReplayingHistory) {
      // A stale attach may still publish its session.ready after a newer
      // session load has begun; never let another session's buffered events
      // bleed into the current load.
      if (
        liveBufferSessionID &&
        event.sessionID &&
        event.sessionID !== liveBufferSessionID
      )
        return;
      liveBuffer.push(event);
      return;
    }
    for (const listener of starts) listener(event);
  }

  function flushLiveBuffer(token: number) {
    const buffered = liveBuffer.splice(0);
    if (!isCurrentSessionLoad(token)) return;
    for (const event of buffered) emitLive(event);
  }

  function finishSessionLoad(token: number, sessionID?: string) {
    if (!isCurrentSessionLoad(token)) return;
    sessionLoadGlobal().__nataliaReplayingHistory = false;
    liveBufferSessionID = undefined;
    flushLiveBuffer(token);
    markStartup("session.loaded");
    if (typeof window !== "undefined")
      window.dispatchEvent(
        new CustomEvent("natalia:history-replay-complete", {
          detail: { token, sessionID },
        }),
      );
  }

  function sessionRecency(session: RuntimeSessionSummary) {
    return new Date(session.lastAccessedAt ?? session.createdAt).getTime();
  }

  const SESSION_SELECTION_KEY = "natalia:current-session";

  function readPersistedSessionID(): string | undefined {
    try {
      return localStorage.getItem(SESSION_SELECTION_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  }

  function persistSessionID(sessionID: string) {
    try {
      localStorage.setItem(SESSION_SELECTION_KEY, sessionID);
    } catch {
      // Persistence is best-effort; session keep working without it.
    }
  }


  let attachChain = Promise.resolve();

  async function attachAndReplay(id: string) {
    const token = beginSessionLoad(id);
    const run = async () => {
      if (!isCurrentSessionLoad(token)) return undefined;
      try {
        const result = await call<RuntimeSessionSummary>("session.attach", {
          id,
        });
        if (!isCurrentSessionLoad(token)) return undefined;
        activeSessionID = result?.id ?? id;
        persistSessionID(activeSessionID);
        markStartup("session.attach");
        try {
          await call("session.touch", { id });
        } catch {
          // Touch is best-effort so the next boot can pick this session as recent.
        }
        if (!isCurrentSessionLoad(token)) return undefined;
        // Deliberately do not replay the full durable event log on attach.
        // The UI hydrates the transcript from session.messages + the
        // message-first view-store path; this keeps long-session startup
        // proportional to the latest page rather than the whole log.
        finishSessionLoad(token, id);
        return isCurrentSessionLoad(token) ? result : undefined;
      } catch (error) {
        if (isCurrentSessionLoad(token)) finishSessionLoad(token, id);
        throw error;
      }
    };
    const pending = attachChain.then(run, run);
    attachChain = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  async function restoreRecentSession() {
    // On page load, prefer the most recent non-archived session over the
    // runtime's deterministic default session. This makes a reload/reopen
    // resume the last conversation. If the list/attach is unavailable, keep the
    // runtime's current session.
    let newest: RuntimeSessionSummary | undefined;
    try {
      const sessions = await call<RuntimeSessionSummary[]>("session.list");
      markStartup("session.list");
      const recent = sessions
        .filter((session) => !session.archived)
        .sort((a, b) => sessionRecency(b) - sessionRecency(a));
      const persisted = readPersistedSessionID();
      const persistedTarget =
        persisted === undefined
          ? undefined
          : sessions.find((session) => session.id === persisted && !session.archived);
      const touched = recent.filter((session) => session.lastAccessedAt);
      const meaningful = recent.filter(
        (session) => session.title && session.title !== "New session",
      );
      const nonEmpty = recent.filter((session) => session.events > 0);
      const fallbackSource = touched.length
        ? touched
        : meaningful.length
          ? meaningful
          : nonEmpty.length
            ? nonEmpty
            : recent;
      const target = persistedTarget ?? fallbackSource[0];
      newest = target;
      if (newest) {
        if (sessionLoadToken !== 0) return newest;
        const attached = await attachAndReplay(newest.id);
        if (attached && typeof window !== "undefined")
          window.dispatchEvent(
            new CustomEvent("natalia:recent-session-restored", {
              detail: { sessionID: newest.id },
            }),
          );
      } else if (sessionLoadToken === 0) {
        // No session to restore. End the startup replay-guard so live events
        // are delivered normally instead of buffering forever.
        const token = beginSessionLoad();
        finishSessionLoad(token);
      }
    } catch (error) {
      console.log("[web-runtime] recent session restore failed", error);
      if (sessionLoadToken === 0) {
        const token = beginSessionLoad();
        finishSessionLoad(token);
      }
    }
    return newest;
  }

  async function start(onEvent: (event: RuntimeEvent) => void) {
    starts.push(onEvent);
    if (started) return;
    started = true;

    // The /events endpoint replays the server-side event ring buffer on
    // connect. That replay may contain events from every recent session, so
    // hold them in liveBuffer until restoreRecentSession has chosen the
    // startup session; beginSessionLoad then discards pre-target events.
    sessionLoadGlobal().__nataliaReplayingHistory = true;
    liveBuffer.length = 0;
    liveBufferSessionID = undefined;

    // Electron: receive runtime events through the main-process IPC bridge.
    if (electron) {
      electron.on<RuntimeEvent>("natalia-runtime-event", (event) => {
          emitLive(event);
      });
      await restoreRecentSession();
      return;
    }

    void runWebSSE();
  }

  async function runWebSSE() {
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    while (true) {
      if ((globalThis as { __NATALIA_ABORT?: AbortController }).__NATALIA_ABORT?.signal.aborted)
        return;
      try {
        // Before every /events connection, enter the startup/reconnect guard.
        // The server may replay its event ring buffer on connect; those events
        // are only live transport history, not session content. They must never
        // be applied before the current session has been re-attached/resynced.
        sessionLoadGlobal().__nataliaReplayingHistory = true;
        liveBuffer.length = 0;
        liveBufferSessionID = activeSessionID;

        const response = await (options.fetch ?? globalThis.fetch)(
          new URL("/events", options.url),
          {
            headers: options.token
              ? { authorization: `Bearer ${options.token}` }
              : undefined,
            signal: (globalThis as { __NATALIA_ABORT?: AbortController })
              .__NATALIA_ABORT?.signal,
          },
        );
        if (!response.ok || !response.body)
          throw new Error(`[web-runtime] sse connect failed: ${response.status}`);
        markStartup("sse.connected");

        const decoder = new TextDecoder();
        let buffer = "";
        let current: RuntimeEvent | null = null;
        const reader = response.body.getReader();
        let resolveStreamEnd!: () => void;
        const streamEnd = new Promise<void>((resolve) => {
          resolveStreamEnd = resolve;
        });
        void (async () => {
          try {
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
                  } catch {
                    current = null;
                  }
                } else if (line === "" && current) {
                  emitLive(current);
                  current = null;
                }
              }
            }
          } finally {
            resolveStreamEnd();
          }
        })();

        // On the first connection this restores the most recent session. On a
        // reconnect it re-attaches the already-active session and lets the UI
        // re-hydrate the latest message page, closing any history gap.
        if (activeSessionID) await attachAndReplay(activeSessionID);
        else await restoreRecentSession();

        await streamEnd;
        if (
          (globalThis as { __NATALIA_ABORT?: AbortController }).__NATALIA_ABORT
            ?.signal.aborted
        )
          return;
        console.log("[web-runtime] sse stream closed; reconnecting");
      } catch (error) {
        if (
          (globalThis as { __NATALIA_ABORT?: AbortController }).__NATALIA_ABORT
            ?.signal.aborted
        )
          return;
        console.log("[web-runtime] sse error", error);
      }
      await sleep(1000);
    }
  }

  const impl: RuntimeClient = {
    start,
    async submit(text) {
      console.log("[web-runtime] submit", text);
      return (await call("prompt", { text })) as never;
    },
    async submitInput(input) {
      console.log("[web-runtime] submitInput", input);
      try {
        return (await call("submit.input", {
          ...(input as Record<string, unknown>),
        })) as never;
      } catch (cause) {
        console.error("[web-runtime] submitInput failed", cause);
        throw cause;
      }
    },
    async submitAndWait(input) {
      console.log("[web-runtime] submitAndWait", input);
      try {
        return (await call(
          "submit.andWait",
          typeof input === "string"
            ? { text: input }
            : { ...(input as Record<string, unknown>) },
        )) as never;
      } catch (cause) {
        console.error("[web-runtime] submitAndWait failed", cause);
        throw cause;
      }
    },
    async chatSubmit(input) {
      console.log("[web-runtime] chatSubmit", input);
      try {
        const result = await call("chat.submit", {
          ...(input as Record<string, unknown>),
        });
        console.log("[web-runtime] chatSubmit result", result);
        return result as { messageID: string };
      } catch (cause) {
        console.error("[web-runtime] chatSubmit failed", cause);
        throw cause;
      }
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
      return (await call("checkpoint.rollback", {
        ...(input as Record<string, unknown>),
      })) as never;
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
      const event: RuntimeEvent = {
        type: "diagnostic",
        level: level ?? "warning",
        message,
        at: new Date().toISOString(),
      };
      for (const listener of starts) listener(event);
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
      return (await call("session.new", {
        ...(input as Record<string, unknown>),
      })) as never;
    },
    async sessionAttach(id) {
      const result = await attachAndReplay(id);
      return (result ?? { sessionID: id }) as never;
    },
    async sessionDuplicate(id, title) {
      return (await call("session.duplicate", { id, title })) as never;
    },
    async workspaceRoots() {
      return (await call<WorkspaceSummary[]>("workspace.roots")) as never;
    },
    async workspaceAdd(input) {
      return (await call<WorkspaceSummary>("workspace.add", {
        ...input,
      })) as never;
    },
    async workspaceRemove(workspaceID) {
      return (await call("workspace.remove", { workspaceID })) as {
        removed: boolean;
      };
    },
    async workspaceActivate(workspaceID) {
      return (await call<WorkspaceSummary>("workspace.activate", {
        workspaceID,
      })) as never;
    },
    async workspacePermissionGet(workspaceID) {
      return (await call<WorkspacePermissionSettings>(
        "workspace.permission.get",
        { workspaceID },
      )) as never;
    },
    async workspacePermissionSet(workspaceID, settings) {
      return (await call<WorkspacePermissionSettings>(
        "workspace.permission.set",
        { workspaceID, settings },
      )) as never;
    },
    async workspaceToolGet(workspaceID) {
      return (await call<WorkspaceToolSettings>("workspace.tool.get", {
        workspaceID,
      })) as never;
    },
    async workspaceToolSet(workspaceID, settings) {
      return (await call<WorkspaceToolSettings>("workspace.tool.set", {
        workspaceID,
        settings,
      })) as never;
    },
    async workspaceSearch(input) {
      return (await call<RuntimeWorkspaceMatch[]>("workspace.search", {
        ...input,
      })) as never;
    },
    async workspaceList(input) {
      return (await call<RuntimeWorkspaceListPage>("workspace.list", {
        ...input,
      })) as never;
    },
    async workspaceRead(input) {
      return (await call<RuntimeWorkspaceContent>("workspace.read", {
        ...input,
      })) as never;
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
