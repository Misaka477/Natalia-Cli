"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopProcessTree = exports.sendProcessSignal = exports.safeToolEnv = exports.readOptionalFile = exports.processFingerprint = exports.parseProcStatStartTicks = exports.ownsProcess = exports.isProcessRunning = exports.ToolExecutionPipeline = exports.materializeTools = exports.nativeTerminalSearchPage = exports.nativeTerminalReadPage = exports.encodeTerminalKey = exports.workspacePath = exports.timeoutSecOr = exports.requireString = exports.requireObject = exports.positiveNumberOrUndefined = exports.positiveNumberOr = exports.optionalString = exports.optionalInteger = exports.numberOr = exports.TOOL_OUTPUT_RETENTION_MS = exports.MAX_TOOL_OUTPUT_LINES = exports.MAX_TOOL_OUTPUT_BYTES = exports.cleanupToolOutput = exports.boundToolOutput = exports.workspaceWritePathsForTool = exports.workspaceWritePathForTool = exports.TerminalCommandBuffer = exports.evaluatePermissionRules = exports.evaluatePermissionProfileCommandRules = exports.commandTextForTool = exports.createToolPolicyHookLayer = exports.validateToolOutput = exports.assertValidToolParameters = exports.tryParseToolArguments = exports.parseToolArguments = exports.parseBashSimpleCommand = exports.parseBashCommandRule = exports.ensureBashCommandParser = exports.commandHasPrefix = exports.runShell = exports.requiresForcedGitApprovalAst = exports.requiresForcedGitApproval = exports.assertNetworkURL = exports.grepWorkspaceFilesBounded = exports.globWorkspaceFilesBounded = exports.validateToolParameters = exports.PROCESS_OBSERVER_SERVICE = void 0;
exports.interactiveTerminalToolAliases = exports.ToolRegistry = exports.truncateProcessOutput = exports.terminateChildProcessTree = void 0;
exports.createToolRegistry = createToolRegistry;
var types_1 = require("./types");
Object.defineProperty(exports, "PROCESS_OBSERVER_SERVICE", { enumerable: true, get: function () { return types_1.PROCESS_OBSERVER_SERVICE; } });
var validate_1 = require("./validate");
Object.defineProperty(exports, "validateToolParameters", { enumerable: true, get: function () { return validate_1.validateToolParameters; } });
var platform_1 = require("@natalia/platform");
Object.defineProperty(exports, "globWorkspaceFilesBounded", { enumerable: true, get: function () { return platform_1.globWorkspaceFilesBounded; } });
Object.defineProperty(exports, "grepWorkspaceFilesBounded", { enumerable: true, get: function () { return platform_1.grepWorkspaceFilesBounded; } });
var network_1 = require("./network");
Object.defineProperty(exports, "assertNetworkURL", { enumerable: true, get: function () { return network_1.assertNetworkURL; } });
var forced_approval_1 = require("./forced-approval");
Object.defineProperty(exports, "requiresForcedGitApproval", { enumerable: true, get: function () { return forced_approval_1.requiresForcedGitApproval; } });
Object.defineProperty(exports, "requiresForcedGitApprovalAst", { enumerable: true, get: function () { return forced_approval_1.requiresForcedGitApprovalAst; } });
var run_shell_1 = require("./run-shell");
Object.defineProperty(exports, "runShell", { enumerable: true, get: function () { return run_shell_1.runShell; } });
var bash_command_policy_1 = require("./bash-command-policy");
Object.defineProperty(exports, "commandHasPrefix", { enumerable: true, get: function () { return bash_command_policy_1.commandHasPrefix; } });
Object.defineProperty(exports, "ensureBashCommandParser", { enumerable: true, get: function () { return bash_command_policy_1.ensureBashCommandParser; } });
Object.defineProperty(exports, "parseBashCommandRule", { enumerable: true, get: function () { return bash_command_policy_1.parseBashCommandRule; } });
Object.defineProperty(exports, "parseBashSimpleCommand", { enumerable: true, get: function () { return bash_command_policy_1.parseBashSimpleCommand; } });
var tool_arguments_1 = require("./tool-arguments");
Object.defineProperty(exports, "parseToolArguments", { enumerable: true, get: function () { return tool_arguments_1.parseToolArguments; } });
Object.defineProperty(exports, "tryParseToolArguments", { enumerable: true, get: function () { return tool_arguments_1.tryParseToolArguments; } });
var validate_2 = require("./validate");
Object.defineProperty(exports, "assertValidToolParameters", { enumerable: true, get: function () { return validate_2.assertValidToolParameters; } });
Object.defineProperty(exports, "validateToolOutput", { enumerable: true, get: function () { return validate_2.validateToolOutput; } });
var tool_policy_1 = require("./tool-policy");
Object.defineProperty(exports, "createToolPolicyHookLayer", { enumerable: true, get: function () { return tool_policy_1.createToolPolicyHookLayer; } });
var permission_policy_1 = require("./permission-policy");
Object.defineProperty(exports, "commandTextForTool", { enumerable: true, get: function () { return permission_policy_1.commandTextForTool; } });
Object.defineProperty(exports, "evaluatePermissionProfileCommandRules", { enumerable: true, get: function () { return permission_policy_1.evaluatePermissionProfileCommandRules; } });
Object.defineProperty(exports, "evaluatePermissionRules", { enumerable: true, get: function () { return permission_policy_1.evaluatePermissionRules; } });
Object.defineProperty(exports, "TerminalCommandBuffer", { enumerable: true, get: function () { return permission_policy_1.TerminalCommandBuffer; } });
Object.defineProperty(exports, "workspaceWritePathForTool", { enumerable: true, get: function () { return permission_policy_1.workspaceWritePathForTool; } });
Object.defineProperty(exports, "workspaceWritePathsForTool", { enumerable: true, get: function () { return permission_policy_1.workspaceWritePathsForTool; } });
var output_1 = require("./output");
Object.defineProperty(exports, "boundToolOutput", { enumerable: true, get: function () { return output_1.boundToolOutput; } });
Object.defineProperty(exports, "cleanupToolOutput", { enumerable: true, get: function () { return output_1.cleanupToolOutput; } });
Object.defineProperty(exports, "MAX_TOOL_OUTPUT_BYTES", { enumerable: true, get: function () { return output_1.MAX_TOOL_OUTPUT_BYTES; } });
Object.defineProperty(exports, "MAX_TOOL_OUTPUT_LINES", { enumerable: true, get: function () { return output_1.MAX_TOOL_OUTPUT_LINES; } });
Object.defineProperty(exports, "TOOL_OUTPUT_RETENTION_MS", { enumerable: true, get: function () { return output_1.TOOL_OUTPUT_RETENTION_MS; } });
/**
 * The tool-authoring surface.
 *
 * A tool family is meant to be writable outside this package — that is the point
 * of `ToolFamily` — and every built-in family already uses these helpers to read
 * its arguments. Keeping them private would have forced an out-of-package family
 * to reimplement argument validation, which is how two dialects of "what a bad
 * argument is" appear.
 */
var arguments_1 = require("./arguments");
Object.defineProperty(exports, "numberOr", { enumerable: true, get: function () { return arguments_1.numberOr; } });
Object.defineProperty(exports, "optionalInteger", { enumerable: true, get: function () { return arguments_1.optionalInteger; } });
Object.defineProperty(exports, "optionalString", { enumerable: true, get: function () { return arguments_1.optionalString; } });
Object.defineProperty(exports, "positiveNumberOr", { enumerable: true, get: function () { return arguments_1.positiveNumberOr; } });
Object.defineProperty(exports, "positiveNumberOrUndefined", { enumerable: true, get: function () { return arguments_1.positiveNumberOrUndefined; } });
Object.defineProperty(exports, "requireObject", { enumerable: true, get: function () { return arguments_1.requireObject; } });
Object.defineProperty(exports, "requireString", { enumerable: true, get: function () { return arguments_1.requireString; } });
Object.defineProperty(exports, "timeoutSecOr", { enumerable: true, get: function () { return arguments_1.timeoutSecOr; } });
Object.defineProperty(exports, "workspacePath", { enumerable: true, get: function () { return arguments_1.workspacePath; } });
var terminal_io_1 = require("./terminal-io");
Object.defineProperty(exports, "encodeTerminalKey", { enumerable: true, get: function () { return terminal_io_1.encodeTerminalKey; } });
Object.defineProperty(exports, "nativeTerminalReadPage", { enumerable: true, get: function () { return terminal_io_1.nativeTerminalReadPage; } });
Object.defineProperty(exports, "nativeTerminalSearchPage", { enumerable: true, get: function () { return terminal_io_1.nativeTerminalSearchPage; } });
var invocation_1 = require("./invocation");
Object.defineProperty(exports, "materializeTools", { enumerable: true, get: function () { return invocation_1.materializeTools; } });
var execution_pipeline_1 = require("./execution-pipeline");
Object.defineProperty(exports, "ToolExecutionPipeline", { enumerable: true, get: function () { return execution_pipeline_1.ToolExecutionPipeline; } });
/**
 * Process helpers are part of the tool-authoring surface: shell, process and
 * terminal families all spawn and supervise child processes, and a family
 * written outside this package must not reimplement environment sanitisation,
 * tree termination or output bounding.
 */
var child_process_1 = require("./child-process");
Object.defineProperty(exports, "isProcessRunning", { enumerable: true, get: function () { return child_process_1.isProcessRunning; } });
Object.defineProperty(exports, "ownsProcess", { enumerable: true, get: function () { return child_process_1.ownsProcess; } });
Object.defineProperty(exports, "parseProcStatStartTicks", { enumerable: true, get: function () { return child_process_1.parseProcStatStartTicks; } });
Object.defineProperty(exports, "processFingerprint", { enumerable: true, get: function () { return child_process_1.processFingerprint; } });
Object.defineProperty(exports, "readOptionalFile", { enumerable: true, get: function () { return child_process_1.readOptionalFile; } });
Object.defineProperty(exports, "safeToolEnv", { enumerable: true, get: function () { return child_process_1.safeToolEnv; } });
Object.defineProperty(exports, "sendProcessSignal", { enumerable: true, get: function () { return child_process_1.sendProcessSignal; } });
Object.defineProperty(exports, "stopProcessTree", { enumerable: true, get: function () { return child_process_1.stopProcessTree; } });
Object.defineProperty(exports, "terminateChildProcessTree", { enumerable: true, get: function () { return child_process_1.terminateChildProcessTree; } });
Object.defineProperty(exports, "truncateProcessOutput", { enumerable: true, get: function () { return child_process_1.truncateProcessOutput; } });
var ToolRegistry = /** @class */ (function (_super) {
    __extends(ToolRegistry, _super);
    function ToolRegistry() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.aliases = new Map();
        return _this;
    }
    ToolRegistry.prototype.addAlias = function (alias, target) {
        var _this = this;
        if (!_super.prototype.has.call(this, target))
            throw new Error("cannot alias unknown tool: ".concat(target));
        if (_super.prototype.has.call(this, alias) || this.aliases.has(alias))
            throw new Error("tool alias already registered: ".concat(alias));
        var registration = { target: target };
        this.aliases.set(alias, registration);
        return function () {
            if (_this.aliases.get(alias) === registration)
                _this.aliases.delete(alias);
        };
    };
    ToolRegistry.prototype.get = function (name) {
        var _a, _b;
        return _super.prototype.get.call(this, (_b = (_a = this.aliases.get(name)) === null || _a === void 0 ? void 0 : _a.target) !== null && _b !== void 0 ? _b : name);
    };
    ToolRegistry.prototype.has = function (name) {
        var _a, _b;
        return _super.prototype.has.call(this, (_b = (_a = this.aliases.get(name)) === null || _a === void 0 ? void 0 : _a.target) !== null && _b !== void 0 ? _b : name);
    };
    return ToolRegistry;
}(Map));
exports.ToolRegistry = ToolRegistry;
/**
 * A registry over an explicit tool list.
 *
 * There is no implicit default: a caller states which tools it wants, because
 * "the tools you get when you say nothing" is exactly the built-in catalogue this
 * package no longer owns. The host assembles the catalogue from families.
 */
function createToolRegistry(tools) {
    return new ToolRegistry(tools.map(function (tool) { return [tool.name, tool]; }));
}
var interactiveTerminalToolAliases = {
    interactive_start: "interactive_terminal_start",
    interactive_read: "interactive_terminal_read",
    interactive_search: "interactive_terminal_search",
    interactive_write: "interactive_terminal_write",
    interactive_send_line: "interactive_terminal_send_line",
    interactive_keys: "interactive_terminal_keys",
    interactive_input: "interactive_terminal_input",
    interactive_snapshot: "interactive_terminal_snapshot",
    interactive_resize: "interactive_terminal_resize",
    interactive_stop: "interactive_terminal_stop",
    interactive_list: "interactive_terminal_list",
};
exports.interactiveTerminalToolAliases = interactiveTerminalToolAliases;
/**
 * The families whose tools still live in this package.
 *
 * Each one describes itself the way an out-of-package family does, so moving a
 * family into its own `packages/tool-*` package is a move, not a redesign: the
 * host's list of families is the only thing that changes. `todo` already left —
 * see `@natalia/plugin-tool-todo`.
 */
