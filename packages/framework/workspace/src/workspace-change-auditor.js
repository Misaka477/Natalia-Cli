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
exports.createWorkspaceChangeAuditor = createWorkspaceChangeAuditor;
var contracts_1 = require("@natalia/contracts");
var workspace_observation_1 = require("./workspace-observation");
/** How long a hint is held before reconciliation, so bursts coalesce (§56.9). */
var DEFAULT_DEBOUNCE_MS = 200;
function createWorkspaceChangeAuditor(input) {
    var _a;
    var workspaceRoot = input.workspaceRoot;
    var debounceMs = (_a = input.debounceMs) !== null && _a !== void 0 ? _a : DEFAULT_DEBOUNCE_MS;
    var pending = new Map();
    var health = "healthy";
    var healthReason;
    var indeterminateWindow = false;
    var confirmSequence = 0;
    var baselinePaths;
    /**
     * Feed a raw watcher event as a hint. This is the ONLY entry for fs.watch
     * events. The hint is validated against the secret-safe observation contract
     * (so a leaked absolute path, command or content field fails here) and held
     * for the debounce window.
     */
    function observe(inputHint) {
        var _a;
        var observation = __assign(__assign({ id: "hint:".concat(workspaceRoot, ":").concat(Date.now().toString(36)), workspaceRoot: workspaceRoot, path: inputHint.path, operation: inputHint.operation, health: health }, (healthReason ? { healthReason: healthReason } : {})), { indeterminate: indeterminateWindow, at: (_a = inputHint.at) !== null && _a !== void 0 ? _a : new Date().toISOString() });
        contracts_1.workspaceObservationSchema.parse(observation);
        (0, workspace_observation_1.assertSecretSafeObservation)(observation);
        var existing = pending.get(inputHint.path);
        if (existing) {
            // A burst of events for one path coalesces: the newest operation wins
            // (a write after a create is still "modified" for reconciliation), but a
            // delete is terminal until it is reconciled.
            if (inputHint.operation !== "deleted")
                existing.operation = inputHint.operation;
            existing.observedAt = Date.now();
            return;
        }
        pending.set(inputHint.path, __assign(__assign({ path: inputHint.path, operation: inputHint.operation, health: health }, (healthReason ? { healthReason: healthReason } : {})), { indeterminate: indeterminateWindow, observedAt: Date.now() }));
    }
    /** Record the baseline path set (the "what existed" snapshot). */
    function baseline(paths) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                baselinePaths = new Set(paths);
                return [2 /*return*/];
            });
        });
    }
    /**
     * Reconcile the pending hints against the current path set. A hint is
     * confirmed only when reconciliation runs (never at observe time), and only
     * a healthy-or-reconciled window may confirm facts.
     */
    function reconcile(currentPaths) {
        var _a, _b, _c, _d, _e, _f;
        var now = new Set(currentPaths);
        var confirmed = [];
        for (var _i = 0, _g = pending.values(); _i < _g.length; _i++) {
            var hint = _g[_i];
            // A deleted path is gone: confirm the delete directly (no current entry
            // to compare). A path still present confirms as its coalesced operation;
            // a path that is absent despite a modified/added hint means it is gone
            // (a create+delete burst coalesced to the terminal state).
            var operation = hint.operation === "deleted"
                ? "deleted"
                : now.has(hint.path)
                    ? hint.operation
                    : "deleted";
            var origin_1 = (_b = (_a = input.resolveOrigin) === null || _a === void 0 ? void 0 : _a.call(input, hint.path)) !== null && _b !== void 0 ? _b : "unknown";
            var identity = (_c = input.resolveIdentity) === null || _c === void 0 ? void 0 : _c.call(input, hint.path);
            var correlatedOrigin = (_d = identity === null || identity === void 0 ? void 0 : identity.origin) !== null && _d !== void 0 ? _d : origin_1;
            var attributed = (0, workspace_observation_1.attributionFor)(correlatedOrigin, {
                hasReliableIdentity: ((_f = (_e = input.hasReliableIdentity) === null || _e === void 0 ? void 0 : _e.call(input)) !== null && _f !== void 0 ? _f : false) &&
                    correlatedOrigin !== "external" &&
                    correlatedOrigin !== "unknown",
                indeterminate: hint.indeterminate,
            });
            var change = __assign(__assign({ id: "change:".concat(workspaceRoot, ":").concat(confirmSequence++), workspaceRoot: workspaceRoot, path: hint.path, operation: operation, origin: correlatedOrigin, attribution: attributed, correlation: {
                    sessionID: identity === null || identity === void 0 ? void 0 : identity.sessionID,
                    episodeID: identity === null || identity === void 0 ? void 0 : identity.episodeID,
                    turnID: identity === null || identity === void 0 ? void 0 : identity.turnID,
                    callID: identity === null || identity === void 0 ? void 0 : identity.callID,
                    operationID: identity === null || identity === void 0 ? void 0 : identity.operationID,
                }, health: hint.health }, (hint.healthReason ? { healthReason: hint.healthReason } : {})), { at: new Date(hint.observedAt).toISOString() });
            (0, workspace_observation_1.assertSecretSafeObservation)(change);
            confirmed.push(change);
        }
        pending.clear();
        return confirmed;
    }
    /**
     * Mark the watcher as degraded or recovered. A degraded watcher's hints are
     * still buffered but their health is carried through, and an indeterminate
     * window keeps confirmed changes indeterminate.
     */
    function setHealth(status, reason) {
        health = status;
        healthReason = reason;
        if (status === "healthy") {
            indeterminateWindow = false;
        }
    }
    /** A reconciliation-timeout / integrity-uncertain window flag. */
    function markIndeterminate() {
        indeterminateWindow = true;
    }
    function status() {
        return { health: health, healthReason: healthReason, pending: pending.size };
    }
    return {
        observe: observe,
        baseline: baseline,
        reconcile: reconcile,
        setHealth: setHealth,
        markIndeterminate: markIndeterminate,
        status: status,
    };
}
