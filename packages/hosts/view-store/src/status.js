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
exports.applyStatusEvent = applyStatusEvent;
var conversation_1 = require("./conversation");
var state_1 = require("./state");
function accumulateUsage(target, event) {
    var _a, _b, _c, _d, _e, _f, _g;
    target.steps += 1;
    target.inputTokens += (_a = event.inputTokens) !== null && _a !== void 0 ? _a : 0;
    target.outputTokens += (_b = event.outputTokens) !== null && _b !== void 0 ? _b : 0;
    target.cacheReadInputTokens += (_c = event.cacheReadInputTokens) !== null && _c !== void 0 ? _c : 0;
    target.cacheCreationInputTokens += (_d = event.cacheCreationInputTokens) !== null && _d !== void 0 ? _d : 0;
    target.llmMs += (_e = event.llmMs) !== null && _e !== void 0 ? _e : 0;
    target.toolMs += (_f = event.toolMs) !== null && _f !== void 0 ? _f : 0;
    if (event.ttftMs !== undefined) {
        target.ttftMs += event.ttftMs;
        target.ttftSteps += 1;
    }
    target.decodeMs += (_g = event.decodeMs) !== null && _g !== void 0 ? _g : 0;
}
/** Returns true when the event belongs to this projection. */
function applyStatusEvent(state, event) {
    var _a, _b;
    var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    switch (event.type) {
        case "runtime.step_usage": {
            // Session-wide aggregate (backwards compatible) plus the stream that
            // actually produced the step. Absent fields contribute nothing; a step
            // without provider usage still counts and carries timing.
            accumulateUsage(state.sessionUsage, event);
            // Legacy shared-event replay only: live writers emit
            // navi./nia.runtime.step_usage with no channel tag. `channel` is the
            // journal-compatibility discriminator for events written before the
            // namespaced events existed.
            var channel = (_c = event.channel) !== null && _c !== void 0 ? _c : "main";
            if (!state.usageByChannel[channel])
                state.usageByChannel[channel] = (0, state_1.emptySessionUsageStats)();
            accumulateUsage(state.usageByChannel[channel], event);
            return true;
        }
        case "navi.runtime.step_usage": {
            accumulateUsage(state.sessionUsage, event);
            if (!state.usageByChannel.navi)
                state.usageByChannel.navi = (0, state_1.emptySessionUsageStats)();
            accumulateUsage(state.usageByChannel.navi, event);
            return true;
        }
        case "nia.runtime.step_usage": {
            accumulateUsage(state.sessionUsage, event);
            if (!state.usageByChannel.nia)
                state.usageByChannel.nia = (0, state_1.emptySessionUsageStats)();
            accumulateUsage(state.usageByChannel.nia, event);
            return true;
        }
        case "work_contract.drafted":
            state.workContracts[event.planID] = __assign(__assign(__assign(__assign({ planID: event.planID, version: event.planVersion }, (event.scope ? { scope: event.scope } : {})), (event.verification ? { verification: event.verification } : {})), (event.constraints ? { constraints: event.constraints } : {})), { status: "draft" });
            return true;
        case "work_contract.accepted":
            state.workContracts[event.planID] = __assign(__assign(__assign(__assign(__assign({ planID: event.planID, version: event.planVersion }, (event.scope ? { scope: event.scope } : {})), (event.verification ? { verification: event.verification } : {})), (event.constraints ? { constraints: event.constraints } : {})), { status: "current", acceptedBy: event.acceptedBy, acceptedAt: event.acceptedAt }), (event.unverifiable ? { unverifiable: true } : {}));
            return true;
        case "plan.doc.updated": {
            // A plan document edit invalidates a draft extracted from the older
            // version (EI §8.2); an accepted contract is the user's commitment and
            // survives until a new one is approved.
            var contract = state.workContracts[event.planID];
            if (contract && contract.status === "draft")
                contract.stale = true;
            return true;
        }
        case "status.update":
            state.status = event.status;
            state.footer = [event.status, event.detail].filter(Boolean).join(" - ");
            return true;
        case "status.snapshot":
            state.statusSegments = [
                "mode:runtime",
                "model:".concat(event.model),
                "provider:".concat(event.provider),
                "ctx:".concat(event.context),
                "step:".concat(event.step),
                event.permissions,
                "bg:".concat(event.background),
            ];
            return true;
        case "context.status": {
            // Journal replay only: a live writer emits the namespaced
            // `navi./nia.context.snapshot`, and the shared `context.status` for the
            // main channel. `channel` is the discriminator that older journals carry,
            // so it decides which meter an old entry belongs to — dropping it would
            // file a replayed navi status under the main channel.
            var usage = __assign({ used: event.used, max: event.max, source: event.source, thresholdPercent: event.thresholdPercent, reserved: event.reserved }, (event.trigger === undefined ? {} : { trigger: event.trigger }));
            if (event.channel === "navi")
                state.navi.context = usage;
            else if (event.channel === "nia")
                state.nia.context = usage;
            else
                state.context = usage;
            state.footer = "context ".concat(event.used, "/").concat(event.max, " source=").concat(event.source).concat(event.trigger ? " trigger=".concat(event.trigger) : "");
            return true;
        }
        case "context.snapshot": {
            // Legacy journal replay only: live writers emit
            // navi./nia.context.snapshot.
            var usage = __assign(__assign({ used: (_e = (_d = event.projectedTokens) !== null && _d !== void 0 ? _d : event.pressureTokens) !== null && _e !== void 0 ? _e : event.usedTokens }, (event.contextWindow === undefined
                ? {}
                : { max: event.contextWindow })), { source: event.source, contextWindow: event.contextWindow, pressureTokens: event.pressureTokens, projectedTokens: event.projectedTokens });
            if (event.channel === "navi")
                state.navi.context = usage;
            else if (event.channel === "nia")
                state.nia.context = usage;
            else
                state.context = usage;
            return true;
        }
        case "navi.context.snapshot": {
            state.navi.context = __assign(__assign({ used: (_g = (_f = event.projectedTokens) !== null && _f !== void 0 ? _f : event.pressureTokens) !== null && _g !== void 0 ? _g : event.usedTokens }, (event.contextWindow === undefined
                ? {}
                : { max: event.contextWindow })), { source: event.source, contextWindow: event.contextWindow, pressureTokens: event.pressureTokens, projectedTokens: event.projectedTokens });
            return true;
        }
        case "nia.context.snapshot": {
            state.nia.context = __assign(__assign({ used: (_j = (_h = event.projectedTokens) !== null && _h !== void 0 ? _h : event.pressureTokens) !== null && _j !== void 0 ? _j : event.usedTokens }, (event.contextWindow === undefined
                ? {}
                : { max: event.contextWindow })), { source: event.source, contextWindow: event.contextWindow, pressureTokens: event.pressureTokens, projectedTokens: event.projectedTokens });
            return true;
        }
        case "context.checkpoint":
            return true;
        case "compaction.begin":
            state.compactionBanner = {
                kind: "compacting",
                text: "Compacting after ".concat(event.trigger, " \u00B7 before ").concat(event.beforeTokens, "/").concat(event.maxTokens, " \u00B7 reserved ").concat(event.reservedTokens),
            };
            state.footer = state.compactionBanner.text;
            return true;
        case "compaction.end":
            state.compactionBanner = undefined;
            // Compaction rewrites what the model can still see, so the outcome belongs
            // in the transcript rather than only in a banner that disappears.
            (0, state_1.upsertBlock)(state, event.id, "system", event.success
                ? "compaction complete: ".concat(event.beforeTokens, " -> ").concat(event.afterTokens, " tokens in ").concat(event.durationMs, "ms")
                : "compaction failed atomically: ".concat((_k = event.error) !== null && _k !== void 0 ? _k : "unknown"), event.success ? "compacted" : "failed");
            state.footer = event.success
                ? "compaction complete"
                : "compaction failed";
            return true;
        case "context.limit.recovery":
            (0, state_1.upsertBlock)(state, "".concat(event.id, ":context-limit"), "system", event.compacted
                ? "context-limit recovery compacted once; retrying original step"
                : "context-limit recovery requested", "context_limit");
            return true;
        case "step.retry":
            (0, conversation_1.resetStreamsForRetry)(state, event.id, event.attempt);
            // Stated from the event's own fields. Turning a retry into friendlier
            // prose is presentation, and belongs to whichever UI renders it.
            state.retryBanner = {
                kind: "step_retry",
                text: "Retrying ".concat(event.operation, " after ").concat(event.reason, " \u00B7 attempt ").concat(event.attempt, "/").concat((_l = event.maxAttempts) !== null && _l !== void 0 ? _l : "unlimited", " \u00B7 waiting ").concat(event.waitMs, "ms"),
            };
            return true;
        case "step.retry.cleared":
            state.retryBanner = undefined;
            state.footer = "retry recovered after ".concat(event.attempts, " attempts");
            return true;
        case "step.retry.exhausted":
            state.retryBanner = undefined;
            // Exhaustion is terminal for the step, so it is recorded, not just shown.
            (0, state_1.upsertBlock)(state, "".concat(event.id, ":retry:exhausted"), "system", event.message, "retry_exhausted");
            state.footer =
                event.retryable === false
                    ? "not retryable: ".concat(event.reason)
                    : "retry exhausted: ".concat(event.reason);
            return true;
        case "agent.selection":
            state.agentSelection = { name: event.name, pending: event.pending };
            return true;
        case "context.instructions": {
            // ADR Phase C: a prompt-level instruction change arrives as a durable
            // event; the projection keeps the latest revision per kind (latest
            // wins), so a replay and a live stream converge on the same view.
            var existing = state.runtimeNotices.find(function (notice) { return notice.kind === event.kind; });
            if (existing && existing.revision >= event.revision)
                return true;
            var notice = __assign({ noticeID: event.id, kind: event.kind, revision: event.revision, at: event.at, summary: event.summary }, (event.detail ? { detail: event.detail } : {}));
            state.runtimeNotices = __spreadArray(__spreadArray([], state.runtimeNotices.filter(function (n) { return n.kind !== event.kind; }), true), [
                notice,
            ], false).sort(function (left, right) { return left.at.localeCompare(right.at); });
            // ADR Phase C: interleave the notice into the transcript at its sequence
            // position as a system bubble (fold order = event order, so upserting
            // here lands it between the turns it actually separates), never stacked
            // at the top. A replay and a live stream converge on the same rows.
            (0, conversation_1.upsertInto)(state.natalia.messages, "notice:".concat(event.id), "system", "".concat(event.kind, ": ").concat(event.summary));
            return true;
        }
        case "model.selection":
            state.modelSelection = {
                modelID: event.modelID,
                variant: event.variant,
            };
            return true;
        case "drift.finding_opened": {
            if (state.driftFindings.some(function (finding) { return finding.findingID === event.findingID; }))
                return true;
            state.driftFindings = (0, state_1.appendBounded)(state.driftFindings, __assign(__assign({}, event), { status: "open", reopenedCount: 0 }), state_1.driftFindingLimit);
            return true;
        }
        case "drift.finding_updated": {
            var index_1 = state.driftFindings.findIndex(function (finding) { return finding.findingID === event.findingID; });
            if (index_1 < 0)
                return true;
            var existing = state.driftFindings[index_1];
            var reopenedCount_1 = event.status === "open" && existing.status !== "open"
                ? existing.reopenedCount + 1
                : existing.reopenedCount;
            state.driftFindings = state.driftFindings.map(function (finding, current) {
                return current === index_1
                    ? __assign(__assign(__assign(__assign({}, finding), { status: event.status }), (event.rationale ? { rationale: event.rationale } : {})), { reopenedCount: reopenedCount_1 }) : finding;
            });
            return true;
        }
        case "evidence.recorded":
            state.evidence = (0, state_1.appendBounded)(state.evidence, event, state_1.evidenceLimit);
            (0, state_1.upsertBlock)(state, event.id, "system", "".concat(event.status, " \u00B7 ").concat(event.objective), event.status, { taskID: event.taskID });
            return true;
        case "completion.recorded":
            state.completions = (0, state_1.appendBounded)(state.completions, event, state_1.completionLimit);
            return true;
        case "constitution.rule_added":
            state.constitutionRules = __assign(__assign({}, state.constitutionRules), (_a = {}, _a[event.ruleID] = event, _a));
            return true;
        case "constitution.rule_updated": {
            var existing = state.constitutionRules[event.ruleID];
            if (!existing)
                return true;
            state.constitutionRules = __assign(__assign({}, state.constitutionRules), (_b = {}, _b[event.ruleID] = __assign(__assign({}, existing), { statement: (_m = event.statement) !== null && _m !== void 0 ? _m : existing.statement, priority: (_o = event.priority) !== null && _o !== void 0 ? _o : existing.priority }), _b));
            return true;
        }
        case "constitution.override_granted":
            state.constitutionOverrides = (0, state_1.appendBounded)(state.constitutionOverrides, event, state_1.constitutionOverrideLimit);
            return true;
        case "decision.recorded":
            // Workspace-tier decisions are shown through an explicit workspace
            // query, never silently mixed into a session transcript view.
            if (event.scope === "workspace")
                return true;
            if (state.decisions.some(function (record) { return record.id === event.id; }))
                return true;
            state.decisions = (0, state_1.appendBounded)(state.decisions, event, state_1.decisionLimit);
            return true;
        case "policy.decision":
            // Kept so a UI can explain why a tool did not run. Allows are recorded
            // too, because "nothing was denied" is also an answer.
            state.policyDecisions = (0, state_1.appendBounded)(state.policyDecisions, event, state_1.policyDecisionLimit);
            return true;
        case "constitution.check":
            // Only a conflicting check is worth surfacing; a rule that passed is not
            // news. Note this projection is empty in practice today: no production
            // code emits constitution rules, so nothing can conflict with them.
            if (!event.conflict)
                return true;
            state.constitutionConflicts = (0, state_1.appendBounded)(state.constitutionConflicts, event, state_1.constitutionConflictLimit);
            (0, state_1.upsertBlock)(state, "constitution:".concat(event.id), "system", "".concat(event.enforcement, " \u00B7 ").concat(event.statement, " (").concat(event.action, " on ").concat(event.resource, ")"), event.enforcement);
            return true;
        case "session.snapshot":
            state.intelligence = event;
            return true;
        case "diagnostic":
            state.footer = "".concat(event.level, ": ").concat(event.message);
            return true;
        case "invariant.violation": {
            // The edge opens the record once — a replayed or repeated violation
            // of the same identity must not stack (the journal holds one fact,
            // the view holds one row per open/closed lifecycle).
            var key_1 = "".concat(event.owner, "|").concat(event.invariant, "|").concat(event.code, "|").concat(event.detail);
            if (state.invariantFindings.some(function (finding) { return finding.key === key_1 && !finding.resolved; }))
                return true;
            state.invariantFindings = (0, state_1.appendBounded)(state.invariantFindings, __assign(__assign({ key: key_1, at: event.at, owner: event.owner, invariant: event.invariant, code: event.code, detail: event.detail }, (event.sessionID ? { sessionID: event.sessionID } : {})), { resolved: false }), state_1.invariantFindingLimit);
            return true;
        }
        case "invariant.resolved": {
            var key_2 = "".concat(event.owner, "|").concat(event.invariant, "|").concat(event.code, "|").concat(event.detail);
            var open_1 = state.invariantFindings.find(function (finding) { return finding.key === key_2 && !finding.resolved; });
            if (open_1)
                open_1.resolved = true;
            return true;
        }
        default:
            return false;
    }
}
