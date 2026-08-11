/**
 * Per-member decision: when this call does not happen, how does the caller find out?
 *
 * Three answers, and only three:
 *
 *   - `value`   — refusing is an ordinary outcome, so the return type says it.
 *                 A caller must never have to tell "not now" apart from a broken
 *                 connection by catching, and `Promise<void>` cannot say either.
 *   - `error`   — the operation has nothing to answer with, so a refusal arrives
 *                 as `-32001` with a reason (see `failures.ts`).
 *   - `none`    — it cannot be refused for a normal reason: a pure read, a local
 *                 accessor, or an idempotent teardown.
 *
 * The table exists because the question was being answered per member, by
 * whoever wrote it, with no record. Filling it in found five members whose RPC
 * reply asserted success unconditionally — `pause`, `resume`, `selectAgent`,
 * `respondApproval`, `respondQuestion` — the same shape already fixed once for
 * `reloadConfig`.
 *
 * A member that belongs to no row fails typecheck, so a new member cannot be
 * added without someone deciding this about it.
 *
 * Refusal categories decided on 2026-08-10 that this table does *not* yet
 * produce, recorded so they are not mistaken for oversights:
 *
 *   - background sessions must refuse approval-requiring tools outright
 *     (mainline §41.6 D5.2). It is not a member: it happens inside a turn and
 *     surfaces as a tool result, not as an RPC failure.
 *   - the secure-input interlock (terminal plan TERM-M.2 I2) is implemented and
 *     refuses, but the `nativeTerminal*` members have no route yet, so its
 *     refusal is still an untyped `Error` in `packages/native-terminal`. It gets
 *     typed with those routes.
 *   - focus may not be stolen by a background session (I1) and terminals must be
 *     addressed per session (I3) — both land with multi-session. The
 *     `terminal`/`terminalSharing` members this table used to cover for them are
 *     gone: they belonged to the xterm emulator line, which is retired (no
 *     production code can create a session in it), and the live terminal line is
 *     `nativeTerminal*`.
 */
import type { RuntimeClient } from "./events";

export type MemberRefusalSemantics =
  /** Refusing is a value. `expressedBy` names the field that says so. */
  | { refusal: "value"; expressedBy: string; note?: string }
  /** Refusing arrives as `-32001`, because there is no value to put it in. */
  | { refusal: "error"; note: string }
  /** Nothing to handle: it cannot be refused for a normal reason. */
  | { refusal: "none"; note: string };

export const RUNTIME_MEMBER_REFUSAL_SEMANTICS = {
  // --- required ---
  start: {
    refusal: "none",
    note: "attaches a sink; remote consumers subscribe to /events instead",
  },
  submit: {
    refusal: "error",
    note: "a turn either starts or does not; a rejected submission has no partial value to report",
  },
  cancel: {
    refusal: "none",
    note: "idempotent; cancelling nothing is not a refusal",
  },
  snapshot: { refusal: "none", note: "pure read" },
  diagnostic: { refusal: "none", note: "records a fact; cannot decline" },
  lastSubmission: { refusal: "none", note: "local accessor" },
  respondApproval: {
    refusal: "value",
    expressedBy: "accepted",
    note: "a response to a request that timed out or was already answered is dropped, and the caller has to be told; it used to answer responded:true either way",
  },
  respondQuestion: {
    refusal: "value",
    expressedBy: "accepted",
    note: "same as respondApproval",
  },

  // --- transcript ---
  history: { refusal: "none", note: "pure read" },
  messages: { refusal: "none", note: "pure read" },
  pendingInteractive: { refusal: "none", note: "pure read" },
  submitInput: { refusal: "error", note: "as submit" },

  // --- turnControl ---
  pause: {
    refusal: "value",
    expressedBy: "paused",
    note: "nothing running, or already paused, is an ordinary answer",
  },
  resume: {
    refusal: "value",
    expressedBy: "resumed",
    note: "nothing paused is an ordinary answer",
  },

  // --- lifecycle ---
  dispose: {
    refusal: "none",
    note: "idempotent teardown; intentionally not routed remotely",
  },
  canReloadConfig: {
    refusal: "value",
    expressedBy: "allowed",
    note: "advisory precheck; the action re-checks for itself",
  },
  reloadConfig: {
    refusal: "value",
    expressedBy: "applied",
    note: "the reference case: applying new policy under a running turn is refused, and refusing is normal",
  },
  updateConfig: {
    refusal: "value",
    expressedBy: "applied",
    note: "the file may be written while a running turn prevents application, and that is an ordinary answer",
  },
  settingsGet: {
    refusal: "error",
    note: "pure read; an unreadable settings file is a file error",
  },
  settingsSet: {
    refusal: "error",
    note: "an invalid patch or unwritable file leaves no safe partial write",
  },

  // --- selection ---
  agents: { refusal: "none", note: "pure read" },
  selectAgent: {
    refusal: "value",
    expressedBy: "outcome",
    note: "three real outcomes exist in the runtime — applied, deferred until the turn ends, unknown agent — and the caller could see none of them",
  },
  modelCatalog: { refusal: "none", note: "pure read" },
  modelSelection: { refusal: "none", note: "pure read" },
  selectModel: {
    refusal: "error",
    note: "the caller named a model it needs; an unavailable model or unknown variant leaves nothing to proceed with, so there is no partial success to report",
  },
  skills: { refusal: "none", note: "pure read" },

  // --- workspace ---
  workspaceFiles: { refusal: "none", note: "pure read of the catalog" },
  workspaceSearch: {
    refusal: "error",
    note: "path and pattern policy refuse; the reason never names the resolved path",
  },
  workspaceList: { refusal: "error", note: "path policy refuses" },
  workspaceRead: {
    refusal: "error",
    note: "path policy and the size limit refuse",
  },
  workspaceGlob: {
    refusal: "error",
    note: "path and pattern policy refuse",
  },

  // --- nativeTerminal ---
  // No routes until the API plan's P0-C, which is also when the I2 interlock's
  // refusal stops being an untyped Error.
  nativeTerminalList: { refusal: "none", note: "pure read" },
  nativeTerminalRead: {
    refusal: "error",
    note: "output is withheld while a human is entering a secret",
  },
  nativeTerminalOpenHub: {
    refusal: "error",
    note: "I1 will refuse a background session asking for the human's focus",
  },
  nativeTerminalRevokeApprovalScope: {
    refusal: "error",
    note: "no scope to revoke is an argument error; the interlock refuses",
  },
  nativeTerminalReleaseHumanControl: {
    refusal: "error",
    note: "releasing control mid-secret-input is refused",
  },
  nativeTerminalBeginSecureInput: {
    refusal: "error",
    note: "secure input requires human control, and is refused without it",
  },
  nativeTerminalEndSecureInput: {
    refusal: "error",
    note: "ending somebody else's secure input is refused",
  },
  nativeTerminalStop: {
    refusal: "error",
    note: "the interlock refuses while a human is entering a secret",
  },
  nativeTerminalStart: {
    refusal: "error",
    note: "refused when the host has not enabled terminal writes, or the terminal host is unavailable",
  },
  nativeTerminalWrite: {
    refusal: "error",
    note: "refused while a human holds input or secure input is active; an idempotency key replay answers delivery:duplicate instead",
  },
  nativeTerminalResize: {
    refusal: "error",
    note: "refused by the secure-input interlock, like the model-side resize",
  },

  // --- checkpoint ---
  checkpointList: { refusal: "none", note: "pure read" },
  checkpointPreview: { refusal: "none", note: "pure read" },
  checkpointRollback: {
    refusal: "error",
    note: "a rollback that cannot run leaves the tree untouched and has nothing to report but why",
  },

  // --- sandbox ---
  sandboxList: { refusal: "none", note: "pure read" },
  sandboxDiff: { refusal: "none", note: "pure read" },
  sandboxResources: { refusal: "none", note: "pure read" },
  sandboxResourceOutput: { refusal: "none", note: "pure read" },
  sandboxMerge: {
    refusal: "error",
    note: "a merge that conflicts or is not allowed changes nothing",
  },
  sandboxDelete: {
    refusal: "error",
    note: "running resources block deletion",
  },
  sandboxResourceStop: {
    refusal: "error",
    note: "an unknown resource is an argument error",
  },

  // --- sessions ---
  sessionList: { refusal: "none", note: "pure read" },
  sessionTouch: {
    refusal: "error",
    note: "an unknown session is an argument error",
  },
  sessionRename: {
    refusal: "error",
    note: "an unknown session is an argument error",
  },
  sessionPin: {
    refusal: "error",
    note: "an unknown session is an argument error",
  },
  sessionDuplicate: {
    refusal: "error",
    note: "an unknown session is an argument error",
  },
  sessionFork: {
    refusal: "error",
    note: "an unknown session or turn is an argument error",
  },
  sessionDelete: {
    refusal: "error",
    note: "an unknown session is an argument error",
  },
  sessionNew: {
    refusal: "value",
    expressedBy: "created",
    note: "creating an existing id answers created:false with the existing summary",
  },
  sessionArchive: {
    refusal: "value",
    expressedBy: "archived",
    note: "archiving an archived session answers archived:true; an unknown session is an argument error",
  },
  sessionExport: {
    refusal: "error",
    note: "pure read; an unknown session is an argument error",
  },
  sessionAttach: {
    refusal: "error",
    note: "an unknown session, active turn, or pending interactive request leaves no safe partial attach",
  },

  // --- mcp ---
  mcpCatalog: { refusal: "none", note: "pure read" },
  permissionList: { refusal: "none", note: "pure read" },
  permissionSave: {
    refusal: "value",
    expressedBy: "saved",
    note: "the config file is written either way; a running turn blocks the reload and answers applied:false",
  },
  permissionDelete: {
    refusal: "value",
    expressedBy: "deleted",
    note: "the default profile refuses deletion; an unknown name is an idempotent success",
  },
  mcpServerAdd: {
    refusal: "value",
    expressedBy: "saved",
    note: "config write and reconnect; connection failures surface as diagnostics",
  },
  mcpServerRemove: {
    refusal: "value",
    expressedBy: "removed",
    note: "an unknown server is an idempotent success",
  },
  agentCreate: {
    refusal: "value",
    expressedBy: "created",
    note: "creating an existing name answers created:false with a reason",
  },
  agentUpdate: {
    refusal: "error",
    note: "an unknown agent name is an argument error",
  },
  agentDelete: {
    refusal: "value",
    expressedBy: "deleted",
    note: "the default agent refuses deletion; an unknown name is an idempotent success",
  },
  providerDiscover: {
    refusal: "error",
    note: "a failed probe is an error; carries the api key only for the probe",
  },
  providerAdd: {
    refusal: "value",
    expressedBy: "saved",
    note: "config write and apply; apply may be blocked by a running turn",
  },
  providerRemove: {
    refusal: "value",
    expressedBy: "removed",
    note: "a provider referenced by a model refuses deletion; an unknown name is an idempotent success",
  },
  pluginUnload: {
    refusal: "value",
    expressedBy: "unloaded",
    note: "an unknown plugin id is an idempotent success",
  },
  pluginReload: {
    refusal: "error",
    note: "an unknown plugin id is an argument error",
  },
  getMcpPrompt: {
    refusal: "error",
    note: "a disconnected server refuses; there is no prompt to return",
  },
  readMcpResource: {
    refusal: "error",
    note: "a disconnected server refuses",
  },

  // --- extensions ---
  plugins: { refusal: "none", note: "pure read" },
  commandCatalog: { refusal: "none", note: "pure read" },
  capabilities: { refusal: "none", note: "pure read" },

  // --- automation ---
  // These report per-entry problems in the result rather than failing the call,
  // so one unreadable document cannot blank the list.
  taskOverview: { refusal: "none", note: "pure read; problems are per entry" },
  flowOverview: { refusal: "none", note: "pure read; problems are per entry" },
  documentCatalog: { refusal: "none", note: "pure read" },
  saveFlowDocument: {
    refusal: "error",
    note: "a path outside .natalia/flows is refused, like workspace paths",
  },
  deleteFlowDocument: {
    refusal: "error",
    note: "a flow still referenced by tasks is refused with the referencing tasks; already-deleted is a value",
  },
  taskPermissionPreview: {
    refusal: "error",
    note: "a path outside .natalia/tasks is refused; validation problems are a value in the result",
  },

  // --- observability ---
  runtimeStatus: { refusal: "none", note: "pure read" },
  diagnostics: { refusal: "none", note: "pure read" },
  sessionSnapshot: { refusal: "none", note: "pure read" },

  // --- workGraph ---
  workGraphNodes: { refusal: "none", note: "pure read" },
  workGraphEdges: { refusal: "none", note: "pure read" },

  // --- intelligence ---
  // Reachable, empty, and named in UNIMPLEMENTED_QUERIES with the reason.
  constitutionRules: { refusal: "none", note: "pure read" },
  decisionRecords: { refusal: "none", note: "pure read" },
  evidenceRecords: { refusal: "none", note: "pure read" },
  driftFindings: { refusal: "none", note: "pure read" },
  registeredTools: { refusal: "none", note: "pure read" },
} as const satisfies Record<keyof RuntimeClient, MemberRefusalSemantics>;

type AssertNever<T extends never> = T;
/**
 * Compile-time completeness: a new `RuntimeClient` member with no row here fails
 * typecheck, so "how does a caller learn this did not happen" cannot be left
 * undecided.
 */
export type MemberWithoutRefusalSemantics = AssertNever<
  Exclude<keyof RuntimeClient, keyof typeof RUNTIME_MEMBER_REFUSAL_SEMANTICS>
>;

/** The members whose refusal is a value. Consumers read the result, not a catch. */
export function membersRefusingByValue(): string[] {
  return Object.entries(RUNTIME_MEMBER_REFUSAL_SEMANTICS)
    .filter(([, semantics]) => semantics.refusal === "value")
    .map(([member]) => member)
    .sort();
}
