import type {
  CheckpointPreview,
  RuntimeCheckpoint,
  RuntimeEvent,
} from "@natalia/contracts";

type Created = Extract<RuntimeEvent, { type: "checkpoint.created" }>;

export const baselineCheckpoint: Created = {
  type: "checkpoint.created",
  id: "checkpoint_0",
  reason: "baseline",
  sequence: 0,
  complete: true,
  files: 3,
  changes: 0,
  contextJournalOffset: 0,
  step: 0,
  tokenEstimate: 128,
  diskUsageBytes: 1024,
};

export function toRuntimeCheckpoints(
  checkpoints: readonly Created[],
): RuntimeCheckpoint[] {
  return checkpoints.map((checkpoint, index) => ({
    id: checkpoint.id,
    sequence: checkpoint.sequence,
    ...(checkpoint.turnID ? { turnID: checkpoint.turnID } : {}),
    step: checkpoint.step,
    reason: index === 0 ? "baseline" : "turn_begin",
    createdAt: new Date().toISOString(),
    complete: checkpoint.complete,
    errors: [],
    files: checkpoint.files,
    changes: checkpoint.changes,
    tokenEstimate: checkpoint.tokenEstimate,
    diskUsageBytes: checkpoint.diskUsageBytes,
  }));
}

export function fixturePreview(
  checkpoint: Created,
  dryRun: boolean,
): CheckpointPreview {
  return {
    checkpointID: checkpoint.id,
    dryRun,
    changes: [{ kind: "modify", path: "README.md" }],
    context: {
      truncateMessages: 1,
      targetJournalOffset: 0,
      targetStep: 0,
      targetTokens: 128,
      compactionGeneration: 0,
    },
    resources: [],
    ignoredFiles: 0,
    diskUsageBytes: checkpoint.diskUsageBytes,
    complete: true,
    warnings: [],
  };
}
