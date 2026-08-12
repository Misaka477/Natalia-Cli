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

export type RuntimeTool = ToolExecutionBoundary & {
  description: string;
  parameters: ToolSchema;
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
