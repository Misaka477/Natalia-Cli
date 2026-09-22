import type { CheckpointFactory } from "@natalia/runtime-services";
import { defineService } from "@natalia/runtime-services";

/**
 * The checkpoint factory token; lives with the mechanism that implements it.
 */
export const checkpointFactory = defineService<CheckpointFactory>(
  "checkpoint.factory",
  { scope: "workspace", capability: "services" },
);
