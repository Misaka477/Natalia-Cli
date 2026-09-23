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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EGRESS_ADVISORY = void 0;
exports.createCommands = createCommands;
/**
 * Slash commands and command catalog — runtime/commands module.
 *
 * `handleCommand` is a thin router over the read-only slash handlers
 * (`slash-read.ts`) and the state-changing slash handlers (`slash-action.ts`).
 * `commandCatalogEntries` is the plugin-command catalog read surface. Reads
 * everything it needs from `RuntimeContext` at call time.
 */
var session_1 = require("@anthelia/session");
var slash_action_1 = require("./slash-action");
var egress_advisory_1 = require("../../egress-advisory");
Object.defineProperty(exports, "EGRESS_ADVISORY", { enumerable: true, get: function () { return egress_advisory_1.EGRESS_ADVISORY; } });
function createCommands(ctx) {
    return {
        isPendingInteractiveRequest: isPendingInteractiveRequest,
        handleCommand: handleCommand,
        commandCatalogEntries: commandCatalogEntries,
    };
    function isPendingInteractiveRequest(forSessionID, id, kind) {
        var _a, _b;
        var getExecutionBySession = ctx.ports.getExecutionBySession;
        // D2: the request lives in the session whose turn issued it. A response
        // arriving while the UI is attached to another session must be judged
        // against that session's journal, never the attached one's.
        var target = (_a = getExecutionBySession().get(forSessionID)) === null || _a === void 0 ? void 0 : _a.session;
        var pending = (0, session_1.projectInteractiveRequests)((_b = target === null || target === void 0 ? void 0 : target.events) !== null && _b !== void 0 ? _b : []);
        if (kind === "approval")
            return pending.approvals.some(function (request) { return request.id === id; });
        if (kind === "question")
            return pending.questions.some(function (request) { return request.id === id; });
        return pending.interactives.some(function (request) { return request.id === id && request.kind === kind; });
    }
    function commandCatalogEntries() {
        var getCapabilityRegistry = ctx.ports.getCapabilityRegistry;
        return getCapabilityRegistry()
            .contributions("commands")
            .map(function (entry) { return entry.payload; });
    }
    function handleCommand(id_1, text_1, signal_1) {
        return __awaiter(this, arguments, void 0, function (id, text, signal, commandExec) {
            var trimmed, _a, commandName, args, pluginCommand, output, _b, getAgentRegistry, setPaused, publishForSession, applyAgentPolicy, applyAgentProvider, getActiveExec, deps;
            if (commandExec === void 0) { commandExec = ctx.ports.getActiveExec(); }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!text.trim().startsWith("/"))
                            return [2 /*return*/, false];
                        trimmed = text.trim();
                        _a = trimmed.slice(1).split(/\s+/u), commandName = _a[0], args = _a.slice(1);
                        pluginCommand = commandCatalogEntries().find(function (command) { return command.name === commandName; });
                        if (!pluginCommand) return [3 /*break*/, 2];
                        return [4 /*yield*/, pluginCommand.run({
                                raw: trimmed,
                                args: args,
                                workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                sessionID: commandExec.session.id,
                                signal: signal,
                            })];
                    case 1:
                        output = _c.sent();
                        if (typeof output === "string")
                            ctx.ports.publishForSession(commandExec, {
                                type: "content.delta",
                                id: id,
                                text: output,
                            });
                        ctx.ports.publishForSession(commandExec, { type: "content.done", id: id });
                        ctx.ports.publishForSession(commandExec, {
                            type: "turn.finished",
                            id: id,
                            stopReason: "done",
                        });
                        return [2 /*return*/, true];
                    case 2:
                        _b = ctx.ports, getAgentRegistry = _b.getAgentRegistry, setPaused = _b.setPaused, publishForSession = _b.publishForSession, applyAgentPolicy = _b.applyAgentPolicy, applyAgentProvider = _b.applyAgentProvider, getActiveExec = _b.getActiveExec;
                        deps = {
                            id: id,
                            text: text,
                            signal: signal,
                            commandExec: commandExec,
                            publish: function (event) { return publishForSession(commandExec, event); },
                            agentRegistry: getAgentRegistry(),
                            applyAgentPolicy: applyAgentPolicy,
                            applyAgentProvider: applyAgentProvider,
                            getActiveExec: getActiveExec,
                            setPaused: setPaused,
                        };
                        return [4 /*yield*/, (0, slash_action_1.tryActionSlashCommand)(deps)];
                    case 3: return [2 /*return*/, _c.sent()];
                }
            });
        });
    }
}
