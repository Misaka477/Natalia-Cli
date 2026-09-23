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
exports.createWorkspaceFilesController = createWorkspaceFilesController;
var platform_1 = require("@natalia/platform");
var workspace_change_auditor_1 = require("./workspace-change-auditor");
/**
 * The workspace-files watcher controller — cut of the resource controllers
 * split (mainline plan §15) and WG4's observation owner (mainline plan §56.9).
 *
 * It owns the workspace watcher's lifecycle: the runtime starts it at
 * initialize and closes it at dispose, and nothing else touches it. Every
 * fs.watch event is handed to the `WorkspaceChangeAuditor` as a hint — the
 * auditor is the only production owner of workspace observation, and this
 * controller must not write the Work Graph or generate workspace provenance.
 *
 * The watcher is per-workspace today; when sessions become per-session maps,
 * the watch set becomes per-session too and only this module's `init` changes.
 */
function createWorkspaceFilesController(input) {
    var cleanup;
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: input.workspaceRoot,
        resolveOrigin: function (path) { var _a, _b; return (_b = (_a = input.resolveMutation) === null || _a === void 0 ? void 0 : _a.call(input, path)) === null || _b === void 0 ? void 0 : _b.origin; },
        resolveIdentity: function (path) { var _a; return (_a = input.resolveMutation) === null || _a === void 0 ? void 0 : _a.call(input, path); },
        hasReliableIdentity: function () { return true; },
    });
    function init() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        // Idempotent: re-running init must not leak the previous watcher. A
                        // leaked watcher keeps the process alive on Windows (ReadDirectoryChangesW
                        // holds the event loop) and duplicates change events everywhere.
                        close();
                        _b = (_a = auditor).baseline;
                        return [4 /*yield*/, input.listPaths()];
                    case 1: return [4 /*yield*/, _b.apply(_a, [_c.sent()])];
                    case 2:
                        _c.sent();
                        return [4 /*yield*/, (0, platform_1.watchWorkspaceFiles)(input.workspaceRoot, function (change) {
                                return auditor.observe(change);
                            }).catch(function () { return undefined; })];
                    case 3:
                        cleanup = _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function close() {
        cleanup === null || cleanup === void 0 ? void 0 : cleanup();
        cleanup = undefined;
    }
    function reconcile() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _b = (_a = auditor).reconcile;
                        return [4 /*yield*/, input.listPaths()];
                    case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                }
            });
        });
    }
    function observationStatus() {
        return auditor.status();
    }
    return { init: init, close: close, reconcile: reconcile, observationStatus: observationStatus, auditor: auditor };
}
