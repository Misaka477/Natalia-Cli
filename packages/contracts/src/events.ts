import type {
  ApprovalResponse,
  QuestionItem,
  QuestionResponse,
} from "@natalia/ui-model";
import type {
  AgentConfig,
  AgentPermissionRules,
  MCPServerConfig,
  PermissionProfile,
} from "./schemas";
export type { ApprovalResponse, QuestionResponse } from "@natalia/ui-model";

export type SessionID = `ses_${string}`;
export type EpisodeID = `epi_${string}`;

export type ErrorKind =
  | "timeout"
  | "connection"
  | "rate_limit"
  | "server"
  | "auth"
  | "invalid_request"
  | "empty_response"
  | "context_limit"
  | "quota"
  | "unknown"
  | "cancel";

export type StepRetryOperation = "llm_step" | "compaction" | "metadata_probe";

export type ContextStatusSource =
  | "exact_checkpoint"
  | "pending_estimate"
  | "compaction_estimate"
  | "restored";

export type CompactionTrigger =
  | "ratio"
  | "reserved"
  | "manual"
  | "context_limit";

export type ExecutionTarget =
  | { kind: "host"; cwd: string }
  | {
      kind: "sandbox";
      sandboxID: string;
      root: string;
      isolationLevel: "workspace" | "container" | "vm";
    };

export type TerminalStatus =
  | "starting"
  | "running"
  | "waiting"
  | "awaiting_approval"
  | "exited"
  | "failed";
export type TerminalOwnership = "model" | "user" | "shared" | "detached";
export type TerminalAction =
  | "write"
  | "submit"
  | "special_key"
  | "resize"
  | "exit"
  | "attach"
  | "detach"
  | "secure_input"
  | "request_human"
  | "started";
export type SandboxStatus =
  | "created"
  | "running"
  | "changed"
  | "merge_previewed"
  | "merged"
  | "conflicted"
  | "stopped"
  | "deleted"
  | "failed";
export type SandboxDiffKind =
  | "add"
  | "modify"
  | "delete"
  | "rename"
  | "mode"
  | "conflict";

export type DurableContextCheckpointRecord = {
  entries: Array<{
    id: string;
    role:
      | "system"
      | "user"
      | "assistant"
      | "tool_call"
      | "tool_result"
      | "dynamic"
      | "resource"
      | "summary";
    content: string;
    tokens?: number;
    pairID?: string;
    artifactRef?: string;
    attachments?: LocalAttachment[];
  }>;
  checkpoint?: {
    messageCount: number;
    tokens: number;
    inputTokens?: number;
    outputTokens?: number;
    source: "provider_usage" | "estimate";
  };
  resources: Array<{
    kind:
      | "background"
      | "process"
      | "agent"
      | "terminal"
      | "sandbox"
      | "workflow"
      | "skill";
    id: string;
    summary: string;
  }>;
  journalOffset: number;
  step: number;
  tokenEstimate: number;
  compactionGeneration: number;
};

export type CheckpointChangeKind =
  | "add"
  | "modify"
  | "delete"
  | "rename"
  | "mode"
  | "symlink";

export type CheckpointResourcePolicy = {
  kind:
    | "subagent"
    | "process"
    | "background"
    | "terminal"
    | "sandbox"
    | "workflow"
    | "tool"
    | "pending_modal";
  id: string;
  action: "stop" | "preserve_dirty" | "cancel" | "invalidate" | "none";
  summary: string;
};

export type CheckpointPreview = {
  checkpointID: string;
  safetyCheckpointID?: string;
  dryRun: boolean;
  changes: Array<{
    kind: CheckpointChangeKind;
    path: string;
    oldPath?: string;
    mode?: string;
  }>;
  context: {
    truncateMessages: number;
    targetJournalOffset: number;
    targetStep: number;
    targetTokens: number;
    compactionGeneration: number;
  };
  resources: CheckpointResourcePolicy[];
  ignoredFiles: number;
  diskUsageBytes: number;
  complete: boolean;
  warnings: string[];
};
export type RuntimeCheckpoint = {
  id: string;
  sequence: number;
  turnID?: string;
  stepID?: string;
  step: number;
  reason:
    | "baseline"
    | "turn_begin"
    | "step_begin"
    | "manual"
    | "pre_tool"
    | "pre_compaction"
    | "rollback_safety";
  createdAt: string;
  complete: boolean;
  errors: string[];
  files: number;
  changes: number;
  tokenEstimate: number;
  diskUsageBytes: number;
};
export type RuntimeSandbox = {
  id: string;
  root: string;
  isolationLevel: "workspace" | "container" | "vm";
  changedFiles: number;
  runningResources: number;
  envAllowlist: string[];
};
export type RuntimeSandboxChange = {
  kind: SandboxDiffKind;
  path: string;
  oldPath?: string;
  mode?: string;
};
export type RuntimeSandboxResource = {
  id: string;
  sandboxID: string;
  command: string;
  pid: number;
  status: "running" | "exited" | "failed" | "stopped";
  outputPath: string;
  startedAt: string;
  endedAt?: string;
};

export type ToolStatus =
  | "receiving_arguments"
  | "queued"
  | "awaiting_approval"
  | "running"
  | "succeeded"
  | "failed"
  | "rejected"
  | "cancelled";

type RuntimeEventData =
  | { type: "session.created"; sessionID: SessionID; title: string }
  | { type: "session.ready"; sessionID: SessionID }
  | {
      type: "turn.submitted";
      id: string;
      text: string;
      byteLength: number;
      lineCount: number;
      sha256: string;
      attachments?: LocalAttachment[];
      resources?: PromptResourceMention[];
      agents?: PromptAgentMention[];
    }
  | { type: "turn.cancelled"; id: string; reason: string }
  | { type: "turn.paused"; id: string; reason: string }
  | { type: "turn.resumed"; id: string }
  | {
      type: "thinking.delta";
      id: string;
      text: string;
      visible?: boolean;
      attempt?: number;
    }
  | {
      type: "thinking.done";
      id: string;
      text?: string;
      visible?: boolean;
      attempt?: number;
    }
  | { type: "content.delta"; id: string; text: string; attempt?: number }
  | { type: "content.done"; id: string; text?: string; attempt?: number }
  | {
      type: "turn.retry";
      id: string;
      attempt: number;
      maxAttempts: number;
      reason: string;
      retryAfterMs: number;
    }
  | {
      type: "step.retry";
      id: string;
      operation: StepRetryOperation;
      step: number;
      attempt: number;
      maxAttempts: number;
      waitMs: number;
      reason: ErrorKind;
      statusCode?: number;
    }
  | {
      type: "step.retry.cleared";
      id: string;
      operation: StepRetryOperation;
      step: number;
      attempts: number;
    }
  | {
      type: "step.retry.exhausted";
      id: string;
      operation: StepRetryOperation;
      step: number;
      attempts: number;
      maxAttempts: number;
      reason: ErrorKind;
      statusCode?: number;
      message: string;
      /**
       * False when the attempt budget was never the limit because the failure
       * could not be retried. Without it, stopping after one of three attempts
       * reads as if retries had been used up.
       */
      retryable?: boolean;
    }
  | {
      type: "tool.update";
      id: string;
      name: string;
      callID?: string;
      status: ToolStatus;
      summary: string;
      argumentsDelta?: string;
      result?: string;
      metadata?: Record<string, unknown>;
      startedAt?: number;
      endedAt?: number;
    }
  | {
      type: "policy.decision";
      turnID: string;
      toolName: string;
      toolCallID?: string;
      decision: "allow" | "deny" | "approval_required" | "rejected";
      reason?: string;
    }
  | {
      type: "subagent.update";
      id: string;
      status:
        | "idle"
        | "running"
        | "paused"
        | "stopped"
        | "completed"
        | "failed";
      attached: boolean;
      event:
        | "created"
        | "status"
        | "log"
        | "done"
        | "stopped"
        | "resumed"
        | "attached"
        | "detached";
      task?: string;
      text?: string;
      parentSessionID?: string;
      parentAgentID?: string;
      continuation?: number;
    }
  | {
      type: "mcp.status";
      server: string;
      status: "disabled" | "connected" | "failed" | "unsupported_auth_flow";
      tools: number;
      message?: string;
    }
  | { type: "agent.selection"; name?: string; pending: boolean }
  | { type: "model.selection"; modelID?: string; variant?: string }
  | {
      type: "plugin.update";
      id: string;
      status: "loaded" | "unloaded" | "denied" | "failed";
      detail?: string;
    }
  | {
      type: "session.snapshot";
      id: string;
      agentStatus: string;
      currentStep?: string;
      activeTool?: string;
      changedFiles: number;
      unvalidatedChanges: number;
      recentOutput?: string;
      hasPTY: boolean;
      hasSandbox: boolean;
    }
  | {
      type: "drift.finding_opened";
      id: string;
      findingID: string;
      severity: "advisory" | "warning" | "high";
      confidence: number;
      originalObjective: string;
      currentActivity: string;
      evidence: string[];
      applicableConstraints: string[];
    }
  | {
      type: "drift.finding_updated";
      id: string;
      findingID: string;
      status: "open" | "explained" | "dismissed" | "corrected";
      rationale?: string;
    }
  | {
      type: "tool.registered";
      id: string;
      name: string;
      owner: string;
      scope: "process" | "workspace" | "session";
      recovery: "none" | "retry" | "restart" | "fail_closed";
      precedence: number;
      requiresApproval: boolean;
    }
  | {
      type: "tool.unregistered";
      id: string;
      name: string;
    }
  | {
      type: "capability.loaded";
      id: string;
      apiVersion: number;
      name: string;
      version: string;
      scope: "process" | "workspace" | "session";
      grants: string[];
    }
  | {
      type: "capability.unloaded";
      id: string;
      name: string;
    }
  | {
      type: "capability.failed";
      id: string;
      name: string;
      reason: string;
    }
  | {
      type: "workgraph.node_added";
      id: string;
      nodeID: string;
      kind: import("./schemas").WorkGraphNodeKind;
      summary: string;
      actor?: string;
      target?: string;
      sessionID?: string;
      turnID?: string;
    }
  | {
      type: "workgraph.edge_added";
      id: string;
      sourceID: string;
      targetID: string;
      kind: import("./schemas").WorkGraphEdgeKind;
      reason?: string;
    }
  | {
      type: "evidence.recorded";
      id: string;
      taskID: string;
      objective: string;
      status:
        | "planned"
        | "implemented"
        | "validated"
        | "accepted"
        | "promoted"
        | "blocked"
        | "failed"
        | "partial";
      changes?: Array<{
        path: string;
        changeType: "added" | "modified" | "deleted";
        summary: string;
      }>;
      validations?: Array<{
        command: string;
        result: "passed" | "failed" | "skipped";
        safeSummary: string;
      }>;
      knownGaps?: string[];
    }
  | {
      type: "completion.recorded";
      id: string;
      taskID: string;
      objective: string;
      /** The fixed completion-card report structure (§5). */
      changeSummary: string;
      behaviorImpact?: string;
      validations: Array<{
        command: string;
        result: "passed" | "failed" | "skipped";
        safeSummary: string;
      }>;
      humanValidation?: string;
      knownGaps?: string[];
      externalSideEffects?: string[];
      rollbackState?: "clean" | "available" | "none" | "needs_promotion";
      evidenceIDs?: string[];
      recordedAt: string;
    }
  | {
      type: "constitution.check";
      id: string;
      ruleID: string;
      statement: string;
      priority: "critical" | "high" | "medium" | "low";
      enforcement: "deny" | "approval" | "warn";
      action: string;
      resource: string;
      conflict: boolean;
      override?: { reason: string; approvedBy: string };
    }
  | {
      type: "constitution.rule_added";
      id: string;
      ruleID: string;
      statement: string;
      scope: "project" | "package" | "sandbox" | "task" | "release";
      priority: "critical" | "high" | "medium" | "low";
      source: "user" | "master_plan" | "policy";
      enforcement: "deny" | "approval" | "warn";
      overridePolicy: "forbidden" | "user_scoped" | "user_explicit";
      evidenceRefs?: string[];
    }
  | {
      type: "constitution.rule_updated";
      id: string;
      ruleID: string;
      statement?: string;
      priority?: "critical" | "high" | "medium" | "low";
    }
  | {
      type: "decision.recorded";
      id: string;
      decision: string;
      rationale?: string[];
      alternatives?: { option: string; rejectedReason?: string }[];
      consequences?: string[];
      status: "proposed" | "accepted" | "superseded";
      linkedPlans?: string[];
      linkedConstraints?: string[];
    }
  | {
      type: "mailbox.queued";
      id: string;
      messageID: string;
      source: "user_via_live_chat" | "system";
      priority: "normal" | "high" | "urgent";
      intent:
        | "clarification"
        | "constraint"
        | "reprioritize"
        | "pause"
        | "cancel"
        | "request_report"
        | "proposed_change"
        | "next_plan_handoff";
      text: string;
      safeSummary: string;
      relatedPlanID?: string;
      deliveryPolicy:
        | "next_safe_boundary"
        | "before_next_tool"
        | "before_next_side_effect"
        | "immediate_control";
      createdAt: string;
    }
  | {
      type: "mailbox.delivered";
      id: string;
      messageID: string;
      deliveredAt: string;
    }
  | {
      type: "mailbox.acknowledged";
      id: string;
      messageID: string;
      acknowledgedAt: string;
    }
  | {
      type: "mailbox.deferred";
      id: string;
      messageID: string;
      reason: string;
      deferredAt: string;
    }
  | {
      type: "mailbox.superseded";
      id: string;
      messageID: string;
      reason: string;
      supersededAt: string;
    }
  | {
      type: "plan.draft.created";
      id: string;
      planID: string;
      version: number;
      title: string;
      author: "user" | "live_chat" | "main_agent";
      objective: string;
      steps: Array<{
        id: string;
        title: string;
        detail?: string;
        verification?: string;
      }>;
      constraints?: string[];
      verification?: string[];
      riskNotes?: string[];
      relatedMailboxMessageID?: string;
      /** The task this plan verifies (E3 task contract). */
      taskID?: string;
      supersedesPlanID?: string;
      createdAt: string;
      reason?: string;
    }
  | {
      type: "plan.draft.updated";
      id: string;
      planID: string;
      version: number;
      updatedAt: string;
      reason?: string;
    }
  | {
      type: "plan.proposed";
      id: string;
      planID: string;
      version: number;
      proposedAt: string;
    }
  | {
      type: "plan.accepted";
      id: string;
      planID: string;
      version: number;
      acceptedBy: "user";
      acceptedAt: string;
    }
  | {
      type: "plan.queued";
      id: string;
      planID: string;
      version: number;
      queuedAt: string;
    }
  | {
      type: "plan.activated";
      id: string;
      planID: string;
      version: number;
      activatedAt: string;
    }
  | {
      type: "plan.superseded";
      id: string;
      planID: string;
      version: number;
      reason: string;
      supersededAt: string;
    }
  | {
      type: "plan.completed";
      id: string;
      planID: string;
      version: number;
      completedAt: string;
    }
  | {
      type: "plan.archived";
      id: string;
      planID: string;
      version: number;
      archivedAt: string;
    }
  | { type: "status.update"; status: string; detail?: string }
  | {
      type: "status.snapshot";
      model: string;
      provider: string;
      context: string;
      step: string;
      permissions: string;
      cwd: string;
      background: string;
    }
  | {
      type: "context.status";
      used: number;
      max: number;
      source: ContextStatusSource;
      thresholdPercent: number;
      reserved: number;
      trigger?: CompactionTrigger;
    }
  | {
      type: "compaction.begin";
      id: string;
      trigger: CompactionTrigger;
      beforeTokens: number;
      maxTokens: number;
      thresholdPercent: number;
      reservedTokens: number;
      instruction?: string;
      attempt: number;
      startedAt: string;
    }
  | {
      type: "compaction.end";
      id: string;
      trigger: CompactionTrigger;
      success: boolean;
      beforeTokens: number;
      afterTokens?: number;
      durationMs: number;
      attempts: number;
      error?: string;
    }
  | {
      type: "context.limit.recovery";
      id: string;
      step: number;
      attempted: boolean;
      compacted: boolean;
      reason: "context_limit";
    }
  | {
      type: "context.checkpoint";
      id: string;
      snapshot: DurableContextCheckpointRecord;
    }
  | {
      type: "terminal.update";
      id: string;
      command: string;
      cwd: string;
      status: TerminalStatus;
      attached: boolean;
      rows: number;
      cols: number;
      prompt?: string;
      activity: "waiting" | "running";
      tail: string;
      transcript?: string;
      lastAction?: TerminalAction;
      target: ExecutionTarget;
      ownership?: TerminalOwnership;
      approvalID?: string;
      screen?: TerminalScreenSnapshot;
      revision?: number;
      lastOutputAt?: string;
      viewers?: TerminalViewer[];
      inputOwner?: TerminalOwner;
      geometryOwner?: TerminalOwner;
    }
  | {
      type: "terminal.action";
      id: string;
      action: TerminalAction;
      redacted?: boolean;
      target: ExecutionTarget;
    }
  | {
      type: "terminal.timeline";
      id: string;
      actor: "model" | "user" | "system";
      action: TerminalAction | "created" | "approval";
      status:
        | "requested"
        | "awaiting_approval"
        | "approved"
        | "executed"
        | "rejected";
      summary: string;
      at: string;
    }
  | {
      type: "terminal.approval";
      id: string;
      approvalID: string;
      state: "awaiting" | "approved" | "rejected";
      action: TerminalAction;
      reason: string;
      target: ExecutionTarget;
    }
  | {
      type: "terminal.viewer";
      id: string;
      viewerID: string;
      viewerKind?: "external" | "embedded";
      action:
        | "registered"
        | "takeover"
        | "release"
        | "unregistered"
        | "expired";
      inputOwner: TerminalOwner;
      geometryOwner: TerminalOwner;
      at: string;
    }
  | { type: "terminal.pane.select"; id: string }
  | { type: "terminal.pane.focus"; focus: "chat" | "terminal" }
  | {
      type: "sandbox.update";
      id: string;
      status: SandboxStatus;
      root: string;
      isolationLevel: "workspace" | "container" | "vm";
      changedFiles: number;
      runningResources: number;
      target: ExecutionTarget;
      resourcePolicy: string;
    }
  | {
      type: "sandbox.diff";
      id: string;
      changes: Array<{
        kind: SandboxDiffKind;
        path: string;
        oldPath?: string;
        mode?: string;
      }>;
    }
  | {
      type: "sandbox.audit";
      id: string;
      action: string;
      target: ExecutionTarget;
      approvalRequired: boolean;
      checkpointPolicy:
        | "sandbox_manifest"
        | "host_checkpoint"
        | "not_available";
      message: string;
    }
  | {
      type: "checkpoint.created";
      id: string;
      reason: string;
      turnID?: string;
      stepID?: string;
      sequence: number;
      complete: boolean;
      files: number;
      changes: number;
      contextJournalOffset: number;
      step: number;
      tokenEstimate: number;
      diskUsageBytes: number;
    }
  | {
      type: "checkpoint.failed";
      reason: string;
      message: string;
      incomplete?: boolean;
      errors?: string[];
    }
  | {
      type: "checkpoint.unavailable";
      reason: string;
      suggestion: string;
      disabledByConfig?: boolean;
    }
  | { type: "rollback.previewed"; preview: CheckpointPreview }
  | {
      type: "rollback.begin";
      checkpointID: string;
      safetyCheckpointID: string;
      dryRun?: boolean;
      sessionID?: string;
    }
  | {
      type: "rollback.end";
      checkpointID: string;
      safetyCheckpointID: string;
      restoredFiles: number;
      deletedFiles: number;
      contextJournalOffset: number;
      step: number;
      sessionID?: string;
    }
  | {
      type: "rollback.failed";
      checkpointID: string;
      safetyCheckpointID?: string;
      message: string;
      recovered: boolean;
      sessionID?: string;
    }
  | {
      type: "diagnostic";
      level: "info" | "warning" | "error";
      message: string;
      at?: string;
      /**
       * Which capability, plugin or namespace the diagnostic belongs to, so a
       * consumer can attribute it ("which tool package failed") and filter by
       * owner. Capability-scoped values use the capability id (e.g.
       * `plugin:demo.plugin`, `mcp:server`, `natalia-tool-fs`); a runtime-level
       * diagnostic without a meaningful owner omits the field.
       */
      owner?: string;
    }
  | {
      type: "dialog.open";
      dialog:
        | "palette"
        | "approval"
        | "question"
        | "sessions"
        | "settings"
        | "status";
    }
  | { type: "dialog.close" }
  | {
      type: "approval.request";
      id: string;
      title: string;
      preview: string;
      detail?: string;
      keyArguments?: string[];
      sensitive?: boolean;
      risk?: "terminal_low" | "terminal_high";
      scope?: string;
      expiresAt?: string;
      revocable?: boolean;
    }
  | {
      type: "approval.response";
      id: string;
      decision: ApprovalResponse["decision"];
      feedback?: string;
    }
  | {
      type: "question.request";
      id: string;
      title: string;
      options?: string[];
      questions?: QuestionItem[];
    }
  | {
      type: "question.response";
      id: string;
      answers: string[][];
      rejected?: boolean;
    }
  | { type: "snapshot.created"; id: string; files: string[] }
  | {
      type: "turn.finished";
      id: string;
      stopReason: "done" | "cancelled" | "error" | "waiting_human";
      reason?: "missing_final_response";
    }
  | {
      type: "flow.module_event";
      kind:
        | "activated"
        | "claimed"
        | "evaluated"
        | "completed"
        | "blocked"
        | "stalled"
        | "continued";
      moduleID: string;
      moduleType?: string;
      outcome?: "complete" | "incomplete" | "blocked";
      reason?: string;
    }
  | {
      type: "flow.finished";
      outcome: "succeeded" | "failed" | "skipped";
      reason?: string;
    }
  | {
      type: "flow.evaluator";
      moduleID?: string;
      phase: "thinking" | "content";
      text: string;
    }
  | {
      type: "chat.message.added";
      id: string;
      messageID: string;
      role: "user" | "chat";
      text: string;
      at: string;
    }
  | {
      type: "chat.message.delta";
      id: string;
      messageID: string;
      text: string;
    }
  | {
      type: "chat.thinking.delta";
      id: string;
      messageID: string;
      text: string;
    }
  | {
      type: "chat.tool.used";
      id: string;
      messageID: string;
      toolName: string;
      status: string;
      summary: string;
      result?: string;
      argumentsRaw?: string;
      startedAt?: number;
      endedAt?: number;
      at: string;
    }
  | {
      type: "chat.rollback";
      id: string;
      toMessageID: string;
      removed: number;
      at: string;
    }
  | {
      type: "collab.suggestion";
      id: string;
      from: "live_chat";
      to: "main_agent";
      suggestion: string;
      rationale?: string;
      priority: "normal" | "high";
      status: "proposed";
      at: string;
    }
  | {
      type: "collab.notice";
      id: string;
      from: "main_agent";
      to: "live_chat";
      notice: string;
      noticeType: "step_completed" | "blocked" | "needs_input" | "risk";
      at: string;
    }
  | {
      type: "collab.question";
      id: string;
      from: "main_agent";
      to: "live_chat";
      question: string;
      at: string;
    }
  | {
      type: "collab.answer";
      id: string;
      questionID: string;
      from: "live_chat";
      to: "main_agent";
      answer: string;
      at: string;
    }
  | {
      type: "collab.response";
      id: string;
      messageID: string;
      from: "live_chat" | "main_agent";
      decision: "adopted" | "rejected" | "deferred";
      reason?: string;
      at: string;
    }
  | {
      type: "settings.updated";
      scope: "global" | "project";
    };

/**
 * An episode groups all events emitted by one isolated execution without
 * changing the durable workspace-level session identity used by interactive
 * clients. It is intentionally a correlation field, not a Work Graph event.
 *
 * `sessionID` is stamped by the runtime on every event published while a
 * session is active, so a transport subscriber can isolate one session's
 * stream server-side (the D6 rule: an event carrying a session id belongs to
 * that session and no other; one without it is runtime-level and reaches every
 * subscriber). Events that already carry a session id (`session.created`,
 * `session.ready`, work-graph nodes) keep their own.
 */
export type RuntimeEvent = RuntimeEventData & {
  episodeID?: EpisodeID;
  sessionID?: SessionID;
};

export type SubmittedTurn = Extract<RuntimeEvent, { type: "turn.submitted" }>;
export type LocalAttachment = {
  id: string;
  path: string;
  filename: string;
  mediaType:
    | "image/png"
    | "image/jpeg"
    | "image/webp"
    | "image/gif"
    | "video/mp4"
    | "video/webm"
    | "application/pdf"
    | "text/plain"
    | "text/markdown"
    | "application/json"
    | "text/csv";
  byteLength: number;
  sha256: string;
};
export type PromptResourceMention = {
  server: string;
  uri: string;
  name: string;
  mimeType?: string;
};
export type PromptAgentMention = { name: string };
export type SubmitInput = {
  text: string;
  delivery?: "steer" | "queue";
  id?: string;
  attachments?: string[];
  resources?: PromptResourceMention[];
  agents?: PromptAgentMention[];
};
export type RuntimeHistoryEvent = { seq: number; event: RuntimeEvent };
export type RuntimeHistory = {
  events: RuntimeHistoryEvent[];
  hasMore: boolean;
};
export type RuntimeProjectedMessageRowKind =
  | "user"
  | "thinking"
  | "assistant"
  | "tool"
  | "approval"
  | "question"
  | "system";
export type RuntimeProjectedMessageRow = {
  id: string;
  turnID: string;
  kind: RuntimeProjectedMessageRowKind;
  event: RuntimeEvent;
};
export type RuntimeProjectedMessage = {
  id: string;
  turnID: string;
  submitted: SubmittedTurn;
  rows: RuntimeProjectedMessageRow[];
  stopReason?: Extract<RuntimeEvent, { type: "turn.finished" }>["stopReason"];
};
export type RuntimeMessageCursor = {
  previous?: string;
  next?: string;
};
export type RuntimeMessagePage = {
  data: RuntimeProjectedMessage[];
  cursor: RuntimeMessageCursor;
};
export type PendingInteractiveRequests = {
  approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>;
  questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>;
};
export type MCPPromptCatalog = {
  server: string;
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
};
export type MCPResourceCatalog = {
  server: string;
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};
export type MCPCatalogSnapshot = {
  prompts: MCPPromptCatalog[];
  resources: MCPResourceCatalog[];
};
/** A command a capability or plugin contributed, as a UI sees it. */
export type ContributedCommand = {
  name: string;
  title: string;
  category?: string;
};

/**
 * Work Graph read models exposed over RuntimeClient/RPC/SDK.
 *
 * Derived from the canonical `workGraphNodeSchema` / `workGraphEdgeSchema` rather
 * than redeclared, so the query surface cannot drift from the vocabulary the
 * writer emits. Only `episodeID` is added: it is the correlation id the runtime
 * already stamps on every event, and a consumer needs it to group facts by
 * execution.
 */
export type WorkGraphNodeView = {
  nodeID: string;
  kind: import("./schemas").WorkGraphNodeKind;
  summary: string;
  actor?: string;
  target?: string;
  sessionID?: string;
  turnID?: string;
  episodeID?: EpisodeID;
};

export type WorkGraphEdgeView = {
  sourceID: string;
  targetID: string;
  kind: import("./schemas").WorkGraphEdgeKind;
  reason?: string;
  episodeID?: EpisodeID;
};
export type PluginStatus = {
  id: string;
  version: string;
  name: string;
  description: string;
  capabilities: string[];
};
export type RuntimeStatusSnapshot = Extract<
  RuntimeEvent,
  { type: "status.snapshot" }
>;
export type RuntimeDiagnostic = Extract<
  RuntimeEvent,
  { type: "diagnostic" }
> & { at: string };
export type RuntimeModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  variants: string[];
};
export type RuntimeModelSelection = {
  modelID?: string;
  variant?: string;
};
export type RuntimeAgentCatalogEntry = {
  name: string;
  description: string;
  mode: "primary" | "subagent" | "all";
  hidden: boolean;
  color?: string;
  model?: string;
  variant?: string;
  maxSteps?: number;
  allowedTools?: string[];
  excludedTools?: string[];
  mcpServers?: string[];
  permissions?: AgentPermissionRules;
};
export type RuntimeSkillCatalogEntry = {
  name: string;
  qualifiedName: string;
  description: string;
  source: "project" | "user" | "remote";
  requireApproval: boolean;
  sandboxRequired: boolean;
};
export type RuntimeSlashCommand = {
  name: string;
  description: string;
  acceptsArguments?: boolean;
};
export type RuntimeWorkspaceFileEntry = {
  path: string;
  type: "file" | "directory";
};
export type RuntimeWorkspaceListPage = {
  entries: RuntimeWorkspaceFileEntry[];
  truncated: boolean;
  next?: number;
};
export type RuntimeWorkspaceMatch = {
  path: string;
  line: number;
  text: string;
};
export type RuntimeWorkspaceContent = {
  path: string;
  content: string;
  encoding: "utf8" | "base64";
  mime: string;
  offset?: number;
  truncated?: boolean;
  next?: number;
};
/** Color encoding: undefined=default, 0..255=palette, 0x1000000+RGB=truecolor. */
export type TerminalColor = number | null | undefined;
/** Compact wire cell: chars, width, fg, bg, style bitmask. */
export type TerminalCell = [
  chars: string,
  width: number,
  fg?: TerminalColor,
  bg?: TerminalColor,
  attributes?: number,
];
export type TerminalScreenSnapshot = {
  rows: number;
  cols: number;
  buffer: "normal" | "alternate";
  cursor: { row: number; col: number; visible: boolean };
  cursorX?: number;
  cursorY?: number;
  lines: TerminalCell[][];
  text: string;
  modes?: { bracketedPaste: boolean };
  highlightRanges?: Array<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  }>;
};

export type TerminalViewer = {
  id: string;
  kind: "external" | "embedded";
  connectedAt: string;
  lastSeenAt: string;
};
export type TerminalOwner =
  | { type: "model" }
  | { type: "viewer"; viewerID: string };
export type RuntimeTerminalSession = {
  id: string;
  command: string;
  cwd: string;
  status: TerminalStatus;
  attached: boolean;
  rows: number;
  cols: number;
  transcript: string;
  tail: string;
  startedAt: string;
  endedAt?: string;
  screen?: TerminalScreenSnapshot;
  revision?: number;
  lastOutputAt?: string;
  prompt?: string;
  activity?: "waiting" | "running";
  viewers?: TerminalViewer[];
  inputOwner?: TerminalOwner;
  geometryOwner?: TerminalOwner;
  secretAudit: Array<{
    at: string;
    action: "write" | "prompt_detected";
    summary: string;
    sha256?: string;
  }>;
};

export type RuntimeNativeTerminalSession = {
  id: string;
  host: "wezterm";
  paneID: number;
  windowID: number;
  muxWindowID: number;
  tabID: number;
  command: string;
  cwd: string;
  status: "running" | "exited";
  inputOwner: "model" | "human";
  geometryOwner: "human";
  secureInput: boolean;
  rows?: number;
  cols?: number;
  startedAt: string;
  attached: boolean;
  /**
   * TERM-M.3 route 3: a conservative "this pane may be waiting for a human"
   * weak fact. True only when the model wrote, the pane produced output after
   * that write, and no new output or model write has happened for the grace
   * period. It never inspects content — a long computation also reads true.
   */
  mayWaitForHuman?: boolean;
};

export type RuntimeTerminalObservationSession = Omit<
  RuntimeTerminalSession,
  "screen" | "transcript"
> & {
  screen?: TerminalScreenSnapshot;
  transcript?: string;
};
export type RuntimeSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  lastAccessedAt?: string;
  pinned: boolean;
  archived?: boolean;
  events: number;
  pendingInputs: number;
  cancelled: boolean;
  resumable: boolean;
  /**
   * TERM-M.3 (c): a terminal the model asked a human to take over, with the
   * turn ended. Present while the runtime is waiting for the human to finish
   * input before it resumes the task, so any consumer (session list, remote
   * UI) can see the session is waiting for a human instead of inferring it
   * from the timeline.
   */
  pendingHumanTerminal?: {
    terminalID: string;
    reason: string;
    since: string;
  };
};
// Keep TUI completion and runtime command handling on one local vocabulary.
export const runtimeSlashCommands: RuntimeSlashCommand[] = [
  { name: "help", description: "Show runtime command help" },
  { name: "doctor", description: "Inspect runtime and provider health" },
  { name: "status", description: "Show the runtime status snapshot" },
  {
    name: "diagnostics",
    description: "Show durable runtime diagnostics",
    acceptsArguments: true,
  },
  { name: "sessions", description: "List durable sessions" },
  {
    name: "files",
    description: "Find workspace files",
    acceptsArguments: true,
  },
  {
    name: "search",
    description: "Search workspace file content",
    acceptsArguments: true,
  },
  { name: "agents", description: "List selectable agents" },
  {
    name: "agent",
    description: "Select the next-turn agent",
    acceptsArguments: true,
  },
  { name: "models", description: "List selectable models" },
  {
    name: "model",
    description: "Select model and variant",
    acceptsArguments: true,
  },
  { name: "skills", description: "List discovered skills" },
  { name: "skill", description: "Activate a skill", acceptsArguments: true },
  {
    name: "skill-resource",
    description: "Read an active skill resource",
    acceptsArguments: true,
  },
  {
    name: "skill-script",
    description: "Run an active skill script",
    acceptsArguments: true,
  },
  {
    name: "attach",
    description: "Submit a workspace attachment",
    acceptsArguments: true,
  },
  {
    name: "editor",
    description: "Open the composer draft in an external editor",
    acceptsArguments: true,
  },
  { name: "checkpoint", description: "Create a workspace checkpoint" },
  { name: "checkpoints", description: "List workspace checkpoints" },
  {
    name: "rollback",
    description: "Restore a checkpoint",
    acceptsArguments: true,
  },
  { name: "pause", description: "Pause at a safe runtime boundary" },
  { name: "resume", description: "Resume runtime execution" },
];

/** Streaming fragments are transport-live; their completed settlements are durable. */
export function runtimeEventDurability(
  event: RuntimeEvent,
): "durable" | "live" {
  switch (event.type) {
    case "content.delta":
    case "thinking.delta":
    case "context.status":
    case "status.update":
    case "terminal.update":
      return "live";
    case "tool.update":
      return ["succeeded", "failed", "rejected", "cancelled"].includes(
        event.status,
      )
        ? "durable"
        : "live";
    default:
      return "durable";
  }
}

/**
 * Outcomes of operations that can decline for an ordinary reason.
 *
 * `Promise<void>` and `void` cannot say "I did not do that, and here is why", so
 * a caller was left inferring success from the absence of an exception — and over
 * RPC, from a hard-coded `{ok: true}`. Which members must answer this way is
 * recorded per member in `refusals.ts`.
 */
export type PauseOutcome = { paused: boolean; reason?: string };
export type ResumeOutcome = { resumed: boolean; reason?: string };

export type AgentSelectionOutcome = {
  /**
   * `pending` means a turn is running and the selection applies when it ends:
   * changing the agent underneath a running turn would change the rules it
   * started under.
   */
  outcome: "applied" | "pending" | "rejected";
  selected?: string;
  reason?: string;
};

/**
 * These outcomes may arrive synchronously or over a hop: the in-process runtime
 * answers immediately, while the worker channel has to ask the runtime thread.
 * A channel that cannot see the outcome must not invent one, so the type admits
 * a promise rather than forcing a guess.
 */
export type InteractiveResponseOutcome = {
  /** False when the request was no longer pending, with the reason. */
  accepted: boolean;
  reason?: string;
};

/**
 * One loaded capability as reported by the `capabilities` query: what it
 * declares it may do, and the effective contributions it owns. Contributions
 * are metadata only — payloads never leave the runtime — and a contribution
 * that lost an override is not effective and is omitted.
 */
export type CapabilityRecordView = {
  id: string;
  name: string;
  version: string;
  scope: string;
  grants: string[];
  dependencies?: string[];
  precedence?: number;
  contributions: Array<{ kind: string; name: string }>;
};

export type RuntimeClient = {
  start(
    onEvent: (event: RuntimeEvent) => void,
    options?: { replay?: "all" | "none" },
  ): void;
  submit(text: string): Promise<SubmittedTurn>;
  submitInput?(input: SubmitInput): Promise<SubmittedTurn>;
  history?(options?: {
    after?: number;
    limit?: number;
  }): Promise<RuntimeHistory>;
  messages?(options?: {
    limit?: number;
    order?: "asc" | "desc";
    cursor?: string;
  }): Promise<RuntimeMessagePage>;
  pendingInteractive?(): Promise<PendingInteractiveRequests>;
  /**
   * Reconcile the workspace watcher hints against the current workspace and
   * return the confirmed changes (WG4 Phase 3 read surface). Confirmed changes
   * are not written to the Work Graph yet (Phase 4).
   */
  confirmedWorkspaceChanges?(): Promise<
    Array<{
      id: string;
      workspaceRoot: string;
      path: string;
      operation: "added" | "modified" | "deleted" | "renamed";
      origin:
        | "tool"
        | "sandbox_merge"
        | "checkpoint_rollback"
        | "external"
        | "unknown";
      attribution: "attributed" | "unattributed" | "indeterminate";
      correlation: {
        sessionID?: string;
        episodeID?: string;
        turnID?: string;
        callID?: string;
        operationID?: string;
      };
      health: "healthy" | "degraded" | "unavailable";
      at: string;
    }>
  >;
  dispose?(): Promise<void>;
  /**
   * Whether config could be applied right now. Advisory only: a turn can start
   * between asking and acting, which is why `reloadConfig` re-checks and reports
   * for itself rather than trusting a caller to have asked.
   */
  canReloadConfig?(): Promise<{ allowed: boolean; reason?: string }>;
  /**
   * Writes a config patch to disk (merged over the current config, like the
   * TUI settings menu) and applies it. Refusal is a value with a reason, like
   * `reloadConfig`: the file may be written while a running turn prevents
   * application. Idempotent by patch: replaying the same patch reproduces the
   * same merged result.
   */
  updateConfig?(input: {
    patch: Record<string, unknown>;
    scope?: "project" | "global";
  }): Promise<{ applied: boolean; reason?: string }>;
  /**
   * The interface-preference settings (`tui.json`). The TUI used to own this
   * file privately; the runtime now serves it so any consumer reads and
   * writes the same settings the TUI renders. `config` is the fully resolved
   * effective value (defaults + global + project), `sources` says what came
   * from where.
   */
  settingsGet?(): Promise<{
    config: Record<string, unknown>;
    sources: Array<{
      scope: "defaults" | "global" | "project";
      path?: string;
      applied: boolean;
      diagnostic?: string;
    }>;
  }>;
  settingsSet?(
    patch: Record<string, unknown>,
    scope: "global" | "project",
  ): Promise<{ applied: boolean }>;
  /**
   * Applies the config on disk. Refusal is a value rather than an exception,
   * because refusing is a normal outcome — applying new policy underneath a
   * running turn would change the rules the turn started under.
   */
  reloadConfig?(): Promise<{ applied: boolean; reason?: string }>;
  cancel(reason?: string): void;
  /**
   * Pauses the running turn. Refusal is a value: there may be nothing running, or
   * it may already be paused, and both are ordinary answers. Returning nothing
   * made the RPC reply claim `paused: true` in every case, including when the
   * runtime had done nothing at all.
   */
  pause?(reason?: string): PauseOutcome | Promise<PauseOutcome>;
  /** Resumes a paused turn. Refusal is a value, as with `pause`. */
  resume?(): ResumeOutcome | Promise<ResumeOutcome>;
  /**
   * Selects the agent for subsequent turns. Three outcomes are real and were all
   * invisible to a caller: applied now, deferred until the running turn ends, or
   * rejected because no such agent exists.
   */
  selectAgent?(
    name?: string,
  ): AgentSelectionOutcome | Promise<AgentSelectionOutcome>;
  agents?(): Promise<RuntimeAgentCatalogEntry[]>;
  modelCatalog?(): Promise<RuntimeModelCatalogEntry[]>;
  modelSelection?(): Promise<RuntimeModelSelection>;
  selectModel?(modelID?: string, variant?: string): Promise<void>;
  skills?(): Promise<RuntimeSkillCatalogEntry[]>;
  workspaceFiles?(input?: {
    query?: string;
    type?: "file" | "directory";
    limit?: number;
  }): Promise<RuntimeWorkspaceFileEntry[]>;
  workspaceSearch?(input: {
    query: string;
    include?: string;
    limit?: number;
  }): Promise<RuntimeWorkspaceMatch[]>;
  workspaceList?(input?: {
    path?: string;
    offset?: number;
    limit?: number;
  }): Promise<RuntimeWorkspaceListPage>;
  workspaceRead?(input: {
    path: string;
    offset?: number;
    limit?: number;
  }): Promise<RuntimeWorkspaceContent>;
  workspaceGlob?(input: {
    pattern: string;
    path?: string;
    limit?: number;
  }): Promise<RuntimeWorkspaceFileEntry[]>;
  nativeTerminalList?(): Promise<RuntimeNativeTerminalSession[]>;
  nativeTerminalRead?(id: string): Promise<{ id: string; text: string }>;
  nativeTerminalOpenHub?(): Promise<{ muxWindowID: number }>;
  nativeTerminalRevokeApprovalScope?(id: string): Promise<{
    id: string;
    scope: string;
    revoked: boolean;
  }>;
  nativeTerminalReleaseHumanControl?(
    id: string,
  ): Promise<RuntimeNativeTerminalSession>;
  nativeTerminalBeginSecureInput?(
    id: string,
  ): Promise<RuntimeNativeTerminalSession>;
  nativeTerminalEndSecureInput?(
    id: string,
  ): Promise<RuntimeNativeTerminalSession>;
  nativeTerminalStop?(id: string): Promise<RuntimeNativeTerminalSession>;
  /**
   * Starts a native terminal session remotely. The route exists and is a write;
   * the host must explicitly enable terminal writes (`terminalWrite: true`),
   * otherwise the call is refused. `cwd` defaults to the runtime's workspace
   * root. Remote callers are treated as model-side actors for ownership and
   * secure-input arbitration.
   */
  nativeTerminalStart?(input: {
    command: string;
    cwd?: string;
    id?: string;
  }): Promise<RuntimeNativeTerminalSession>;
  /**
   * Writes input bytes (including control bytes such as Enter, Ctrl-C, Esc) to
   * a native terminal session. Refused while a human holds input, while secure
   * input is active, or when the host has not enabled terminal writes.
   * `idempotencyKey` makes a replay answer `delivery: "duplicate"` instead of
   * writing again.
   */
  nativeTerminalWrite?(input: {
    id: string;
    input: string;
    idempotencyKey?: string;
  }): Promise<{
    id: string;
    writtenBytes: number;
    delivery: "accepted" | "duplicate" | "cancelled";
  }>;
  /**
   * Resizes a native terminal session. Subject to the same secure-input
   * interlock as the model-side tool; geometry itself stays human-owned.
   */
  nativeTerminalResize?(input: {
    id: string;
    rows: number;
    cols: number;
  }): Promise<RuntimeNativeTerminalSession>;
  checkpointList?(): Promise<RuntimeCheckpoint[]>;
  checkpointPreview?(id: string): Promise<CheckpointPreview>;
  checkpointRollback?(input: {
    id: string;
    dryRun?: boolean;
  }): Promise<CheckpointPreview>;
  sandboxList?(): Promise<RuntimeSandbox[]>;
  sandboxDiff?(id: string): Promise<RuntimeSandboxChange[]>;
  sandboxResources?(id: string): Promise<RuntimeSandboxResource[]>;
  sandboxResourceOutput?(input: {
    id: string;
    resourceID: string;
    maxBytes?: number;
  }): Promise<string>;
  sandboxMerge?(id: string): Promise<RuntimeSandboxChange[]>;
  sandboxDelete?(id: string): Promise<{
    pendingChanges: RuntimeSandboxChange[];
    runningResources: string[];
  }>;
  sandboxResourceStop?(input: {
    id: string;
    resourceID: string;
  }): Promise<RuntimeSandboxResource>;
  sessionList?(): Promise<RuntimeSessionSummary[]>;
  sessionTouch?(id: string): Promise<void>;
  sessionRename?(id: string, title: string): Promise<RuntimeSessionSummary>;
  sessionPin?(id: string, pinned: boolean): Promise<RuntimeSessionSummary>;
  sessionDuplicate?(id: string, title?: string): Promise<RuntimeSessionSummary>;
  sessionFork?(
    id: string,
    turnID: string,
    title?: string,
  ): Promise<RuntimeSessionSummary>;
  sessionDelete?(
    id: string,
  ): Promise<{ id: string; removedAttachments: number }>;
  /**
   * Creates a session record. Idempotent by id: creating an existing id
   * answers `created: false` with the existing summary instead of failing.
   * With no id the runtime mints one. A write.
   */
  sessionNew?(input?: {
    id?: string;
    title?: string;
  }): Promise<{ sessionID: string; created: boolean }>;
  /**
   * Archives a session record: it stays listable with `archived: true` and
   * can still be exported, but is no longer a candidate for new work. A
   * write; idempotent (archiving an archived session answers
   * `archived: true`).
   */
  sessionArchive?(id: string): Promise<{ id: string; archived: boolean }>;
  /**
   * Exports a session's journal: the record header plus every event in
   * sequence. Read-only; an unknown session id is an argument error.
   */
  sessionExport?(id: string): Promise<{
    sessionID: string;
    title: string;
    createdAt: string;
    archived: boolean;
    events: Array<{ seq: number; event: RuntimeEvent }>;
  }>;
  /**
   * Makes an existing durable session the active session of this runtime without
   * rebuilding the host process. An in-flight turn remains owned by its current
   * session and continues in the background; attach switches only the session
   * this runtime presents to its UI and direct calls.
   */
  sessionAttach?(id: string): Promise<{ sessionID: string }>;
  mcpCatalog?(): Promise<MCPCatalogSnapshot>;
  /**
   * Lists permission profiles with the active default. Read-only.
   */
  permissionList?(): Promise<{
    default: string;
    profiles: Array<{ name: string } & PermissionProfile>;
  }>;
  /**
   * Creates or replaces a permission profile. Validated against the config
   * schema; the config file is written either way and the runtime reloads
   * it — `applied: false` with a reason when a running turn blocks the
   * reload. A write.
   */
  permissionSave?(input: {
    name: string;
    profile: PermissionProfile;
  }): Promise<{ saved: boolean; applied: boolean; reason?: string }>;
  /**
   * Deletes a permission profile. Idempotent: an unknown name answers
   * `deleted: true`. The profile currently selected as default is refused
   * (`deleted: false` with a reason). A write.
   */
  permissionDelete?(name: string): Promise<{
    deleted: boolean;
    reason?: string;
  }>;
  /**
   * Adds or replaces an MCP server from its config (the MCP official field
   * set: type/command/args/url/headers/environment/…). The runtime writes
   * the config and reconnects the server; connection failures surface as
   * diagnostics. A write.
   */
  mcpServerAdd?(input: {
    name: string;
    config: MCPServerConfig;
  }): Promise<{ saved: boolean }>;
  /**
   * Removes an MCP server. Idempotent: an unknown name answers
   * `removed: true`. The runtime writes the config and disconnects. A write.
   */
  mcpServerRemove?(name: string): Promise<{ removed: boolean }>;
  /**
   * Creates an agent definition. A write; creating an existing name answers
   * `created: false` with a reason.
   */
  agentCreate?(input: {
    name: string;
    config: AgentConfig;
  }): Promise<{ created: boolean; reason?: string }>;
  /**
   * Replaces an agent definition. A write; an unknown name is an argument
   * error.
   */
  agentUpdate?(input: {
    name: string;
    config: AgentConfig;
  }): Promise<{ updated: boolean }>;
  /**
   * Deletes an agent definition. A write; idempotent (unknown answers
   * `deleted: true`); the default agent refuses deletion.
   */
  agentDelete?(name: string): Promise<{
    deleted: boolean;
    reason?: string;
  }>;
  /**
   * Discovers the models a provider endpoint offers, without configuring it.
   * Read-only, but carries the api key for the probe.
   */
  providerDiscover?(input: {
    type: string;
    baseURL: string;
    apiKey: string;
  }): Promise<{ models: string[] }>;
  /**
   * Adds or replaces a provider by type, endpoint and key, and applies the
   * config. A write.
   */
  providerAdd?(input: {
    name: string;
    type: string;
    baseURL?: string;
    apiKey: string;
  }): Promise<{ saved: boolean }>;
  /**
   * Removes a provider. A write; idempotent; a provider referenced by a model
   * refuses deletion.
   */
  providerRemove?(name: string): Promise<{
    removed: boolean;
    reason?: string;
  }>;
  /**
   * Unloads a plugin. A write; idempotent (unknown answers `unloaded: true`).
   */
  pluginUnload?(id: string): Promise<{ unloaded: boolean }>;
  /**
   * Reloads a plugin from its manifest path: unloads the current instance and
   * re-imports the module. A write; an unknown plugin id is an argument
   * error.
   */
  pluginReload?(id: string): Promise<{ reloaded: boolean }>;
  /**
   * Hot-reloads an out-of-tree tool family: re-imports its entry with a
   * cache-busting query and re-registers it without a restart. This is what a
   * self-modifying agent triggers after its change is promoted. A write; an
   * unknown family id or a disabled family is an argument error.
   */
  toolFamilyReload?(id: string): Promise<{ reloaded: boolean }>;
  getMcpPrompt?(
    server: string,
    name: string,
    arguments_?: Record<string, string>,
  ): Promise<unknown>;
  readMcpResource?(server: string, uri: string): Promise<unknown>;
  plugins?(): Promise<PluginStatus[]>;
  /**
   * Unattended work, read-only.
   *
   * These exist so an integration can list and inspect scheduled tasks and flows
   * without shelling out to the CLI. They report problems per entry instead of
   * throwing, so one broken document cannot blank the list. Running a task is
   * deliberately not here: it is a long, side-effecting operation with its own
   * preflight, and belongs to the task controller rather than a read API.
   */
  /**
   * Commands contributed by capabilities and plugins, so a UI can render them
   * without knowing which extension produced each one.
   */
  commandCatalog?(): Promise<ContributedCommand[]>;
  taskOverview?(): Promise<import("./schemas").ScheduledTaskOverview>;
  flowOverview?(): Promise<import("./schemas").FlowOverview>;
  documentCatalog?(): Promise<import("./schemas").WorkflowDocumentChoice[]>;
  /**
   * Creates or updates a flow document. Refusal is a value: a path outside
   * `.natalia/flows` is refused, and the result says whether the document was
   * created or updated. Idempotent by path: replaying the same request with
   * the same document produces the same outcome, not a second side effect.
   */
  saveFlowDocument?(input: {
    path?: string;
    document: import("./schemas").NataliaFlowDocumentInput;
  }): Promise<{
    path: string;
    flowID: string;
    created: boolean;
    updated: boolean;
  }>;
  /**
   * Deletes a flow document. Idempotent: deleting what is already gone
   * answers `alreadyDeleted: true` instead of failing. A flow still
   * referenced by task documents is refused with the referencing tasks.
   */
  deleteFlowDocument?(input: { path: string }): Promise<{
    path: string;
    deleted: boolean;
    alreadyDeleted: boolean;
  }>;
  /** Creates or replaces a task document under `.natalia/tasks`. */
  saveTaskDocument?(input: {
    path?: string;
    document: import("./schemas").NataliaTaskDocumentInput;
  }): Promise<{
    path: string;
    taskID: string;
    created: boolean;
    updated: boolean;
  }>;
  /** Deletes a task document; configured timers must be removed first. */
  deleteTaskDocument?(input: { path: string }): Promise<{
    path: string;
    deleted: boolean;
    alreadyDeleted: boolean;
  }>;
  taskSchedule?(input: {
    path: string;
    calendar: string;
    scope: "user" | "system";
  }): Promise<{
    path: string;
    taskID: string;
    timerUnit: string;
    scope: "user" | "system";
    normalizedCalendar: string;
    next: string[];
    commands: string[];
  }>;
  taskUnschedule?(input: { path: string }): Promise<{
    path: string;
    removed: boolean;
    commands: string[];
  }>;
  /**
   * Validates a task document and previews its permissions before it is ever
   * delivered to a runtime. Problems are a value, not an exception: an
   * orchestrator validates first and decides, instead of catching. The path
   * must be either a relative file under `.natalia/tasks` or a currently
   * visible capability-owned `cap:` virtual path.
   */
  taskPermissionPreview?(input: { path: string }): Promise<{
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
  runtimeStatus?(): Promise<RuntimeStatusSnapshot>;
  diagnostics?(limit?: number): Promise<RuntimeDiagnostic[]>;
  snapshot(): RuntimeEvent;
  diagnostic(message: string, level?: "info" | "warning" | "error"): void;
  lastSubmission(): SubmittedTurn | undefined;
  /**
   * Answers a pending approval. Refusal is a value: a request that timed out or
   * was already answered is dropped, which an external UI has to know about —
   * "the model was told this call did not run" and "your answer arrived" are
   * different facts. This used to return nothing and the RPC reply said
   * `responded: true` either way.
   */
  respondApproval(
    response: ApprovalResponse,
  ): InteractiveResponseOutcome | Promise<InteractiveResponseOutcome>;
  /** Answers a pending question. Refusal is a value, as with `respondApproval`. */
  respondQuestion(
    response: QuestionResponse,
  ): InteractiveResponseOutcome | Promise<InteractiveResponseOutcome>;
  constitutionRules?(): Promise<
    Array<{
      ruleID: string;
      statement: string;
      scope: "project" | "package" | "sandbox" | "task" | "release";
      priority: "critical" | "high" | "medium" | "low";
      source: "user" | "master_plan" | "policy";
      enforcement: "deny" | "approval" | "warn";
      overridePolicy: "forbidden" | "user_scoped" | "user_explicit";
    }>
  >;
  decisionRecords?(): Promise<
    Array<{
      decision: string;
      rationale: string[];
      alternatives: { option: string; rejectedReason?: string }[];
      consequences: string[];
      status: "proposed" | "accepted" | "superseded";
      linkedPlans: string[];
      linkedConstraints: string[];
    }>
  >;
  /**
   * Records a decision as a durable `decision.recorded` fact. The decision text
   * and rationale may reach the journal — safe prose only, never tool output,
   * file content or secrets.
   */
  recordDecision?(input: {
    decision: string;
    rationale?: string[];
    alternatives?: { option: string; rejectedReason?: string }[];
    consequences?: string[];
    linkedPlans?: string[];
    linkedConstraints?: string[];
  }): Promise<{ recorded: boolean }>;
  /** The durable mailbox of Live Work Chat intents, projected from the journal. */
  mailboxList?(): Promise<
    Array<{
      messageID: string;
      source: "user_via_live_chat" | "system";
      priority: "normal" | "high" | "urgent";
      intent: string;
      text: string;
      safeSummary: string;
      relatedPlanID?: string;
      deliveryPolicy: string;
      createdAt: string;
      status: string;
      reason?: string;
    }>
  >;
  /**
   * Enqueues a Live Work Chat intent as a durable mailbox message. The text is
   * user intent prose that may reach the journal — secrets must be redacted by
   * the caller; `safeSummary` is the bounded, redacted summary.
   */
  mailboxSend?(input: {
    source?: "user_via_live_chat" | "system";
    priority?: "normal" | "high" | "urgent";
    intent: string;
    text: string;
    safeSummary?: string;
    relatedPlanID?: string;
    deliveryPolicy?: string;
  }): Promise<{ queued: boolean; messageID?: string }>;
  /** Marks a queued mailbox message delivered at a safe boundary. */
  mailboxDeliver?(messageID: string): Promise<{ delivered: boolean }>;
  /** Acknowledges a delivered mailbox message. */
  mailboxAcknowledge?(messageID: string): Promise<{ acknowledged: boolean }>;
  /** Defers a mailbox message, with a safe reason. */
  mailboxDefer?(
    messageID: string,
    reason?: string,
  ): Promise<{ deferred: boolean }>;
  /** Supersedes a mailbox message, with a safe reason. */
  mailboxSupersede?(
    messageID: string,
    reason?: string,
  ): Promise<{ superseded: boolean }>;
  /** The durable Live Work Chat plans, projected from the journal (P8 C4). */
  planList?(): Promise<
    Array<{
      planID: string;
      version: number;
      title: string;
      author: "user" | "live_chat" | "main_agent";
      objective: string;
      steps: Array<{
        id: string;
        title: string;
        detail?: string;
        verification?: string;
      }>;
      constraints: string[];
      verification: string[];
      riskNotes: string[];
      relatedMailboxMessageID?: string;
      supersedesPlanID?: string;
      createdAt: string;
      status: string;
      reason?: string;
    }>
  >;
  /**
   * Creates a plan draft. Plan content (objective, steps, constraints,
   * verification, risk notes) is safe prose that may reach the journal — never
   * tool output, file content or secrets.
   */
  planCreate?(input: {
    title: string;
    author?: "user" | "live_chat" | "main_agent";
    objective: string;
    steps: Array<{
      id: string;
      title: string;
      detail?: string;
      verification?: string;
    }>;
    constraints?: string[];
    verification?: string[];
    riskNotes?: string[];
    relatedMailboxMessageID?: string;
    supersedesPlanID?: string;
    taskID?: string;
  }): Promise<{ created: boolean; planID?: string }>;
  /** Updates a draft plan's content (keeps the plan, bumps version). */
  planUpdate?(input: {
    planID: string;
    objective?: string;
    steps?: Array<{
      id: string;
      title: string;
      detail?: string;
      verification?: string;
    }>;
    constraints?: string[];
    verification?: string[];
    riskNotes?: string[];
    reason?: string;
  }): Promise<{ updated: boolean }>;
  /** Proposes a draft for user review. */
  planPropose?(planID: string): Promise<{ proposed: boolean }>;
  /** Accepts a proposed plan (the user's decision). */
  planAccept?(planID: string): Promise<{ accepted: boolean }>;
  /** Queues an accepted plan as next, waiting for the current plan's safe finish. */
  planQueue?(planID: string): Promise<{ queued: boolean }>;
  /** Activates a queued-next plan. */
  planActivate?(planID: string): Promise<{ activated: boolean }>;
  /** Supersedes a plan, with a safe reason. */
  planSupersede?(
    planID: string,
    reason?: string,
  ): Promise<{ superseded: boolean }>;
  /** Marks an active plan completed; its task's evidence moves to accepted (E3). */
  planCompleted?(planID: string): Promise<{ completed: boolean }>;
  evidenceRecords?(): Promise<
    Array<{
      taskID: string;
      objective: string;
      status: string;
      /** E3: the status driven by its plan's lifecycle, when the record belongs to a task. */
      effectiveStatus?: string;
      changes: Array<{
        path: string;
        changeType: "added" | "modified" | "deleted";
        summary: string;
      }>;
      validations: Array<{
        command: string;
        result: "passed" | "failed" | "skipped";
        safeSummary: string;
        durationMs?: number;
      }>;
      knownGaps: string[];
    }>
  >;
  /**
   * Runs a validation command against the workspace and records the outcome as
   * a durable `evidence.recorded` fact. Only the command, outcome, bounded safe
   * summary and duration reach the journal — the raw output is redacted and
   * truncated before recording.
   */
  recordValidation?(input: {
    taskID: string;
    objective: string;
    command: string;
    timeoutSec?: number;
    knownGaps?: string[];
  }): Promise<{
    recorded: boolean;
    result?: "passed" | "failed";
    safeSummary?: string;
  }>;
  /** The completion cards, projected from the journal (P2 E4). */
  completions?(): Promise<
    Array<{
      completionID: string;
      taskID: string;
      objective: string;
      changeSummary: string;
      behaviorImpact?: string;
      validations: Array<{
        command: string;
        result: "passed" | "failed" | "skipped";
        safeSummary: string;
      }>;
      humanValidation?: string;
      knownGaps: string[];
      externalSideEffects: string[];
      rollbackState?: string;
      evidenceIDs: string[];
      recordedAt: string;
    }>
  >;
  /**
   * Record a completion card: the fixed report structure that answers "is it
   * really done, what evidence is missing". changeSummary is safe prose — never
   * a diff or file content.
   */
  recordCompletion?(input: {
    taskID: string;
    objective: string;
    changeSummary: string;
    behaviorImpact?: string;
    validations?: Array<{
      command: string;
      result: "passed" | "failed" | "skipped";
      safeSummary: string;
    }>;
    humanValidation?: string;
    knownGaps?: string[];
    externalSideEffects?: string[];
    rollbackState?: "clean" | "available" | "none" | "needs_promotion";
    evidenceIDs?: string[];
    changePaths?: string[];
  }): Promise<{ recorded: boolean; completionID?: string }>;
  sessionSnapshot?(): Promise<
    | {
        agentStatus: string;
        currentStep?: string;
        activeTool?: string;
        changedFiles: number;
        unvalidatedChanges: number;
        hasPTY: boolean;
        hasSandbox: boolean;
      }
    | undefined
  >;
  driftFindings?(): Promise<
    Array<{
      findingID: string;
      severity: "advisory" | "warning" | "high";
      confidence: number;
      originalObjective: string;
      currentActivity: string;
      evidence: string[];
      status: string;
    }>
  >;
  /**
   * Runs the DriftEvaluator against safe signals and publishes any
   * `drift.finding_opened` facts. The evaluator is the only production writer
   * of drift findings and has no write power — a finding only escalates to an
   * approval/Chat/mailbox prompt, never a cancellation.
   */
  evaluateDrift?(input: {
    objective: string;
    currentActivity: string;
    applicableConstraints?: string[];
    changes?: Array<{
      path?: string;
      action?: string;
      target?: string;
      summary?: string;
    }>;
    evidenceRefs?: string[];
  }): Promise<{ opened: number }>;
  /**
   * Acknowledge a drift finding (P7 D3): the Main Agent explains it, the user
   * dismisses it, or the work corrects it. Only an open finding can transition.
   */
  acknowledgeDriftFinding?(input: {
    findingID: string;
    status: "explained" | "dismissed" | "corrected";
    rationale?: string;
  }): Promise<{ acknowledged: boolean }>;
  registeredTools?(): Promise<
    Array<{
      name: string;
      owner: string;
      scope: string;
      recovery: string;
      precedence: number;
      requiresApproval: boolean;
    }>
  >;
  capabilities?(): Promise<CapabilityRecordView[]>;
  workGraphNodes?(): Promise<WorkGraphNodeView[]>;
  workGraphEdges?(): Promise<WorkGraphEdgeView[]>;
  /**
   * Sends the user's message into the Live Work Chat conversation (P8 C2). The
   * Chat is a long-lived, always-available collaborator with the full safe
   * project/execution context, not a stateless second agent; it answers with a
   * streamed `chat.message.delta` and settles with `chat.message.added`.
   */
  chatSubmit?(input: { text: string }): Promise<{ messageID: string }>;
  /**
   * The durable Chat conversation, oldest first. `chat.rollback` truncates it
   * at a message boundary, so the projection returns the effective history.
   */
  chatMessages?(): Promise<ChatMessageRow[]>;
  /**
   * Rolls the Chat conversation back to a message boundary — the only rollback
   * the Chat may issue, and it never touches workspace/checkpoint state.
   */
  chatRollback?(input: {
    toMessageID: string;
  }): Promise<{ rolledBackTo: string; removed: number }>;
};

export type ChatMessageRow = {
  messageID: string;
  role: "user" | "chat";
  text: string;
  at: string;
};

export type FakeBackend = RuntimeClient;
