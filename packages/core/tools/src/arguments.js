"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspacePath = workspacePath;
exports.requireObject = requireObject;
exports.requireString = requireString;
exports.optionalString = optionalString;
exports.numberOr = numberOr;
exports.timeoutSecOr = timeoutSecOr;
exports.positiveNumberOrUndefined = positiveNumberOrUndefined;
exports.positiveNumberOr = positiveNumberOr;
exports.optionalInteger = optionalInteger;
/**
 * Argument handling shared by every built-in tool.
 *
 * Tool arguments arrive as `unknown`: they were produced by a model, decoded from
 * JSON the model wrote, so nothing about their shape is guaranteed. These helpers
 * are the single place that turns that into typed values, and they throw rather
 * than coerce — a tool that silently accepts a wrong-typed argument runs with
 * something the caller did not ask for.
 *
 * `workspacePath` belongs here for the same reason: it is where a model-supplied
 * path is checked for containment before anything opens it.
 */
var node_path_1 = require("node:path");
/**
 * Resolves a workspace-relative path and refuses anything that escapes the
 * workspace, including by `..` or by being absolute. Every tool that touches a
 * path a model supplied goes through this.
 */
function workspacePath(root, inputPath) {
    var path = (0, node_path_1.resolve)(root, inputPath);
    var rel = (0, node_path_1.relative)((0, node_path_1.resolve)(root), path);
    // An escape is a leading ".." path SEGMENT — the path leaves the workspace.
    // Match the whole segment (both separators) rather than a ".." prefix, so a
    // legitimate in-workspace name that merely starts with ".." (e.g. "..config")
    // is not misreported as an escape.
    if ((0, node_path_1.isAbsolute)(rel) || rel.split(/[/\\]/u)[0] === "..")
        throw new Error("path escapes workspace: ".concat(inputPath));
    return path;
}
function requireObject(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
        throw new Error("tool arguments must be an object");
    return input;
}
function requireString(value, name) {
    if (typeof value !== "string")
        throw new Error("".concat(name, " must be a string"));
    return value;
}
function optionalString(value) {
    if (value === undefined)
        return undefined;
    if (typeof value !== "string")
        throw new Error("optional value must be a string");
    return value;
}
function numberOr(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
/**
 * Reads an optional per-call timeout in seconds. Invalid values fall back to
 * the tool default; values above the tool maximum are clamped so a model can
 * extend a command but cannot hold the runtime open indefinitely.
 */
function timeoutSecOr(value, fallback, max) {
    var candidate = typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : fallback;
    var upperBound = max > 0 ? max : fallback;
    return Math.min(candidate, upperBound);
}
function positiveNumberOrUndefined(value) {
    if (value === undefined)
        return undefined;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
        throw new Error("value must be a positive number");
    return value;
}
function positiveNumberOr(value, fallback) {
    var _a;
    if (value === undefined)
        return fallback;
    return (_a = positiveNumberOrUndefined(value)) !== null && _a !== void 0 ? _a : fallback;
}
function optionalInteger(value, name) {
    if (value === undefined)
        return undefined;
    if (typeof value !== "number" || !Number.isInteger(value))
        throw new Error("".concat(name, " must be an integer"));
    return value;
}
