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
exports.createTeamRuntime = createTeamRuntime;
var runtime_services_1 = require("@natalia/runtime-services");
function createTeamRuntime(ctx) {
    return {
        teamPRList: teamPRList,
    };
    function teamPRList(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var subagents, sandboxes, ownerSessionID, prs, _i, _a, record, diff, buildCommand, buildEvidence, _b;
            var _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0: return [4 /*yield*/, ctx.ports.getReady()];
                    case 1:
                        _f.sent();
                        subagents = ctx.state.serviceDirectory.getOptional(runtime_services_1.subagentsService);
                        sandboxes = ctx.state.serviceDirectory.getOptional(runtime_services_1.sandboxService);
                        ownerSessionID = sessionID !== null && sessionID !== void 0 ? sessionID : (_c = ctx.ports.getActiveExec()) === null || _c === void 0 ? void 0 : _c.session.id;
                        if (!(subagents === null || subagents === void 0 ? void 0 : subagents.enabled()))
                            return [2 /*return*/, []];
                        prs = [];
                        _i = 0, _a = subagents.list();
                        _f.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                        record = _a[_i];
                        if (record.mode !== "sandbox")
                            return [3 /*break*/, 7];
                        if (ownerSessionID &&
                            record.parentSessionID &&
                            record.parentSessionID !== ownerSessionID)
                            return [3 /*break*/, 7];
                        return [4 /*yield*/, (sandboxes === null || sandboxes === void 0 ? void 0 : sandboxes.previewMerge(record.id).catch(function () { return []; }))];
                    case 3:
                        diff = (_d = (_f.sent())) !== null && _d !== void 0 ? _d : [];
                        buildCommand = (_e = ctx.ports.getTsRuntimeConfig()) === null || _e === void 0 ? void 0 : _e.sandbox.promoteCommand;
                        if (!buildCommand) return [3 /*break*/, 5];
                        return [4 /*yield*/, (sandboxes === null || sandboxes === void 0 ? void 0 : sandboxes.validate(record.id, buildCommand).catch(function () { return ({
                                ok: false,
                                exitCode: -1,
                                output: "validate failed",
                            }); }))];
                    case 4:
                        _b = _f.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        _b = undefined;
                        _f.label = 6;
                    case 6:
                        buildEvidence = _b;
                        prs.push(__assign(__assign(__assign({ id: record.id, sandboxID: record.id, status: record.status, task: record.task }, (record.outputs.length
                            ? {
                                result: record.outputs
                                    .map(function (entry) { return entry.text; })
                                    .filter(Boolean)
                                    .join("\n"),
                            }
                            : {})), (buildEvidence ? { buildEvidence: buildEvidence } : {})), { diff: diff.map(function (change) { return toDiffChange(change); }) }));
                        _f.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 2];
                    case 8: return [2 /*return*/, prs];
                }
            });
        });
    }
    function toDiffChange(change) {
        var _a, _b;
        var operation = change.kind === "add"
            ? "added"
            : change.kind === "delete"
                ? "deleted"
                : change.kind === "rename"
                    ? "renamed"
                    : "modified";
        return __assign(__assign(__assign(__assign(__assign(__assign(__assign({ path: change.path, operation: operation }, (change.oldPath ? { oldPath: change.oldPath } : {})), { additions: (_a = change.additions) !== null && _a !== void 0 ? _a : 0, deletions: (_b = change.deletions) !== null && _b !== void 0 ? _b : 0 }), (change.patch ? { patch: change.patch } : {})), (change.structured ? { structured: change.structured } : {})), (change.before ? { before: change.before } : {})), (change.after ? { after: change.after } : {})), (change.mode ? { mode: change.mode } : {}));
    }
}
