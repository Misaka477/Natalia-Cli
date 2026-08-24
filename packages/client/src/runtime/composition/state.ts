import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { CapabilityRegistry } from "@natalia/capability";
import type { ConfigV3, RuntimeEvent, SessionID } from "@natalia/contracts";
import {
  ContextWindowResolver,
  ProviderConcurrencyLimiter,
} from "@natalia/runtime";
import { createToolRegistry } from "@natalia/tools";
import { RuntimePerformanceTrace } from "../../performance-trace";
import { defaultContextStatusConfig } from "../provider-selection";
import type { RuntimeContext, RuntimeState } from "../context";
import type { RealRuntimeClientOptions } from "../options";

type RuntimeDiagnostic = Extract<RuntimeEvent, { type: "diagnostic" }> & {
  at: string;
};

export function createCompositionContext(
  options: RealRuntimeClientOptions,
): RuntimeContext {
  const permissionMode = options.permissionMode ?? "ask";
  const executionBySession = new Map<
    SessionID,
    import("../context").SessionExecutionState
  >();
  const turnSession = new Map<string, SessionID>();
  const runtimeDiagnostics: RuntimeDiagnostic[] = [];
  const runtimeDiagnosticsBySession = new Map<SessionID, RuntimeDiagnostic[]>();
  const state = {
    runtimeDisposed: false,
    workspaceRoot: resolve(options.workspaceRoot ?? process.cwd()),
    provider: options.provider,
    providerSource: options.provider ? "explicit" : "unconfigured",
    capabilityRegistry: options.capabilityRegistry ?? new CapabilityRegistry(),
    capabilityHost: options.capabilityHost,
    workspaceCapabilityView: options.capabilityHost?.view,
    tools: options.tools ?? createToolRegistry([]),
    permissionMode,
    defaultPermissionMode: permissionMode,
    toolCalls: new Map<string, number>(),
    replayMode: "all",
    turnSession,
    liveMainOutputByTurn: new Map<string, string>(),
    turnAgent: new Map<string, string>(),
    executionBySession,
    paused: false,
    pauseWaiters: [],
    attachmentReferences: new Map(),
    runtimeDiagnosticsBySession,
    runtimeDiagnostics,
    sessionPersistence: Promise.resolve(),
    nativeRuntimeID: randomUUID(),
    contextWindowResolver: new ContextWindowResolver(),
    runtimeContextConfig: defaultContextStatusConfig(),
    providerConcurrencyLimiter: new ProviderConcurrencyLimiter({}),
    terminalStatusByID: new Map<string, string>(),
    performanceTrace: new RuntimePerformanceTrace(),
    sandboxResourcesByID: new Map<string, number>(),
    activeToolByTurn: new Map<string, string>(),
    sessionSnapshotSequence: 0,
    decisionSequence: 0,
    evidenceSequence: 0,
    mailboxSequence: 0,
    chatSequence: 0,
    collabSequence: 0,
    internalWakeTasks: new Set<Promise<unknown>>(),
    planSequence: 0,
    completionSequence: 0,
    titleGenerationTasks: new Map(),
  } as unknown as RuntimeState;
  return { state, ports: {} as RuntimeContext["ports"] };
}

export type CompositionState = RuntimeState;
export type PermissionProfile = ConfigV3["permissionProfiles"][string];
