"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createToolPolicyService = createToolPolicyService;
/**
 * The tool-policy framework service: the unique policy funnel.
 *
 * `executeOneTool` is the single place every tool call passes through, and this
 * package owns the policy evaluation half of it: the permission-rule evaluator,
 * the workspace write-path detection, the command-text extraction and the
 * hook-layer factory. The runtime host requires this service — a runtime
 * without policy enforcement is not a runtime — and constructs it directly.
 *
 * Keeping the funnel on the service channel is what later lets plugins
 * contribute policy rules and hooks through the same single writer, instead of
 * opening a second policy path.
 */
var tools_1 = require("@anthelia/tools");
function createToolPolicyService() {
    return {
        createExecutionPipeline: function () { return new tools_1.ToolExecutionPipeline(); },
        createHookLayer: tools_1.createToolPolicyHookLayer,
        evaluatePermissionRules: tools_1.evaluatePermissionRules,
        workspaceWritePathForTool: tools_1.workspaceWritePathForTool,
        workspaceWritePathsForTool: tools_1.workspaceWritePathsForTool,
        commandTextForTool: tools_1.commandTextForTool,
    };
}
