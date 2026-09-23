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
exports.createSnapshot = createSnapshot;
/**
 * Session intelligence snapshots and in-flight state — runtime/snapshot module.
 *
 * Owns the `session.snapshot` production writer, the snapshot trigger test, the
 * turn/tool id helpers, the event flush barrier, and the durable in-flight
 * operation writer. Reads live state through `RuntimeContext` at call time.
 */
var session_1 = require("@anthelia/session");
var session_intelligence_1 = require("../session-intelligence");
var session_store_1 = require("@anthelia/session-store");
function createSnapshot(ctx) {
    var sessionSnapshotSequence = 0;
    return {
        toolEventTurnID: toolEventTurnID,
        isSessionSnapshotTrigger: isSessionSnapshotTrigger,
        currentSessionSnapshot: currentSessionSnapshot,
        publishSessionSnapshot: publishSessionSnapshot,
        runtimeEventFlushBarrier: runtimeEventFlushBarrier,
        setInFlightOperation: setInFlightOperation,
        setInFlightOperationFor: setInFlightOperationFor,
    };
    /**
     * The turn a tool event belongs to, from the `${turnID}:${callID}` id shape
     * the runtime publishes (the call id is repeated in `callID`, so only a real
     * suffix is stripped — the same normalisation the shared projection uses).
     */
    function toolEventTurnID(event) {
        var suffix = event.callID ? ":".concat(event.callID) : "";
        return event.callID && event.id.endsWith(suffix)
            ? event.id.slice(0, -suffix.length)
            : event.id;
    }
    /** Work-state boundaries worth a fresh snapshot. */
    function isSessionSnapshotTrigger(event) {
        if (event.type === "turn.submitted" ||
            event.type === "turn.started" ||
            event.type === "turn.finished" ||
            event.type === "turn.cancelled")
            return true;
        if (event.type === "tool.update")
            return (event.status === "running" ||
                ["succeeded", "failed", "rejected", "cancelled"].includes(event.status));
        if (event.type === "sandbox.update")
            return event.status === "created" || event.status === "deleted";
        if (event.type === "terminal.timeline")
            return (event.action === "created" ||
                event.action === "started" ||
                event.action === "exit");
        return false;
    }
    /**
     * The session intelligence production writer: builds the latest snapshot from
     * the journal-backed facts (changed files, validated changes, recent output,
     * live PTY/sandbox) plus live state (active tool), and publishes it as a
     * durable event so the `session.snapshot` read model answers real data.
     *
     * Agent status is derived from the journal rather than the live turn marker:
     * by the time this runs after a `turn.finished`, the event is already
     * appended, so `projectSession` reports the turn as complete — the snapshot
     * for the finished turn says `idle`, not `running`. Deriving from the journal
     * also makes the same snapshot reproducible from replay.
     */
    function currentSessionSnapshot(exec, id) {
        var _a;
        var redactToolOutput = ctx.ports.redactToolOutput;
        var _b = ctx.state, activeToolByTurn = _b.activeToolByTurn, liveMainOutputByTurn = _b.liveMainOutputByTurn;
        // Prefer the incremental hot state when it was seeded from the full log;
        // otherwise fall back to the full journal fold. This keeps the snapshot
        // correct on fast-attach tails until the state can be completed.
        var factState = exec.factStateComplete === true ? exec.factState : undefined;
        var facts = factState
            ? (0, session_1.sessionFactIntelligenceFacts)(factState)
            : undefined;
        var activeTurnIDs;
        if (factState) {
            activeTurnIDs = (0, session_1.sessionFactActiveTurnIDs)(factState);
        }
        else {
            var events = exec.session.events;
            var cachedProjection = exec.snapshotProjection;
            var projection = cachedProjection && cachedProjection.eventCount === events.length
                ? cachedProjection.value
                : (0, session_1.projectSession)(exec.session);
            if (!cachedProjection || cachedProjection.eventCount !== events.length)
                exec.snapshotProjection = {
                    eventCount: events.length,
                    value: projection,
                };
            activeTurnIDs = projection.activeTurnIDs;
        }
        var active = activeTurnIDs.length > 0;
        var agentStatus = "idle";
        if (exec.paused)
            agentStatus = "paused";
        else if (active)
            agentStatus = "running";
        var step = exec.context.journalStatus().messageCount;
        var activeTurnID = activeTurnIDs[0];
        var activeTool = activeTurnID
            ? activeToolByTurn.get(activeTurnID)
            : undefined;
        var liveOutput = activeTurnID
            ? redactToolOutput((_a = liveMainOutputByTurn.get(activeTurnID)) !== null && _a !== void 0 ? _a : "", true)
                .trim()
                .slice(-2000)
            : "";
        var live = __assign(__assign(__assign({ agentStatus: agentStatus }, (active ? { currentStep: "step ".concat(step) } : {})), (activeTool ? { activeTool: activeTool } : {})), (liveOutput ? { recentOutput: liveOutput } : {}));
        return facts
            ? (0, session_intelligence_1.buildSessionIntelligenceSnapshotFromFacts)({ id: id, facts: facts, live: live })
            : (0, session_intelligence_1.buildSessionIntelligenceSnapshot)({
                id: id,
                events: exec.session.events,
                live: live,
            });
    }
    function publishSessionSnapshot(exec) {
        var _a = ctx.ports, getActiveExec = _a.getActiveExec, publishForSession = _a.publishForSession;
        var target = exec !== null && exec !== void 0 ? exec : getActiveExec();
        if (!(target === null || target === void 0 ? void 0 : target.session))
            return;
        publishForSession(target, currentSessionSnapshot(target, "snapshot:".concat(target.session.id, ":").concat(sessionSnapshotSequence++)));
    }
    function runtimeEventFlushBarrier(event) {
        return (event.type === "approval.response" ||
            event.type === "question.response" ||
            event.type === "turn.finished" ||
            event.type === "turn.cancelled" ||
            event.type === "context.checkpoint");
    }
    function setInFlightOperation(operation) {
        return __awaiter(this, void 0, void 0, function () {
            var getActiveExec, activeExec;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getActiveExec = ctx.ports.getActiveExec;
                        activeExec = getActiveExec();
                        if (!activeExec)
                            return [2 /*return*/];
                        return [4 /*yield*/, setInFlightOperationFor(activeExec, operation)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function setInFlightOperationFor(exec, operation) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getSessionPersistence, setSessionPersistence, publishForSession, sessionStoreController, targetSession, sessionPersistence, next;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = ctx.ports, getSessionPersistence = _a.getSessionPersistence, setSessionPersistence = _a.setSessionPersistence, publishForSession = _a.publishForSession;
                        sessionStoreController = ctx.state.serviceDirectory.get(session_store_1.sessionStoreController);
                        targetSession = exec.session;
                        targetSession.metadata = __assign({}, targetSession.metadata);
                        if (operation)
                            targetSession.metadata.inFlightOperation = operation;
                        else
                            delete targetSession.metadata.inFlightOperation;
                        sessionPersistence = ctx.ports.getSessionPersistenceForSession(exec.session.id);
                        next = sessionPersistence
                            .then(function () {
                            return sessionStoreController.updateMetadata(exec.session.id, {
                                inFlightOperation: operation,
                            });
                        })
                            .catch(function (error) {
                            return publishForSession(exec, {
                                type: "diagnostic",
                                level: "warning",
                                message: "in-flight operation audit persistence failed: ".concat(error instanceof Error ? error.message : String(error)),
                            });
                        });
                        ctx.ports.setSessionPersistenceForSession(exec.session.id, next);
                        setSessionPersistence(Promise.allSettled([getSessionPersistence(), next]).then(function () { return undefined; }));
                        return [4 /*yield*/, next];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
}
