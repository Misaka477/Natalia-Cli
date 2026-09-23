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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
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
exports.smokeFace = smokeFace;
exports.niaFace = niaFace;
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var contracts_1 = require("@natalia/contracts");
var config_1 = require("@natalia/config");
var main_1 = require("./main");
/**
 * The sandbox smoke face of the verification gate (NGM study §4.3):
 * boot an isolated runtime with the CANDIDATE's config, run one trivial
 * turn, and report healthy only when the candidate actually loaded.
 *
 * The isolation is a throwaway workspace plus the candidate's own
 * confinement mode — the smoke is subject to the policy it is testing.
 * The health criterion includes the subtle half: the runtime swallows a
 * config-resolution failure by design (it falls back to defaults with a
 * warning), so a smoke that ignored that warning would happily "pass"
 * while having booted defaults — smoking nothing at all.
 */
/** A provider that answers any prompt with a fixed string and finishes. */
function smokeProvider() {
    return {
        provider: "composition-smoke",
        model: "composition-smoke-model",
        stream: function () {
            return __asyncGenerator(this, arguments, function stream_1() {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, __await({ type: "content", text: "ok" })];
                        case 1: return [4 /*yield*/, _a.sent()];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 3: return [4 /*yield*/, _a.sent()];
                        case 4:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
function waitForSignal(events, predicate, timeoutMs, label) {
    return __awaiter(this, void 0, void 0, function () {
        var deadline;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    deadline = Date.now() + timeoutMs;
                    _a.label = 1;
                case 1:
                    if (!(Date.now() < deadline)) return [3 /*break*/, 3];
                    if (events.some(predicate))
                        return [2 /*return*/];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 20); })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 3: throw new Error("".concat(label, " did not arrive within ").concat(timeoutMs, "ms"));
            }
        });
    });
}
function smokeFace(options) {
    var _this = this;
    var _a;
    if (options === void 0) { options = {}; }
    var timeoutMs = (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 60000;
    var face = function (generation) { return __awaiter(_this, void 0, void 0, function () {
        var base, workspaceRoot, configPath, events, client, resolved, globalSource, error_1, _a;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "composition-smoke-"))];
                case 1:
                    base = _d.sent();
                    workspaceRoot = (0, node_path_1.join)(base, "workspace");
                    configPath = (0, node_path_1.join)(base, "config.json");
                    return [4 /*yield*/, (0, promises_1.mkdir)(workspaceRoot, { recursive: true })];
                case 2:
                    _d.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)(configPath, JSON.stringify(generation.config, null, 2))];
                case 3:
                    _d.sent();
                    events = [];
                    _d.label = 4;
                case 4:
                    _d.trys.push([4, 8, 9, 14]);
                    // Strict schema validation first. Two real holes make this the
                    // smoke's job rather than a formality: loadGeneration does not
                    // deep-validate a stored generation's config (a corrupted or forged
                    // object parses), and the runtime deliberately swallows config errors
                    // (a config error must never kill a running session) — so neither the
                    // store nor the boot would ever say the candidate's config is invalid.
                    try {
                        contracts_1.configV3Schema.parse(generation.config);
                    }
                    catch (error) {
                        return [2 /*return*/, {
                                check: "smoke",
                                ok: false,
                                detail: "candidate config invalid: ".concat(error instanceof Error ? error.message : String(error)),
                            }];
                    }
                    return [4 /*yield*/, (0, config_1.resolveConfig)({
                            workspaceRoot: workspaceRoot,
                            globalPath: configPath,
                        })];
                case 5:
                    resolved = _d.sent();
                    globalSource = resolved.sources.find(function (source) { return source.scope === "global"; });
                    if (!(globalSource === null || globalSource === void 0 ? void 0 : globalSource.applied))
                        return [2 /*return*/, {
                                check: "smoke",
                                ok: false,
                                detail: "candidate config did not load: ".concat((_b = globalSource === null || globalSource === void 0 ? void 0 : globalSource.diagnostic) !== null && _b !== void 0 ? _b : "global scope not applied"),
                            }];
                    client = (0, main_1.createRealRuntimeClient)({
                        sessionID: "ses_smoke_".concat(Date.now().toString(36)),
                        workspaceRoot: workspaceRoot,
                        globalConfigPath: configPath,
                        provider: smokeProvider(),
                        // Hermetic store paths: the smoke owns a throwaway home.
                        checkpointDir: (0, node_path_1.join)(base, "checkpoints"),
                        sessionDir: (0, node_path_1.join)(base, "sessions"),
                        // Approval prompts would park the gate on a human; the smoke proves
                        // the candidate boots and answers, not that a human is willing to.
                        permissionMode: "auto",
                    });
                    client.start(function (event) { return events.push(event); });
                    return [4 /*yield*/, waitForSignal(events, function (event) { return event.type === "session.ready"; }, timeoutMs, "session.ready")];
                case 6:
                    _d.sent();
                    if (typeof client.submitAndWait !== "function")
                        return [2 /*return*/, {
                                check: "smoke",
                                ok: false,
                                detail: "runtime exposes no submitAndWait — cannot prove a turn",
                            }];
                    return [4 /*yield*/, client.submitAndWait("smoke: reply with a short ok.")];
                case 7:
                    _d.sent();
                    return [2 /*return*/, { check: "smoke", ok: true }];
                case 8:
                    error_1 = _d.sent();
                    return [2 /*return*/, {
                            check: "smoke",
                            ok: false,
                            detail: error_1 instanceof Error ? error_1.message : String(error_1),
                        }];
                case 9:
                    _d.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, ((_c = client === null || client === void 0 ? void 0 : client.dispose) === null || _c === void 0 ? void 0 : _c.call(client))];
                case 10:
                    _d.sent();
                    return [3 /*break*/, 12];
                case 11:
                    _a = _d.sent();
                    return [3 /*break*/, 12];
                case 12: return [4 /*yield*/, (0, promises_1.rm)(base, { recursive: true, force: true })];
                case 13:
                    _d.sent();
                    return [7 /*endfinally*/];
                case 14: return [2 /*return*/];
            }
        });
    }); };
    return face;
}
function niaFace(client, options) {
    var _this = this;
    var _a;
    if (options === void 0) { options = {}; }
    var timeoutMs = (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 120000;
    var face = function (generation) { return __awaiter(_this, void 0, void 0, function () {
        var missing, short, path, summary, marked, deadline, status_1, error_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    missing = [];
                    if (typeof client.planDocWrite !== "function")
                        missing.push("planDocWrite");
                    if (typeof client.planDocMark !== "function")
                        missing.push("planDocMark");
                    if (typeof client.planDocActivate !== "function")
                        missing.push("planDocActivate");
                    if (typeof client.planDocStatus !== "function")
                        missing.push("planDocStatus");
                    if (typeof ((_a = client.niaChat) === null || _a === void 0 ? void 0 : _a.submit) !== "function")
                        missing.push("niaChat.submit");
                    if (missing.length)
                        return [2 /*return*/, {
                                check: "nia",
                                ok: false,
                                detail: "runtime exposes no ".concat(missing.join(", "), " \u2014 the audit face needs the plan and Nia surfaces"),
                            }];
                    short = generation.schema.replace(/[^a-z0-9]/gi, "").slice(0, 8);
                    path = "plans/generation-verify-".concat(short, "-").concat(Date.now().toString(36), ".md");
                    summary = __spreadArray(__spreadArray(__spreadArray(__spreadArray([
                        "# Composition generation audit: ".concat(generation.schema),
                        "",
                        "Audit this composition generation candidate. When verified call",
                        "audit_report with this plan's planID.",
                        "",
                        "## Plugins"
                    ], generation.plugins.map(function (plugin) {
                        return "- ".concat(plugin.id, " (").concat(plugin.enabled ? "enabled" : "disabled", ") ").concat(plugin.fingerprint);
                    }), true), [
                        "",
                        "## Policy rows"
                    ], false), generation.policyRows.map(function (row) {
                        return "- ".concat(row.id, ": ").concat(row.statement, " [").concat(row.enforcement, "/").concat(row.overridePolicy, "]");
                    }), true), [
                        "",
                        "## Config",
                        "```json",
                        JSON.stringify(generation.config, null, 2),
                        "```",
                        "",
                    ], false).join("\n");
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 10, , 11]);
                    return [4 /*yield*/, client.planDocWrite({
                            path: path,
                            content: summary,
                            title: "Generation audit",
                        })];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, client.planDocMark({
                            path: path,
                            title: "Generation audit",
                        })];
                case 3:
                    marked = _c.sent();
                    (_b = options.onAuditPlan) === null || _b === void 0 ? void 0 : _b.call(options, marked.planID, path);
                    return [4 /*yield*/, client.planDocActivate(marked.planID)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, client.niaChat.submit({
                            text: "Audit plan ".concat(marked.planID, " (").concat(path, "): a composition generation candidate. Verify it against the plan document and call audit_report with planID=").concat(marked.planID, "."),
                        })];
                case 5:
                    _c.sent();
                    deadline = Date.now() + timeoutMs;
                    _c.label = 6;
                case 6:
                    if (!(Date.now() < deadline)) return [3 /*break*/, 9];
                    return [4 /*yield*/, client.planDocStatus(marked.planID)];
                case 7:
                    status_1 = (_c.sent()).status;
                    if (status_1 === "completed")
                        return [2 /*return*/, { check: "nia", ok: true }];
                    if (status_1 === "audit_gaps")
                        return [2 /*return*/, {
                                check: "nia",
                                ok: false,
                                detail: "Nia reported audit_gaps (evidence: the audit round checkpoint and evidence.recorded in the journal)",
                            }];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                case 8:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 9: return [2 /*return*/, {
                        check: "nia",
                        ok: false,
                        detail: "no audit_report verdict for plan ".concat(marked.planID, " within ").concat(timeoutMs, "ms"),
                    }];
                case 10:
                    error_2 = _c.sent();
                    return [2 /*return*/, {
                            check: "nia",
                            ok: false,
                            detail: error_2 instanceof Error ? error_2.message : String(error_2),
                        }];
                case 11: return [2 /*return*/];
            }
        });
    }); };
    return face;
}
