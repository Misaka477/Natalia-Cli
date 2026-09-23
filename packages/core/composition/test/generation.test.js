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
var bun_test_1 = require("bun:test");
var object_store_1 = require("@natalia/object-store");
var contracts_1 = require("@natalia/contracts");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var index_1 = require("../src/index");
function testStore() {
    var root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-composition-"));
    return { root: root, store: new object_store_1.ObjectStore(root) };
}
// Bun's sync mkdtemp keeps the helper honest across platforms.
var node_fs_1 = require("node:fs");
var CONFIG = {
    version: 3,
    runtime: { terminal: { backend: "pty" } },
};
var CATALOG = [
    { id: "natalia-skills", enabled: true, fingerprint: "fp-skills" },
    { id: "natalia-team", enabled: false, fingerprint: "fp-team" },
];
(0, bun_test_1.test)("serialize and parse round-trip a generation", function () {
    var generation = (0, index_1.buildGeneration)({
        config: CONFIG,
        catalog: CATALOG,
        policyRows: [],
    });
    var parsed = (0, index_1.parseGeneration)((0, index_1.serializeGeneration)(generation));
    (0, bun_test_1.expect)(parsed).toEqual(generation);
    (0, bun_test_1.expect)(parsed.schema).toBe(contracts_1.GENERATION_SCHEMA);
});
(0, bun_test_1.test)("the catalog is stored sorted, so entry order never changes the id", function () {
    var a = (0, index_1.buildGeneration)({
        config: CONFIG,
        catalog: CATALOG,
        policyRows: [],
    });
    var b = (0, index_1.buildGeneration)({
        config: CONFIG,
        catalog: __spreadArray([], CATALOG, true).reverse(),
        policyRows: [],
    });
    (0, bun_test_1.expect)((0, index_1.serializeGeneration)(a)).toBe((0, index_1.serializeGeneration)(b));
});
(0, bun_test_1.test)("storing identical content yields the identical id", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, store, a, b, first, second, loaded;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = testStore(), root = _a.root, store = _a.store;
                _b.label = 1;
            case 1:
                _b.trys.push([1, , 5, 7]);
                a = (0, index_1.buildGeneration)({
                    config: CONFIG,
                    catalog: CATALOG,
                    policyRows: [],
                });
                b = (0, index_1.buildGeneration)({
                    config: CONFIG,
                    catalog: CATALOG,
                    policyRows: [],
                });
                return [4 /*yield*/, (0, index_1.storeGeneration)(store, a)];
            case 2:
                first = _b.sent();
                return [4 /*yield*/, (0, index_1.storeGeneration)(store, b)];
            case 3:
                second = _b.sent();
                (0, bun_test_1.expect)(first).toBe(second);
                return [4 /*yield*/, (0, index_1.loadGeneration)(store, first)];
            case 4:
                loaded = _b.sent();
                (0, bun_test_1.expect)(loaded.plugins.map(function (_a) {
                    var id = _a.id;
                    return id;
                })).toEqual([
                    "natalia-skills",
                    "natalia-team",
                ]);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a changed config is a different generation", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, store, first, second, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = testStore(), root = _a.root, store = _a.store;
                _d.label = 1;
            case 1:
                _d.trys.push([1, , 6, 8]);
                return [4 /*yield*/, (0, index_1.storeGeneration)(store, (0, index_1.buildGeneration)({ config: CONFIG, catalog: CATALOG, policyRows: [] }))];
            case 2:
                first = _d.sent();
                return [4 /*yield*/, (0, index_1.storeGeneration)(store, (0, index_1.buildGeneration)({
                        config: __assign(__assign({}, CONFIG), { runtime: { terminal: { backend: "wezterm", windowMode: "auto" } } }),
                        catalog: CATALOG,
                        policyRows: [],
                    }))];
            case 3:
                second = _d.sent();
                (0, bun_test_1.expect)(second).not.toBe(first);
                _b = bun_test_1.expect;
                return [4 /*yield*/, store.has(first)];
            case 4:
                _b.apply(void 0, [_d.sent()]).toBe(true);
                _c = bun_test_1.expect;
                return [4 /*yield*/, store.has(second)];
            case 5:
                _c.apply(void 0, [_d.sent()]).toBe(true);
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 7:
                _d.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("parseGeneration rejects a foreign schema", function () {
    (0, bun_test_1.expect)(function () {
        return (0, index_1.parseGeneration)(JSON.stringify({ schema: "other/1", plugins: [] }));
    }).toThrow(/unknown generation schema/);
});
(0, bun_test_1.test)("the pointer derives from the last switch, previous from its from", function () {
    var pointer = (0, index_1.deriveCompositionPointer)([
        { type: "session.created" },
        switched("gen-a", undefined, "config.reload"),
        switched("gen-b", "gen-a", "config.reload"),
        switched("gen-c", "gen-b", "rollback"),
    ]);
    (0, bun_test_1.expect)(pointer).toEqual({ current: "gen-c", previous: "gen-b" });
});
(0, bun_test_1.test)("a proposal that never commits stays the candidate", function () {
    var pointer = (0, index_1.deriveCompositionPointer)([
        switched("gen-a", undefined, "config.reload"),
        proposed("gen-b", "agent.proposal"),
    ]);
    (0, bun_test_1.expect)(pointer).toEqual({
        current: "gen-a",
        previous: undefined,
        candidate: "gen-b",
    });
});
(0, bun_test_1.test)("a committed proposal stops being the candidate", function () {
    var pointer = (0, index_1.deriveCompositionPointer)([
        switched("gen-a", undefined, "config.reload"),
        proposed("gen-b", "agent.proposal"),
        switched("gen-b", "gen-a", "config.reload"),
    ]);
    (0, bun_test_1.expect)(pointer.candidate).toBeUndefined();
    (0, bun_test_1.expect)(pointer.current).toBe("gen-b");
});
(0, bun_test_1.test)("the latest proposal wins as the candidate", function () {
    var pointer = (0, index_1.deriveCompositionPointer)([
        proposed("gen-x", "agent.proposal"),
        proposed("gen-y", "agent.proposal"),
    ]);
    (0, bun_test_1.expect)(pointer.candidate).toBe("gen-y");
});
(0, bun_test_1.test)("a stream without switches has no pointer", function () {
    (0, bun_test_1.expect)((0, index_1.deriveCompositionPointer)([])).toEqual({});
});
(0, bun_test_1.test)("the first switch has no previous", function () {
    var pointer = (0, index_1.deriveCompositionPointer)([
        switched("gen-a", undefined, "config.reload"),
    ]);
    (0, bun_test_1.expect)(pointer).toEqual({ current: "gen-a" });
});
function proposed(candidateID, reason) {
    return {
        type: "composition.proposed",
        candidateID: candidateID,
        reason: reason,
    };
}
function switched(to, from, reason) {
    return __assign(__assign({ type: "composition.switched", to: to }, (from ? { from: from } : {})), { reason: reason });
}
