"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createToolPublish = createToolPublish;
/**
 * Tool catalog publishing — runtime/tool-publish.ts.
 *
 * Publishes the capability and tool catalog facts to the event stream, and
 * hot-reloads one out-of-tree tool family through the local-tools plugin.
 * Reads host state through `RuntimeContext` at call time.
 */
var runtime_services_1 = require("@natalia/runtime-services");
var work_ledger_1 = require("@natalia/work-ledger");
function createToolPublish(ctx, options) {
    /**
     * Capabilities published by the previous call, so publishing stays a sync
     * rather than an append.
     *
     * Publishing only `loaded` made the stream additive: a consumer accumulates
     * capabilities and never hears about one going away, so a reload that drops a
     * family left it on screen.
     *
     * Declared before the `return` below on purpose — a `let` placed after it
     * would never be initialised, since the function returns first, and every
     * later read would land in the temporal dead zone.
     */
    var publishedCapabilities = new Map();
    return {
        publishRuntimeCapabilities: publishRuntimeCapabilities,
        hotReloadToolFamily: hotReloadToolFamily,
        publishRegisteredTools: publishRegisteredTools,
        publishToolCatalogChanges: publishToolCatalogChanges,
        publishWorkGraphToolCall: publishWorkGraphToolCall,
    };
    function publishRuntimeCapabilities() {
        var _a = ctx.ports, publish = _a.publish, getCapabilityRegistry = _a.getCapabilityRegistry;
        var present = new Map();
        for (var _i = 0, _b = getCapabilityRegistry().list(); _i < _b.length; _i++) {
            var record = _b[_i];
            var id = "cap:".concat(record.id);
            present.set(id, record.name);
            publish({
                type: "capability.loaded",
                id: id,
                apiVersion: 1,
                name: record.name,
                version: record.version,
                scope: record.scope,
                grants: record.grants,
            });
        }
        for (var _c = 0, publishedCapabilities_1 = publishedCapabilities; _c < publishedCapabilities_1.length; _c++) {
            var _d = publishedCapabilities_1[_c], id = _d[0], name_1 = _d[1];
            if (!present.has(id))
                publish({ type: "capability.unloaded", id: id, name: name_1 });
        }
        publishedCapabilities = present;
    }
    function hotReloadToolFamily(familyID) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, publish, getTools, getTsRuntimeConfig, getCapabilityRegistry, tools, reload, before, _i, before_1, name_2, _b, _c, name_3, owner;
            var _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _a = ctx.ports, publish = _a.publish, getTools = _a.getTools, getTsRuntimeConfig = _a.getTsRuntimeConfig, getCapabilityRegistry = _a.getCapabilityRegistry;
                        tools = getTools();
                        if (options.tools || !getTsRuntimeConfig())
                            throw new Error("tool family reload is not available");
                        reload = ctx.state.serviceDirectory.getOptional(runtime_services_1.localToolsReload);
                        if (!reload)
                            throw new Error("local tool families are not loaded (natalia-local-tools)");
                        before = new Set(tools.keys());
                        return [4 /*yield*/, reload(familyID)];
                    case 1:
                        _f.sent();
                        // Publish what changed so the projected tool catalog stays honest.
                        for (_i = 0, before_1 = before; _i < before_1.length; _i++) {
                            name_2 = before_1[_i];
                            if (tools.has(name_2))
                                continue;
                            publish({ type: "tool.unregistered", id: "tool:".concat(name_2), name: name_2 });
                        }
                        for (_b = 0, _c = __spreadArray([], tools.keys(), true); _b < _c.length; _b++) {
                            name_3 = _c[_b];
                            if (before.has(name_3))
                                continue;
                            owner = getCapabilityRegistry().ownerOf("tools", name_3);
                            publish({
                                type: "tool.registered",
                                id: "tool:".concat(name_3),
                                name: name_3,
                                owner: owner !== null && owner !== void 0 ? owner : "natalia-runtime",
                                scope: (owner && getCapabilityRegistry().scopeOf(owner)) || "session",
                                recovery: "fail_closed",
                                precedence: 0,
                                requiresApproval: (_e = (_d = tools.get(name_3)) === null || _d === void 0 ? void 0 : _d.requiresApproval) !== null && _e !== void 0 ? _e : false,
                            });
                        }
                        return [2 /*return*/, { reloaded: true }];
                }
            });
        });
    }
    function publishRegisteredTools() {
        var _a = ctx.ports, publish = _a.publish, getTools = _a.getTools, getCapabilityRegistry = _a.getCapabilityRegistry;
        for (var _i = 0, _b = getTools().values(); _i < _b.length; _i++) {
            var tool = _b[_i];
            var owner = getCapabilityRegistry().ownerOf("tools", tool.name);
            publish({
                type: "tool.registered",
                id: "tool:".concat(tool.name),
                name: tool.name,
                owner: owner !== null && owner !== void 0 ? owner : "natalia-runtime",
                scope: (owner && getCapabilityRegistry().scopeOf(owner)) || "session",
                recovery: "fail_closed",
                precedence: 0,
                requiresApproval: tool.requiresApproval,
            });
        }
    }
    function publishToolCatalogChanges(before) {
        var _a = ctx.ports, publish = _a.publish, getTools = _a.getTools, getCapabilityRegistry = _a.getCapabilityRegistry;
        var tools = getTools();
        for (var _i = 0, before_2 = before; _i < before_2.length; _i++) {
            var name_4 = before_2[_i];
            if (!tools.has(name_4))
                publish({ type: "tool.unregistered", id: "tool:".concat(name_4), name: name_4 });
        }
        for (var _b = 0, _c = tools.values(); _b < _c.length; _b++) {
            var tool = _c[_b];
            if (before.has(tool.name))
                continue;
            var owner = getCapabilityRegistry().ownerOf("tools", tool.name);
            publish({
                type: "tool.registered",
                id: "tool:".concat(tool.name),
                name: tool.name,
                owner: owner !== null && owner !== void 0 ? owner : "natalia-runtime",
                scope: (owner && getCapabilityRegistry().scopeOf(owner)) || "session",
                recovery: "fail_closed",
                precedence: 0,
                requiresApproval: tool.requiresApproval,
            });
        }
    }
    /**
     * Records a settled tool call in the Work Graph, with the edge to the turn that
     * caused it. Only settled calls: an in-flight call is not yet a fact. The tool
     * name and status are recorded, never arguments or output.
     */
    function publishWorkGraphToolCall(turnID, callID, toolName, status) {
        var _a = ctx.ports, executionForTurn = _a.executionForTurn, publishForSession = _a.publishForSession;
        var workLedgerController = ctx.state.serviceDirectory.get(work_ledger_1.workLedgerController);
        var exec = executionForTurn(turnID);
        if (!exec)
            throw new Error("no execution state for turn ".concat(turnID));
        var ownerSessionID = exec.session.id;
        publishForSession(exec, workLedgerController.toolCallNode({
            turnID: turnID,
            callID: callID,
            toolName: toolName,
            status: status,
            sessionID: ownerSessionID,
        }));
        publishForSession(exec, workLedgerController.toolCallEdge({ turnID: turnID, callID: callID }));
    }
}
