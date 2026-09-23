"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMarkdownHtml = renderMarkdownHtml;
var marked_1 = require("marked");
var markdownCache = new Map();
var MARKDOWN_CACHE_LIMIT = 512;
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
// Raw HTML in a local markdown file must not execute in the host page.
var renderer = new marked_1.marked.Renderer();
renderer.html = function (_a) {
    var text = _a.text;
    return escapeHtml(text);
};
function tableDelimiter(line) {
    return (typeof line === "string" &&
        line.includes("|") &&
        /^\s*\|?[\s:|-]+\|?\s*$/u.test(line) &&
        line.includes("-"));
}
function tableHeader(line) {
    return typeof line === "string" && line.includes("|");
}
/**
 * GFM tables must start a fresh block. README files often put the table
 * immediately after the preceding sentence, which marked otherwise treats as
 * ordinary paragraph text. Insert the required blank line before the header.
 */
function normalizeGfmTables(text) {
    var lines = text.split(/\r?\n/u);
    var normalized = [];
    for (var index = 0; index < lines.length; index += 1) {
        var line = lines[index];
        var next = lines[index + 1];
        if (tableHeader(line) &&
            tableDelimiter(next) &&
            normalized.length > 0 &&
            normalized.at(-1).trim() !== "")
            normalized.push("");
        normalized.push(line);
    }
    return normalized.join("\n");
}
/**
 * Renders GitHub-flavoured markdown to HTML with a small revision cache. Shared
 * by the transcript and the file editor so both render tables and code alike.
 */
function renderMarkdownHtml(text) {
    var cached = markdownCache.get(text);
    if (cached !== undefined)
        return cached;
    var html = marked_1.marked.parse(normalizeGfmTables(text), {
        gfm: true,
        breaks: true,
        renderer: renderer,
    });
    if (markdownCache.size >= MARKDOWN_CACHE_LIMIT) {
        var oldest = markdownCache.keys().next().value;
        if (oldest !== undefined)
            markdownCache.delete(oldest);
    }
    markdownCache.set(text, html);
    return html;
}
