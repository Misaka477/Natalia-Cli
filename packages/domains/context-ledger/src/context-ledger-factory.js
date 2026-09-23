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
exports.createContextLedgerFactory = createContextLedgerFactory;
var runtime_1 = require("@natalia/runtime");
var runtime_services_1 = require("@natalia/runtime-services");
function createContextLedgerFactory() {
    return {
        create: function () { return new runtime_1.ContextLedger(); },
        restore: function (context, events) {
            var _a, _b, _c, _d, _e, _f;
            var restoreStart = performance.now();
            var addMs = 0;
            var add = function (entry) {
                var addStart = performance.now();
                context.add(entry);
                addMs += performance.now() - addStart;
            };
            var assistantByID = new Map();
            var reasoningByTurnID = new Map();
            var textSignatureByTurnID = new Map();
            var contentPartsByTurnID = new Map();
            var providerMetadataByTurnID = new Map();
            var recordedCalls = new Set();
            var recordedResults = new Set();
            for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
                var event_1 = events_1[_i];
                if (event_1.type === "turn.submitted") {
                    add({
                        id: "".concat(event_1.id, ":user"),
                        role: "user",
                        content: event_1.text,
                        attachments: event_1.attachments,
                    });
                    continue;
                }
                if (event_1.type === "turn.input") {
                    // A `next-step` injected into a running turn is a first-class user
                    // message; replay must reconstruct it or the resumed context loses it.
                    add({
                        id: "".concat(event_1.inputID, ":user"),
                        role: event_1.internal ? "system" : "user",
                        content: event_1.text,
                    });
                    continue;
                }
                if (event_1.type === "thinking.done") {
                    var reasoning = __assign(__assign(__assign(__assign(__assign({}, (event_1.text !== undefined
                        ? { reasoningContent: event_1.text }
                        : {})), (event_1.reasoningField
                        ? { reasoningField: event_1.reasoningField }
                        : {})), (event_1.reasoningSignature
                        ? { reasoningSignature: event_1.reasoningSignature }
                        : {})), (event_1.reasoningRedacted ? { reasoningRedacted: true } : {})), (((_a = event_1.reasoningBlocks) === null || _a === void 0 ? void 0 : _a.length)
                        ? { reasoningBlocks: event_1.reasoningBlocks }
                        : {}));
                    if (Object.keys(reasoning).length > 0)
                        reasoningByTurnID.set(event_1.id, reasoning);
                    continue;
                }
                if (event_1.type === "content.delta") {
                    assistantByID.set(event_1.id, "".concat((_b = assistantByID.get(event_1.id)) !== null && _b !== void 0 ? _b : "").concat(event_1.text));
                    continue;
                }
                if (event_1.type === "content.done") {
                    if (event_1.text !== undefined)
                        assistantByID.set(event_1.id, event_1.text);
                    if (event_1.textSignature)
                        textSignatureByTurnID.set(event_1.id, event_1.textSignature);
                    if ((_c = event_1.contentParts) === null || _c === void 0 ? void 0 : _c.length)
                        contentPartsByTurnID.set(event_1.id, event_1.contentParts);
                    if (event_1.providerMetadata)
                        providerMetadataByTurnID.set(event_1.id, event_1.providerMetadata);
                    continue;
                }
                if (event_1.type === "tool.update" &&
                    event_1.callID &&
                    !recordedCalls.has(event_1.callID) &&
                    (event_1.status === "receiving_arguments" ||
                        event_1.status === "queued" ||
                        event_1.status === "awaiting_approval")) {
                    recordedCalls.add(event_1.callID);
                    var turnID = event_1.id.slice(0, event_1.id.lastIndexOf(":"));
                    var reasoning = reasoningByTurnID.get(turnID);
                    var textSignature = textSignatureByTurnID.get(turnID);
                    var contentParts = contentPartsByTurnID.get(turnID);
                    var providerMetadata = providerMetadataByTurnID.get(turnID);
                    add(__assign(__assign(__assign(__assign(__assign({ id: "restore:".concat(event_1.id, ":call"), role: "tool_call", content: "".concat(event_1.name, " ").concat((_d = event_1.argumentsDelta) !== null && _d !== void 0 ? _d : "{}"), pairID: event_1.callID }, (reasoning !== null && reasoning !== void 0 ? reasoning : {})), (textSignature ? { textSignature: textSignature } : {})), (contentParts ? { contentParts: contentParts } : {})), (providerMetadata ? { providerMetadata: providerMetadata } : {})), (event_1.thoughtSignature
                        ? { thoughtSignature: event_1.thoughtSignature }
                        : {})));
                    continue;
                }
                if (event_1.type === "tool.update" &&
                    event_1.callID &&
                    !recordedResults.has(event_1.callID) &&
                    ["succeeded", "failed", "rejected", "cancelled"].includes(event_1.status)) {
                    // Terminal tool.update events are durable, while queued/running
                    // markers are live. If the initial call marker is not in the replay
                    // set, reconstruct a tool_call from the terminal event so the
                    // provider still sees the call/result pair.
                    if (!recordedCalls.has(event_1.callID)) {
                        recordedCalls.add(event_1.callID);
                        var turnID = event_1.id.slice(0, event_1.id.lastIndexOf(":"));
                        var reasoning = reasoningByTurnID.get(turnID);
                        var textSignature = textSignatureByTurnID.get(turnID);
                        var contentParts = contentPartsByTurnID.get(turnID);
                        var providerMetadata = providerMetadataByTurnID.get(turnID);
                        add(__assign(__assign(__assign(__assign(__assign({ id: "restore:".concat(event_1.id, ":call"), role: "tool_call", content: "".concat(event_1.name, " ").concat((_e = event_1.argumentsDelta) !== null && _e !== void 0 ? _e : "{}"), pairID: event_1.callID }, (reasoning !== null && reasoning !== void 0 ? reasoning : {})), (textSignature ? { textSignature: textSignature } : {})), (contentParts ? { contentParts: contentParts } : {})), (providerMetadata ? { providerMetadata: providerMetadata } : {})), (event_1.thoughtSignature
                            ? { thoughtSignature: event_1.thoughtSignature }
                            : {})));
                    }
                    recordedResults.add(event_1.callID);
                    add({
                        id: "restore:".concat(event_1.id, ":result"),
                        role: "tool_result",
                        content: (_f = event_1.result) !== null && _f !== void 0 ? _f : (event_1.status === "succeeded"
                            ? event_1.summary
                            : "ERROR: ".concat(event_1.summary)),
                        pairID: event_1.callID,
                    });
                    continue;
                }
                if (event_1.type === "turn.finished") {
                    var content = assistantByID.get(event_1.id);
                    var textSignature = textSignatureByTurnID.get(event_1.id);
                    var contentParts = contentPartsByTurnID.get(event_1.id);
                    var providerMetadata = providerMetadataByTurnID.get(event_1.id);
                    if ((content === null || content === void 0 ? void 0 : content.trim()) ||
                        textSignature ||
                        (contentParts === null || contentParts === void 0 ? void 0 : contentParts.length) ||
                        providerMetadata) {
                        add(__assign(__assign(__assign({ id: "".concat(event_1.id, ":assistant"), role: "assistant", content: content !== null && content !== void 0 ? content : "" }, (textSignature ? { textSignature: textSignature } : {})), ((contentParts === null || contentParts === void 0 ? void 0 : contentParts.length) ? { contentParts: contentParts } : {})), (providerMetadata ? { providerMetadata: providerMetadata } : {})));
                        assistantByID.delete(event_1.id);
                        textSignatureByTurnID.delete(event_1.id);
                        contentPartsByTurnID.delete(event_1.id);
                        providerMetadataByTurnID.delete(event_1.id);
                    }
                }
            }
            (0, runtime_services_1.perfLog)("[perf] contextLedgerFactory.restore events=".concat(events.length, " entries=").concat(context.snapshot().entries.length, " add=").concat(addMs.toFixed(1), "ms total=").concat((performance.now() - restoreStart).toFixed(1), "ms"));
        },
    };
}
