import type {
  LocalAttachment,
  PromptAgentMention,
  PromptResourceMention,
  RuntimeEvent,
  SessionID,
} from "@natalia/contracts";
import type { ProviderRunnerInput } from "@natalia/runtime-services";
import type { ProviderUsage } from "@natalia/runtime";

export type ProviderModelControllerInput = {
  initialize(): void;
  runnerInput(sessionID: SessionID): ProviderRunnerInput;
  commands: {
    catalog(): Promise<
      Array<{ id: string; name: string; provider: string; variants: string[] }>
    >;
    select(
      sessionID: SessionID,
      modelID: string,
      variant?: string,
    ): Promise<void>;
  };
  navi: ProviderChatStreamInput;
  nia: ProviderChatStreamInput;
};

export interface ProviderModelController {
  runTurn(sessionID: SessionID, turn: ProviderTurnInput): Promise<void>;
  runNaviChatTurn(turn: ProviderChatTurnInput): Promise<void>;
  runNiaChatTurn(turn: ProviderChatTurnInput): Promise<void>;
  requestNaviWake(sessionID: SessionID): void;
  requestNiaWake(sessionID: SessionID): void;
  naviBusy(sessionID: SessionID): boolean;
  niaBusy(sessionID: SessionID): boolean;
  abortNavi(sessionID: SessionID): boolean;
  abortNia(sessionID: SessionID): boolean;
  dispose(): Promise<void>;
}

export type ProviderChatStreamInput = {
  available(sessionID: SessionID): boolean;
  publish(sessionID: SessionID, event: RuntimeEvent): void;
  runBody(input: ProviderChatTurnInput, signal: AbortSignal): Promise<void>;
  wake(sessionID: SessionID): Promise<void>;
};

export type ProviderTurnInput = {
  id: string;
  text: string;
  attachments: LocalAttachment[];
  resources: PromptResourceMention[];
  agents: PromptAgentMention[];
  internal?: boolean;
};

export type ProviderChatTurnInput = {
  sessionID: SessionID;
  text: string;
  responseMessageID: string;
  internal?: boolean;
  /**
   * A detour-review wake (EI §3.4): when set on an internal Nia turn, the turn
   * prompts Nia to review the requested detour (via detour_review) instead of
   * the default audit wake. Her verdict is a reference for the user.
   */
  detourReview?: { detourID: string; planID: string; reason: string };
  model?: { modelID?: string; variant?: string };
  provider?: import("@natalia/runtime").StreamingProvider;
  reasoningEffort?: import("@natalia/contracts").RuntimeReasoningEffort;
  attachments?: import("@natalia/contracts").LocalAttachment[];
};
