import type { StatusSnapshotController } from "@natalia/runtime-services";
import { defineService } from "@natalia/runtime-services";

/** The runtime status snapshot controller token; lives with the mechanism. */
export const statusSnapshotController = defineService<StatusSnapshotController>(
  "status.snapshot.controller",
  { scope: "workspace", capability: "services" },
);
