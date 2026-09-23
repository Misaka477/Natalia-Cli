"use strict";
/**
 * Service-graph analysis for the dependency-cycle guard (interface spec §5.3).
 *
 * The package-level guard answers "do packages import each other in a loop".
 * This module answers the question that level cannot see: *services* form
 * their own dependency graph — a plugin requires a service another plugin
 * provides — and that graph can deadlock while every package.json edge stays
 * acyclic. Two plugins requiring each other's services is the classic shape.
 *
 * Everything here reads *declarations* (spec: "从猜 import 升级为读声明"):
 *
 * - token declarations — `defineService<...>("id", { meta })` from production
 *   sources, giving the id namespace and the variable name each provide/get
 *   call site speaks;
 * - provides — plugin manifests (`provides: [...]`, plugin packages only) and
 *   `provide(...)` call sites (`api.services.provide`, the host's
 *   `serviceDirectory.provide`, and local wrappers around it);
 * - requires — plugin manifests (`requires: [...]`) and `get(...)` call sites
 *   (`api.services.get`, `serviceDirectory.get/getOptional`).
 *
 * The host is the provider root, never a consumer: its consumption of
 * plugin-provided services is call-time resolution (spec §5.3 item 4 records
 * that P1's directory resolves lazily), so a host→plugin→host require cycle is
 * the intended shape, not a deadlock. Kahn therefore runs over the
 * plugin-to-plugin edges only, where a cycle is the real deadlock class.
 *
 * The analysis is static source scanning: no imports, no execution, no
 * registry boot. Its checks (duplicate ids, missing providers, double
 * providers, Kahn cycles, orphan tokens) fail the gate with the messages the
 * spec copied from Chord's `validateFacets`.
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
exports.HOST_PACKAGE = void 0;
exports.isProductionSource = isProductionSource;
exports.packageOf = packageOf;
exports.scanTokenDeclarations = scanTokenDeclarations;
exports.analyzeServiceGraph = analyzeServiceGraph;
/** The host is a single node: the runtime that binds most services itself. */
exports.HOST_PACKAGE = "@natalia/host";
var TOKEN_DECLARATION = /export const (\w+) = defineService(?:<[^>]*>)?\(\s*"([^"]+)"\s*,\s*\{([^}]*)\}/dgs;
var META_SCOPE = /scope:\s*"([^"]+)"/;
var META_CAPABILITY = /capability:\s*"([^"]+)"/;
var VALID_SCOPES = new Set(["process", "workspace", "session"]);
/** Test files and fixtures are not the production declaration surface. */
function isProductionSource(path) {
    return (!path.includes("/test/") &&
        !path.endsWith(".test.ts") &&
        !path.endsWith(".spec.ts"));
}
/** Workspace package name for a repo-relative (or absolute) source path. */
function packageOf(path) {
    var LAYERS = "framework|domains|core|plugins|tooling|hosts";
    var m = new RegExp("(?:^|/)packages/(".concat(LAYERS, ")/([^/]+)/")).exec(path);
    if (!m)
        return exports.HOST_PACKAGE;
    var layer = m[1], name = m[2];
    if (layer === "plugins")
        return "@natalia/".concat(name, "-plugin");
    return "@natalia/".concat(name);
}
/** Every `defineService` declaration in one file. */
function scanTokenDeclarations(file) {
    var _a, _b;
    var out = [];
    for (var _i = 0, _c = file.text.matchAll(TOKEN_DECLARATION); _i < _c.length; _i++) {
        var m = _c[_i];
        var variable = m[1], id = m[2], meta = m[3];
        var scope = (_a = META_SCOPE.exec(meta !== null && meta !== void 0 ? meta : "")) === null || _a === void 0 ? void 0 : _a[1];
        var capability = (_b = META_CAPABILITY.exec(meta !== null && meta !== void 0 ? meta : "")) === null || _b === void 0 ? void 0 : _b[1];
        out.push(__assign(__assign({ id: id, variable: variable, file: file.path, pkg: file.pkg }, (scope ? { scope: scope } : {})), (capability ? { capability: capability } : {})));
    }
    return out;
}
/**
 * Token expressions used in one file, resolved through the *global* variable
 * map: provide sites live in files that import the token, so a per-file map
 * would resolve nothing there. Import aliases (`import { a as b }`) are
 * mapped too.
 */
function resolveTokenReferences(file, byVariable) {
    var _a;
    var references = new Map();
    for (var _i = 0, _b = file.text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]+"/g); _i < _b.length; _i++) {
        var m = _b[_i];
        for (var _c = 0, _d = m[1].split(","); _c < _d.length; _c++) {
            var part = _d[_c];
            var alias = /\s*(\w+)\s+as\s+(\w+)\s*/.exec(part);
            if (!alias)
                continue;
            var id = byVariable.get(alias[1]);
            if (id)
                references.set(alias[2], id);
        }
    }
    for (var _e = 0, _f = file.text.matchAll(/\b(\w+)\.id\b/g); _e < _f.length; _e++) {
        var m = _f[_e];
        var id = (_a = references.get(m[1])) !== null && _a !== void 0 ? _a : byVariable.get(m[1]);
        if (id)
            references.set(m[0], id);
    }
    for (var _g = 0, _h = file.text.matchAll(/\b([a-z]\w*)\b/g); _g < _h.length; _g++) {
        var m = _h[_g];
        var id = byVariable.get(m[1]);
        if (id && !references.has(m[1]))
            references.set(m[1], id);
    }
    return references;
}
var CALL_PATTERNS = [
    [/api\.services\.provide\(\s*([^,]+),/g, "provide"],
    [/(?:serviceDirectory|directory)\.provide\(\s*([^,]+),/gi, "provide"],
    // Local wrappers around directory.provide (the host's refreshPluginInputs
    // passes its `token` parameter through a `provide(token, value)` helper).
    [/\bprovide\(\s*([^,]+),/g, "provide"],
    [/api\.services\.get(?:<[^>]*>)?\(\s*([^),]+)/g, "get"],
    [/(?:serviceDirectory|directory)\.get(?:Optional)?\(\s*([^),]+)/gi, "get"],
];
function collectCalls(file, byVariable) {
    var references = resolveTokenReferences(file, byVariable);
    var calls = [];
    for (var _i = 0, CALL_PATTERNS_1 = CALL_PATTERNS; _i < CALL_PATTERNS_1.length; _i++) {
        var _a = CALL_PATTERNS_1[_i], pattern = _a[0], keyword = _a[1];
        for (var _b = 0, _c = file.text.matchAll(pattern); _b < _c.length; _b++) {
            var m = _c[_b];
            var expr = m[1].trim();
            var direct = references.get(expr);
            var member = /\b\w+\.id\b/.exec(expr);
            var id = direct !== null && direct !== void 0 ? direct : (member ? references.get(member[0]) : undefined);
            if (id)
                calls.push({ tokenId: id, keyword: keyword });
        }
    }
    return calls;
}
/**
 * Manifest provides/requires, collected from plugin packages only: manifests
 * are a plugin concept, and domain objects can carry an unrelated `requires:`
 * key (work-contract evidence rules do).
 */
function collectManifestLists(file, byVariable) {
    var _a;
    var provides = new Set();
    var requires = new Set();
    if (!file.path.includes("/plugins/"))
        return { provides: provides, requires: requires };
    var references = resolveTokenReferences(file, byVariable);
    for (var _i = 0, _b = ["provides", "requires"]; _i < _b.length; _i++) {
        var key = _b[_i];
        var m = new RegExp("\\b".concat(key, ":\\s*\\[([^\\]]*)\\]"), "gs").exec(file.text);
        if (!m)
            continue;
        for (var _c = 0, _d = m[1].split(","); _c < _d.length; _c++) {
            var item = _d[_c];
            var expr = item.trim();
            if (!expr)
                continue;
            var member = /\b(\w+)\.id\b/.exec(expr);
            var id = member
                ? references.get(member[0])
                : ((_a = references.get(expr)) !== null && _a !== void 0 ? _a : (/^["'][^"']+["']$/.test(expr) ? expr.slice(1, -1) : undefined));
            if (id)
                (key === "provides" ? provides : requires).add(id);
        }
    }
    return { provides: provides, requires: requires };
}
/**
 * Build the service graph and run every §5.3 check. `problems` is empty when
 * the declarations are sound.
 */
function analyzeServiceGraph(files) {
    var _a, _b, _c, _d, _e;
    var tokens = [];
    for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
        var file = files_1[_i];
        if (file.path.includes("/src/"))
            tokens.push.apply(tokens, scanTokenDeclarations(file));
    }
    var byVariable = new Map(tokens.map(function (t) { return [t.variable, t.id]; }));
    var problems = [];
    // 1. id uniqueness — convention 2's registration-time check, statically.
    var byId = new Map();
    for (var _f = 0, tokens_1 = tokens; _f < tokens_1.length; _f++) {
        var token = tokens_1[_f];
        var list = (_a = byId.get(token.id)) !== null && _a !== void 0 ? _a : [];
        list.push(token);
        byId.set(token.id, list);
    }
    for (var _g = 0, byId_1 = byId; _g < byId_1.length; _g++) {
        var _h = byId_1[_g], id = _h[0], list = _h[1];
        if (list.length > 1)
            problems.push("duplicate service id \"".concat(id, "\" declared in ").concat(list.map(function (t) { return t.file; }).join(" and ")));
    }
    // 2. meta well-formedness.
    for (var _j = 0, tokens_2 = tokens; _j < tokens_2.length; _j++) {
        var token = tokens_2[_j];
        if (token.scope && !VALID_SCOPES.has(token.scope))
            problems.push("token \"".concat(token.id, "\" declares invalid scope \"").concat(token.scope, "\" (").concat(token.file, ")"));
        if (!token.capability)
            problems.push("token \"".concat(token.id, "\" declares no capability (").concat(token.file, ")"));
    }
    // 3. providers index + consumer edges (production sources only: a fixture's
    //    provide binds nothing in a real graph).
    var nodes = new Map();
    var nodeFor = function (pkg, file) {
        var node = nodes.get(pkg);
        if (!node) {
            node = {
                package: pkg,
                files: new Set(),
                provides: new Set(),
                requires: new Set(),
            };
            nodes.set(pkg, node);
        }
        node.files.add(file);
        return node;
    };
    var providers = new Map();
    var addProvide = function (id, pkg, file) {
        var _a;
        nodeFor(pkg, file).provides.add(id);
        var set = (_a = providers.get(id)) !== null && _a !== void 0 ? _a : new Set();
        set.add(pkg);
        providers.set(id, set);
    };
    var addRequire = function (id, pkg, file) {
        nodeFor(pkg, file).requires.add(id);
    };
    for (var _k = 0, files_2 = files; _k < files_2.length; _k++) {
        var file = files_2[_k];
        if (!isProductionSource(file.path))
            continue;
        var _l = collectManifestLists(file, byVariable), provides = _l.provides, requires = _l.requires;
        for (var _m = 0, provides_1 = provides; _m < provides_1.length; _m++) {
            var id = provides_1[_m];
            addProvide(id, file.pkg, file.path);
        }
        for (var _o = 0, requires_1 = requires; _o < requires_1.length; _o++) {
            var id = requires_1[_o];
            addRequire(id, file.pkg, file.path);
        }
        for (var _p = 0, _q = collectCalls(file, byVariable); _p < _q.length; _p++) {
            var call = _q[_p];
            if (call.keyword === "provide")
                addProvide(call.tokenId, file.pkg, file.path);
            else
                addRequire(call.tokenId, file.pkg, file.path);
        }
    }
    // 4. every required id has a provider (Chord's missing-provider message).
    for (var _r = 0, _s = nodes.values(); _r < _s.length; _r++) {
        var node = _s[_r];
        for (var _t = 0, _u = node.requires; _t < _u.length; _t++) {
            var id = _u[_t];
            if (!providers.has(id))
                problems.push("service \"".concat(id, "\" is required by ").concat(node.package, " but no package provides it (").concat(__spreadArray([], node.files, true).join(", "), ")"));
        }
    }
    // 4b. a provided id is owned by exactly one package (Chord's both-providers
    //     message). Ownership collisions are defects even before a consumer.
    for (var _v = 0, providers_1 = providers; _v < providers_1.length; _v++) {
        var _w = providers_1[_v], id = _w[0], set = _w[1];
        if (set.size > 1)
            problems.push("service \"".concat(id, "\" is provided by both ").concat(__spreadArray([], set, true).sort().join(" and ")));
    }
    // 5. every declared token has a provider (an orphan declaration is a stub).
    for (var _x = 0, tokens_3 = tokens; _x < tokens_3.length; _x++) {
        var token = tokens_3[_x];
        if (!providers.has(token.id))
            problems.push("token \"".concat(token.id, "\" is declared in ").concat(token.file, " but never provided"));
    }
    // 6. Kahn over plugin-to-plugin edges. The host is the provider root, not a
    //    consumer: its consumes resolve lazily (spec §5.3 item 4), so requiring a
    //    host-provided service creates no edge and host cycles are not deadlocks.
    var edges = new Map();
    for (var _y = 0, _z = nodes.values(); _y < _z.length; _y++) {
        var node = _z[_y];
        // Only plugin nodes participate in the deadlock graph: everything else is
        // host-side machinery that provides or consumes, but never activation-
        // blocks on a plugin.
        if (!node.package.endsWith("-plugin"))
            continue;
        var targets = new Set();
        for (var _0 = 0, _1 = node.requires; _0 < _1.length; _0++) {
            var id = _1[_0];
            for (var _2 = 0, _3 = (_b = providers.get(id)) !== null && _b !== void 0 ? _b : []; _2 < _3.length; _2++) {
                var provider = _3[_2];
                if (provider !== node.package && provider !== exports.HOST_PACKAGE)
                    targets.add(provider);
            }
        }
        edges.set(node.package, targets);
    }
    var indegree = new Map();
    for (var _4 = 0, edges_1 = edges; _4 < edges_1.length; _4++) {
        var _5 = edges_1[_4], targets = _5[1];
        for (var _6 = 0, targets_1 = targets; _6 < targets_1.length; _6++) {
            var target = targets_1[_6];
            indegree.set(target, ((_c = indegree.get(target)) !== null && _c !== void 0 ? _c : 0) + 1);
        }
    }
    var ready = __spreadArray([], edges.keys(), true).filter(function (pkg) { var _a; return ((_a = indegree.get(pkg)) !== null && _a !== void 0 ? _a : 0) === 0; });
    var ordered = [];
    while (ready.length) {
        var pkg = ready.shift();
        ordered.push(pkg);
        for (var _7 = 0, _8 = (_d = edges.get(pkg)) !== null && _d !== void 0 ? _d : []; _7 < _8.length; _7++) {
            var target = _8[_7];
            var left = ((_e = indegree.get(target)) !== null && _e !== void 0 ? _e : 0) - 1;
            indegree.set(target, left);
            if (left === 0)
                ready.push(target);
        }
    }
    var cycleNodes = __spreadArray([], edges.keys(), true).filter(function (pkg) { return !ordered.includes(pkg); });
    if (cycleNodes.length)
        problems.push("dependency cycle: ".concat(cycleNodes.sort().join(" -> "), " (service requires/provides form a loop)"));
    return { tokens: tokens, nodes: __spreadArray([], nodes.values(), true), problems: problems };
}
