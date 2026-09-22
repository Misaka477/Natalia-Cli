import type { CompactionService } from "@natalia/runtime-services";
import { defineService } from "@natalia/runtime-services";

/** The compaction service token; lives with the mechanism that implements it. */
export const compactionService = defineService<CompactionService>(
  "compaction.service",
  { scope: "workspace", capability: "services" },
);
