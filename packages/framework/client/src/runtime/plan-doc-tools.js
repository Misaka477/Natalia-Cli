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
exports.createPlanDocListTool = createPlanDocListTool;
exports.createPlanDocReadTool = createPlanDocReadTool;
exports.createPlanDocTickTool = createPlanDocTickTool;
exports.createPlanPauseTool = createPlanPauseTool;
var work_ledger_1 = require("@natalia/work-ledger");
/** Lists the workspace plan documents with their stable planIDs and paths. */
function createPlanDocListTool(ctx) {
    return {
        name: "plan_doc_list",
        description: "List the workspace plan documents under .natalia/plans/. Each entry carries a stable planID, title, status and documentPath. Use plan_doc_read to read one.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
        execute: function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _b = (_a = JSON).stringify;
                            return [4 /*yield*/, ctx.ports.planDocRuntime.planDocList()];
                        case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                    }
                });
            });
        },
    };
}
/** Reads one plan document by planID or path. */
function createPlanDocReadTool(ctx) {
    return {
        name: "plan_doc_read",
        description: "Read a Markdown plan document by planID or path. Plan documents live under .natalia/plans/. This is how you read the active plan's full text — the plan is never injected into your context, so read it before acting on it.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                planID: {
                    type: "string",
                    description: "The planID from plan_doc_list.",
                },
                path: {
                    type: "string",
                    description: "The document path (alternative to planID).",
                },
            },
            additionalProperties: false,
        },
        execute: function (parsed) {
            return __awaiter(this, void 0, void 0, function () {
                var args, _a, _b, cause_1;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            args = parsed;
                            if (!args.planID && !args.path)
                                return [2 /*return*/, "plan_doc_read requires planID or path; use plan_doc_list to find an available plan document"];
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 3, , 4]);
                            _b = (_a = JSON).stringify;
                            return [4 /*yield*/, ctx.ports.planDocRuntime.planDocRead(__assign(__assign({}, (args.planID ? { planID: args.planID } : {})), (args.path ? { path: args.path } : {})))];
                        case 2: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                        case 3:
                            cause_1 = _c.sent();
                            return [2 /*return*/, cause_1 instanceof Error ? cause_1.message : String(cause_1)];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        },
    };
}
/**
 * `plan_doc_tick` — the model's "declare this step done / retract it" action
 * (EI §4 Phase 4). It flips one checkbox's marker (tick / untick), or — when the
 * plan carries no matching checkbox — appends the step to a `## 落地日志`
 * landing-log section (created on first use). It never rewrites any existing
 * line's text, so the model can declare progress without editing the plan; the
 * runtime then cross-checks the declaration against recorded evidence.
 */
function createPlanDocTickTool(ctx) {
    return {
        name: "plan_doc_tick",
        description: "Declare a plan step done (tick) or retract it (untick). Reads the plan, flips the matching checkbox marker, and writes it back — only the marker changes, never the step text. For a plan with no checkboxes, it appends the step to a '## 落地日志' landing-log section. Use it as you complete each step; a ticked step with no recorded evidence reads as 'gap'.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                planID: {
                    type: "string",
                    description: "The planID from plan_doc_list.",
                },
                task: {
                    type: "string",
                    description: "The exact step label (the checkbox text). Read the plan first to copy it.",
                },
                done: {
                    type: "boolean",
                    description: "true = declare done (tick); false = retract (untick).",
                },
            },
            required: ["planID", "task", "done"],
            additionalProperties: false,
        },
        execute: function (parsed) {
            return __awaiter(this, void 0, void 0, function () {
                var args, doc, result, cause_2;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            args = parsed;
                            if (!((_a = args.planID) === null || _a === void 0 ? void 0 : _a.trim()))
                                return [2 /*return*/, "plan_doc_tick requires planID"];
                            if (typeof args.task !== "string" || !args.task.trim())
                                return [2 /*return*/, "plan_doc_tick requires a non-empty task label"];
                            if (typeof args.done !== "boolean")
                                return [2 /*return*/, "plan_doc_tick requires done (boolean)"];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 5, , 6]);
                            return [4 /*yield*/, ctx.ports.planDocRuntime.planDocRead({
                                    planID: args.planID,
                                })];
                        case 2:
                            doc = _b.sent();
                            result = (0, work_ledger_1.applyPlanDocTick)(doc.content, {
                                task: args.task,
                                done: args.done,
                            });
                            if (!result.ok)
                                return [2 /*return*/, result.reason];
                            if (!(result.action !== "unticked" || result.content !== doc.content)) return [3 /*break*/, 4];
                            return [4 /*yield*/, ctx.ports.planDocRuntime.planDocWrite(__assign({ path: doc.documentPath, content: result.content }, (doc.planID ? { planID: doc.planID } : {})))];
                        case 3:
                            _b.sent();
                            _b.label = 4;
                        case 4: return [2 /*return*/, JSON.stringify({
                                ok: true,
                                action: result.action,
                                planID: doc.planID,
                                documentPath: doc.documentPath,
                            })];
                        case 5:
                            cause_2 = _b.sent();
                            return [2 /*return*/, cause_2 instanceof Error ? cause_2.message : String(cause_2)];
                        case 6: return [2 /*return*/];
                    }
                });
            });
        },
    };
}
/**
 * `plan_pause` (EI §3.5 correction: 暂停 plan). The user asks for a pause in the
 * Live Work Chat ("约束 / 改计划 / 暂停走 chat 对话流"), so the main agent owns the
 * action. Pausing sets the plan's lifecycle status to `paused` (resume returns
 * it to `executing`); the change is a durable `plan.doc.status` fact, so replay
 * and the plan panel stay consistent.
 */
function createPlanPauseTool(ctx) {
    return {
        name: "plan_pause",
        description: "Pause or resume a plan at the user's request (El §3.5). paused=true marks the plan 'paused' so it is no longer treated as actively executing; paused=false resumes it to 'executing'. Use it only when the user asks to pause or resume the plan in chat.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                planID: {
                    type: "string",
                    description: "The planID from plan_doc_list.",
                },
                paused: {
                    type: "boolean",
                    description: "true = pause; false = resume.",
                },
            },
            required: ["planID", "paused"],
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, status, result, cause_3;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            args = parsed;
                            if (!((_a = args.planID) === null || _a === void 0 ? void 0 : _a.trim()))
                                return [2 /*return*/, "plan_pause requires planID"];
                            if (typeof args.paused !== "boolean")
                                return [2 /*return*/, "plan_pause requires paused (boolean)"];
                            status = args.paused ? "paused" : "executing";
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, ctx.ports.planDocRuntime.planDocUpdateStatus(__assign({ planID: args.planID, status: status }, (context.sessionID ? { sessionID: context.sessionID } : {})))];
                        case 2:
                            result = _b.sent();
                            if (!result.updated)
                                return [2 /*return*/, JSON.stringify({
                                        ok: false,
                                        reason: "no marked plan ".concat(args.planID),
                                    })];
                            return [2 /*return*/, JSON.stringify({
                                    ok: true,
                                    planID: args.planID,
                                    status: status,
                                })];
                        case 3:
                            cause_3 = _b.sent();
                            return [2 /*return*/, cause_3 instanceof Error ? cause_3.message : String(cause_3)];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        },
    };
}
