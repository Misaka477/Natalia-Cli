"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClientSurface = createClientSurface;
var collab_1 = require("@natalia/collab");
var collab_2 = require("@natalia/collab");
var collab_3 = require("@natalia/collab");
var extensions_runtime_1 = require("./commands/extensions-runtime");
var intelligence_1 = require("./engineering-intelligence/intelligence");
var attachment_runtime_1 = require("./attachment-runtime");
var subagent_runtime_1 = require("./subagent-runtime");
var mcp_runtime_1 = require("./mcp-runtime");
var selection_1 = require("./provider-selection/selection");
var sandbox_runtime_1 = require("./sandbox-runtime");
var team_runtime_1 = require("./team-runtime");
var core_1 = require("./session-execution/core");
var lifecycle_1 = require("./session-execution/lifecycle");
var management_1 = require("./session-execution/management");
var observability_1 = require("./session-execution/observability");
var sessions_1 = require("./session-execution/sessions");
var settings_1 = require("./session-execution/settings");
var transcript_1 = require("./session-execution/transcript");
var turn_control_1 = require("./session-execution/turn-control");
var native_terminal_1 = require("./terminal-runtime/native-terminal");
var work_graph_1 = require("./work-graph");
var workspace_runtime_1 = require("./workspace-runtime");
var plugin_runtime_1 = require("./plugin-runtime");
function createClientSurface(ctx, options) {
    var _this = this;
    var checkpoint = ctx.ports.getCheckpointRuntime();
    var surface = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, (0, core_1.createCoreSurface)(ctx, options)), (0, transcript_1.createTranscriptSurface)(ctx, options)), (0, turn_control_1.createTurnControlSurface)(ctx, options)), (0, lifecycle_1.createLifecycleSurface)(ctx, options)), (0, settings_1.createSettingsSurface)(ctx, options)), (0, selection_1.createSelectionSurface)(ctx, options)), (0, workspace_runtime_1.createWorkspaceRuntime)(ctx)), (0, plugin_runtime_1.createPluginRuntime)(ctx)), (0, native_terminal_1.createNativeTerminalSurface)(ctx, options)), { checkpointList: checkpoint.checkpointList, checkpointListByKind: checkpoint.checkpointListByKind, auditRounds: checkpoint.auditRounds, roundDiff: checkpoint.roundDiff, checkpointPreview: checkpoint.checkpointPreview, checkpointRollback: checkpoint.checkpointRollback, checkpointRename: checkpoint.checkpointRename, workspaceDiff: checkpoint.workspaceDiff }), (0, sandbox_runtime_1.createSandboxRuntime)(ctx, options.episodeID)), (0, team_runtime_1.createTeamRuntime)(ctx)), (0, subagent_runtime_1.createSubagentRuntime)(ctx)), (0, attachment_runtime_1.createAttachmentRuntime)(ctx)), (0, sessions_1.createSessionsSurface)(ctx, options)), (0, mcp_runtime_1.createMcpRuntime)(ctx, options.globalConfigPath)), (0, extensions_runtime_1.createExtensionsRuntime)(ctx)), (0, management_1.createManagementSurface)(ctx, options)), (0, observability_1.createObservabilitySurface)(ctx, options)), (0, work_graph_1.createWorkGraphRuntime)(ctx)), (0, intelligence_1.createIntelligenceSurface)(ctx, options)), (0, collab_2.createMailboxSurface)(ctx)), (0, collab_3.createPlanDocRuntime)(ctx)), (0, collab_1.createChatSurface)(ctx)), { 
        // Direct status-bar goal controls (pause/resume/clear/edit); bypass the
        // model. Read the ports at call time — they are installed by the event sink
        // during composition, and the workspace proxy forwards these per workspace.
        goalControl: function (action, sessionID) { return __awaiter(_this, void 0, void 0, function () {
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, ((_b = (_a = ctx.ports).goalControl) === null || _b === void 0 ? void 0 : _b.call(_a, action, sessionID))];
                    case 1: return [2 /*return*/, (_c = (_d.sent())) !== null && _c !== void 0 ? _c : {
                            ok: false,
                            action: action,
                            message: "goal control unavailable",
                        }];
                }
            });
        }); }, goalEdit: function (input, sessionID) { return __awaiter(_this, void 0, void 0, function () {
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, ((_b = (_a = ctx.ports).goalEdit) === null || _b === void 0 ? void 0 : _b.call(_a, input, sessionID))];
                    case 1: return [2 /*return*/, (_c = (_d.sent())) !== null && _c !== void 0 ? _c : {
                            ok: false,
                            action: "edit",
                            message: "goal edit unavailable",
                        }];
                }
            });
        }); } });
    // Goal `pause` hard-stops the in-flight goal round through the standard cancel
    // path, so it must be reachable from the goal runtime (event sink).
    ctx.ports.cancelTurn = function (reason, sessionID) {
        return surface.cancel(reason, sessionID);
    };
    return surface;
}
