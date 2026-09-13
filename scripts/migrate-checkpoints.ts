/**
 * Migrates legacy (v2) checkpoint journals to the delta + CDC format (v3).
 *
 *   bun scripts/migrate-checkpoints.ts /path/to/workspace
 *
 * The runtime migrates automatically on first load too; this entry point exists
 * so a large journal can be converted ahead of time (outside a running app)
 * and so the operator can watch the result. Every migrated journal keeps a
 * `<journal>.v2-backup` next to it; nothing is deleted.
 */
import { resolve } from "node:path";
import { migrateAllCheckpointJournals } from "@natalia/runtime";

const workspaceRoot = resolve(process.argv[2] ?? process.cwd());
console.log(`[migrate-checkpoints] workspace=${workspaceRoot}`);

const results = await migrateAllCheckpointJournals(workspaceRoot);
if (results.length === 0) {
  console.log("[migrate-checkpoints] nothing to migrate (no v2 journals)");
} else {
  for (const result of results)
    console.log(
      `[migrate-checkpoints] ${result.sessionID}: ${result.migrated} records -> v3, backup ${result.backup}`,
    );
}
