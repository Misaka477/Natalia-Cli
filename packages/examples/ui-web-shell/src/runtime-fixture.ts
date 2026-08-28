import type {
  ApprovalResponse,
  ChatModelProfile,
  QuestionResponse,
  RuntimeClient,
  RuntimeEvent,
  RuntimeModelCatalogEntry,
  RuntimeReasoningEffort,
  SessionID,
  SubmitInput,
  SubmittedTurn,
} from "@natalia/contracts";
import {
  baselineCheckpoint,
  fixturePreview,
  toRuntimeCheckpoints,
} from "./fixture-checkpoints";

/**
 * Browser-safe fixture runtime for the Phase 1 web host.
 *
 * The shell owns runtime construction. Swap this for a real worker/RPC client
 * later without touching `@natalia/ui-host` or the UI plugin.
 */
export function createWebFixtureRuntime(): RuntimeClient {
  const sessionID = "ses_web_host" as SessionID;
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let turns = 0;
  let chats = 0;
  let activeTurn: string | undefined;
  let chatActive: string | undefined;
  let submission: SubmittedTurn | undefined;
  let modelID = "gpt-5.5-fixture";
  let variant: string | undefined;
  let reasoning: RuntimeReasoningEffort | undefined;
  let chatProfile: ChatModelProfile = {
    normal: { modelID: "gpt-5.5-fixture" },
    expert: { modelID: "opus-fixture", reasoningEffort: "high" },
  };
  const cancelled = new Set<string>();
  const checkpoints: Array<
    Extract<RuntimeEvent, { type: "checkpoint.created" }>
  > = [baselineCheckpoint];
  const publish = (event: RuntimeEvent) => sink?.(event);
  const stillActive = (id: string) => activeTurn === id && !cancelled.has(id);

  const catalog: RuntimeModelCatalogEntry[] = [
    {
      id: "gpt-5.5-fixture",
      name: "GPT 5.5 fixture",
      provider: "fake",
      variants: ["fast"],
    },
    {
      id: "opus-fixture",
      name: "Opus fixture",
      provider: "fake",
      variants: [],
    },
  ];

  const emitTurn = async (input: SubmitInput) => {
    turns += 1;
    const id = `turn_${turns}`;
    activeTurn = id;
    const attachments = (input.attachments ?? []).map((path, index) => ({
      id: `att_${index}`,
      path,
      filename: path.split("/").at(-1) ?? path,
      mediaType: "text/plain" as const,
      byteLength: 12,
      sha256: "web-fixture",
    }));
    const event: SubmittedTurn = {
      type: "turn.submitted",
      id,
      text: input.text,
      byteLength: new TextEncoder().encode(input.text).byteLength,
      lineCount: input.text.split("\n").length,
      sha256: "web-fixture",
      ...(input.delivery ? { delivery: input.delivery } : {}),
      ...(attachments.length ? { attachments } : {}),
    };
    submission = event;
    publish(event);
    if (input.delivery === "steer") {
      publish({ type: "content.done", id, text: `steered: ${input.text}` });
      publish({ type: "turn.finished", id, stopReason: "done" });
      activeTurn = undefined;
      return event;
    }
    publish({ type: "turn.started", id });
    publish({
      type: "status.update",
      status: "thinking",
      detail: "web fixture",
    });
    publish({ type: "thinking.delta", id, text: "working", visible: true });
    publish({ type: "thinking.done", id });
    if (input.text.trim().toLowerCase().startsWith("/modal")) {
      publish({
        type: "approval.request",
        id: "apr_web",
        title: "Approve workspace snapshot?",
        preview: "fake_snapshot would inspect workspace state",
        detail: "fixture approval",
      });
      publish({
        type: "question.request",
        id: "q_web",
        title: "Choose a format",
        questions: [
          {
            id: "format",
            header: "Format",
            question: "Continue?",
            options: [{ label: "continue" }, { label: "cancel" }],
          },
        ],
      });
    } else {
      publish({ type: "content.delta", id, text: "main echo: " });
      publish({ type: "content.done", id, text: `main echo: ${input.text}` });
    }
    if (!stillActive(id)) return event;
    publish({
      type: "checkpoint.created",
      id: `checkpoint_${turns}`,
      reason: "turn_begin",
      turnID: id,
      sequence: turns,
      complete: true,
      files: 4,
      changes: 1,
      contextJournalOffset: turns,
      step: turns,
      tokenEstimate: 256,
      diskUsageBytes: 2048,
    });
    checkpoints.push({
      type: "checkpoint.created",
      id: `checkpoint_${turns}`,
      reason: "turn_begin",
      turnID: id,
      sequence: turns,
      complete: true,
      files: 4,
      changes: 1,
      contextJournalOffset: turns,
      step: turns,
      tokenEstimate: 256,
      diskUsageBytes: 2048,
    });
    publish({ type: "turn.finished", id, stopReason: "done" });
    publish({ type: "status.update", status: "ready", detail: "web fixture" });
    activeTurn = undefined;
    return event;
  };

  return {
    start(onEvent) {
      sink = onEvent;
      publish({
        type: "session.created",
        sessionID,
        title: "Web UI prototype",
      });
      publish({ type: "session.ready", sessionID });
      publish({
        type: "status.update",
        status: "ready",
        detail: "web fixture connected",
      });
      publish({ type: "model.selection", modelID, variant });
      for (const checkpoint of checkpoints) publish(checkpoint);
    },
    async submit(text) {
      return emitTurn({ text });
    },
    async submitInput(input) {
      return emitTurn(input);
    },
    async chatSubmit(input) {
      chats += 1;
      const messageID = `chat_${chats}`;
      chatActive = messageID;
      const at = new Date().toISOString();
      publish({
        type: "chat.turn.started",
        id: messageID,
        messageID,
        startedAt: Date.now(),
      });
      publish({
        type: "chat.message.added",
        id: messageID,
        messageID,
        role: "user",
        text: input.text,
        at,
      });
      const reply =
        input.model?.modelID === chatProfile.expert?.modelID
          ? `expert echo: ${input.text}`
          : `chat echo: ${input.text}`;
      publish({
        type: "chat.message.delta",
        id: `${messageID}:reply`,
        messageID: `${messageID}:reply`,
        text: reply,
      });
      publish({
        type: "chat.message.added",
        id: `${messageID}:reply`,
        messageID: `${messageID}:reply`,
        role: "chat",
        text: reply,
        at,
      });
      publish({
        type: "chat.turn.finished",
        id: messageID,
        messageID,
        stopReason: "done",
        startedAt: Date.now(),
        endedAt: Date.now(),
      });
      chatActive = undefined;
      return { messageID };
    },
    async chatAbort() {
      if (!chatActive) return { aborted: false };
      const messageID = chatActive;
      chatActive = undefined;
      publish({
        type: "chat.turn.finished",
        id: messageID,
        messageID,
        stopReason: "cancelled",
        startedAt: Date.now(),
        endedAt: Date.now(),
      });
      return { aborted: true };
    },
    cancel(reason = "user cancel") {
      if (!activeTurn) return;
      const id = activeTurn;
      activeTurn = undefined;
      cancelled.add(id);
      publish({ type: "turn.cancelled", id, reason });
      publish({ type: "turn.finished", id, stopReason: "cancelled" });
      publish({ type: "status.update", status: "ready", detail: "cancelled" });
    },
    async modelCatalog() {
      return catalog;
    },
    async modelSelection() {
      return { modelID, variant };
    },
    async selectModel(nextModelID, nextVariant) {
      if (nextModelID) modelID = nextModelID;
      variant = nextVariant;
      publish({ type: "model.selection", modelID, variant });
    },
    async reasoningEffort() {
      return reasoning;
    },
    async setReasoningEffort(effort) {
      reasoning = effort;
    },
    async chatModelProfile() {
      return chatProfile;
    },
    async setChatModelProfile(profile) {
      chatProfile = profile;
      return { saved: true };
    },
    async checkpointList() {
      return toRuntimeCheckpoints(checkpoints);
    },
    async checkpointRollback(input) {
      const checkpoint =
        checkpoints.find((entry) => entry.id === input.id) ?? checkpoints[0]!;
      const preview = fixturePreview(checkpoint, Boolean(input.dryRun));
      publish({ type: "rollback.previewed", preview });
      if (input.dryRun) return preview;
      publish({
        type: "rollback.begin",
        checkpointID: checkpoint.id,
        safetyCheckpointID: "checkpoint_safety",
      });
      publish({
        type: "rollback.end",
        checkpointID: checkpoint.id,
        safetyCheckpointID: "checkpoint_safety",
        restoredFiles: 1,
        deletedFiles: 0,
        contextJournalOffset: 0,
        step: 0,
      });
      return { ...preview, safetyCheckpointID: "checkpoint_safety" };
    },
    snapshot() {
      const event: RuntimeEvent = {
        type: "snapshot.created",
        id: `snap_${Date.now().toString(36)}`,
        files: [],
      };
      publish(event);
      return event;
    },
    diagnostic(message, level = "warning") {
      publish({ type: "diagnostic", level, message });
    },
    lastSubmission() {
      return submission;
    },
    respondApproval(response: ApprovalResponse) {
      publish({
        type: "approval.response",
        id: response.requestID,
        decision: response.decision,
        feedback: response.feedback,
      });
      return { accepted: true };
    },
    respondQuestion(response: QuestionResponse) {
      publish({
        type: "question.response",
        id: response.requestID,
        answers: response.answers,
        rejected: response.rejected,
      });
      return { accepted: true };
    },
    async sessionList() {
      return [
        {
          id: sessionID,
          title: "Web UI prototype",
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          pinned: false,
          events: turns,
          pendingInputs: 0,
          cancelled: false,
          resumable: true,
        },
      ];
    },
    async sessionNew() {
      return { sessionID: "ses_web_new" as SessionID, created: true };
    },
    async sessionDuplicate(id, title) {
      return {
        id: `ses_${id}_dup` as SessionID,
        title: title ?? `Fork of ${id}`,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        pinned: false,
        events: turns,
        pendingInputs: 0,
        cancelled: false,
        resumable: true,
      };
    },
    async workspaceSearch(input) {
      const query = String(input?.query ?? "");
      return [
        {
          path: "packages/examples/ui-web-plugin/src/app-neu.tsx",
          line: 12,
          text: query ? `match: ${query}` : "export function AppNeu(...)",
        },
        {
          path: "packages/examples/ui-web-plugin/src/file-editor.tsx",
          line: 167,
          text: "export function FileEditor()",
        },
      ].filter((match) => !query || match.text.toLowerCase().includes(query.toLowerCase()));
    },
    async workspaceList() {
      return {
        entries: [
          { path: "README.md", type: "file" as const },
          { path: "packages", type: "directory" as const },
          { path: "apps", type: "directory" as const },
        ],
        truncated: false,
      };
    },
    async workspaceRead(input) {
      const path = String(input?.path ?? "");
      const content = path.endsWith(".md")
        ? "# Natalia\n\nA local-first agent runtime."
        : "// workspace fixture content\nexport const value = 1;\n";
      return {
        path,
        content,
        encoding: "utf8" as const,
        mime: path.endsWith(".md")
          ? "text/markdown"
          : "text/plain",
      };
    },
    async configGet() {
      return {
        version: 3,
        defaultAgent: "main",
        defaultModel: { provider: "fake", model: "gpt-5.5-fixture" },
        permissionProfiles: {},
        providers: {},
        runtime: { maxStepsPerTurn: 8, maxAttemptsPerStep: 3 },
        context: { compactionEnabled: true, compactionThresholdPercent: 85 },
        checkpoint: { additionalDirs: [] },
      } as never;
    },
    async updateConfig(patch) {
      publish({ type: "settings.updated", scope: "project" });
      return { applied: true };
    },
    async mcpServerAdd(input) {
      publish({
        type: "mcp.status",
        server: input.name,
        status: "connected",
        tools: 0,
      });
      return { saved: true };
    },
    async mcpServerRemove(name) {
      publish({
        type: "mcp.status",
        server: name,
        status: "disabled",
        tools: 0,
      });
      return { removed: true };
    },
    async saveFlowDocument(input) {
      const flowID = input.document.flowID;
      return { path: input.path ?? `${flowID}.yaml`, flowID, created: true, updated: false };
    },
    async deleteFlowDocument(input) {
      return { path: input.path, deleted: true, alreadyDeleted: false };
    },
    async providerAdd(input) {
      return { saved: true };
    },
  };
}
