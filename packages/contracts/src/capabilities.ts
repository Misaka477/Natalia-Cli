/**
 * What a runtime is required to do, and how a consumer finds out what else it can.
 *
 * `RuntimeClient` has 95 members and only eight of them are required, so on its own
 * the type says almost nothing: an implementer cannot tell what the minimum is, and
 * a consumer has to feature-detect nearly every call. Worse, `optional` cannot
 * express *why* something is absent — "this runtime does not do terminals" and
 * "nobody has implemented this yet" look identical from the outside, and a query
 * that returns an empty array looks like "no data".
 *
 * This module says all three things explicitly:
 *
 *   - `REQUIRED_RUNTIME_MEMBERS` is the minimum. A runtime providing these is
 *     usable: start a session, submit a turn, cancel it, read state, answer a
 *     prompt.
 *   - `RUNTIME_CAPABILITY_GROUPS` assigns every remaining member to a capability,
 *     so "which parts of the API does this runtime have" is answerable by group
 *     rather than one member at a time. A member that belongs to no group fails
 *     typecheck, so the classification cannot rot as members are added.
 *   - `UNIMPLEMENTED_QUERIES` names the surfaces that exist, are wired end to end,
 *     and have no production writer yet. They answer with an empty result today,
 *     which a consumer would otherwise read as "nothing recorded".
 *
 * `describeRuntimeCapabilities()` derives the report from an instance instead of
 * asking the implementer to declare it, because a hand-maintained declaration is
 * one more thing that can disagree with the code.
 */
import type { RuntimeClient } from "./events";

/**
 * The minimum a runtime must implement to be usable at all: open a session, take a
 * turn, stop it, read the current state, report a problem, and answer the two
 * prompts a turn can block on.
 */
export const REQUIRED_RUNTIME_MEMBERS = [
  "start",
  "submit",
  "cancel",
  "snapshot",
  "diagnostic",
  "lastSubmission",
  "respondApproval",
  "respondQuestion",
] as const satisfies readonly (keyof RuntimeClient)[];

export type RequiredRuntimeMember = (typeof REQUIRED_RUNTIME_MEMBERS)[number];

/**
 * Optional members grouped by the capability they belong to. A consumer checks a
 * group, not 87 individual members, and an implementer reads a group as a unit of
 * work rather than a list of methods to guess at.
 */
export const RUNTIME_CAPABILITY_GROUPS = {
  /** Reading and replaying a session's own history. */
  transcript: ["history", "messages", "pendingInteractive", "submitInput"],
  /** Pausing and resuming a running turn. */
  turnControl: ["pause", "resume"],
  /** Lifecycle beyond a single session. */
  lifecycle: ["dispose", "canReloadConfig", "reloadConfig"],
  /** Choosing the agent and model a turn runs as. */
  selection: [
    "agents",
    "selectAgent",
    "modelCatalog",
    "modelSelection",
    "selectModel",
    "skills",
  ],
  /** Reading and searching the workspace. */
  workspace: [
    "workspaceFiles",
    "workspaceSearch",
    "workspaceList",
    "workspaceRead",
    "workspaceGlob",
  ],
  /** Driving terminals the model owns. */
  terminal: [
    "terminalList",
    "terminalRead",
    "terminalObserve",
    "terminalScrollback",
    "terminalWrite",
    "terminalKey",
    "terminalResize",
    "terminalAttach",
    "terminalDetach",
    "terminalStop",
  ],
  /** Sharing a terminal with other viewers. */
  terminalSharing: [
    "terminalViewerRegister",
    "terminalViewerHeartbeat",
    "terminalViewerControl",
    "terminalViewerWrite",
    "terminalViewerResize",
  ],
  /** The native terminal host, including secure input and approval scopes. */
  nativeTerminal: [
    "nativeTerminalList",
    "nativeTerminalRead",
    "nativeTerminalOpenHub",
    "nativeTerminalRevokeApprovalScope",
    "nativeTerminalReleaseHumanControl",
    "nativeTerminalBeginSecureInput",
    "nativeTerminalEndSecureInput",
    "nativeTerminalStop",
  ],
  /** Snapshotting the workspace and rolling it back. */
  checkpoint: ["checkpointList", "checkpointPreview", "checkpointRollback"],
  /** Working inside an isolated copy of the workspace. */
  sandbox: [
    "sandboxList",
    "sandboxDiff",
    "sandboxResources",
    "sandboxResourceOutput",
    "sandboxMerge",
    "sandboxDelete",
    "sandboxResourceStop",
  ],
  /** Managing sessions as durable records. */
  sessions: [
    "sessionList",
    "sessionTouch",
    "sessionRename",
    "sessionPin",
    "sessionDuplicate",
    "sessionFork",
    "sessionDelete",
  ],
  /** Tools and prompts contributed by MCP servers. */
  mcp: ["mcpCatalog", "getMcpPrompt", "readMcpResource"],
  /** What has been loaded into this runtime. */
  extensions: ["plugins", "commandCatalog", "capabilities"],
  /** Durable task and flow documents. */
  automation: ["taskOverview", "flowOverview", "documentCatalog"],
  /** Runtime health and its own diagnostics. */
  observability: ["runtimeStatus", "diagnostics", "sessionSnapshot"],
  /** The Work Graph: what happened and what caused it. */
  workGraph: ["workGraphNodes", "workGraphEdges"],
  /**
   * Engineering-intelligence records. Present end to end and empty in practice —
   * see `UNIMPLEMENTED_QUERIES`.
   */
  intelligence: [
    "constitutionRules",
    "decisionRecords",
    "evidenceRecords",
    "driftFindings",
    "registeredTools",
  ],
} as const satisfies Record<string, readonly (keyof RuntimeClient)[]>;

export type RuntimeCapabilityGroup = keyof typeof RUNTIME_CAPABILITY_GROUPS;

const GROUP_BY_MEMBER = new Map<string, RuntimeCapabilityGroup>(
  (Object.keys(RUNTIME_CAPABILITY_GROUPS) as RuntimeCapabilityGroup[]).flatMap(
    (group) =>
      (RUNTIME_CAPABILITY_GROUPS[group] as readonly string[]).map(
        (member) => [member, group] as const,
      ),
  ),
);

/**
 * Which capability a member belongs to, so a caller told "not supported" can
 * switch off the whole group instead of discovering it one member at a time.
 * Required members belong to no group and answer `undefined`, because a runtime
 * missing one of those is unusable rather than degraded.
 *
 * Derived from `RUNTIME_CAPABILITY_GROUPS`; a second hand-written mapping is
 * exactly the thing that would rot.
 */
export function capabilityGroupOf(
  member: string,
): RuntimeCapabilityGroup | undefined {
  return GROUP_BY_MEMBER.get(member);
}

type ClassifiedMember =
  | RequiredRuntimeMember
  | (typeof RUNTIME_CAPABILITY_GROUPS)[RuntimeCapabilityGroup][number];

type AssertNever<T extends never> = T;
/**
 * Compile-time completeness. Adding a member to `RuntimeClient` without putting it
 * in a group fails typecheck, so the report can never quietly stop describing part
 * of the API — the failure mode this exists to prevent.
 */
export type UnclassifiedRuntimeClientMember = AssertNever<
  Exclude<keyof RuntimeClient, ClassifiedMember>
>;

/**
 * Queries that are implemented, reachable, and answer with nothing because no
 * production code writes the facts they read yet. Stated here so an integrator can
 * tell that apart from "there is nothing to report", which is the one thing an
 * empty array cannot say for itself.
 *
 * Each is a first slice whose writer is scheduled work, not an abandoned surface.
 */
export const UNIMPLEMENTED_QUERIES = {
  constitutionRules: "no production code records constitution rules yet",
  decisionRecords: "no production code records decisions yet",
  evidenceRecords: "no production code records validation evidence yet",
  driftFindings: "no production code opens drift findings yet",
  registeredTools: "tool registration metadata is not published yet",
} as const satisfies Partial<Record<keyof RuntimeClient, string>>;

export type UnimplementedQuery = keyof typeof UNIMPLEMENTED_QUERIES;

export type RuntimeCapabilityReport = {
  /** True when every required member is present; false means unusable, not degraded. */
  usable: boolean;
  missingRequired: RequiredRuntimeMember[];
  groups: Array<{
    name: RuntimeCapabilityGroup;
    /** Every member of the group is present. */
    available: boolean;
    /** Some but not all — worth reporting, because it is usually a mistake. */
    partial: boolean;
    missing: string[];
  }>;
  /**
   * Present and answering with nothing, with the reason. A consumer should not
   * build a feature on these.
   */
  unimplemented: Array<{ member: UnimplementedQuery; reason: string }>;
};

/**
 * Describes what a specific runtime can do, by looking at what it actually
 * implements rather than what it claims.
 */
export function describeRuntimeCapabilities(
  client: RuntimeClient,
): RuntimeCapabilityReport {
  const has = (member: string) =>
    typeof (client as unknown as Record<string, unknown>)[member] ===
    "function";
  const missingRequired = REQUIRED_RUNTIME_MEMBERS.filter(
    (member) => !has(member),
  );
  const groups = (
    Object.keys(RUNTIME_CAPABILITY_GROUPS) as RuntimeCapabilityGroup[]
  ).map((name) => {
    const members = RUNTIME_CAPABILITY_GROUPS[name] as readonly string[];
    const missing = members.filter((member) => !has(member));
    return {
      name,
      available: missing.length === 0,
      partial: missing.length > 0 && missing.length < members.length,
      missing,
    };
  });
  return {
    usable: missingRequired.length === 0,
    missingRequired: [...missingRequired],
    groups,
    unimplemented: (Object.keys(UNIMPLEMENTED_QUERIES) as UnimplementedQuery[])
      .filter((member) => has(member))
      .map((member) => ({ member, reason: UNIMPLEMENTED_QUERIES[member] })),
  };
}
