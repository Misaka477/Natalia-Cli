"use strict";
/**
 * Constitution / AGENTS document parser — runtime/constitution-doc.ts.
 *
 * The 文档 authoring face (EI §3.8 P-1.c / §8.3): the workspace `AGENTS.md`
 * and `.natalia/constitution.md` are the highest user-tier input, and they are
 * also the seed of the executable constitution. A section is either:
 *
 * - **prose (soft)** — no annotation. It is a warn-level runtime-context rule:
 *   the model is told to respect it, but nothing intercepts a tool call for it.
 * - **annotated (hard)** — carries `<!-- enforcement: deny|approval|warn -->`
 *   and optionally `<!-- appliesTo: { tools: [], paths: [], commandPattern } -->`.
 *   It can be promoted to a journal `constitution.rule_added` (a user action,
 *   no gate) and then executed by the runtime matcher.
 *
 * The parser is a pure function of the document text so it can be unit-tested
 * and re-run on every document edit (hash change) without a restart. It never
 * writes: promotion is a separate, user-initiated step.
 */
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
exports.parseConstitutionDocument = parseConstitutionDocument;
exports.splitConstitutionSections = splitConstitutionSections;
exports.applyConstitutionDocEdit = applyConstitutionDocEdit;
var HEADING = /^(#{1,6})\s+(.*\S)\s*$/u;
var ENFORCEMENT_ANNOTATION = /<!--\s*enforcement\s*:\s*(deny|approval|warn)\s*-->/iu;
var APPLIESTO_ANNOTATION = /<!--\s*appliesTo\s*:\s*(\{[\s\S]*?\})\s*-->/iu;
var ANY_HTML_COMMENT = /<!--[\s\S]*?-->/gu;
/** A stable, filesystem-ish slug for a section heading. */
function slugify(text) {
    var slug = text
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, "-")
        .replace(/^-+|-+$/gu, "")
        .slice(0, 48);
    return slug || "section";
}
/** Parses a bracket list body (`"a", "b"`) into trimmed, unquoted entries. */
function parseListBody(body) {
    return body
        .split(",")
        .map(function (entry) {
        return entry
            .trim()
            .replace(/^["']|["']$/gu, "")
            .trim();
    })
        .filter(function (entry) { return entry.length > 0; });
}
/**
 * Lenient parse of an `appliesTo` annotation body. The plan's form
 * (`{ tools: [], paths: [], commandPattern: "" }`) is not valid JSON (unquoted
 * keys), so try JSON first and fall back to field extraction. Only non-empty
 * anchors are kept so an empty `{}` reads as "no structured anchor".
 */
function parseAppliesTo(raw) {
    var _a, _b, _c;
    var body = raw.trim();
    var parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch (_d) {
        parsed = undefined;
    }
    var anchor = {};
    var readList = function (value) {
        return Array.isArray(value)
            ? value
                .map(function (entry) { return String(entry).trim(); })
                .filter(function (entry) { return entry.length > 0; })
            : undefined;
    };
    if (parsed && typeof parsed === "object") {
        var record = parsed;
        var tools = readList(record.tools);
        var paths = readList(record.paths);
        var commandPattern = typeof record.commandPattern === "string" && record.commandPattern.trim()
            ? record.commandPattern.trim()
            : undefined;
        if (tools === null || tools === void 0 ? void 0 : tools.length)
            anchor.tools = tools;
        if (paths === null || paths === void 0 ? void 0 : paths.length)
            anchor.paths = paths;
        if (commandPattern)
            anchor.commandPattern = commandPattern;
    }
    else {
        var tools = body.match(/tools\s*:\s*\[([^\]]*)\]/iu);
        var paths = body.match(/paths\s*:\s*\[([^\]]*)\]/iu);
        var commandPattern = body.match(/commandPattern\s*:\s*["']([^"']*)["']/iu);
        var toolList = tools ? parseListBody(tools[1]) : [];
        var pathList = paths ? parseListBody(paths[1]) : [];
        if (toolList.length)
            anchor.tools = toolList;
        if (pathList.length)
            anchor.paths = pathList;
        if ((_a = commandPattern === null || commandPattern === void 0 ? void 0 : commandPattern[1]) === null || _a === void 0 ? void 0 : _a.trim())
            anchor.commandPattern = commandPattern[1].trim();
    }
    return ((_b = anchor.tools) === null || _b === void 0 ? void 0 : _b.length) || ((_c = anchor.paths) === null || _c === void 0 ? void 0 : _c.length) || anchor.commandPattern
        ? anchor
        : undefined;
}
/**
 * Parses a constitution / AGENTS markdown document into its rules (EI §3.8
 * P-1.c). Sections are delimited by ATX headings; a section's prose is its
 * statement, its HTML-comment annotations set enforcement / appliesTo. A
 * section with neither prose nor an annotation is skipped.
 */
function parseConstitutionDocument(content, source) {
    var rules = [];
    var ordinal = 0;
    for (var _i = 0, _a = splitConstitutionSections(content); _i < _a.length; _i++) {
        var section = _a[_i];
        var derived = sectionToRule(section, source, ordinal);
        if (derived) {
            ordinal = derived.ordinal;
            rules.push(derived.rule);
        }
    }
    return rules;
}
/**
 * Splits a document into its ATX sections with line ranges (EI §3.8 P-1.c).
 * Line numbers index the CRLF-normalized line array, so an edit can splice a
 * rewritten section back in. Content before the first heading is one section
 * with an empty heading — matching how the parser treats it (a `rule N`).
 */
function splitConstitutionSections(content) {
    var lines = content.replace(/\r\n?/gu, "\n").split("\n");
    var sections = [];
    var current = {
        heading: "",
        headingLine: "",
        body: [],
        startLine: 0,
        endLine: 0,
    };
    var flush = function (endLine) {
        sections.push(__assign(__assign({}, current), { endLine: endLine }));
    };
    for (var index = 0; index < lines.length; index += 1) {
        var line = lines[index];
        var heading = line.match(HEADING);
        if (heading) {
            flush(index - 1);
            current = {
                heading: heading[2].trim(),
                headingLine: line,
                body: [],
                startLine: index,
                endLine: index,
            };
            continue;
        }
        current.body.push(line);
    }
    flush(lines.length - 1);
    return sections;
}
/** Derives a section's rule (or nothing, when it has no statement/annotation). */
function sectionToRule(section, source, ordinal) {
    var _a, _b;
    var raw = section.body.join("\n");
    var enforcementMatch = raw.match(ENFORCEMENT_ANNOTATION);
    var appliesToMatch = raw.match(APPLIESTO_ANNOTATION);
    var statement = raw
        .replace(ANY_HTML_COMMENT, "")
        .split("\n")
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line.length > 0; })
        .join("\n")
        .trim();
    if (!statement && !enforcementMatch)
        return undefined;
    var nextOrdinal = ordinal + 1;
    var enforcement = (_b = (_a = enforcementMatch === null || enforcementMatch === void 0 ? void 0 : enforcementMatch[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "warn";
    var appliesTo = appliesToMatch
        ? parseAppliesTo(appliesToMatch[1])
        : undefined;
    var heading = section.heading || "rule ".concat(nextOrdinal);
    return {
        ordinal: nextOrdinal,
        rule: __assign({ id: "".concat(source, ":").concat(slugify(heading), ":").concat(nextOrdinal), source: source, section: heading, statement: statement || heading, enforcement: enforcement, annotated: Boolean(enforcementMatch) }, (appliesTo ? { appliesTo: appliesTo } : {})),
    };
}
/** Whether an appliesTo anchor carries at least one executable field. */
function hasAnchor(appliesTo) {
    var _a, _b;
    return Boolean(appliesTo &&
        (((_a = appliesTo.tools) === null || _a === void 0 ? void 0 : _a.length) ||
            ((_b = appliesTo.paths) === null || _b === void 0 ? void 0 : _b.length) ||
            appliesTo.commandPattern));
}
/** Serializes an appliesTo anchor back to the documented annotation body. */
function renderAppliesTo(appliesTo) {
    var _a, _b;
    var parts = [];
    if ((_a = appliesTo.tools) === null || _a === void 0 ? void 0 : _a.length)
        parts.push("tools: [".concat(appliesTo.tools.map(function (t) { return JSON.stringify(t); }).join(", "), "]"));
    if ((_b = appliesTo.paths) === null || _b === void 0 ? void 0 : _b.length)
        parts.push("paths: [".concat(appliesTo.paths.map(function (p) { return JSON.stringify(p); }).join(", "), "]"));
    if (appliesTo.commandPattern)
        parts.push("commandPattern: ".concat(JSON.stringify(appliesTo.commandPattern)));
    return "{ ".concat(parts.join(", "), " }");
}
/**
 * Rewrites one document section in place and returns the new document (EI §3.8
 * P-1.c 软规则编辑): the statement prose is replaced and the enforcement /
 * appliesTo HTML-comment annotations are synced to the requested tier. The
 * section is located by its stable rule id, so other sections (and their ids)
 * are untouched. Pure — the caller writes the returned content to disk.
 *
 * A deny/approval rule must carry a non-empty appliesTo anchor (the same hard
 * invariant the promote path enforces); an unknown id is reported, not thrown.
 */
function applyConstitutionDocEdit(content, source, ruleId, next) {
    var anchor = hasAnchor(next.appliesTo);
    if (next.enforcement !== "warn" && !anchor)
        return {
            ok: false,
            reason: "a deny/approval rule requires a non-empty appliesTo anchor",
        };
    var sections = splitConstitutionSections(content);
    var ordinal = 0;
    var target;
    for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
        var section = sections_1[_i];
        var derived = sectionToRule(section, source, ordinal);
        if (!derived)
            continue;
        ordinal = derived.ordinal;
        if (derived.rule.id === ruleId) {
            target = section;
            break;
        }
    }
    if (!target)
        return { ok: false, reason: "unknown document rule id" };
    var annotated = next.enforcement !== "warn" || anchor;
    var body = [];
    var prose = next.statement
        .split("\n")
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line.length > 0; });
    body.push.apply(body, prose);
    if (annotated) {
        if (body.length)
            body.push("");
        body.push("<!-- enforcement: ".concat(next.enforcement, " -->"));
        if (anchor)
            body.push("<!-- appliesTo: ".concat(renderAppliesTo(next.appliesTo), " -->"));
    }
    var headingLine = target.headingLine || "## ".concat(target.heading);
    var replacement = headingLine ? __spreadArray([headingLine, ""], body, true) : body;
    var lines = content.replace(/\r\n?/gu, "\n").split("\n");
    var updated = __spreadArray(__spreadArray(__spreadArray([], lines.slice(0, target.startLine), true), replacement, true), lines.slice(target.endLine + 1), true).join("\n");
    return { ok: true, content: updated };
}
