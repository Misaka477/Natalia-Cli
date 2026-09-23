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
/**
 * Dependency-cycle guard (audit finding A-02 / completion criterion §11).
 *
 * §11 requires "没有生产依赖环" — the production dependency graph of the
 * workspace must be acyclic. That used to be a one-off manual walk over the
 * package.json files; this guard makes it mechanical so a regression fails the
 * gate instead of quietly re-tangling the kernel / framework / plugin layers.
 *
 * It reads every workspace `package.json` under `packages/` and `apps/` (build
 * output under `dist/` is skipped), keeps only edges whose target is another
 * workspace package, and reports any cycle in the `dependencies` graph.
 *
 * Interface spec §5.3 also requires the *service* graph: services have their
 * own dependency edges (a plugin requires a service another plugin provides),
 * and those can deadlock while every package.json edge stays acyclic. The
 * second half of this guard therefore reads token declarations — where the
 * spec says "从猜 import 升级为读声明" — and checks id uniqueness, provider
 * ownership, missing providers and Kahn cycles over the declared graph.
 *
 * devDependency cycles are reported as advisory, not enforced: §11 scopes the
 * invariant to production, and a test-only package re-exporting a real
 * implementation (e.g. `@natalia/testing` -> a plugin) can legitimately close a
 * loop through a dev edge while the production graph stays acyclic. New
 * production cycles always fail; the advisory line keeps the dev picture
 * visible without pretending it is the enforced invariant.
 */
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var root = process.cwd();
/** Every `package.json` under a root, recursively, skipping build output. */
function workspacePackageJsonFiles(rootDir) {
    return __awaiter(this, void 0, void 0, function () {
        var found, entries, _a, _i, entries_1, entry, full, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    found = [];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.readdir)(rootDir, { withFileTypes: true })];
                case 2:
                    entries = _e.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _e.sent();
                    return [2 /*return*/, found];
                case 4:
                    _i = 0, entries_1 = entries;
                    _e.label = 5;
                case 5:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 9];
                    entry = entries_1[_i];
                    if (!entry.isDirectory())
                        return [3 /*break*/, 8];
                    if (entry.name === "node_modules" || entry.name === "dist")
                        return [3 /*break*/, 8];
                    full = (0, node_path_1.join)(rootDir, entry.name);
                    return [4 /*yield*/, Bun.file((0, node_path_1.join)(full, "package.json")).exists()];
                case 6:
                    if (_e.sent())
                        found.push((0, node_path_1.join)(full, "package.json"));
                    _c = (_b = found.push).apply;
                    _d = [found];
                    return [4 /*yield*/, workspacePackageJsonFiles(full)];
                case 7:
                    _c.apply(_b, _d.concat([(_e.sent())]));
                    _e.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 5];
                case 9: return [2 /*return*/, found];
            }
        });
    });
}
/** Every `.ts` source file under a root, recursively, skipping build output. */
function workspaceSourceFiles(rootDir) {
    return __awaiter(this, void 0, void 0, function () {
        var found, entries, _a, _i, entries_2, entry, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    found = [];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.readdir)(rootDir, { withFileTypes: true })];
                case 2:
                    entries = _e.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _e.sent();
                    return [2 /*return*/, found];
                case 4:
                    _i = 0, entries_2 = entries;
                    _e.label = 5;
                case 5:
                    if (!(_i < entries_2.length)) return [3 /*break*/, 9];
                    entry = entries_2[_i];
                    if (!entry.isDirectory()) return [3 /*break*/, 7];
                    if (entry.name === "node_modules" || entry.name === "dist")
                        return [3 /*break*/, 8];
                    _c = (_b = found.push).apply;
                    _d = [found];
                    return [4 /*yield*/, workspaceSourceFiles((0, node_path_1.join)(rootDir, entry.name))];
                case 6:
                    _c.apply(_b, _d.concat([(_e.sent())]));
                    return [3 /*break*/, 8];
                case 7:
                    if (entry.name.endsWith(".ts"))
                        found.push((0, node_path_1.join)(rootDir, entry.name));
                    _e.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 5];
                case 9: return [2 /*return*/, found];
            }
        });
    });
}
var files = __spreadArray(__spreadArray([], (await workspacePackageJsonFiles((0, node_path_1.join)(root, "packages"))), true), (await workspacePackageJsonFiles((0, node_path_1.join)(root, "apps"))), true);
var packages = [];
var workspaceNames = new Set();
for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
    var file = files_1[_i];
    var pkg = JSON.parse(await (0, promises_1.readFile)(file, "utf8"));
    if (!pkg.name)
        continue;
    packages.push(pkg);
    workspaceNames.add(pkg.name);
}
function buildGraph(useDev) {
    var _a, _b, _c;
    var graph = new Map();
    for (var _i = 0, workspaceNames_1 = workspaceNames; _i < workspaceNames_1.length; _i++) {
        var name_1 = workspaceNames_1[_i];
        graph.set(name_1, new Set());
    }
    for (var _d = 0, packages_1 = packages; _d < packages_1.length; _d++) {
        var pkg = packages_1[_d];
        var edges = graph.get(pkg.name);
        for (var _e = 0, _f = Object.keys((_a = pkg.dependencies) !== null && _a !== void 0 ? _a : {}); _e < _f.length; _e++) {
            var dep = _f[_e];
            if (workspaceNames.has(dep))
                edges.add(dep);
        }
        if (useDev)
            for (var _g = 0, _h = Object.keys((_b = pkg.devDependencies) !== null && _b !== void 0 ? _b : {}); _g < _h.length; _g++) {
                var dep = _h[_g];
                if (workspaceNames.has(dep) && !((_c = pkg.dependencies) !== null && _c !== void 0 ? _c : {})[dep])
                    edges.add(dep);
            }
    }
    return graph;
}
/** Every distinct cycle, each rendered once as `a -> b -> a`. */
function findCycles(graph) {
    var cycles = [];
    var seen = new Set();
    var stack = [];
    var onStack = new Set();
    var visited = new Set();
    var short = function (name) { return name.replace("@natalia/", "@"); };
    var visit = function (node) {
        var _a;
        if (onStack.has(node)) {
            var cycle = stack.slice(stack.indexOf(node)).concat(node);
            var key = __spreadArray([], cycle, true).sort().join("|");
            if (!seen.has(key)) {
                seen.add(key);
                cycles.push(cycle.map(short));
            }
            return;
        }
        if (visited.has(node))
            return;
        visited.add(node);
        stack.push(node);
        onStack.add(node);
        for (var _i = 0, _b = (_a = graph.get(node)) !== null && _a !== void 0 ? _a : []; _i < _b.length; _i++) {
            var next = _b[_i];
            visit(next);
        }
        stack.pop();
        onStack.delete(node);
    };
    for (var _i = 0, _a = graph.keys(); _i < _a.length; _i++) {
        var node = _a[_i];
        visit(node);
    }
    return cycles;
}
var productionCycles = findCycles(buildGraph(false));
var devCycles = findCycles(buildGraph(true));
console.log("dependency cycle guard: ".concat(workspaceNames.size, " workspace packages"));
if (devCycles.length) {
    console.log("advisory (not enforced; \u00A711 is production-only): ".concat(devCycles.length, " cycle(s) including devDependencies"));
    for (var _a = 0, devCycles_1 = devCycles; _a < devCycles_1.length; _a++) {
        var cycle = devCycles_1[_a];
        console.log("  dev  ".concat(cycle.join(" -> ")));
    }
}
if (productionCycles.length) {
    console.error("production dependency cycles: ".concat(productionCycles.length, " (\u00A711 requires an acyclic production graph)"));
    for (var _b = 0, productionCycles_1 = productionCycles; _b < productionCycles_1.length; _b++) {
        var cycle = productionCycles_1[_b];
        console.error("  PROD ".concat(cycle.join(" -> ")));
    }
    process.exit(1);
}
// --- service-level graph (interface spec §5.3) ---
var _c = await Promise.resolve().then(function () { return require("../src/service-graph"); }), analyzeServiceGraph = _c.analyzeServiceGraph, packageOf = _c.packageOf;
var sourceFiles = __spreadArray(__spreadArray([], (await workspaceSourceFiles((0, node_path_1.join)(root, "packages"))), true), (await workspaceSourceFiles((0, node_path_1.join)(root, "apps"))), true);
var scanned = [];
for (var _d = 0, sourceFiles_1 = sourceFiles; _d < sourceFiles_1.length; _d++) {
    var path = sourceFiles_1[_d];
    var text = await Bun.file(path).text();
    scanned.push({ path: path, pkg: packageOf(path), text: text });
}
var graph = analyzeServiceGraph(scanned);
console.log("service graph: ".concat(graph.tokens.length, " declared tokens, ").concat(graph.nodes.length, " nodes"));
var ownershipProblems = graph.problems.filter(function (p) { return !p.startsWith("dependency cycle:"); });
if (ownershipProblems.length) {
    console.error("service declaration problems: ".concat(ownershipProblems.length));
    for (var _e = 0, ownershipProblems_1 = ownershipProblems; _e < ownershipProblems_1.length; _e++) {
        var problem = ownershipProblems_1[_e];
        console.error("  DECL ".concat(problem));
    }
}
var cycleProblems = graph.problems.filter(function (p) {
    return p.startsWith("dependency cycle:");
});
if (cycleProblems.length) {
    for (var _f = 0, cycleProblems_1 = cycleProblems; _f < cycleProblems_1.length; _f++) {
        var problem = cycleProblems_1[_f];
        console.error("  SVC  ".concat(problem));
    }
}
if (graph.problems.length) {
    console.error("service graph is unsound (spec §5.3: duplicate ids, unowned services and cycles are hard failures)");
    process.exit(1);
}
console.log("service declaration graph is sound");
