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
exports.sandboxTools = sandboxTools;
exports.sandboxToolFamily = sandboxToolFamily;
/**
 * Tools that work inside a workspace sandbox.
 */
/**
 * Tools that work inside a workspace sandbox.
 *
 * A sandbox is a copy of the workspace the model may change freely; merging is the
 * only way changes reach the real tree, and it is the only action here that asks
 * for authorization on the paths involved. Every tool refuses to run without a
 * sandbox manager rather than silently falling back to the workspace, because
 * "isolation was unavailable" must never be indistinguishable from "isolation
 * happened".
 */
var tools_1 = require("@anthelia/tools");
function requireSandboxes(context) {
    if (!context.sandboxes)
        throw new Error("sandbox runtime unavailable");
    return context.sandboxes;
}
function sandboxCreateTool() {
    return {
        name: "sandbox_create",
        description: "Create a TS workspace-isolated sandbox.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: { id: { type: "string" }, maxLines: { type: "number" } },
            required: ["id"],
            additionalProperties: false,
        },
        output: {
            schema: {
                type: "object",
                properties: { id: { type: "string" } },
                required: ["id"],
                additionalProperties: false,
            },
            presentCall: function (args) {
                return {
                    kind: "generic",
                    title: (0, tools_1.requireObject)(args).id,
                    summary: "create",
                };
            },
            presentResult: function (args, value) {
                return {
                    kind: "generic",
                    title: (0, tools_1.requireObject)(args).id,
                    summary: value,
                };
            },
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, sandbox, backend;
                var _a, _b, _c, _d, _e, _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            return [4 /*yield*/, requireSandboxes(context).create(id)];
                        case 1:
                            sandbox = _g.sent();
                            (_a = context.onSandboxEvent) === null || _a === void 0 ? void 0 : _a.call(context, requireSandboxes(context).updateEvent(id));
                            (_b = context.onSandboxEvent) === null || _b === void 0 ? void 0 : _b.call(context, requireSandboxes(context).auditEvent(id, "create"));
                            backend = (_f = (_e = (_d = (_c = context.runtimeConfig) === null || _c === void 0 ? void 0 : _c.call(context)) === null || _d === void 0 ? void 0 : _d.sandbox) === null || _e === void 0 ? void 0 : _e.backend) !== null && _f !== void 0 ? _f : "snapshot";
                            return [2 /*return*/, JSON.stringify(__assign(__assign({}, sandbox), { backend: backend }), null, 2)];
                    }
                });
            });
        },
    };
}
function sandboxExecuteTool() {
    return {
        name: "sandbox_execute",
        description: "Execute a shell command inside a TS workspace sandbox.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: { id: { type: "string" }, command: { type: "string" } },
            required: ["id", "command"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, manager, id, result;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            manager = requireSandboxes(context);
                            id = (0, tools_1.requireString)(args.id, "id");
                            return [4 /*yield*/, manager.execute(id, (0, tools_1.requireString)(args.command, "command"), {
                                    signal: context.signal,
                                })];
                        case 1:
                            result = _c.sent();
                            (_a = context.onSandboxEvent) === null || _a === void 0 ? void 0 : _a.call(context, manager.updateEvent(id));
                            (_b = context.onSandboxEvent) === null || _b === void 0 ? void 0 : _b.call(context, manager.auditEvent(id, "execute"));
                            return [2 /*return*/, ["exit=".concat(result.exitCode), result.output].join("\n")];
                    }
                });
            });
        },
    };
}
function sandboxWriteTool() {
    return {
        name: "sandbox_write",
        description: "Write a file inside a TS workspace sandbox manifest.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                path: { type: "string" },
                content: { type: "string" },
            },
            required: ["id", "path", "content"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, manager, id;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            manager = requireSandboxes(context);
                            id = (0, tools_1.requireString)(args.id, "id");
                            return [4 /*yield*/, manager.write(id, (0, tools_1.requireString)(args.path, "path"), (0, tools_1.requireString)(args.content, "content"))];
                        case 1:
                            _c.sent();
                            (_a = context.onSandboxEvent) === null || _a === void 0 ? void 0 : _a.call(context, manager.updateEvent(id));
                            (_b = context.onSandboxEvent) === null || _b === void 0 ? void 0 : _b.call(context, manager.diffEvent(id));
                            return [2 /*return*/, "wrote ".concat((0, tools_1.requireString)(args.path, "path"), " in sandbox ").concat(id)];
                    }
                });
            });
        },
    };
}
function sandboxDiffTool() {
    var _this = this;
    return sandboxReadTool("sandbox_diff", "Show pending sandbox changes.", function (manager, id) { return __awaiter(_this, void 0, void 0, function () {
        var changes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, manager.previewMerge(id)];
                case 1:
                    changes = _a.sent();
                    return [2 /*return*/, JSON.stringify(changes, null, 2)];
            }
        });
    }); });
}
function sandboxMergeTool() {
    return {
        name: "sandbox_merge",
        description: "Merge a sandbox manifest into the current workspace.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: { id: { type: "string" }, maxLines: { type: "number" } },
            required: ["id"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, manager, command, promotion, changes;
                var _this = this;
                var _a, _b, _c, _d, _e, _f, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            manager = requireSandboxes(context);
                            command = ((_d = (_c = (_b = (_a = context.runtimeConfig) === null || _a === void 0 ? void 0 : _a.call(context)) === null || _b === void 0 ? void 0 : _b.sandbox) === null || _c === void 0 ? void 0 : _c.promoteCommand) === null || _d === void 0 ? void 0 : _d.trim()) || "npm run typecheck";
                            return [4 /*yield*/, manager.promoteWithValidation(id, {
                                    command: command,
                                    hostRoot: context.workspaceRoot,
                                    authorize: function (paths) { return __awaiter(_this, void 0, void 0, function () {
                                        var _a;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0: return [4 /*yield*/, ((_a = context.sandboxMergeAuthorize) === null || _a === void 0 ? void 0 : _a.call(context, {
                                                        id: id,
                                                        paths: paths,
                                                    }))];
                                                case 1: return [2 /*return*/, _b.sent()];
                                            }
                                        });
                                    }); },
                                })];
                        case 1:
                            promotion = _h.sent();
                            changes = promotion.changedFiles;
                            (_e = context.onWorkspaceChange) === null || _e === void 0 ? void 0 : _e.call(context, changes);
                            (_f = context.onSandboxEvent) === null || _f === void 0 ? void 0 : _f.call(context, manager.updateEvent(id));
                            (_g = context.onSandboxEvent) === null || _g === void 0 ? void 0 : _g.call(context, manager.auditEvent(id, "merge"));
                            return [2 /*return*/, JSON.stringify(changes, null, 2)];
                    }
                });
            });
        },
    };
}
/**
 * Undoes one sandbox's promotion.
 *
 * Exposed as a tool because the promotion is: a capability the runtime publishes
 * in its completion record (`rollbackState`) is only honest if something can act
 * on it. It rewrites host files, so it clears the same authorization gate as the
 * merge it undoes.
 */
function sandboxRollbackTool() {
    return {
        name: "sandbox_rollback",
        description: "Undo a sandbox's promotion and restore the host to what it was before. Refuses when a later promotion has touched the same paths, since undoing would discard newer work.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, manager, diff, paths, result;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            manager = requireSandboxes(context);
                            return [4 /*yield*/, manager.previewMerge(id)];
                        case 1:
                            diff = _e.sent();
                            paths = diff.map(function (change) { return change.path; });
                            return [4 /*yield*/, ((_a = context.sandboxMergeAuthorize) === null || _a === void 0 ? void 0 : _a.call(context, { id: id, paths: paths }))];
                        case 2:
                            _e.sent();
                            return [4 /*yield*/, manager.rollback(id)];
                        case 3:
                            result = _e.sent();
                            (_b = context.onWorkspaceChange) === null || _b === void 0 ? void 0 : _b.call(context, diff.map(function (change) { return (__assign(__assign({}, change), { kind: "modify" })); }));
                            (_c = context.onSandboxEvent) === null || _c === void 0 ? void 0 : _c.call(context, manager.updateEvent(id));
                            (_d = context.onSandboxEvent) === null || _d === void 0 ? void 0 : _d.call(context, manager.auditEvent(id, "rollback"));
                            return [2 /*return*/, JSON.stringify({
                                    id: id,
                                    restored: result.restored,
                                    restoredPaths: result.restored ? paths : [],
                                }, null, 2)];
                    }
                });
            });
        },
    };
}
function sandboxDeleteTool() {
    return {
        name: "sandbox_delete",
        description: "Delete a TS workspace sandbox.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var id, manager, result;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            id = (0, tools_1.requireString)((0, tools_1.requireObject)(input).id, "id");
                            manager = requireSandboxes(context);
                            return [4 /*yield*/, manager.delete(id)];
                        case 1:
                            result = _c.sent();
                            (_a = context.onSandboxEvent) === null || _a === void 0 ? void 0 : _a.call(context, {
                                type: "sandbox.update",
                                id: id,
                                status: "deleted",
                                root: "",
                                isolationLevel: "workspace",
                                changedFiles: result.pendingChanges.length,
                                runningResources: result.runningResources.length,
                                target: { kind: "host", cwd: context.workspaceRoot },
                                resourcePolicy: "sandbox deleted after resource cleanup",
                            });
                            (_b = context.onSandboxEvent) === null || _b === void 0 ? void 0 : _b.call(context, {
                                type: "sandbox.audit",
                                id: id,
                                action: "delete",
                                target: { kind: "host", cwd: context.workspaceRoot },
                                approvalRequired: true,
                                checkpointPolicy: "sandbox_manifest",
                                message: "Sandbox workspace directory deleted after resource cleanup.",
                            });
                            return [2 /*return*/, JSON.stringify(result, null, 2)];
                    }
                });
            });
        },
    };
}
function sandboxResourceStartTool() {
    return {
        name: "sandbox_resource_start",
        description: "Start a managed background process inside a TS workspace sandbox.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                command: { type: "string" },
                resourceID: { type: "string" },
            },
            required: ["id", "command"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, manager, id, resource;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            manager = requireSandboxes(context);
                            id = (0, tools_1.requireString)(args.id, "id");
                            return [4 /*yield*/, manager.startResource(id, (0, tools_1.requireString)(args.command, "command"), (0, tools_1.optionalString)(args.resourceID))];
                        case 1:
                            resource = _c.sent();
                            (_a = context.onSandboxEvent) === null || _a === void 0 ? void 0 : _a.call(context, manager.updateEvent(id));
                            (_b = context.onSandboxEvent) === null || _b === void 0 ? void 0 : _b.call(context, manager.auditEvent(id, "resource_start"));
                            return [2 /*return*/, JSON.stringify(resource, null, 2)];
                    }
                });
            });
        },
    };
}
function sandboxResourceListTool() {
    return sandboxResourceReadTool("sandbox_resource_list", "List managed processes running inside a TS workspace sandbox.", function (manager, id) { return JSON.stringify(manager.resourcesFor(id), null, 2); });
}
function sandboxResourceOutputTool() {
    return {
        name: "sandbox_resource_output",
        description: "Read retained output from a managed sandbox process.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: { id: { type: "string" }, resourceID: { type: "string" } },
            required: ["id", "resourceID"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            return [4 /*yield*/, requireSandboxes(context).resourceOutput((0, tools_1.requireString)(args.id, "id"), (0, tools_1.requireString)(args.resourceID, "resourceID"))];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
    };
}
function sandboxResourceStopTool() {
    return {
        name: "sandbox_resource_stop",
        description: "Stop a managed process running inside a TS workspace sandbox.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: { id: { type: "string" }, resourceID: { type: "string" } },
            required: ["id", "resourceID"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, manager, id, resource;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            manager = requireSandboxes(context);
                            id = (0, tools_1.requireString)(args.id, "id");
                            return [4 /*yield*/, manager.stopResource(id, (0, tools_1.requireString)(args.resourceID, "resourceID"))];
                        case 1:
                            resource = _c.sent();
                            (_a = context.onSandboxEvent) === null || _a === void 0 ? void 0 : _a.call(context, manager.updateEvent(id));
                            (_b = context.onSandboxEvent) === null || _b === void 0 ? void 0 : _b.call(context, manager.auditEvent(id, "resource_stop"));
                            return [2 /*return*/, JSON.stringify(resource, null, 2)];
                    }
                });
            });
        },
    };
}
function sandboxResourceReadTool(name, description, action) {
    return {
        name: name,
        description: description,
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, action(requireSandboxes(context), (0, tools_1.requireString)((0, tools_1.requireObject)(input).id, "id"))];
                });
            });
        },
    };
}
function sandboxReadTool(name, description, action, requiresApproval) {
    if (requiresApproval === void 0) { requiresApproval = false; }
    return {
        name: name,
        description: description,
        requiresApproval: requiresApproval,
        parameters: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, action(requireSandboxes(context), (0, tools_1.requireString)((0, tools_1.requireObject)(input).id, "id"))];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
    };
}
/** Every sandbox tool. */
function sandboxTools() {
    return [
        sandboxCreateTool(),
        sandboxExecuteTool(),
        sandboxWriteTool(),
        sandboxDiffTool(),
        sandboxMergeTool(),
        sandboxRollbackTool(),
        sandboxDeleteTool(),
        sandboxResourceStartTool(),
        sandboxResourceListTool(),
        sandboxResourceOutputTool(),
        sandboxResourceStopTool(),
    ];
}
/**
 * Workspace scope: a sandbox is a copy of the workspace, and its tools are only
 * meaningful while that workspace is mounted.
 */
function sandboxToolFamily() {
    return {
        id: "sandbox",
        name: "Sandbox Tools",
        version: "1.0.0",
        description: "Isolated workspaces and their merge back.",
        scope: "workspace",
        tools: __spreadArray([], sandboxTools(), true),
    };
}
