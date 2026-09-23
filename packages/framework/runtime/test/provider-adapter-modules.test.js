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
var src_1 = require("../src");
(0, bun_test_1.afterEach)(function () {
    (0, src_1.clearProviderAdapters)();
});
function workspace() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-adapter-mod-"))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/** A minimal valid adapter module, written into a workspace. */
function writeAdapter(root, relativePath, body) {
    return __awaiter(this, void 0, void 0, function () {
        var target;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    target = (0, node_path_1.join)(root, relativePath);
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(target, ".."), { recursive: true })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)(target, body)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var ADAPTER_SRC = function (format) { return "\nexport default {\n  format: \"".concat(format, "\",\n  create: (options) => ({\n    provider: options.provider ?? \"").concat(format, "\",\n    model: options.model,\n    async *stream() { yield { type: \"done\" }; },\n  }),\n};\n"); };
(0, bun_test_1.test)("loads a local module and registers it under its declared format", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, results, adapter, built;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, writeAdapter(root, "adapters/mine.ts", ADAPTER_SRC("my-format"))];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.loadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
                        ],
                    })];
            case 3:
                results = _a.sent();
                (0, bun_test_1.expect)(results.results).toEqual([
                    { providerID: "mine", module: (0, node_path_1.join)(root, "adapters/mine.ts"), ok: true },
                ]);
                adapter = (0, src_1.getProviderAdapter)("my-format");
                (0, bun_test_1.expect)(adapter).toBeDefined();
                built = adapter.create({
                    apiKey: "k",
                    model: "m",
                });
                (0, bun_test_1.expect)(built.model).toBe("m");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the registered adapter is usable through providerFromKind", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, providerFromKind, built;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, writeAdapter(root, "adapters/mine.ts", ADAPTER_SRC("my-format"))];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.loadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
                        ],
                    })];
            case 3:
                _a.sent();
                return [4 /*yield*/, Promise.resolve().then(function () { return require("../src"); })];
            case 4:
                providerFromKind = (_a.sent()).providerFromKind;
                built = providerFromKind({
                    apiKey: "k",
                    model: "m",
                    providerName: "mine",
                    provider: "mine",
                    format: "my-format",
                });
                (0, bun_test_1.expect)(built.model).toBe("m");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("rejects a module path that escapes the workspace root", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                (0, bun_test_1.expect)(function () {
                    return (0, src_1.validateProviderAdapterPath)(root, "../../etc/passwd.ts");
                }).toThrow(/escapes the workspace root/);
                (0, bun_test_1.expect)(function () { return (0, src_1.validateProviderAdapterPath)(root, "/abs/elsewhere.ts"); }).toThrow(/escapes the workspace root/);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("rejects a module that is not a local JS or TS file", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                (0, bun_test_1.expect)(function () { return (0, src_1.validateProviderAdapterPath)(root, "adapters/x.json"); }).toThrow(/must be a local \.js, \.mjs or \.ts file/);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a missing module is reported, not thrown", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, results;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, src_1.loadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            { providerID: "gone", format: "gone-format", module: "./nope.ts" },
                        ],
                    })];
            case 2:
                results = _a.sent();
                (0, bun_test_1.expect)(results.results[0].ok).toBe(false);
                (0, bun_test_1.expect)(results.results[0].error).toBeTruthy();
                (0, bun_test_1.expect)((0, src_1.getProviderAdapter)("gone-format")).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a module without a default export is reported with the reason", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, results;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, writeAdapter(root, "adapters/empty.ts", "export const nothing = 1;\n")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.loadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [{ providerID: "e", format: "e", module: "./adapters/empty.ts" }],
                    })];
            case 3:
                results = _a.sent();
                (0, bun_test_1.expect)(results.results[0].ok).toBe(false);
                (0, bun_test_1.expect)(results.results[0].error).toMatch(/default-export an adapter object/);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an adapter missing its format or factory is rejected by shape", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, noFormat, noCreate;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, writeAdapter(root, "adapters/nofmt.ts", "export default { create: () => ({}) };\n")];
            case 2:
                _a.sent();
                return [4 /*yield*/, writeAdapter(root, "adapters/nocreate.ts", 'export default { format: "x" };\n')];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, src_1.loadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [{ providerID: "a", format: "x", module: "./adapters/nofmt.ts" }],
                    })];
            case 4:
                noFormat = _a.sent();
                return [4 /*yield*/, (0, src_1.loadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            { providerID: "b", format: "x", module: "./adapters/nocreate.ts" },
                        ],
                    })];
            case 5:
                noCreate = _a.sent();
                (0, bun_test_1.expect)(noFormat.results[0].error).toMatch(/non-empty `format` string/);
                (0, bun_test_1.expect)(noCreate.results[0].error).toMatch(/`create\(options\)` factory/);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an adapter whose format disagrees with the endpoint is rejected", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, results;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, writeAdapter(root, "adapters/mismatch.ts", ADAPTER_SRC("actual-format"))];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.loadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            {
                                providerID: "m",
                                format: "declared-format",
                                module: "./adapters/mismatch.ts",
                            },
                        ],
                    })];
            case 3:
                results = _a.sent();
                (0, bun_test_1.expect)(results.results[0].ok).toBe(false);
                (0, bun_test_1.expect)(results.results[0].error).toMatch(/they must match/);
                (0, bun_test_1.expect)((0, src_1.getProviderAdapter)("actual-format")).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("collects requests only from endpoints declaring both a format and a module", function () {
    var requests = (0, src_1.providerAdapterModuleRequests)({
        builtin: { protocol: { format: "openai-chat" } },
        custom: { protocol: { format: "mine", module: "./a.ts" } },
        half: { protocol: { format: "half", module: undefined } },
        none: { protocol: { format: "openai-chat" } },
    });
    // The built-in families need no module, so only a format-plus-module pair is
    // a load request.
    (0, bun_test_1.expect)(requests).toEqual([
        { providerID: "custom", format: "mine", module: "./a.ts" },
    ]);
});
(0, bun_test_1.test)("re-registering the same module is a conflict, not a silent replace", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, again;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, writeAdapter(root, "adapters/mine.ts", ADAPTER_SRC("my-format"))];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.loadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
                        ],
                    })];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, src_1.loadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
                        ],
                    })];
            case 4:
                again = _a.sent();
                (0, bun_test_1.expect)(again.results[0].ok).toBe(false);
                (0, bun_test_1.expect)(again.results[0].error).toMatch(/already registered/);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reloading withdraws the previous set before loading the new one", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, first, second;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, writeAdapter(root, "adapters/mine.ts", ADAPTER_SRC("my-format"))];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.reloadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
                        ],
                    })];
            case 3:
                first = _a.sent();
                (0, bun_test_1.expect)(first[0].ok).toBe(true);
                (0, bun_test_1.expect)((0, src_1.getProviderAdapter)("my-format")).toBeDefined();
                return [4 /*yield*/, (0, src_1.reloadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
                        ],
                    })];
            case 4:
                second = _a.sent();
                // Same format, same module: reloaded rather than rejected.
                (0, bun_test_1.expect)(second[0].ok).toBe(true);
                (0, bun_test_1.expect)((0, src_1.getProviderAdapter)("my-format")).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reloading with an empty set withdraws everything", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, writeAdapter(root, "adapters/mine.ts", ADAPTER_SRC("my-format"))];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.reloadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
                        ],
                    })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)((0, src_1.getProviderAdapter)("my-format")).toBeDefined();
                return [4 /*yield*/, (0, src_1.reloadProviderAdapterModules)({ workspaceRoot: root, requests: [] })];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)((0, src_1.getProviderAdapter)("my-format")).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a module that failed to load leaves nothing to withdraw", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, load;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, src_1.loadProviderAdapterModules)({
                        workspaceRoot: root,
                        requests: [
                            { providerID: "gone", format: "gone-format", module: "./nope.ts" },
                        ],
                    })];
            case 2:
                load = _a.sent();
                (0, bun_test_1.expect)(load.results[0].ok).toBe(false);
                (0, bun_test_1.expect)(function () { return load.withdraw(); }).not.toThrow();
                (0, bun_test_1.expect)((0, src_1.getProviderAdapter)("gone-format")).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
