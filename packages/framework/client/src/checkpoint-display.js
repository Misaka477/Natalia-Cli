"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkpointDisplayLine = checkpointDisplayLine;
function checkpointDisplayLine(event) {
    switch (event.type) {
        case "checkpoint.created":
            return "checkpoint ".concat(event.id, " created (").concat(event.files, " files, ").concat(event.changes, " changes, ").concat(event.complete ? "complete" : "incomplete", ")");
        case "checkpoint.failed":
            return "checkpoint failed: ".concat(event.message);
        case "checkpoint.unavailable":
            return "checkpoint unavailable: ".concat(event.reason, ". ").concat(event.suggestion);
        case "rollback.previewed":
            return "rollback preview ".concat(event.preview.checkpointID, ": ").concat(event.preview.changes.length, " file changes, truncate ").concat(event.preview.context.truncateMessages, " context messages");
        case "rollback.begin":
            return "rollback ".concat(event.checkpointID, " begin (safety ").concat(event.safetyCheckpointID, ")");
        case "rollback.end":
            return "rollback ".concat(event.checkpointID, " complete (").concat(event.restoredFiles, " restored, ").concat(event.deletedFiles, " deleted, step ").concat(event.step, ")");
        case "rollback.failed":
            return "rollback ".concat(event.checkpointID, " failed: ").concat(event.message, " (").concat(event.recovered ? "safety restored" : "safety restore failed", ")");
        default:
            return undefined;
    }
}
