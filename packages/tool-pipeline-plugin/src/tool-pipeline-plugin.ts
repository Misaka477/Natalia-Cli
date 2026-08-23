/**
 * The tool-pipeline built-in plugin: the unique policy funnel.
 *
 * `executeOneTool` is the single place every tool call passes through, and this
 * plugin owns the policy evaluation half of it: the permission-rule evaluator,
 * the workspace write-path detection, the command-text extraction and the
 * hook-layer factory. The host requires this service — a runtime without policy
 * enforcement is not a runtime — and reads it from the kernel rather than
 * wiring the policy functions into its own source.
 *
 * Keeping the funnel on the service channel is what later lets plugins
 * contribute policy rules and hooks through the same single writer, instead of
 * opening a second policy path.
 */
import type { Plugin } from "@natalia/plugin";
import {
  commandTextForTool,
  createToolPolicyHookLayer,
  evaluatePermissionRules,
  ToolExecutionPipeline,
  workspaceWritePathForTool,
  workspaceWritePathsForTool,
} from "@natalia/tools";
import { TOOL_POLICY_SERVICE } from "@natalia/runtime-services";

export const TOOL_PIPELINE_PLUGIN_ID = "natalia-tool-pipeline";
export function createToolPipelinePlugin(): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: TOOL_PIPELINE_PLUGIN_ID,
      version: "1.0.0",
      name: "Tool Pipeline",
      description: "The single policy funnel every tool call passes through.",
      entry: "natalia:tool-pipeline",
      scope: "workspace",
      provides: [TOOL_POLICY_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      api.services.provide(TOOL_POLICY_SERVICE, {
        createExecutionPipeline: () => new ToolExecutionPipeline(),
        createHookLayer: createToolPolicyHookLayer,
        evaluatePermissionRules,
        workspaceWritePathForTool,
        workspaceWritePathsForTool,
        commandTextForTool,
      });
    },
  };
}
