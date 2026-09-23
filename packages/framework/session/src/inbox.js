"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.SessionInputConflictError = void 0;
exports.normalizeDelivery = normalizeDelivery;
exports.buildInputAdmission = buildInputAdmission;
exports.buildInputUpdated = buildInputUpdated;
exports.buildSubmittedTurn = buildSubmittedTurn;
exports.admittedInputs = admittedInputs;
exports.normalizeInbox = normalizeInbox;
exports.admitInput = admitInput;
exports.admissionCutoff = admissionCutoff;
exports.promoteNextSteps = promoteNextSteps;
exports.promoteNextTurn = promoteNextTurn;
exports.claimNextSteps = claimNextSteps;
exports.removeAdmittedInput = removeAdmittedInput;
exports.replaceAdmittedInput = replaceAdmittedInput;
exports.promoteInputToStep = promoteInputToStep;
var node_crypto_1 = require("node:crypto");
function normalizeDelivery(value) {
    // Legacy `steer` only meant "run before queued turns", never "inject into the
    // running turn", so it must not become `next-step`.
    return value === "next-step" ? "next-step" : "next-turn";
}
function inputDigest(text) {
    return {
        byteLength: new TextEncoder().encode(text).byteLength,
        lineCount: text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length,
        sha256: (0, node_crypto_1.createHash)("sha256").update(text).digest("hex"),
    };
}
/**
 * Builds the durable `input.admitted` fact. Admission is separate from starting
 * a turn: `turn.submitted` is published when the turn actually begins.
 */
function buildInputAdmission(input) {
    var _a, _b, _c;
    return __assign(__assign(__assign(__assign(__assign(__assign(__assign({ type: "input.admitted", id: input.id, text: input.text }, inputDigest(input.text)), { delivery: input.delivery }), (input.internal ? { internal: true } : {})), (((_a = input.attachments) === null || _a === void 0 ? void 0 : _a.length) ? { attachments: input.attachments } : {})), (((_b = input.resources) === null || _b === void 0 ? void 0 : _b.length) ? { resources: input.resources } : {})), (((_c = input.agents) === null || _c === void 0 ? void 0 : _c.length) ? { agents: input.agents } : {})), { admittedAt: input.admittedAt, admittedSeq: input.admittedSeq });
}
/** Builds the durable `input.updated` fact for an edited queued input. */
function buildInputUpdated(id, text) {
    return __assign({ type: "input.updated", id: id, text: text }, inputDigest(text));
}
/**
 * Builds the `turn.submitted` fact for a turn that is actually starting. The
 * id matches the admitted input that produced it.
 */
function buildSubmittedTurn(input) {
    var _a, _b, _c;
    return __assign(__assign(__assign(__assign(__assign({ type: "turn.submitted", id: input.id, text: input.text }, inputDigest(input.text)), (input.internal ? { internal: true } : {})), (((_a = input.attachments) === null || _a === void 0 ? void 0 : _a.length) ? { attachments: input.attachments } : {})), (((_b = input.resources) === null || _b === void 0 ? void 0 : _b.length) ? { resources: input.resources } : {})), (((_c = input.agents) === null || _c === void 0 ? void 0 : _c.length) ? { agents: input.agents } : {}));
}
var SessionInputConflictError = /** @class */ (function (_super) {
    __extends(SessionInputConflictError, _super);
    function SessionInputConflictError(id) {
        return _super.call(this, "session input conflicts with existing admission: ".concat(id)) || this;
    }
    return SessionInputConflictError;
}(Error));
exports.SessionInputConflictError = SessionInputConflictError;
function admittedInputs(session) {
    var _a;
    return (_a = session.inbox) !== null && _a !== void 0 ? _a : [];
}
/** Normalizes legacy `steer` / `queue` values in place; idempotent. */
function normalizeInbox(session) {
    var _a;
    var inbox = (_a = session.inbox) !== null && _a !== void 0 ? _a : [];
    for (var _i = 0, inbox_1 = inbox; _i < inbox_1.length; _i++) {
        var item = inbox_1[_i];
        if (item.delivery !== "next-turn" && item.delivery !== "next-step")
            item.delivery = normalizeDelivery(item.delivery);
    }
    return inbox;
}
function admitInput(session, input, now) {
    var _a, _b, _c, _d, _e, _f;
    if (now === void 0) { now = new Date(); }
    var existing = admittedInputs(session).find(function (item) { return item.id === input.id; });
    if (existing) {
        if (existing.sessionID === session.id &&
            existing.text === input.text &&
            JSON.stringify((_a = existing.attachments) !== null && _a !== void 0 ? _a : []) ===
                JSON.stringify((_b = input.attachments) !== null && _b !== void 0 ? _b : []) &&
            JSON.stringify((_c = existing.resources) !== null && _c !== void 0 ? _c : []) ===
                JSON.stringify((_d = input.resources) !== null && _d !== void 0 ? _d : []) &&
            JSON.stringify((_e = existing.agents) !== null && _e !== void 0 ? _e : []) ===
                JSON.stringify((_f = input.agents) !== null && _f !== void 0 ? _f : []) &&
            existing.delivery === input.delivery &&
            existing.internal === input.internal)
            return existing;
        throw new SessionInputConflictError(input.id);
    }
    var admitted = __assign(__assign({}, input), { sessionID: session.id, admittedAt: now.toISOString(), admittedSeq: admittedInputs(session).reduce(function (latest, item, index) { var _a; return Math.max(latest, (_a = item.admittedSeq) !== null && _a !== void 0 ? _a : index + 1); }, 0) + 1 });
    session.inbox = __spreadArray(__spreadArray([], admittedInputs(session), true), [admitted], false);
    return admitted;
}
/** Highest admission sequence currently in the inbox. */
function admissionCutoff(session) {
    return admittedInputs(session).reduce(function (latest, item, index) { var _a; return Math.max(latest, (_a = item.admittedSeq) !== null && _a !== void 0 ? _a : index + 1); }, 0);
}
/**
 * Promotes every un-promoted `next-step` admitted before this turn boundary.
 * These run as their own turn when the session is idle; while a turn is already
 * running, the provider loop claims them in place before a drain can.
 */
function promoteNextSteps(session, cutoff, now) {
    if (cutoff === void 0) { cutoff = admissionCutoff(session); }
    if (now === void 0) { now = new Date(); }
    return promote(session, admittedInputs(session).filter(function (item, index) {
        var _a;
        return !item.promotedAt &&
            item.delivery === "next-step" &&
            ((_a = item.admittedSeq) !== null && _a !== void 0 ? _a : index + 1) <= cutoff;
    }), now);
}
/** Promotes one `next-turn` input at a turn boundary. */
function promoteNextTurn(session, now) {
    if (now === void 0) { now = new Date(); }
    var next = admittedInputs(session).find(function (item) { return !item.promotedAt && item.delivery === "next-turn"; });
    return next ? promote(session, [next], now) : [];
}
/**
 * Claims every un-promoted `next-step` for one provider step. Claiming marks the
 * input promoted, so a later drain will not also run it as a turn.
 */
function claimNextSteps(session, turnID, step, now) {
    if (now === void 0) { now = new Date(); }
    var claimed = admittedInputs(session).filter(function (item) { return !item.promotedAt && item.delivery === "next-step"; });
    if (!claimed.length)
        return [];
    var ids = new Set(claimed.map(function (item) { return item.id; }));
    var claimedAt = now.toISOString();
    var promotedSeq = admissionCutoff(session);
    session.inbox = admittedInputs(session).map(function (item) {
        return ids.has(item.id)
            ? __assign(__assign({}, item), { promotedAt: claimedAt, promotedSeq: promotedSeq, claimedAt: claimedAt, claimedTurnID: turnID, claimedStep: step }) : item;
    });
    return session.inbox.filter(function (item) { return ids.has(item.id); });
}
/** Removes one not-yet-promoted input. Promoting means it can no longer be cancelled. */
function removeAdmittedInput(session, id) {
    var existing = admittedInputs(session).find(function (item) { return item.id === id; });
    if (!existing || existing.promotedAt)
        return undefined;
    session.inbox = admittedInputs(session).filter(function (item) { return item.id !== id; });
    return existing;
}
/** Replaces the text of one not-yet-promoted input. */
function replaceAdmittedInput(session, id, text) {
    var existing = admittedInputs(session).find(function (item) { return item.id === id; });
    if (!existing || existing.promotedAt)
        return undefined;
    session.inbox = admittedInputs(session).map(function (item) {
        return item.id === id ? __assign(__assign({}, item), { text: text }) : item;
    });
    return session.inbox.find(function (item) { return item.id === id; });
}
/** Promotes one queued `next-turn` input to `next-step` so the running turn takes it. */
function promoteInputToStep(session, id) {
    var existing = admittedInputs(session).find(function (item) { return item.id === id; });
    if (!existing || existing.promotedAt || existing.delivery !== "next-turn")
        return undefined;
    session.inbox = admittedInputs(session).map(function (item) {
        return item.id === id ? __assign(__assign({}, item), { delivery: "next-step" }) : item;
    });
    return session.inbox.find(function (item) { return item.id === id; });
}
function promote(session, inputs, now) {
    if (!inputs.length)
        return [];
    var promoted = new Set(inputs.map(function (item) { return item.id; }));
    var promotedAt = now.toISOString();
    var promotedSeq = admissionCutoff(session);
    session.inbox = admittedInputs(session).map(function (item) {
        return promoted.has(item.id) ? __assign(__assign({}, item), { promotedAt: promotedAt, promotedSeq: promotedSeq }) : item;
    });
    return session.inbox.filter(function (item) { return promoted.has(item.id); });
}
