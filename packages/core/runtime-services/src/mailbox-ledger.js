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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMailboxQueued = buildMailboxQueued;
exports.buildMailboxStatus = buildMailboxStatus;
function buildMailboxQueued(input) {
    return __assign(__assign({ type: "mailbox.queued", id: input.id, messageID: input.messageID, source: input.source, priority: input.priority, intent: input.intent, text: input.text, safeSummary: input.safeSummary }, (input.relatedPlanID ? { relatedPlanID: input.relatedPlanID } : {})), { deliveryPolicy: input.deliveryPolicy, createdAt: input.createdAt });
}
function buildMailboxStatus(input) {
    var _a, _b;
    switch (input.status) {
        case "delivered":
            return {
                type: "mailbox.delivered",
                id: input.id,
                messageID: input.messageID,
                deliveredAt: input.at,
            };
        case "acknowledged":
            return {
                type: "mailbox.acknowledged",
                id: input.id,
                messageID: input.messageID,
                acknowledgedAt: input.at,
            };
        case "deferred":
            return {
                type: "mailbox.deferred",
                id: input.id,
                messageID: input.messageID,
                reason: (_a = input.reason) !== null && _a !== void 0 ? _a : "deferred at an unsafe boundary",
                deferredAt: input.at,
            };
        case "superseded":
            return {
                type: "mailbox.superseded",
                id: input.id,
                messageID: input.messageID,
                reason: (_b = input.reason) !== null && _b !== void 0 ? _b : "superseded by a newer instruction",
                supersededAt: input.at,
            };
    }
}
