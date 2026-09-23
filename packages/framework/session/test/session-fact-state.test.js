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
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var NOW = Date.parse("2026-01-01T00:00:00.000Z");
/**
 * A mixed journal that exercises every fact family, including the cases the
 * reducers must survive: duplicate rule/decision ids, a transition for an
 * unknown mailbox, an orphan drift update, expired vs live overrides, and an
 * out-of-order collab answer (answer before question).
 */
function fixture() {
    return [
        {
            type: "turn.submitted",
            id: "turn_1",
            text: "do it",
            byteLength: 5,
            lineCount: 1,
            sha256: "turn-1",
        },
        { type: "turn.finished", id: "turn_1", stopReason: "done" },
        {
            type: "turn.submitted",
            id: "turn_2",
            text: "again",
            byteLength: 5,
            lineCount: 1,
            sha256: "turn-2",
        },
        {
            type: "constitution.rule_added",
            id: "rule:1",
            ruleID: "C-001",
            statement: "Never commit without approval",
            scope: "project",
            priority: "critical",
            source: "user",
            enforcement: "approval",
            overridePolicy: "forbidden",
        },
        // A second add for the same ruleID must not replace the first.
        {
            type: "constitution.rule_added",
            id: "rule:1-dup",
            ruleID: "C-001",
            statement: "duplicate must be ignored",
            scope: "project",
            priority: "low",
            source: "policy",
            enforcement: "warn",
            overridePolicy: "user_explicit",
        },
        {
            type: "constitution.rule_updated",
            id: "rule:1-update",
            ruleID: "C-001",
            priority: "high",
        },
        // Updating a rule that was never added is a no-op.
        {
            type: "constitution.rule_updated",
            id: "rule:404-update",
            ruleID: "C-404",
            priority: "low",
        },
        {
            type: "constitution.override_granted",
            id: "override:live",
            ruleID: "C-001",
            reason: "one-off",
            approvedBy: "user",
            expiresAt: "2999-01-01T00:00:00.000Z",
        },
        {
            type: "constitution.override_granted",
            id: "override:expired",
            ruleID: "C-001",
            reason: "stale",
            approvedBy: "user",
            expiresAt: "2000-01-01T00:00:00.000Z",
        },
        {
            type: "drift.finding_opened",
            id: "drift:1",
            findingID: "DF-001",
            severity: "warning",
            confidence: 0.75,
            originalObjective: "Fix parser",
            currentActivity: "Auth config",
            evidence: ["12 actions without parser files"],
            applicableConstraints: [],
            contractVersion: 2,
        },
        {
            type: "drift.finding_updated",
            id: "drift:1-update",
            findingID: "DF-001",
            status: "explained",
            rationale: "auth is a prerequisite",
        },
        // An orphan update must not create a finding.
        {
            type: "drift.finding_updated",
            id: "drift:404-update",
            findingID: "DF-404",
            status: "dismissed",
        },
        {
            type: "mailbox.queued",
            id: "mailbox:1:queued",
            messageID: "mailbox:1",
            source: "user_via_live_chat",
            priority: "high",
            intent: "reprioritize",
            text: "focus on docs",
            safeSummary: "reprioritize to docs",
            deliveryPolicy: "next_safe_boundary",
            createdAt: "t0",
        },
        {
            type: "mailbox.delivered",
            id: "mailbox:1:delivered",
            messageID: "mailbox:1",
            deliveredAt: "t1",
        },
        {
            type: "mailbox.acknowledged",
            id: "mailbox:1:acked",
            messageID: "mailbox:1",
            acknowledgedAt: "t2",
        },
        {
            type: "mailbox.queued",
            id: "mailbox:2:queued",
            messageID: "mailbox:2",
            source: "system",
            priority: "normal",
            intent: "constraint",
            text: "never commit",
            safeSummary: "a constraint",
            deliveryPolicy: "before_next_tool",
            createdAt: "t3",
        },
        {
            type: "mailbox.deferred",
            id: "mailbox:2:deferred",
            messageID: "mailbox:2",
            reason: "unsafe boundary",
            deferredAt: "t4",
        },
        {
            type: "mailbox.superseded",
            id: "mailbox:2:superseded",
            messageID: "mailbox:2",
            reason: "newer instruction",
            supersededAt: "t5",
        },
        // A transition for an unknown message must be ignored.
        {
            type: "mailbox.acknowledged",
            id: "mailbox:3:acked",
            messageID: "mailbox:3",
            acknowledgedAt: "t6",
        },
        {
            type: "decision.recorded",
            id: "decision:1",
            decision: "Use TypeScript/Bun only",
            status: "accepted",
        },
        // Duplicate decision id must not be recorded twice.
        {
            type: "decision.recorded",
            id: "decision:1",
            decision: "duplicate",
            status: "proposed",
        },
        {
            type: "decision.recorded",
            id: "decision:2",
            decision: "Keep the shared session window",
            status: "accepted",
        },
        {
            type: "session.snapshot",
            id: "snap:1",
            agentStatus: "running",
            currentStep: "step 1",
            changedFiles: 0,
            unvalidatedChanges: 0,
            hasPTY: false,
            hasSandbox: false,
        },
        {
            type: "session.snapshot",
            id: "snap:2",
            agentStatus: "idle",
            changedFiles: 2,
            unvalidatedChanges: 1,
            hasPTY: true,
            hasSandbox: false,
        },
        // Out-of-order collab: the answer lands before the question it replies to.
        {
            type: "collab.answer",
            id: "answer:1",
            questionID: "question:1",
            from: "live_chat",
            to: "main_agent",
            answer: "yes",
            at: "t7",
        },
        {
            type: "collab.question",
            id: "question:1",
            from: "main_agent",
            to: "live_chat",
            question: "safe?",
            at: "t8",
        },
        {
            type: "collab.message",
            message: {
                id: "suggestion:1",
                threadID: "suggestion:1",
                kind: "suggestion",
                from: "live_chat",
                to: "main_agent",
                text: "use echo",
                priority: "normal",
                expectsReply: true,
                at: "t9",
            },
        },
        {
            type: "collab.message",
            message: {
                id: "response:1",
                threadID: "suggestion:1",
                replyToID: "suggestion:1",
                kind: "response",
                from: "main_agent",
                to: "live_chat",
                text: "adopted",
                decision: "adopted",
                expectsReply: false,
                at: "t10",
            },
        },
        // An unrelated event the fact reducers must ignore.
        {
            type: "tool.update",
            id: "turn_1:call_1",
            name: "read_file",
            callID: "call_1",
            status: "succeeded",
            summary: "read",
        },
    ];
}
(0, bun_test_1.test)("incremental fact state matches the full projections it is built from", function () {
    var _a;
    var events = fixture();
    var state = (0, src_1.sessionFactStateFromEvents)(events);
    (0, bun_test_1.expect)((0, src_1.sessionFactConstitutionRules)(state)).toEqual((0, src_1.projectedConstitutionRules)(events));
    (0, bun_test_1.expect)((0, src_1.sessionFactConstitutionOverrides)(state, NOW)).toEqual((0, src_1.projectedConstitutionOverrides)(events, NOW));
    (0, bun_test_1.expect)((0, src_1.sessionFactDriftFindings)(state)).toEqual((0, src_1.projectedDriftFindings)(events));
    (0, bun_test_1.expect)((0, src_1.sessionFactMailboxMessages)(state)).toEqual((0, src_1.projectedMailboxMessages)(events));
    (0, bun_test_1.expect)((0, src_1.sessionFactDecisionRecords)(state)).toEqual((0, src_1.projectedDecisionRecords)(events));
    (0, bun_test_1.expect)((0, src_1.sessionFactCollabMessages)(state)).toEqual((0, src_1.projectedCollabMessages)(events));
    (0, bun_test_1.expect)((0, src_1.sessionFactActiveTurnIDs)(state)).toEqual(["turn_2"]);
    (0, bun_test_1.expect)((_a = (0, src_1.sessionFactLatestSnapshot)(state)) === null || _a === void 0 ? void 0 : _a.id).toBe("snap:2");
});
(0, bun_test_1.test)("fact semantics survive the fold: dedup, orphan drops, expiry, updates", function () {
    var _a, _b, _c, _d, _e, _f;
    var state = (0, src_1.sessionFactStateFromEvents)(fixture());
    var rules = (0, src_1.sessionFactConstitutionRules)(state);
    (0, bun_test_1.expect)(rules).toHaveLength(1);
    (0, bun_test_1.expect)((_a = rules[0]) === null || _a === void 0 ? void 0 : _a.statement).toBe("Never commit without approval");
    (0, bun_test_1.expect)((_b = rules[0]) === null || _b === void 0 ? void 0 : _b.priority).toBe("high");
    (0, bun_test_1.expect)((0, src_1.sessionFactConstitutionOverrides)(state, NOW).map(function (e) { return e.id; })).toEqual(["override:live"]);
    var drift = (0, src_1.sessionFactDriftFindings)(state);
    (0, bun_test_1.expect)(drift).toHaveLength(1);
    (0, bun_test_1.expect)((_c = drift[0]) === null || _c === void 0 ? void 0 : _c.status).toBe("explained");
    (0, bun_test_1.expect)((_d = drift[0]) === null || _d === void 0 ? void 0 : _d.originalObjective).toBe("Fix parser");
    var mailbox = (0, src_1.sessionFactMailboxMessages)(state);
    (0, bun_test_1.expect)(mailbox).toHaveLength(2);
    (0, bun_test_1.expect)((_e = mailbox.find(function (m) { return m.messageID === "mailbox:1"; })) === null || _e === void 0 ? void 0 : _e.status).toBe("acknowledged");
    (0, bun_test_1.expect)((_f = mailbox.find(function (m) { return m.messageID === "mailbox:2"; })) === null || _f === void 0 ? void 0 : _f.status).toBe("superseded");
    (0, bun_test_1.expect)((0, src_1.sessionFactDecisionRecords)(state).map(function (e) { return e.id; })).toEqual([
        "decision:1",
        "decision:2",
    ]);
});
(0, bun_test_1.test)("applying events one at a time equals a one-shot fold", function () {
    var events = fixture();
    var incremental = (0, src_1.emptySessionFactState)();
    for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
        var event_1 = events_1[_i];
        (0, src_1.applySessionFactEvent)(incremental, event_1);
    }
    var oneShot = (0, src_1.sessionFactStateFromEvents)(events);
    (0, bun_test_1.expect)((0, src_1.sessionFactConstitutionRules)(incremental)).toEqual((0, src_1.sessionFactConstitutionRules)(oneShot));
    (0, bun_test_1.expect)((0, src_1.sessionFactConstitutionOverrides)(incremental, NOW)).toEqual((0, src_1.sessionFactConstitutionOverrides)(oneShot, NOW));
    (0, bun_test_1.expect)((0, src_1.sessionFactDriftFindings)(incremental)).toEqual((0, src_1.sessionFactDriftFindings)(oneShot));
    (0, bun_test_1.expect)((0, src_1.sessionFactMailboxMessages)(incremental)).toEqual((0, src_1.sessionFactMailboxMessages)(oneShot));
    (0, bun_test_1.expect)((0, src_1.sessionFactDecisionRecords)(incremental)).toEqual((0, src_1.sessionFactDecisionRecords)(oneShot));
    (0, bun_test_1.expect)((0, src_1.sessionFactCollabMessages)(incremental)).toEqual((0, src_1.sessionFactCollabMessages)(oneShot));
    (0, bun_test_1.expect)((0, src_1.sessionFactActiveTurnIDs)(incremental)).toEqual((0, src_1.sessionFactActiveTurnIDs)(oneShot));
    (0, bun_test_1.expect)((0, src_1.sessionFactLatestSnapshot)(incremental)).toEqual((0, src_1.sessionFactLatestSnapshot)(oneShot));
});
(0, bun_test_1.test)("out-of-order collab replies still resolve in the incremental state", function () {
    var _a, _b, _c;
    var state = (0, src_1.sessionFactStateFromEvents)(fixture());
    var collab = (0, src_1.sessionFactCollabMessages)(state);
    (0, bun_test_1.expect)((_a = collab.find(function (m) { return m.id === "question:1"; })) === null || _a === void 0 ? void 0 : _a.status).toBe("replied");
    (0, bun_test_1.expect)((_b = collab.find(function (m) { return m.id === "suggestion:1"; })) === null || _b === void 0 ? void 0 : _b.status).toBe("replied");
    // An answer carries no threadID of its own; it inherits the question's.
    (0, bun_test_1.expect)((_c = collab.find(function (m) { return m.id === "answer:1"; })) === null || _c === void 0 ? void 0 : _c.threadID).toBe("question:1");
});
(0, bun_test_1.test)("an old open fact survives unrelated later events", function () {
    var _a;
    var state = (0, src_1.sessionFactStateFromEvents)(fixture());
    for (var index = 0; index < 500; index += 1)
        (0, src_1.applySessionFactEvent)(state, {
            type: "tool.update",
            id: "noise:".concat(index),
            name: "read_file",
            callID: "call_".concat(index),
            status: "succeeded",
            summary: "noise",
        });
    var drift = (0, src_1.sessionFactDriftFindings)(state);
    (0, bun_test_1.expect)(drift).toHaveLength(1);
    (0, bun_test_1.expect)((_a = drift[0]) === null || _a === void 0 ? void 0 : _a.findingID).toBe("DF-001");
    var mailbox = (0, src_1.sessionFactMailboxMessages)(state);
    (0, bun_test_1.expect)(mailbox).toHaveLength(2);
});
(0, bun_test_1.test)("intelligence facts fold identically in the state and from events", function () {
    var baseTerminal = { target: { kind: "host", cwd: "/w" } };
    var events = [
        {
            type: "workgraph.node_added",
            id: "wg:change:1",
            nodeID: "wg:change:1",
            kind: "workspace_change",
            summary: "write_file changed",
            target: "src/a.ts",
            actor: "write_file",
            sessionID: "ses_1",
        },
        {
            type: "workgraph.node_added",
            id: "wg:action:1",
            nodeID: "wg:action:1",
            kind: "agent_action",
            summary: "turn",
            sessionID: "ses_1",
        },
        {
            type: "evidence.recorded",
            id: "evidence:1",
            taskID: "task_1",
            objective: "objective",
            status: "validated",
            changes: [
                { path: "src/a.ts", changeType: "modified", summary: "fixed" },
                { path: "src/b.ts", changeType: "modified", summary: "fixed" },
            ],
        },
        { type: "content.done", id: "turn_1", text: "first" },
        { type: "content.delta", id: "turn_2", text: "unconfirmed" },
        { type: "content.done", id: "turn_2", text: "final" },
        __assign({ type: "terminal.timeline", id: "term_live", actor: "model", action: "started", status: "executed", summary: "started", at: "now" }, baseTerminal),
        __assign({ type: "terminal.timeline", id: "term_dead", actor: "model", action: "exit", status: "executed", summary: "exit", at: "now" }, baseTerminal),
        {
            type: "sandbox.update",
            id: "sb_1",
            status: "created",
            root: "/w/.natalia/sandboxes/sb_1",
            isolationLevel: "workspace",
            changedFiles: 0,
            runningResources: 0,
            target: {
                kind: "sandbox",
                sandboxID: "sb_1",
                root: "/r",
                isolationLevel: "workspace",
            },
            resourcePolicy: "policy",
        },
        {
            type: "sandbox.update",
            id: "sb_1",
            status: "deleted",
            root: "/w/.natalia/sandboxes/sb_1",
            isolationLevel: "workspace",
            changedFiles: 0,
            runningResources: 0,
            target: {
                kind: "sandbox",
                sandboxID: "sb_1",
                root: "/r",
                isolationLevel: "workspace",
            },
            resourcePolicy: "policy",
        },
    ];
    var state = (0, src_1.sessionFactStateFromEvents)(events);
    (0, bun_test_1.expect)((0, src_1.sessionFactIntelligenceFacts)(state)).toEqual((0, src_1.sessionIntelligenceFactsFromEvents)(events));
    (0, bun_test_1.expect)((0, src_1.sessionFactIntelligenceFacts)(state)).toEqual({
        changedFiles: 1,
        validatedChanges: 2,
        unvalidatedChanges: 0,
        latestOutput: "final",
        hasPTY: true,
        hasSandbox: false,
    });
});
(0, bun_test_1.test)("navi/nia chat streams fold identically in the state and from events", function () {
    var events = [
        {
            type: "navi.chat.message.added",
            id: "chat:1",
            messageID: "chat:m1",
            role: "user",
            text: "what is the agent doing",
            at: "t1",
        },
        {
            type: "navi.chat.message.added",
            id: "chat:2",
            messageID: "chat:m2",
            role: "chat",
            text: "it is running",
            at: "t2",
        },
        {
            type: "navi.chat.rollback",
            id: "chat:r1",
            toMessageID: "chat:m1",
            removed: 1,
            at: "t3",
        },
        {
            type: "nia.chat.message.new",
            id: "nia:1",
            messageID: "nia:m1",
            role: "user",
            text: "audit this",
            at: "t4",
        },
        {
            type: "nia.chat.thinking.delta",
            id: "nia:t1",
            messageID: "nia:m1",
            text: "weighing evidence. ",
        },
        // Collab rows render on the channel they belong to.
        {
            type: "collab.chat",
            id: "collab:navi",
            threadID: "collab:navi",
            from: "live_chat",
            to: "main_agent",
            text: "sanity check?",
            round: 1,
            expectsReply: false,
            at: "t5",
        },
        {
            type: "collab.chat",
            id: "collab:nia",
            threadID: "collab:nia",
            from: "nia",
            to: "main_agent",
            text: "audit report",
            round: 1,
            expectsReply: false,
            at: "t6",
        },
        // An unrelated event must not enter either stream.
        {
            type: "tool.update",
            id: "turn_1:call_1",
            name: "read_file",
            callID: "call_1",
            status: "succeeded",
            summary: "read",
        },
    ];
    var state = (0, src_1.sessionFactStateFromEvents)(events);
    (0, bun_test_1.expect)((0, src_1.sessionFactNaviChatMessages)(state)).toEqual((0, src_1.projectedNaviChatMessages)(events));
    (0, bun_test_1.expect)((0, src_1.sessionFactNiaChatMessages)(state)).toEqual((0, src_1.projectedNiaChatMessages)(events));
    // Rollback is honoured inside the collected subset too.
    (0, bun_test_1.expect)((0, src_1.sessionFactNaviChatMessages)(state).map(function (m) { return m.messageID; })).toEqual([
        "chat:m1",
        "collab:navi",
    ]);
});
(0, bun_test_1.test)("the collaboration slice feeds collab, plan and mailbox projections", function () {
    var noise = {
        type: "tool.update",
        id: "turn_1:call_1",
        name: "read_file",
        callID: "call_1",
        status: "succeeded",
        summary: "read",
    };
    var events = [
        {
            type: "plan.doc.created",
            id: "plan:1:created",
            planID: "plan:1",
            title: "Plan 1",
            documentPath: ".natalia/plans/plan_1.md",
            createdBy: "live_chat",
            status: "marked",
            createdAt: "t0",
        },
        {
            type: "collab.chat",
            id: "collab:1",
            threadID: "collab:1",
            from: "live_chat",
            to: "main_agent",
            text: "hi",
            round: 1,
            expectsReply: true,
            at: "t1",
        },
        {
            type: "mailbox.queued",
            id: "mailbox:1:queued",
            messageID: "mailbox:1",
            source: "system",
            priority: "normal",
            intent: "constraint",
            text: "never commit",
            safeSummary: "a constraint",
            deliveryPolicy: "before_next_tool",
            createdAt: "t2",
        },
        noise,
    ];
    var state = (0, src_1.sessionFactStateFromEvents)(events);
    var slice = (0, src_1.sessionFactCollaborationEvents)(state);
    // The noisy event is excluded from the slice.
    (0, bun_test_1.expect)(slice).toHaveLength(3);
    (0, bun_test_1.expect)(slice.map(function (event) { return event.type; })).toEqual([
        "plan.doc.created",
        "collab.chat",
        "mailbox.queued",
    ]);
    // Every collaboration projection over the slice matches the full journal.
    (0, bun_test_1.expect)((0, src_1.projectedPlanDocs)(slice)).toEqual((0, src_1.projectedPlanDocs)(events));
    (0, bun_test_1.expect)((0, src_1.projectedCollabMessages)(slice)).toEqual((0, src_1.projectedCollabMessages)(events));
    (0, bun_test_1.expect)((0, src_1.projectedMailboxMessages)(slice)).toEqual((0, src_1.projectedMailboxMessages)(events));
});
(0, bun_test_1.test)("work contracts fold to the current / draft three-state view with staleness", function () {
    var state = (0, src_1.sessionFactStateFromEvents)([
        {
            type: "work_contract.drafted",
            id: "wc:plan:1:1",
            planID: "plan:1",
            planVersion: 1,
            scope: ["packages/a"],
            draftedAt: "2026-09-16T00:00:00.000Z",
            source: "model",
        },
        {
            type: "plan.doc.updated",
            id: "plan:1:updated",
            planID: "plan:1",
            revision: 2,
            updatedAt: "2026-09-16T01:00:00.000Z",
        },
        {
            type: "work_contract.accepted",
            id: "wc:plan:2:accepted",
            planID: "plan:2",
            planVersion: 4,
            verification: ["bun test packages/framework/runtime"],
            acceptedBy: "user",
            acceptedAt: "2026-09-16T02:00:00.000Z",
        },
    ]);
    (0, bun_test_1.expect)((0, src_1.sessionFactWorkContracts)(state)).toEqual([
        {
            planID: "plan:1",
            version: 1,
            scope: ["packages/a"],
            status: "draft",
            stale: true,
        },
        {
            planID: "plan:2",
            version: 4,
            verification: ["bun test packages/framework/runtime"],
            status: "current",
            acceptedBy: "user",
            acceptedAt: "2026-09-16T02:00:00.000Z",
        },
    ]);
});
(0, bun_test_1.test)("a drift finding reopened from a terminal state counts each reopen", function () {
    var state = (0, src_1.sessionFactStateFromEvents)([
        {
            type: "drift.finding_opened",
            id: "drift:1",
            findingID: "DF-001",
            severity: "warning",
            confidence: 0.75,
            originalObjective: "Fix parser",
            currentActivity: "Auth config",
            evidence: ["12 actions without parser files"],
            applicableConstraints: [],
            contractVersion: 2,
        },
        {
            type: "drift.finding_updated",
            id: "u1",
            findingID: "DF-001",
            status: "dismissed",
        },
        // First reopen (翻案): dismissed -> open.
        {
            type: "drift.finding_updated",
            id: "u2",
            findingID: "DF-001",
            status: "open",
        },
        // An open->open update is not a reopen.
        {
            type: "drift.finding_updated",
            id: "u3",
            findingID: "DF-001",
            status: "explained",
        },
        {
            type: "drift.finding_updated",
            id: "u4",
            findingID: "DF-001",
            status: "open",
        },
    ]);
    var findings = (0, src_1.sessionFactDriftFindings)(state);
    (0, bun_test_1.expect)(findings).toHaveLength(1);
    (0, bun_test_1.expect)(findings[0]).toMatchObject({
        findingID: "DF-001",
        status: "open",
        reopenedCount: 2,
    });
});
(0, bun_test_1.test)("constitution disable and tombstone fold keep history complete", function () {
    var events = [
        {
            type: "constitution.rule_added",
            id: "rule:1",
            ruleID: "P-001",
            statement: "no new runtime dependencies",
            scope: "project",
            priority: "high",
            source: "agent_proposed",
            enforcement: "deny",
            overridePolicy: "user_explicit",
            appliesTo: { paths: ["packages/framework/runtime/src"] },
        },
        {
            type: "constitution.rule_updated",
            id: "rule:1-disable",
            ruleID: "P-001",
            enabled: false,
        },
    ];
    // A disabled rule drops out of the effective set.
    (0, bun_test_1.expect)((0, src_1.sessionFactConstitutionRules)((0, src_1.sessionFactStateFromEvents)(events))).toEqual([]);
    // Re-enabling restores it with its original fields.
    events.push({
        type: "constitution.rule_updated",
        id: "rule:1-enable",
        ruleID: "P-001",
        enabled: true,
    });
    (0, bun_test_1.expect)((0, src_1.sessionFactConstitutionRules)((0, src_1.sessionFactStateFromEvents)(events))).toMatchObject([
        {
            ruleID: "P-001",
            statement: "no new runtime dependencies",
            appliesTo: { paths: ["packages/framework/runtime/src"] },
        },
    ]);
    // The tombstone removes the rule from the effective set; the journal keeps
    // the full history of its life.
    events.push({
        type: "constitution.rule_removed",
        id: "rule:1-removed",
        ruleID: "P-001",
        removedAt: "2026-09-16T03:00:00.000Z",
        removedBy: "user",
    });
    (0, bun_test_1.expect)((0, src_1.sessionFactConstitutionRules)((0, src_1.sessionFactStateFromEvents)(events))).toEqual([]);
    // A later rule_added for the same ruleID re-adds it (recovery after removal).
    events.push({
        type: "constitution.rule_added",
        id: "rule:1-readd",
        ruleID: "P-001",
        statement: "no new runtime dependencies",
        scope: "project",
        priority: "high",
        source: "user",
        enforcement: "deny",
        overridePolicy: "user_explicit",
    });
    (0, bun_test_1.expect)((0, src_1.sessionFactConstitutionRules)((0, src_1.sessionFactStateFromEvents)(events))).toMatchObject([{ ruleID: "P-001", source: "user" }]);
    // The full-journal projection and the incremental fold agree.
    var incremental = (0, src_1.emptySessionFactState)();
    for (var _i = 0, events_2 = events; _i < events_2.length; _i++) {
        var event_2 = events_2[_i];
        (0, src_1.applySessionFactEvent)(incremental, event_2);
    }
    (0, bun_test_1.expect)((0, src_1.sessionFactConstitutionRules)(incremental)).toEqual((0, src_1.projectedConstitutionRules)(events));
});
(0, bun_test_1.test)("context.instructions notices project to the latest revision per kind", function () {
    var events = [
        {
            type: "context.instructions",
            id: "context:config:1",
            kind: "config_reload",
            at: "2026-09-16T00:00:00.000Z",
            revision: 1,
            summary: "runtime config reloaded; provider unchanged",
        },
        {
            type: "context.instructions",
            id: "context:agent:1",
            kind: "agent_switch",
            at: "2026-09-16T01:00:00.000Z",
            revision: 1,
            summary: "active agent switched to reviewer",
        },
        {
            type: "context.instructions",
            id: "context:config:2",
            kind: "config_reload",
            at: "2026-09-16T02:00:00.000Z",
            revision: 2,
            summary: "runtime config reloaded; provider reconfigured from disk",
        },
    ];
    // The higher-revision config_reload supersedes the earlier one; the
    // agent_switch stands on its own; history is never mutated.
    // Sorted by `at`; the latest revision per kind survives.
    (0, bun_test_1.expect)((0, src_1.projectedRuntimeNotices)(events)).toEqual([
        {
            noticeID: "context:agent:1",
            kind: "agent_switch",
            revision: 1,
            at: "2026-09-16T01:00:00.000Z",
            summary: "active agent switched to reviewer",
        },
        {
            noticeID: "context:config:2",
            kind: "config_reload",
            revision: 2,
            at: "2026-09-16T02:00:00.000Z",
            summary: "runtime config reloaded; provider reconfigured from disk",
        },
    ]);
    // The next revision is one past the highest already in the journal.
    (0, bun_test_1.expect)((0, src_1.nextContextInstructionsRevision)(events)).toBe(3);
    // An out-of-order (older) revision never clobbers the current state.
    (0, bun_test_1.expect)((0, src_1.projectedRuntimeNotices)(__spreadArray(__spreadArray([], events, true), [
        {
            type: "context.instructions",
            id: "context:config:stale",
            kind: "config_reload",
            at: "2026-09-16T03:00:00.000Z",
            revision: 1,
            summary: "stale reload",
        },
    ], false)).find(function (notice) { return notice.kind === "config_reload"; })).toMatchObject({ noticeID: "context:config:2" });
});
