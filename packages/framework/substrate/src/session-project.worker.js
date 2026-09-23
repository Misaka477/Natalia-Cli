"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var node_worker_threads_1 = require("node:worker_threads");
var config_1 = require("@natalia/config");
var session_1 = require("@anthelia/session");
function prepareRecoveryContext(events) {
    var latestContextCheckpoint;
    var checkpointHasSummary = false;
    for (var index = events.length - 1; index >= 0; index--) {
        var event_1 = events[index];
        if ((event_1 === null || event_1 === void 0 ? void 0 : event_1.type) === "context.checkpoint") {
            latestContextCheckpoint = event_1;
            checkpointHasSummary = event_1.snapshot.entries.some(function (entry) { return entry.role === "summary"; });
            break;
        }
    }
    return {
        latestContextCheckpoint: latestContextCheckpoint,
        checkpointHasSummary: checkpointHasSummary,
        restoreEvents: checkpointHasSummary && latestContextCheckpoint
            ? (0, session_1.modelVisibleEvents)(events)
            : events,
    };
}
var port = node_worker_threads_1.parentPort;
if (!port)
    throw new Error("session-project worker requires parentPort");
port.on("message", function (request) {
    try {
        var result = void 0;
        if (request.op === "project") {
            result = (0, session_1.projectSession)(request.session);
        }
        else if (request.op === "messages") {
            result = (0, session_1.projectSessionMessages)(request.session, request.options);
        }
        else if (request.op === "canonicalTools") {
            result = (0, session_1.projectedCanonicalTools)(request.events);
        }
        else if (request.op === "recoveryPrepare") {
            result = prepareRecoveryContext(request.events);
        }
        else if (request.op === "collabSnapshot") {
            result = {
                collabMessages: (0, session_1.projectedCollabMessages)(request.events),
                planDocs: (0, session_1.projectedPlanDocs)(request.events),
                mailboxMessages: (0, session_1.projectedMailboxMessages)(request.events),
                revision: 0,
                eventCount: request.events.length,
            };
        }
        else if (request.op === "subagentHistory") {
            result = request.events.filter(function (event) { return event.type === "subagent.update"; });
        }
        else if (request.op === "modelCatalog") {
            result = (0, config_1.buildModelCatalog)(request.config);
        }
        else {
            switch (request.name) {
                case "planDocs":
                    result = (0, session_1.projectedPlanDocs)(request.events);
                    break;
                case "evidenceRecords":
                    result = (0, session_1.projectedEvidenceRecords)(request.events);
                    break;
                case "constitutionRules":
                    result = (0, session_1.projectedConstitutionRules)(request.events);
                    break;
                case "decisionRecords":
                    result = (0, session_1.projectedDecisionRecords)(request.events);
                    break;
                case "workGraphNodes":
                    result = (0, session_1.projectedWorkGraphNodes)(request.events);
                    break;
                case "workGraphEdges":
                    result = (0, session_1.projectedWorkGraphEdges)(request.events);
                    break;
                case "mailboxMessages":
                    result = (0, session_1.projectedMailboxMessages)(request.events);
                    break;
                case "collabMessages":
                    result = (0, session_1.projectedCollabMessages)(request.events);
                    break;
                case "notices":
                    result = (0, session_1.projectedRuntimeNotices)(request.events);
                    break;
            }
        }
        var response = {
            id: request.id,
            ok: true,
            result: result,
        };
        port.postMessage(response);
    }
    catch (error) {
        var response = {
            id: request.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
        port.postMessage(response);
    }
});
