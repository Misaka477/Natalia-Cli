import type { TurnController } from "@natalia/runtime-services";
import { defineService } from "@natalia/runtime-services";

/** The turn orchestration controller token; lives with the mechanism. */
export const turnController = defineService<TurnController>("turn.controller", {
  scope: "workspace",
  capability: "services",
});
