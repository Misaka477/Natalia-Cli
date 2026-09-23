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
exports.switchGeneration = switchGeneration;
var verification_1 = require("./verification");
function incident(message) {
    return { type: "diagnostic", level: "error", message: message };
}
/**
 * Runs the full gated switch. Nothing switches unless every face passed AND
 * the channel granted; a failed health check after a live switch restores
 * the current config verbatim and records both the rollback switch and the
 * incident.
 */
function switchGeneration(input) {
    return __awaiter(this, void 0, void 0, function () {
        var when, verdict, approval, error_1, health;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    when = (_a = input.when) !== null && _a !== void 0 ? _a : "next-session";
                    return [4 /*yield*/, (0, verification_1.runVerificationGate)({
                            candidateID: input.candidateID,
                            candidate: input.candidate,
                            activeRules: input.activeRules,
                            faces: input.faces,
                            publish: input.publish,
                        })];
                case 1:
                    verdict = _b.sent();
                    if (verdict.verdict !== "passed")
                        return [2 /*return*/, { switched: false, stage: "gate-failed", verdict: verdict }];
                    return [4 /*yield*/, input.requestApproval({
                            reason: input.reason,
                            candidateID: input.candidateID,
                        })];
                case 2:
                    approval = _b.sent();
                    if (approval !== "granted")
                        return [2 /*return*/, {
                                switched: false,
                                stage: "approval-refused",
                                verdict: verdict,
                                detail: "the user refused the generation switch",
                            }];
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, input.applyConfig(input.candidate.config)];
                case 4:
                    _b.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _b.sent();
                    return [2 /*return*/, {
                            switched: false,
                            stage: "apply-failed",
                            verdict: verdict,
                            detail: error_1 instanceof Error ? error_1.message : String(error_1),
                        }];
                case 6:
                    if (when === "next-session") {
                        // Durable source updated; the live runtime keeps running the current
                        // generation and the NEXT boot's reload producer journals the switch it
                        // actually performs (G2's stage/commit flow) — journaling here would
                        // claim a switch that has not happened yet.
                        return [2 /*return*/, { switched: false, stage: "deferred", verdict: verdict }];
                    }
                    if (!input.reloadRuntime || !input.healthCheck)
                        throw new Error('when: "now" requires reloadRuntime and healthCheck seams — an immediate switch without a health check would have no path back');
                    return [4 /*yield*/, input.reloadRuntime()];
                case 7:
                    _b.sent();
                    input.publish(__assign(__assign({ type: "composition.switched" }, (input.currentGenerationID ? { from: input.currentGenerationID } : {})), { to: input.candidateID, reason: input.reason }));
                    return [4 /*yield*/, input.healthCheck()];
                case 8:
                    health = _b.sent();
                    if (health.ok)
                        return [2 /*return*/, { switched: true, stage: "applied", verdict: verdict }];
                    // Auto-rollback: restore the config verbatim, take it live, and record
                    // both the reversal and the incident (study: "自动回退 previous +
                    // incident evidence").
                    return [4 /*yield*/, input.applyConfig(input.currentConfig)];
                case 9:
                    // Auto-rollback: restore the config verbatim, take it live, and record
                    // both the reversal and the incident (study: "自动回退 previous +
                    // incident evidence").
                    _b.sent();
                    return [4 /*yield*/, input.reloadRuntime()];
                case 10:
                    _b.sent();
                    if (input.currentGenerationID)
                        input.publish({
                            type: "composition.switched",
                            from: input.candidateID,
                            to: input.currentGenerationID,
                            reason: "health-check-failed: automatic rollback",
                        });
                    input.publish(incident("generation switch failed its post-switch health check".concat(health.detail ? ": ".concat(health.detail) : "", " \u2014 rolled back to the previous composition (candidate ").concat(input.candidateID, ")")));
                    return [2 /*return*/, {
                            switched: false,
                            stage: "rolled-back",
                            verdict: verdict,
                            detail: health.detail,
                        }];
            }
        });
    });
}
