import { checkpointDisplayLine } from "@natalia/client";
import type { RuntimeEvent } from "@natalia/contracts";
import { checkpointProgressView } from "@natalia/ui-model";

const events: RuntimeEvent[] = [
  {
    type: "checkpoint.created",
    id: "checkpoint_1",
    reason: "manual",
    sequence: 1,
    complete: true,
    files: 4,
    changes: 1,
    contextJournalOffset: 6,
    step: 2,
    tokenEstimate: 512,
    diskUsageBytes: 4096,
  },
  {
    type: "rollback.previewed",
    preview: {
      checkpointID: "checkpoint_0",
      dryRun: true,
      changes: [{ kind: "delete", path: "test_example.py" }],
      context: {
        truncateMessages: 3,
        targetJournalOffset: 1,
        targetStep: 0,
        targetTokens: 24,
        compactionGeneration: 0,
      },
      resources: [
        { kind: "pty", id: "pty_1", action: "stop", summary: "running PTY" },
      ],
      ignoredFiles: 0,
      diskUsageBytes: 4096,
      complete: true,
      warnings: [],
    },
  },
  {
    type: "rollback.end",
    checkpointID: "checkpoint_0",
    safetyCheckpointID: "checkpoint_2",
    restoredFiles: 3,
    deletedFiles: 1,
    contextJournalOffset: 1,
    step: 0,
  },
];

const rendered = events.map((event) => ({
  plain: checkpointDisplayLine(event),
  view: checkpointProgressView(event),
}));

if (rendered.some((item) => !item.plain || !item.view)) {
  throw new Error("checkpoint smoke failed to render progress/result events");
}

console.log("checkpoint progress/result smoke passed");
