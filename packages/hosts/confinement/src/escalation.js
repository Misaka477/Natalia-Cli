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
exports.ESCALATION_TARGETS = exports.WIDER_MODES = void 0;
exports.validateEscalationArgs = validateEscalationArgs;
exports.sandboxDenialMarker = sandboxDenialMarker;
exports.escalationHintMarker = escalationHintMarker;
exports.approveEscalation = approveEscalation;
/**
 * The sandbox escalation vocabulary and choreography.
 *
 * Ported from dsh's `sandbox/src/escalation.ts`
 * (`devref/deepseek-harness/packages/sandbox/sandbox/src/escalation.ts`):
 * the strictly-wider table, the argument-pairing validation, the
 * model-facing denial/hint markers, and the ordered fail-closed sequence
 * that resolves a `sandbox_permissions` request BEFORE anything executes.
 * Texts that the model and the audit read are kept verbatim so the
 * vocabulary matches the reference.
 *
 * Two deliberate adaptations, both structural:
 *
 * - The approval channel here is a TURN/SESSION-routed closure the runtime
 *   hands the tool (it owns tool/call/turn identity), so the port drops
 *   dsh's agent-routing requirement — same trick dsh itself uses to keep
 *   this module free of its approval/agent packages.
 * - The unknown-outcome branch throws a named error instead of an
 *   exhaustive-assert helper: our unknown-fallback discipline (interface
 *   spec §4.2, enforced by guard:events — which also rejects the helper's
 *   very name in production source, comments included) treats a future
 *   outcome as an unknown value, never as an unreachable one.
 */
/** What a call whose effective mode is the key may escalate TO. */
exports.WIDER_MODES = {
    "read-only": ["workspace-write", "danger-full-access"],
    "workspace-write": ["danger-full-access"],
    "danger-full-access": [],
};
/**
 * The closed escalation-target vocabulary — every mode a call could escalate
 * TO (`read-only` is the floor; nothing escalates to it). This is what the
 * tool schema advertises.
 */
exports.ESCALATION_TARGETS = [
    "workspace-write",
    "danger-full-access",
];
/**
 * `sandbox_permissions` and `justification` travel together — an approval
 * prompt without a reason, or a reason driving nothing, is malformed — and
 * the justification must be a non-empty sentence.
 */
function validateEscalationArgs(sandboxPermissions, justification) {
    if (sandboxPermissions !== undefined && justification === undefined)
        throw new Error("invalid escalation: sandbox_permissions requires a justification");
    if (justification !== undefined && sandboxPermissions === undefined)
        throw new Error("invalid escalation: justification is only valid together with sandbox_permissions");
    if (justification !== undefined && justification.trim().length === 0)
        throw new Error("invalid justification: expected a non-empty sentence");
}
/** The model-facing denial marker (verbatim dsh vocabulary). */
function sandboxDenialMarker(mode) {
    return "[sandbox: file access denied under ".concat(mode, " mode]");
}
/**
 * The same-turn escalation hint that rides a denial while a wider mode still
 * exists — the nudge lives at the decision point so the sanctioned retry does
 * not depend on the model recalling the tool description.
 */
function escalationHintMarker(subject) {
    return "[sandbox: escalation available \u2014 retry this exact ".concat(subject, " once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]");
}
/**
 * Resolve a sandbox permission request before execution: repeating the
 * call's effective mode returns it without approval; a strictly wider mode
 * requires approval and applies only to this call; narrower or unsupported
 * targets and non-grant outcomes throw before anything executes.
 */
function approveEscalation(request, approval) {
    return __awaiter(this, void 0, void 0, function () {
        var mode, effectiveMode, justification, subject, outcome;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mode = request.requestedMode, effectiveMode = request.effectiveMode, justification = request.justification, subject = request.subject;
                    if (mode === effectiveMode)
                        return [2 /*return*/, effectiveMode];
                    if (!exports.WIDER_MODES[effectiveMode].includes(mode))
                        throw new Error("sandbox escalation to \"".concat(mode, "\" is not strictly wider than this call's current \"").concat(effectiveMode, "\" mode"));
                    if (approval.approver === undefined)
                        throw new Error("sandbox escalation to \"".concat(mode, "\" requires approval, but no approval channel is available"));
                    return [4 /*yield*/, approval.approver.request({
                            requestedMode: mode,
                            justification: justification,
                        })];
                case 1:
                    outcome = _a.sent();
                    switch (outcome) {
                        case "allowed-once":
                            return [2 /*return*/, mode];
                        case "rejected":
                            throw new Error("the user rejected escalating this ".concat(subject, " to \"").concat(mode, "\""));
                        case "cancelled":
                            throw new Error("approval for escalating to \"".concat(mode, "\" was cancelled"));
                        case "unavailable":
                            throw new Error("sandbox escalation to \"".concat(mode, "\" requires approval, but no approval channel is available"));
                        default:
                            // guard:events discipline: a future outcome is an unknown value.
                            throw new Error("unknown escalation outcome: ".concat(String(outcome)));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
