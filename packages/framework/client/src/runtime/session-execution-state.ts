import type { AgentDefinition } from "@natalia/agent";
import type {
  LocalAttachment,
  ModelCapabilities,
  RuntimeReasoningEffort,
  SubmittedTurn,
} from "@natalia/contracts";
import type { StreamingProvider } from "@natalia/runtime";
import type { SessionRecord } from "@natalia/session";
import type {
  RuntimeContextLedger,
  SkillMetadata,
} from "@natalia/runtime-services";
import type { RuntimeContextStatusConfig } from "./status-config";

type PermissionProfile =
  import("@natalia/contracts").ConfigV3["permissionProfiles"][string];

export type SessionExecutionState = {
  session: SessionRecord;
  context: RuntimeContextLedger;
  attachmentReferences: Map<string, LocalAttachment[]>;
  toolCalls: Map<string, number>;
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
  chatModelProfile?: import("@natalia/contracts").ChatModelProfile;
  advisorPending?: boolean;
  injectedMailboxIDs: Set<string>;
  pendingChatUserMessages: Array<{ messageID: string; text: string }>;
};
