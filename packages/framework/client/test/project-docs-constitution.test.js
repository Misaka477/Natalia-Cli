"use strict";
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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var project_docs_1 = require("../src/runtime/project-docs");
function workspaceWithConstitution(name, constitution, agents) {
    return __awaiter(this, void 0, void 0, function () {
        var root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-const-".concat(name, "-")))];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "constitution.md"), constitution, "utf8")];
                case 3:
                    _a.sent();
                    if (!agents) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "AGENTS.md"), agents, "utf8")];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/, root];
            }
        });
    });
}
(0, bun_test_1.test)("loadProjectDocumentsSync parses constitution sections into enforcement-tagged rules", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, snapshot, rules, forcePush, review, testing, block;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspaceWithConstitution("parse", [
                    "# Project constitution",
                    "",
                    "## Never force-push",
                    "",
                    "Force-pushing rewrites shared history.",
                    "",
                    "<!-- enforcement: deny -->",
                    '<!-- appliesTo: { commandPattern: "git push --force" } -->',
                    "",
                    "## Review discipline",
                    "",
                    "Prefer small, reviewable pull requests.",
                ].join("\n"), "## Testing\n\nEvery change ships with a test.")];
            case 1:
                root = _a.sent();
                snapshot = (0, project_docs_1.loadProjectDocumentsSync)(root);
                (0, bun_test_1.expect)(snapshot).toBeDefined();
                rules = (0, project_docs_1.projectDocumentRules)(snapshot);
                forcePush = rules.find(function (rule) { return rule.section === "Never force-push"; });
                (0, bun_test_1.expect)(forcePush).toMatchObject({
                    source: "constitution",
                    enforcement: "deny",
                    annotated: true,
                    appliesTo: { commandPattern: "git push --force" },
                });
                review = rules.find(function (rule) { return rule.section === "Review discipline"; });
                (0, bun_test_1.expect)(review).toMatchObject({ enforcement: "warn", annotated: false });
                testing = rules.find(function (rule) { return rule.source === "agents"; });
                (0, bun_test_1.expect)(testing).toMatchObject({
                    enforcement: "warn",
                    statement: "Every change ships with a test.",
                });
                block = (0, project_docs_1.renderProjectDocumentsBlock)(snapshot);
                (0, bun_test_1.expect)(block).toContain("<constitution_rules>");
                (0, bun_test_1.expect)(block).toContain("[deny] Force-pushing rewrites shared history.");
                (0, bun_test_1.expect)(block).toContain("[warn] Prefer small, reviewable pull requests.");
                (0, bun_test_1.expect)(block).toContain("# Project constitution");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a document edit is picked up by the hash-keyed sync cache", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, before, after;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspaceWithConstitution("edit", "## Rule one\n\nFirst version.")];
            case 1:
                root = _a.sent();
                before = (0, project_docs_1.loadProjectDocumentsSync)(root);
                (0, bun_test_1.expect)((0, project_docs_1.projectDocumentRules)(before)).toHaveLength(1);
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "constitution.md"), [
                        "## Rule one",
                        "",
                        "First version.",
                        "",
                        "## Rule two",
                        "",
                        "Second version.",
                    ].join("\n"), "utf8")];
            case 2:
                _a.sent();
                after = (0, project_docs_1.loadProjectDocumentsSync)(root);
                (0, bun_test_1.expect)((0, project_docs_1.projectDocumentRules)(after)).toHaveLength(2);
                return [2 /*return*/];
        }
    });
}); });
