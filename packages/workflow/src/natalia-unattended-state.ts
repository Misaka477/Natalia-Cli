import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const STATE_VERSION = 1;

export type NataliaWatermarkKind = "timestamp" | "offset";

export type NataliaWatermark = {
  source: string;
  kind: NataliaWatermarkKind;
  /**
   * Positions stay strings so the file remains hand-editable and so a byte
   * offset never loses precision through a float round-trip.
   */
  position: string;
  updatedAt: string;
};

export type NataliaFingerprintRecord = {
  issue: string;
  recordedAt: string;
};

export type NataliaSuppressedFingerprint = {
  reason: string;
  suppressedAt: string;
};

export type NataliaUnattendedState = {
  version: number;
  taskID: string;
  watermarks: Record<string, NataliaWatermark>;
  pendingInvocationID?: string;
  pending: Record<string, NataliaWatermark>;
  fingerprints: Record<string, NataliaFingerprintRecord>;
  suppressed: Record<string, NataliaSuppressedFingerprint>;
  consecutiveFailures: number;
  lastResult?: { invocationID: string; status: string; at: string };
};

/**
 * Cross-execution state for one unattended task: how far an external source was
 * consumed, which finding fingerprints already have an issue, which
 * fingerprints a human retired, and how many executions failed in a row.
 *
 * It is deliberately a small, readable, hand-editable JSON file rather than a
 * session journal entry: every episode gets its own session, while this state
 * has to survive across episodes. It is also not the mainline persistent facts
 * layer and does not pretend to be: it carries no evidence or decision
 * semantics, only "where did I get to last time".
 */
export class NataliaUnattendedStateStore {
  readonly taskID: string;
  readonly dir: string;
  readonly path: string;
  #state: NataliaUnattendedState;

  private constructor(
    workspaceRoot: string,
    taskID: string,
    state: NataliaUnattendedState,
  ) {
    this.taskID = taskID;
    this.dir = unattendedStateDir(workspaceRoot, taskID);
    this.path = resolve(this.dir, "state.json");
    this.#state = state;
  }

  static async open(workspaceRoot: string, taskID: string) {
    const dir = unattendedStateDir(workspaceRoot, taskID);
    const path = resolve(dir, "state.json");
    let source: string | undefined;
    try {
      source = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return new NataliaUnattendedStateStore(
      workspaceRoot,
      taskID,
      source === undefined ? initialState(taskID) : parseState(source, taskID),
    );
  }

  state(): NataliaUnattendedState {
    return structuredClone(this.#state);
  }

  watermark(source: string): NataliaWatermark | undefined {
    const watermark = this.#state.watermarks[source];
    return watermark ? { ...watermark } : undefined;
  }

  consecutiveFailures() {
    return this.#state.consecutiveFailures;
  }

  issueFor(fingerprint: string) {
    const record = this.#state.fingerprints[fingerprint];
    return record ? { ...record } : undefined;
  }

  isSuppressed(fingerprint: string) {
    return Boolean(this.#state.suppressed[fingerprint]);
  }

  /**
   * Stages the position an execution has reached. Staging is never durable
   * progress: a position only becomes the watermark when the whole task
   * succeeds, so a failed or killed execution reprocesses the same data instead
   * of skipping it silently.
   */
  async stagePosition(input: {
    invocationID: string;
    source: string;
    kind: NataliaWatermarkKind;
    position: string;
    at?: string;
  }) {
    if (!input.invocationID)
      throw new Error("staged position requires an invocationID");
    if (!input.source) throw new Error("staged position requires a source");
    if (!input.position) throw new Error("staged position requires a position");
    if (input.kind === "offset" && !/^\d+$/u.test(input.position))
      throw new Error(
        `offset position must be a digit string: ${input.position}`,
      );
    if (input.kind === "timestamp" && Number.isNaN(Date.parse(input.position)))
      throw new Error(
        `timestamp position must be a parsable date: ${input.position}`,
      );
    // A different invocation's staged position is never inherited.
    if (this.#state.pendingInvocationID !== input.invocationID)
      this.#state.pending = {};
    this.#state.pendingInvocationID = input.invocationID;
    this.#state.pending[input.source] = {
      source: input.source,
      kind: input.kind,
      position: input.position,
      updatedAt: input.at ?? new Date().toISOString(),
    };
    await this.persist();
  }

  /** Promotes staged positions. Only a final task success may call this. */
  async commit(input: { invocationID: string; at?: string }) {
    const at = input.at ?? new Date().toISOString();
    if (this.#state.pendingInvocationID === input.invocationID)
      for (const [source, watermark] of Object.entries(this.#state.pending))
        this.#state.watermarks[source] = { ...watermark, updatedAt: at };
    this.#state.pending = {};
    this.#state.pendingInvocationID = undefined;
    this.#state.consecutiveFailures = 0;
    this.#state.lastResult = {
      invocationID: input.invocationID,
      status: "succeeded",
      at,
    };
    await this.persist();
  }

  /**
   * Records a non-successful terminal execution. Watermarks stay exactly where
   * they were and the staged position is discarded.
   */
  async recordFailure(input: {
    invocationID: string;
    status: string;
    at?: string;
  }) {
    if (input.status === "succeeded")
      throw new Error("recordFailure must not be used for a succeeded task");
    this.#state.pending = {};
    this.#state.pendingInvocationID = undefined;
    this.#state.consecutiveFailures += 1;
    this.#state.lastResult = {
      invocationID: input.invocationID,
      status: input.status,
      at: input.at ?? new Date().toISOString(),
    };
    await this.persist();
  }

  async mapFingerprint(input: {
    fingerprint: string;
    issue: string;
    at?: string;
  }) {
    if (!input.fingerprint)
      throw new Error("fingerprint mapping requires a fingerprint");
    if (!input.issue)
      throw new Error("fingerprint mapping requires an issue reference");
    // A human closing a finding is final: automation must not reopen or update
    // a suppressed fingerprint.
    if (this.isSuppressed(input.fingerprint))
      throw new Error(
        `fingerprint is suppressed and must not be reopened: ${input.fingerprint}`,
      );
    this.#state.fingerprints[input.fingerprint] = {
      issue: input.issue,
      recordedAt: input.at ?? new Date().toISOString(),
    };
    await this.persist();
  }

  async suppress(input: { fingerprint: string; reason: string; at?: string }) {
    if (!input.fingerprint)
      throw new Error("suppression requires a fingerprint");
    if (!input.reason) throw new Error("suppression requires a reason");
    this.#state.suppressed[input.fingerprint] = {
      reason: input.reason,
      suppressedAt: input.at ?? new Date().toISOString(),
    };
    await this.persist();
  }

  /**
   * Atomic replacement: a killed execution either leaves the previous complete
   * file or the new complete file, never a truncated one.
   */
  private async persist() {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(
        temporary,
        `${JSON.stringify(sortedState(this.#state), null, 2)}\n`,
        { mode: 0o600 },
      );
      await rename(temporary, this.path);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }
}

function unattendedStateDir(workspaceRoot: string, taskID: string) {
  if (!taskID) throw new Error("unattended state requires a taskID");
  const root = resolve(workspaceRoot, ".natalia", "unattended");
  const dir = resolve(root, taskID);
  const dirRelative = relative(root, dir);
  if (
    dirRelative !== taskID ||
    dirRelative.startsWith("..") ||
    /[\\/]/u.test(taskID)
  )
    throw new Error(
      `unattended state taskID must be a path segment: ${taskID}`,
    );
  return dir;
}

function initialState(taskID: string): NataliaUnattendedState {
  return {
    version: STATE_VERSION,
    taskID,
    watermarks: {},
    pending: {},
    fingerprints: {},
    suppressed: {},
    consecutiveFailures: 0,
  };
}

/**
 * A damaged or future state file fails closed. Resetting it silently would
 * reprocess everything or, worse, resurrect fingerprints a human retired.
 */
function parseState(source: string, taskID: string): NataliaUnattendedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `unattended state for ${taskID} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error(`unattended state for ${taskID} must be an object`);
  const state = parsed as Partial<NataliaUnattendedState>;
  if (state.version !== STATE_VERSION)
    throw new Error(
      `unsupported unattended state version for ${taskID}: ${String(state.version)}`,
    );
  if (state.taskID !== taskID)
    throw new Error(
      `unattended state taskID mismatch: expected ${taskID}, found ${String(state.taskID)}`,
    );
  return {
    version: STATE_VERSION,
    taskID,
    watermarks: state.watermarks ?? {},
    pendingInvocationID: state.pendingInvocationID,
    pending: state.pending ?? {},
    fingerprints: state.fingerprints ?? {},
    suppressed: state.suppressed ?? {},
    consecutiveFailures: state.consecutiveFailures ?? 0,
    lastResult: state.lastResult,
  };
}

function sortedState(state: NataliaUnattendedState) {
  return {
    ...state,
    watermarks: sortedRecord(state.watermarks),
    pending: sortedRecord(state.pending),
    fingerprints: sortedRecord(state.fingerprints),
    suppressed: sortedRecord(state.suppressed),
  };
}

function sortedRecord<T>(record: Record<string, T>) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}
