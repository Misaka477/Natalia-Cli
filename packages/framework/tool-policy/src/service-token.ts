import type { ToolPolicyService } from "@natalia/runtime-services";
import { defineService } from "@natalia/runtime-services";

/** The tool policy service token; lives with the mechanism. */
export const toolPolicy = defineService<ToolPolicyService>("tool.policy", {
  scope: "workspace",
  capability: "services",
});
