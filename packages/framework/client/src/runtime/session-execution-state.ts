import type { AgentDefinition } from "@natalia/agent";
import type {
  LocalAttachment,
  ModelCapabilities,
  RuntimeReasoningEffort,
  SubmittedTurn,
} from "@natalia/contracts";
import {
  ContextLedger,
  TokenMeter,
  type StreamingProvider,
} from "@natalia/runtime";
import type { SessionRecord } from "@natalia/session";
import type {
  RuntimeContextLedger,
  SkillMetadata,
} from "@natalia/runtime-services";
import type { RuntimeContextStatusConfig } from "./status-config";

export type CollabSnapshot = {
  collabMessages: import("@natalia/session").ProjectedCollabMessage[];
  planDocs: import("@natalia/session").ProjectedPlanDoc[];
  mailboxMessages: import("@natalia/session").ProjectedMailboxMessage[];
  revision: number;
  eventCount: number;
};

type PermissionProfile = import("@natalia/contracts").PermissionProfile;

export type SessionExecutionState = {
  session: SessionRecord;
  context: RuntimeContextLedger;
  attachmentReferences: Map<string, LocalAttachment[]>;
  toolCalls: Map<string, number[]>;
  provider?: StreamingProvider;
  runtimeContextConfig: RuntimeContextStatusConfig;
  activeModelCapabilities?: ModelCapabilities;
  permissionMode: "ask" | "auto" | "read_only";
  permissionProfile?: PermissionProfile;
  activeAbort?: AbortController;
  activeTurnID?: string;
  selectedAgent?: AgentDefinition;
  pendingAgent?: AgentDefinition;
  selectedModel?: { modelID?: string; variant?: string };
  reasoningEffort?: RuntimeReasoningEffort;
  lastProviderUsage?: { inputTokens: number; outputTokens: number };
  activeSkill?: SkillMetadata;
  endTurnWaitingHuman?: { terminalID: string; reason: string };
  lastSubmitted?: SubmittedTurn;
  paused: boolean;
  pauseWaiters: Array<() => void>;
  naviChatLedger: ContextLedger;
  niaChatLedger: ContextLedger;
  tokenMeter: TokenMeter;
  naviChatModelProfile?: import("@natalia/contracts").ChatModelProfile;
  niaChatModelProfile?: import("@natalia/contracts").ChatModelProfile;
  advisorPending?: boolean;
  collabSnapshot?: CollabSnapshot;
  /** Total durable event count; may be larger than session.events.length when full events are still loading in background. */
  eventCount?: number;
  /** Next hidden per-session durable sequence to stamp on a persisted event. */
  nextSessionSeq: number;
  /** True once session.events holds the complete durable log (not the fast-path tail). */
  fullEventsLoaded?: boolean;
  /** Memoized session projection for snapshot/intelligence reads at one event revision. */
  snapshotProjection?: {
    eventCount: number;
    value: import("@natalia/session").SessionProjection;
  };
  /** Memoized promise that loads the complete durable event log into session.events. */
  fullEventsPromise?: Promise<void>;
  injectedMailboxIDs: Set<string>;
  /** Lazily opened shared event window for secondary projections. */
  eventWindow?: import("./session-window").SessionWindow<
    import("./session-window").SessionWindowEntry<
      import("@natalia/contracts").RuntimeEvent
    >
  >;
  /**
   * Turn ids whose `turn.submitted` was already published, so the runtime can
   * avoid an O(events) journal scan before every turn. Seeded once from the
   * loaded journal and extended as turns are announced.
   */
  announcedTurnIDs: Set<string>;
  naviPendingQueue: Array<{
    messageID: string;
    text: string;
    attachments?: LocalAttachment[];
  }>;
  niaPendingQueue: Array<{
    messageID: string;
    text: string;
    attachments?: LocalAttachment[];
  }>;
  naviAbortWakePending?: boolean;
  niaAbortWakePending?: boolean;
};

/** Seeds {@link SessionExecutionState.announcedTurnIDs} from the loaded journal. */
export function announcedTurnIDsFrom(session: SessionRecord): Set<string> {
  const ids = new Set<string>();
  for (const event of session.events)
    if (event.type === "turn.submitted") ids.add(event.id);
  return ids;
}
