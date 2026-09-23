"use strict";
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var _a, e_1, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Event-fallback guard (interface spec §4.2, landing point for P2).
 *
 * The spec's consumption-side discipline: every switch over `RuntimeEventData`
 * must handle the known branches plus a default fallback, and `assertNever`
 * exhaustiveness assertions are forbidden — the union gains new members as a
 * legitimate unknown value, exactly as a plugin-added variant is (dsh's session
 * format documents the same rule: "switches must NOT use assertNever — a
 * plugin-added variant is a valid unknown value").
 *
 * This mechanizes the check the spec scheduled for P2: a repo-wide grep that
 * fails the gate on any `assertNever` reaching production source. An
 * intentional exception carries a reason on the line, so the allow-list is
 * self-documenting and a stale entry fails like the other guards'.
 */
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var root = process.cwd();
var sourceRoots = ["packages", "apps"];
var skipDirs = new Set([
    "node_modules",
    "dist",
    ".turbo",
    "coverage",
    "build",
    "out",
]);
function sourceFiles(dir) {
    return __asyncGenerator(this, arguments, function sourceFiles_1() {
        var entries, _a, _i, entries_1, entry, path;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 4]);
                    return [4 /*yield*/, __await((0, promises_1.readdir)(dir, { withFileTypes: true }))];
                case 1:
                    entries = _b.sent();
                    return [3 /*break*/, 4];
                case 2:
                    _a = _b.sent();
                    return [4 /*yield*/, __await(void 0)];
                case 3: return [2 /*return*/, _b.sent()];
                case 4:
                    _i = 0, entries_1 = entries;
                    _b.label = 5;
                case 5:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 12];
                    entry = entries_1[_i];
                    if (!entry.isDirectory()) return [3 /*break*/, 8];
                    if (skipDirs.has(entry.name))
                        return [3 /*break*/, 11];
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(sourceFiles((0, node_path_1.join)(dir, entry.name)))))];
                case 6: return [4 /*yield*/, __await.apply(void 0, [_b.sent()])];
                case 7:
                    _b.sent();
                    return [3 /*break*/, 11];
                case 8:
                    if (!entry.name.endsWith(".ts"))
                        return [3 /*break*/, 11];
                    path = (0, node_path_1.join)(dir, entry.name);
                    if (!path.includes("/src/"))
                        return [3 /*break*/, 11];
                    return [4 /*yield*/, __await(path)];
                case 9: return [4 /*yield*/, _b.sent()];
                case 10:
                    _b.sent();
                    _b.label = 11;
                case 11:
                    _i++;
                    return [3 /*break*/, 5];
                case 12: return [2 /*return*/];
            }
        });
    });
}
var violations = [];
var scanned = 0;
for (var _i = 0, sourceRoots_1 = sourceRoots; _i < sourceRoots_1.length; _i++) {
    var sourceRoot = sourceRoots_1[_i];
    try {
        for (var _d = true, _e = (e_1 = void 0, __asyncValues(sourceFiles((0, node_path_1.join)(root, sourceRoot)))), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
            _c = _f.value;
            _d = false;
            var file = _c;
            var text = await (0, promises_1.readFile)(file, "utf8");
            scanned += 1;
            var lines = text.split("\n");
            for (var index = 0; index < lines.length; index += 1) {
                var line = lines[index];
                if (!/\bassertNever\b/.test(line))
                    continue;
                // An intentional use must justify itself on the same line.
                var justified = /assertNever[^\n]*\/\/\s*fallback-ok:\s*\S/u.test(line);
                if (justified)
                    continue;
                var where = "".concat((0, node_path_1.relative)(root, file), ":").concat(index + 1);
                violations.push("".concat(where, ": ").concat(line.trim()));
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
        }
        finally { if (e_1) throw e_1.error; }
    }
}
console.log("event fallback guard: ".concat(scanned, " files scanned"));
if (violations.length) {
    console.error("assertNever reached production source: ".concat(violations.length, " (spec \u00A74.2: event switches fall back, never exhaust-assert)"));
    for (var _g = 0, violations_1 = violations; _g < violations_1.length; _g++) {
        var violation = violations_1[_g];
        console.error("  ".concat(violation));
    }
    console.error("an intentional use carries `// fallback-ok: <reason>` on the same line");
    process.exit(1);
}
console.log("no assertNever in production source (unknown-fallback discipline holds)");
