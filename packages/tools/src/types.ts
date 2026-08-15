/**
 * The contract a tool implements, and the context it is handed.
 *
 * Kept in its own module so a tool family can depend on the contract without
 * depending on the barrel that assembles every family — the alternative is every
 * file importing types from `index.ts` while `index.ts` imports them back.
 *
 * `ToolExecutionBoundary` is the policy-relevant part: a name, whether the action
 * needs a human's approval, and how long it may run. It is separate from the
 * implementation so a caller can reason about what a tool is allowed to do without
 * holding the code that does it.
 */
import type { NativeTerminalRegistry } from "@natalia/native-terminal";
import type { SandboxChange, WorkspaceSandboxManager } from "@natalia/sandbox";
import type { SubagentRegistry } from "@natalia/subagent";

export type ToolExecutionBoundary = {
  name: string;
  requiresApproval: boolean;
  timeoutSec?: number;
};

export type ToolSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

/**
 * The UI-facing card a tool draws for a call or a result.
 *
 * This is a projection, not presentation: the tool says what the call or result
 * means (a file to read, a terminal session, a diff, a search) and keeps the
 * body plain text, and a client renders that however it likes. A card is a
 * suggestion — a client that cannot draw the kind falls back to the plain text.
 */
export type ToolRenderIntent = {
  kind: "generic" | "terminal" | "diff" | "search" | "read" | "web";
  /** Card title, e.g. the file path or the command. */
  title: string;
  /** One-line summary for the collapsed card. */
  summary: string;
  /** Body shown when the card is expanded. */
  body?: string;
  /** Extra label/value lines. */
  meta?: Array<[label: string, value: string]>;
};

/**
 * How a tool's call and result are projected. Optional: a tool without one
 * keeps the plain-string contract — its call and result are still shown
 * verbatim, just not projected.
 */
export type ToolOutputDefinition = {
  /** JSON schema of the tool's output value. */
  schema: ToolSchema;
  /**
   * Projects the call arguments into a card, shown while the tool runs and as
   * the call's own presentation.
   */
  presentCall?(args: unknown): ToolRenderIntent | undefined;
  /** Projects the arguments and the result into a card. */
  presentResult?(args: unknown, value: string): ToolRenderIntent | undefined;
  /**
   * The tool's own final content invariant, called exactly once on the raw
   * result before it is redacted and bounded — e.g. stripping page scripts a
   * fetched page carries, or compacting a screen dump. Pure: the content the
   * model sees is the content this returns.
   */
  finalizeContent?(content: string): string;
};

export type RuntimeTool = ToolExecutionBoundary & {
  description: string;
  parameters: ToolSchema;
  output?: ToolOutputDefinition;
  execute(input: unknown, context: ToolExecutionContext): Promise<string>;
};

export type ToolExecutionContext = {
  workspaceRoot: string;
  signal?: AbortSignal;
  askQuestion?: (input: {
    title: string;
    questions: Array<{
      id: string;
      header: string;
      question: string;
      options: Array<{ label: string; description?: string }>;
      multiple?: boolean;
      custom?: boolean;
    }>;
  }) => Promise<string[][]>;
  subagents?: SubagentRegistry;
  nativeTerminal?: NativeTerminalRegistry;
  sandboxes?: WorkspaceSandboxManager;
  workspaceReadAuthorize?: (input: {
    toolName: "glob" | "grep";
    paths: string[];
  }) => Promise<void>;
  sandboxMergeAuthorize?: (input: {
    id: string;
    paths: string[];
  }) => Promise<void>;
  onSandboxEvent?: (event: { type: string; [key: string]: unknown }) => void;
  onWorkspaceChange?: (changes: SandboxChange[]) => void;
  /**
   * The runtime's resolved config, by name (the D2 `runtime.config` service),
   * refreshed in place on config reload. A tool family reads values the
   * `settings` subset does not carry.
   */
  runtimeConfig?: () => unknown;
  settings?: {
    webSearchEndpoint?: string;
    webSearchProviderPriority?: string[];
    browserBinary?: string;
    browserEnabled?: boolean;
    browserUserAgent?: string;
    browserHeaders?: Record<string, string>;
    browserPersistentProfile?: boolean;
    browserProfileDir?: string;
    browserLocale?: string;
    browserTimezone?: string;
    allowedHosts?: string[];
    allowedHostGroups?: string[][];
    allowedSchemes?: string[];
    allowLocalhost?: boolean;
    allowPrivate?: boolean;
    deniedHosts?: string[];
    envAllowlist?: string[];
  };
  parentSessionID?: string;
  parentAgentID?: string;
  maxSubagentDepth?: number;
};
