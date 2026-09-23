"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBatcher = exports.ProjectionCache = void 0;
exports.shouldLazyRenderDetail = shouldLazyRenderDetail;
exports.checkpointProgressView = checkpointProgressView;
var markdown_1 = require("./markdown");
var tools_1 = require("./tools");
var ProjectionCache = /** @class */ (function () {
    function ProjectionCache() {
        this.markdown = new Map();
        this.tools = new Map();
        this.stats = {
            markdownHits: 0,
            markdownMisses: 0,
            toolHits: 0,
            toolMisses: 0,
        };
    }
    ProjectionCache.prototype.markdownSegment = function (id, revision, text) {
        var key = "".concat(id, ":").concat(revision, ":").concat(text.length);
        var cached = this.markdown.get(key);
        if (cached) {
            this.stats.markdownHits += 1;
            return cached;
        }
        this.stats.markdownMisses += 1;
        var split = (0, markdown_1.splitMarkdownAtSafeBoundary)(text);
        var segment = {
            key: key,
            text: split.committed || split.tail,
            safe: Boolean(split.committed),
        };
        this.markdown.set(key, segment);
        return segment;
    };
    ProjectionCache.prototype.toolResult = function (id, revision, result) {
        var key = "".concat(id, ":").concat(revision, ":").concat(result.length);
        var cached = this.tools.get(key);
        if (cached) {
            this.stats.toolHits += 1;
            return cached;
        }
        this.stats.toolMisses += 1;
        var projected = (0, tools_1.resultView)(result);
        this.tools.set(key, projected);
        return projected;
    };
    return ProjectionCache;
}());
exports.ProjectionCache = ProjectionCache;
var EventBatcher = /** @class */ (function () {
    function EventBatcher() {
        this.pending = [];
    }
    EventBatcher.prototype.push = function (event) {
        this.pending.push(event);
    };
    EventBatcher.prototype.shouldFlush = function (options) {
        var _a, _b, _c;
        if (options === void 0) { options = {}; }
        if (this.pending.length === 0)
            return false;
        var now = (_a = options.now) !== null && _a !== void 0 ? _a : Date.now();
        var interval = options.modalActive
            ? ((_b = options.modalBackgroundIntervalMs) !== null && _b !== void 0 ? _b : 100)
            : ((_c = options.foregroundIntervalMs) !== null && _c !== void 0 ? _c : 16);
        return this.lastFlush === undefined || now - this.lastFlush >= interval;
    };
    EventBatcher.prototype.flush = function (now) {
        if (now === void 0) { now = Date.now(); }
        var events = this.pending;
        this.pending = [];
        this.lastFlush = now;
        return events;
    };
    return EventBatcher;
}());
exports.EventBatcher = EventBatcher;
function shouldLazyRenderDetail(detail, thresholdChars) {
    if (thresholdChars === void 0) { thresholdChars = 4000; }
    return Array.from(detail).length > thresholdChars;
}
function checkpointProgressView(event) {
    switch (event.type) {
        case "checkpoint.created":
            var created = event;
            return {
                title: "Checkpoint ".concat(created.id),
                detail: "".concat(created.files, " tracked files, ").concat(created.changes, " changes, step ").concat(created.step, ", ").concat(created.tokenEstimate, " tokens"),
                severity: created.complete ? "info" : "warning",
            };
        case "checkpoint.unavailable":
            var unavailable = event;
            return {
                title: "Checkpoint unavailable",
                detail: "".concat(unavailable.reason, ". ").concat(unavailable.suggestion),
                severity: unavailable.disabledByConfig ? "warning" : "error",
            };
        case "rollback.previewed":
            var previewed = event;
            return {
                title: "Rollback preview ".concat(previewed.preview.checkpointID),
                detail: "".concat(previewed.preview.changes.length, " file changes, ").concat(previewed.preview.context.truncateMessages, " context messages truncated, ").concat(previewed.preview.resources.length, " resources affected"),
                severity: previewed.preview.complete ? "info" : "warning",
            };
        case "rollback.end":
            var ended = event;
            return {
                title: "Rollback ".concat(ended.checkpointID),
                detail: "".concat(ended.restoredFiles, " files restored, ").concat(ended.deletedFiles, " files deleted, context step ").concat(ended.step),
                severity: "info",
            };
        case "rollback.failed":
            var failed = event;
            return {
                title: "Rollback failed ".concat(failed.checkpointID),
                detail: "".concat(failed.message, ". ").concat(failed.recovered ? "Safety checkpoint restored." : "Safety checkpoint restore failed."),
                severity: "error",
            };
        default:
            return undefined;
    }
}
