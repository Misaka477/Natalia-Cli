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
exports.projectDocumentRules = projectDocumentRules;
exports.loadProjectDocuments = loadProjectDocuments;
exports.loadProjectDocumentsSync = loadProjectDocumentsSync;
exports.renderProjectDocumentsBlock = renderProjectDocumentsBlock;
/**
 * Project document loading — runtime/project-docs.ts.
 *
 * The 文档 authoring face (EI §3.8 P-1.d): the user's project instructions
 * (`AGENTS.md`) and constitution (`.natalia/constitution.md`) are the highest
 * user-tier input the agent sees. They are loaded and injected as a
 * `<runtime_context source="project" authority="user">` block — never in the
 * static system prompt, because they are workspace state (ADR D1/D2).
 *
 * Two rules from the ADR:
 *
 * 1. **Nearest-wins override**: an `.natalia/` constitution overrides the
 *    workspace-root one for the subtree it applies to; the load is anchored at
 *    the workspace root with a hash so a document edit is detected.
 * 2. **Hash-based change detection**: the injected block carries the loaded
 *    content's hash; when a document changes, the runtime context is
 *    re-derived and re-appended (append on change, never mutate — D3).
 */
var promises_1 = require("node:fs/promises");
var node_fs_1 = require("node:fs");
var node_crypto_1 = require("node:crypto");
var node_path_1 = require("node:path");
var constitution_doc_1 = require("./constitution-doc");
/** The parsed constitution/AGENTS rules across a snapshot's documents. */
function projectDocumentRules(snapshot) {
    return snapshot.documents.flatMap(function (document) {
        return (0, constitution_doc_1.parseConstitutionDocument)(document.content, document.source);
    });
}
function hashContent(content) {
    return (0, node_crypto_1.createHash)("sha256")
        .update(content, "utf8")
        .digest("hex")
        .slice(0, 16);
}
function readOptionalSync(path) {
    if (!(0, node_fs_1.existsSync)(path))
        return undefined;
    try {
        var content = (0, node_fs_1.readFileSync)(path, "utf8");
        return { content: content, hash: hashContent(content) };
    }
    catch (_a) {
        return undefined;
    }
}
/**
 * A per-root memoized snapshot (EI §8.5 就近覆盖/hash 变更): the documents
 * are re-read when the aggregate hash changes, so a document edit is picked
 * up without a restart and an unchanged workspace pays no per-turn read.
 */
var syncCache = new Map();
/** Reads a document if present; a missing or unreadable document is not an error. */
function readOptional(path) {
    return __awaiter(this, void 0, void 0, function () {
        var content, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(0, node_fs_1.existsSync)(path))
                        return [2 /*return*/, undefined];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 2:
                    content = _b.sent();
                    return [2 /*return*/, { content: content, hash: hashContent(content) }];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, undefined];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/** Attaches the parsed constitution/AGENTS rules to a loaded document. */
function withRules(document) {
    return __assign(__assign({}, document), { rules: (0, constitution_doc_1.parseConstitutionDocument)(document.content, document.source) });
}
/**
 * Loads the project documents for a workspace root (EI §8.5): the workspace
 * `AGENTS.md` and the `.natalia/constitution.md`. A `.natalia/constitution.md`
 * nearest to the root overrides; the constitution is the runtime-executable
 * tier of the same vocabulary as the seeded rules.
 */
function loadProjectDocuments(workspaceRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var documents, constitution, agents;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    documents = [];
                    return [4 /*yield*/, readOptional((0, node_path_1.join)(workspaceRoot, ".natalia", "constitution.md"))];
                case 1:
                    constitution = _a.sent();
                    if (constitution)
                        documents.push(withRules(__assign({ source: "constitution", path: ".natalia/constitution.md" }, constitution)));
                    return [4 /*yield*/, readOptional((0, node_path_1.join)(workspaceRoot, "AGENTS.md"))];
                case 2:
                    agents = _a.sent();
                    if (agents)
                        documents.push(withRules(__assign({ source: "agents", path: "AGENTS.md" }, agents)));
                    return [2 /*return*/, {
                            documents: documents,
                            hash: documents
                                .map(function (document) { return "".concat(document.source, ":").concat(document.hash); })
                                .join("|"),
                        }];
            }
        });
    });
}
/**
 * The synchronous variant used by the provider runner's per-turn context
 * assembly (EI §8.5): memoized by root + aggregate hash so the per-turn read
 * is a stat, and a document edit is detected by hash rather than by polling.
 */
function loadProjectDocumentsSync(workspaceRoot) {
    var cached = syncCache.get(workspaceRoot);
    var constitution = readOptionalSync((0, node_path_1.join)(workspaceRoot, ".natalia", "constitution.md"));
    var agents = readOptionalSync((0, node_path_1.join)(workspaceRoot, "AGENTS.md"));
    var hash = [
        constitution ? "constitution:".concat(constitution.hash) : "",
        agents ? "agents:".concat(agents.hash) : "",
    ]
        .filter(Boolean)
        .join("|");
    if (cached && cached.hash === hash)
        return cached.snapshot;
    var documents = [];
    if (constitution)
        documents.push(withRules(__assign({ source: "constitution", path: ".natalia/constitution.md" }, constitution)));
    if (agents)
        documents.push(withRules(__assign({ source: "agents", path: "AGENTS.md" }, agents)));
    var snapshot = documents.length
        ? { documents: documents, hash: hash }
        : undefined;
    syncCache.set(workspaceRoot, { hash: hash, snapshot: snapshot });
    return snapshot;
}
/**
 * Renders the project documents as a `<runtime_context source="project">`
 * block (ADR D2): user-tier authority, injected before the turn's request.
 * The block carries the aggregate hash so a document edit changes the block
 * and the runtime re-appends on change (D5/D6).
 *
 * EI §3.8 P-1.c: each document is also parsed into its rules, and the block
 * states each rule's enforcement explicitly — a prose section is a warn-level
 * soft rule, an `<!-- enforcement -->`-annotated section is a hard rule with
 * its `appliesTo` anchor. The raw content stays for grounding; the structured
 * `<constitution_rules>` list is what makes enforcement machine-visible.
 */
function renderProjectDocumentsBlock(snapshot) {
    if (!snapshot.documents.length)
        return undefined;
    var body = snapshot.documents
        .map(function (document) {
        var tag = document.source === "constitution" ? "constitution" : "agents";
        var ruleLines = document.rules
            .map(function (rule) {
            var anchor = rule.appliesTo
                ? " (appliesTo: ".concat(JSON.stringify(rule.appliesTo), ")")
                : "";
            var oneLine = rule.statement.replace(/\s+/gu, " ").trim();
            return "[".concat(rule.enforcement, "] ").concat(oneLine).concat(anchor);
        })
            .join("\n");
        var rulesBlock = ruleLines
            ? "\n<constitution_rules>\n".concat(ruleLines, "\n</constitution_rules>")
            : "";
        return ("<".concat(tag, " source=\"").concat(document.path, "\">\n").concat(document.content, "\n</").concat(tag, ">") +
            rulesBlock);
    })
        .join("\n\n");
    return "<runtime_context source=\"project\" authority=\"user\" trust=\"runtime\" revision=\"1\" hash=\"".concat(snapshot.hash, "\">\n").concat(body, "\n</runtime_context>");
}
