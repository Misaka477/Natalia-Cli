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
exports.questionPresenter = exports.approvalPresenter = void 0;
exports.pendingToolLink = pendingToolLink;
exports.normalizePendingItems = normalizePendingItems;
exports.createPendingController = createPendingController;
/**
 * Best-effort link from a request id back to its transcript tool card.
 * An approval id is `${turnID}:${callID}`; a question id adds `:question`.
 * Only `turn_*` ids are claimed, so plan-acceptance ids are left alone.
 */
function pendingToolLink(id) {
    var base = id.endsWith(":question") ? id.slice(0, -":question".length) : id;
    var sep = base.lastIndexOf(":");
    if (sep <= 0 || sep === base.length - 1)
        return undefined;
    var turnID = base.slice(0, sep);
    var callID = base.slice(sep + 1);
    if (!turnID.startsWith("turn_"))
        return undefined;
    return { turnID: turnID, callID: callID, messageID: "".concat(turnID, ":tool:").concat(callID) };
}
function normalizePendingItems(input) {
    var _a, _b, _c, _d;
    var items = [];
    var sequence = 0;
    for (var _i = 0, _e = (_a = input.approvals) !== null && _a !== void 0 ? _a : []; _i < _e.length; _i++) {
        var approval = _e[_i];
        sequence += 1;
        var tool = pendingToolLink(approval.id);
        var expiresAt = approval.expiresAt === undefined
            ? undefined
            : Date.parse(approval.expiresAt);
        items.push(__assign(__assign({ id: approval.id, kind: "approval", title: approval.title, summary: approval.preview, priority: 10, sequence: sequence, request: approval }, (tool ? { tool: tool } : {})), (expiresAt !== undefined && Number.isFinite(expiresAt)
            ? { expiresAt: expiresAt }
            : {})));
    }
    for (var _f = 0, _g = (_b = input.questions) !== null && _b !== void 0 ? _b : []; _f < _g.length; _f++) {
        var question = _g[_f];
        sequence += 1;
        var tool = pendingToolLink(question.id);
        items.push(__assign({ id: question.id, kind: "question", title: question.title, priority: 20, sequence: sequence, request: question }, (tool ? { tool: tool } : {})));
    }
    for (var _h = 0, _j = (_c = input.interactives) !== null && _c !== void 0 ? _c : []; _h < _j.length; _h++) {
        var interactive = _j[_h];
        sequence += 1;
        var expiresAt = interactive.expiresAt === undefined
            ? undefined
            : Date.parse(interactive.expiresAt);
        items.push(__assign({ id: interactive.id, 
            // The wire `kind` *is* the presenter kind; no legacy shim in between.
            kind: interactive.kind, title: interactive.title, priority: (_d = interactive.priority) !== null && _d !== void 0 ? _d : 30, sequence: sequence, request: interactive }, (expiresAt !== undefined && Number.isFinite(expiresAt)
            ? { expiresAt: expiresAt }
            : {})));
    }
    return items.sort(function (left, right) {
        var priority = left.priority - right.priority;
        return priority !== 0 ? priority : left.sequence - right.sequence;
    });
}
exports.approvalPresenter = {
    kind: "approval",
    label: function (item) { return item.title; },
    fields: function (item) {
        var _a, _b;
        var request = item.request;
        var fields = [
            { label: "预览", value: (_a = request.preview) !== null && _a !== void 0 ? _a : "", kind: "pre" },
        ];
        if (request.detail)
            fields.push({ label: "详情", value: request.detail });
        if ((_b = request.keyArguments) === null || _b === void 0 ? void 0 : _b.length)
            fields.push({
                label: "参数",
                value: request.keyArguments.join("\n"),
                kind: "list",
            });
        if (request.risk)
            fields.push({ label: "风险", value: request.risk });
        if (item.expiresAt !== undefined)
            fields.push({
                label: "过期",
                value: new Date(item.expiresAt).toLocaleTimeString(),
            });
        return fields;
    },
    controls: function () { return [
        {
            kind: "text",
            label: "拒绝原因（可选）",
            field: "feedback",
            placeholder: "可选",
        },
    ]; },
    actions: function (item) {
        var request = item.request;
        return __spreadArray(__spreadArray([
            { id: "allow-once", label: "允许一次", tone: "primary" }
        ], (request.allowSession === false
            ? []
            : [{ id: "allow-session", label: "允许本次会话" }]), true), [
            { id: "reject", label: "拒绝", tone: "danger", requiresInput: true },
        ], false);
    },
    buildResponse: function (item, draft) {
        var _a;
        var action = String((_a = draft.action) !== null && _a !== void 0 ? _a : "reject");
        var decision = action === "allow-once"
            ? "once"
            : action === "allow-session"
                ? "session"
                : "reject";
        var feedback = typeof draft.feedback === "string" && draft.feedback.trim()
            ? draft.feedback.trim()
            : undefined;
        return __assign({ requestID: item.id, decision: decision }, (feedback ? { feedback: feedback } : {}));
    },
};
exports.questionPresenter = {
    kind: "question",
    label: function (item) { return item.title; },
    fields: function (item) {
        return normalizeQuestionRequest(item).questions.map(function (question) { return ({
            label: question.header || "问题",
            value: __spreadArray([
                question.question
            ], question.options.map(function (option) {
                return option.description
                    ? "\u2022 ".concat(option.label, " \u2014 ").concat(option.description)
                    : "\u2022 ".concat(option.label);
            }), true).join("\n"),
        }); });
    },
    controls: function (item) {
        return normalizeQuestionRequest(item).questions.flatMap(function (question, index) {
            var controls = [
                {
                    kind: "options",
                    label: question.header || "\u95EE\u9898 ".concat(index + 1),
                    field: "selections",
                    index: index,
                    multiple: question.multiple,
                    options: question.options,
                },
            ];
            if (question.custom)
                controls.push({
                    kind: "text",
                    label: "自定义回答",
                    field: "custom",
                    index: index,
                    placeholder: "输入自定义回答",
                });
            return controls;
        });
    },
    actions: function () { return [
        { id: "submit", label: "提交回答", tone: "primary" },
        { id: "reject", label: "拒绝", tone: "danger" },
    ]; },
    buildResponse: function (item, draft) {
        var questionDraft = draft;
        if (questionDraft.rejected)
            return { requestID: item.id, answers: [], rejected: true };
        var answers = normalizeQuestionRequest(item).questions.map(function (question, index) {
            var _a, _b, _c, _d;
            var selected = (_b = (_a = questionDraft.selections) === null || _a === void 0 ? void 0 : _a[index]) !== null && _b !== void 0 ? _b : [];
            var custom = ((_d = (_c = questionDraft.custom) === null || _c === void 0 ? void 0 : _c[index]) !== null && _d !== void 0 ? _d : "").trim();
            var merged = custom
                ? question.multiple
                    ? __spreadArray(__spreadArray([], selected, true), [custom], false) : [custom]
                : selected;
            return __spreadArray([], new Set(merged.filter(function (answer) { return answer !== ""; })), true);
        });
        return { requestID: item.id, answers: answers };
    },
};
function normalizeQuestionRequest(item) {
    var _a, _b;
    var request = item.request;
    if ((_a = request.questions) === null || _a === void 0 ? void 0 : _a.length)
        return { id: item.id, title: item.title, questions: request.questions };
    return {
        id: item.id,
        title: item.title,
        questions: [
            {
                id: "".concat(item.id, ":q0"),
                header: item.title,
                question: item.title,
                options: ((_b = request.options) !== null && _b !== void 0 ? _b : []).map(function (option) {
                    return typeof option === "string" ? { label: option } : option;
                }),
                custom: true,
            },
        ],
    };
}
function createPendingController(onChange) {
    var active;
    var dismissed = new Set();
    var changed = function () { return onChange === null || onChange === void 0 ? void 0 : onChange(); };
    return {
        activeID: function () { return active; },
        isDismissed: function (id) { return dismissed.has(id); },
        focus: function (id) {
            dismissed.delete(id);
            if (active === id)
                return;
            active = id;
            changed();
        },
        clearActive: function () {
            if (active === undefined)
                return;
            active = undefined;
            changed();
        },
        dismiss: function (id) {
            dismissed.add(id);
            if (active === id)
                active = undefined;
            changed();
        },
        prune: function (liveIDs) {
            var changedState = false;
            for (var _i = 0, _a = __spreadArray([], dismissed, true); _i < _a.length; _i++) {
                var id = _a[_i];
                if (!liveIDs.has(id)) {
                    dismissed.delete(id);
                    changedState = true;
                }
            }
            if (active !== undefined && !liveIDs.has(active)) {
                active = undefined;
                changedState = true;
            }
            if (changedState)
                changed();
        },
    };
}
