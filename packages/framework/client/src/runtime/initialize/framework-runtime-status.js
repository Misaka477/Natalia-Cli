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
exports.wireRuntimeStatus = wireRuntimeStatus;
/**
 * Framework subsystem composition — initialize/framework-runtime-status.ts.
 *
 * The shared runtime status projection (and the /help, /doctor, /status and
 * /diagnostics commands built on it) is a framework-internal subsystem, not a
 * plugin: this module constructs the status snapshot controller directly and
 * contributes it as the `status.snapshot.controller` service.
 */
var runtime_status_1 = require("@natalia/runtime-status");
var runtime_services_1 = require("@natalia/runtime-services");
var egress_advisory_1 = require("../../egress-advisory");
var process_settled_notices_1 = require("./process-settled-notices");
var runtime_status_2 = require("@natalia/runtime-status");
function wireRuntimeStatus(ctx) {
    var _this = this;
    var registry = ctx.state.capabilityRegistry;
    var deps = ctx.state.initialize;
    var owner = registry.registerOwner({
        id: "natalia-runtime-ui",
        name: "Runtime UI",
        version: "1.0.0",
        scope: "workspace",
        grants: ["services", "commands"],
    });
    var commands = {
        list: function () {
            return ctx.ports.commandCatalogEntries().map(function (command) { return ({
                name: command.name,
                title: command.title,
                description: command.description,
                acceptsArguments: command.acceptsArguments,
                category: command.category,
            }); });
        },
        session: function (sessionID) { return __awaiter(_this, void 0, void 0, function () {
            var exec, statusController;
            var _a;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        exec = ctx.state.executionBySession.get(sessionID);
                        if (!exec)
                            throw new Error("session not found: ".concat(sessionID));
                        statusController = ctx.state.serviceDirectory.get(runtime_status_2.statusSnapshotController);
                        _a = {
                            provider: exec.provider,
                            providerSource: ctx.ports.getProviderSource(),
                            workspaceRoot: ctx.ports.getWorkspaceRoot(),
                            sessionID: sessionID,
                            toolsSize: ctx.state.tools.size,
                            selectedAgentName: (_b = exec.selectedAgent) === null || _b === void 0 ? void 0 : _b.name,
                            skillsCount: ctx.ports.skillsList().length,
                            diagnostics: __spreadArray(__spreadArray([], ctx.state.runtimeDiagnostics, true), ((_c = ctx.state.runtimeDiagnosticsBySession.get(sessionID)) !== null && _c !== void 0 ? _c : []), true)
                        };
                        return [4 /*yield*/, statusController.snapshotFor({
                                provider: exec.provider,
                                context: exec.context,
                                permissionMode: exec.permissionMode,
                            })];
                    case 1: return [2 /*return*/, (_a.snapshot = _d.sent(),
                            _a)];
                }
            });
        }); },
        publish: function (sessionID, event) {
            var exec = ctx.state.executionBySession.get(sessionID);
            if (!exec)
                throw new Error("session not found: ".concat(sessionID));
            ctx.ports.publishForSession(exec, event);
        },
        egressAdvisory: egress_advisory_1.EGRESS_ADVISORY,
    };
    var session = function (invocation) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(invocation === null || invocation === void 0 ? void 0 : invocation.sessionID))
                        throw new Error("runtime UI command requires a session");
                    return [4 /*yield*/, commands.session(invocation.sessionID)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var controller = (0, runtime_status_1.createStatusSnapshotController)({
        provider: ctx.ports.getProvider,
        context: ctx.ports.getRuntimeContext,
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        permissionMode: ctx.ports.getPermissionMode,
        runningCount: function () { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            var _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        _a = ((_c = (_b = ctx.state.serviceDirectory
                            .getOptional(runtime_services_1.subagentsService)) === null || _b === void 0 ? void 0 : _b.runningCount()) !== null && _c !== void 0 ? _c : 0) +
                            ((_e = (_d = ctx.state.serviceDirectory
                                .getOptional(runtime_services_1.sandboxService)) === null || _d === void 0 ? void 0 : _d.runningResourceCount()) !== null && _e !== void 0 ? _e : 0);
                        return [4 /*yield*/, ((_f = deps.capabilityRegistry
                                .service("managedProcessRegistry")) === null || _f === void 0 ? void 0 : _f.runningCount({
                                workspaceRoot: ctx.ports.getWorkspaceRoot(),
                            }))];
                    case 1: return [2 /*return*/, _a +
                            ((_g = (_h.sent())) !== null && _g !== void 0 ? _g : 0)];
                }
            });
        }); },
        publish: ctx.ports.publish,
        commands: commands,
    });
    // The controller binds through the service directory; the owner stays for
    // the commands contributions below.
    ctx.state.serviceDirectory.provide(runtime_status_2.statusSnapshotController, controller);
    // Managed-process exits reach the session that started them. Wired here
    // because this is where the capability registry is already in hand.
    var unwatchProcesses = (0, process_settled_notices_1.wireProcessSettledNotices)(ctx, {
        service: function (name) { return registry.service(name); },
        onServiceUpdate: function (listener) {
            return registry.onServiceUpdate(listener);
        },
    });
    owner.contribute("commands", "help", {
        name: "help",
        title: "Help",
        run: function () {
            return __spreadArray(__spreadArray([
                "Natalia TS7 agent shell commands:"
            ], commands
                .list()
                .map(function (command) { var _a; return "/".concat(command.name).concat(command.acceptsArguments ? " <args>" : "", " - ").concat((_a = command.description) !== null && _a !== void 0 ? _a : command.title); }), true), [
                "Use Ctrl-C to cancel an active turn and Ctrl-D on an empty composer to exit.",
            ], false).join("\n");
        },
    });
    owner.contribute("commands", "doctor", {
        name: "doctor",
        title: "Doctor",
        run: function (invocation) {
            return __awaiter(this, void 0, void 0, function () {
                var state, configured;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, session(invocation)];
                        case 1:
                            state = _b.sent();
                            commands.publish(state.sessionID, state.snapshot);
                            configured = state.provider
                                ? "".concat(state.provider.provider, "/").concat(state.provider.model, " (").concat(state.providerSource, ")")
                                : "not configured";
                            return [2 /*return*/, [
                                    "Natalia TS7 runtime doctor",
                                    "provider: ".concat(configured),
                                    "workspace: ".concat(state.workspaceRoot),
                                    "session: ".concat(state.sessionID),
                                    "native tools: ".concat(state.toolsSize),
                                    "agent: ".concat((_a = state.selectedAgentName) !== null && _a !== void 0 ? _a : "default"),
                                    "skills: ".concat(state.skillsCount),
                                    state.provider
                                        ? "provider check: configured; submit a short prompt to verify live streaming"
                                        : "provider check: set NATALIA_OPENAI_API_KEY (or OPENAI_API_KEY), or configure a provider in .natalia/config.json, then restart the TUI",
                                    "safety: write/shell/process actions require approval unless permissionMode=auto is explicitly configured by a caller",
                                    commands.egressAdvisory,
                                ].join("\n")];
                    }
                });
            });
        },
    });
    owner.contribute("commands", "status", {
        name: "status",
        title: "Status",
        run: function (invocation) {
            return __awaiter(this, void 0, void 0, function () {
                var state;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, session(invocation)];
                        case 1:
                            state = _a.sent();
                            commands.publish(state.sessionID, state.snapshot);
                            return [2 /*return*/, [
                                    "provider: ".concat(state.snapshot.provider, "/").concat(state.snapshot.model, " (").concat(state.providerSource, ")"),
                                    "context: ".concat(state.snapshot.context),
                                    "steps: ".concat(state.snapshot.step),
                                    "workspace: ".concat(state.snapshot.cwd),
                                    "background: ".concat(state.snapshot.background),
                                ].join("\n")];
                    }
                });
            });
        },
    });
    owner.contribute("commands", "diagnostics", {
        name: "diagnostics",
        title: "Diagnostics",
        run: function (invocation) {
            return __awaiter(this, void 0, void 0, function () {
                var state, value, limit, entries;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, session(invocation)];
                        case 1:
                            state = _b.sent();
                            value = (_a = invocation === null || invocation === void 0 ? void 0 : invocation.args.join(" ").trim()) !== null && _a !== void 0 ? _a : "";
                            limit = value ? Number(value) : 20;
                            if (!Number.isInteger(limit) || limit < 1 || limit > 500)
                                throw new Error("diagnostics limit must be an integer between 1 and 500");
                            entries = state.diagnostics.slice(-limit);
                            return [2 /*return*/, entries.length
                                    ? entries
                                        .map(function (entry) {
                                        return "".concat(entry.at).concat(entry.owner ? " [".concat(entry.owner, "]") : "", " ").concat(entry.level, ": ").concat(entry.message);
                                    })
                                        .join("\n")
                                    : "no diagnostics recorded"];
                    }
                });
            });
        },
    });
    return {
        close: function () {
            controller.dispose();
            unwatchProcesses();
        },
    };
}
