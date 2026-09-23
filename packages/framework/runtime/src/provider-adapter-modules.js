"use strict";
/**
 * Loading a user-supplied provider adapter from a local module.
 *
 * This is the extension point that makes the seam real: an endpoint declares
 * `protocol: { format: "my-format", module: "./adapters/mine.ts" }`, and the
 * module's default export becomes the adapter registered under that format. The
 * alternative — shipping every wire format inside this package — would put every
 * new provider behind a release.
 *
 * Registration happens once at composition time, not per request: dynamic
 * `import()` is asynchronous and `providerFromKind` is not, so loading eagerly
 * keeps the dispatch path synchronous. A module that fails to load is reported
 * here and again at dispatch, because a session with other working providers
 * should not be blocked by one broken adapter.
 */
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
exports.validateProviderAdapterPath = validateProviderAdapterPath;
exports.loadProviderAdapterModules = loadProviderAdapterModules;
exports.reloadProviderAdapterModules = reloadProviderAdapterModules;
exports.providerAdapterModuleRequests = providerAdapterModuleRequests;
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
var provider_adapters_1 = require("./provider-adapters");
/** Extensions a local adapter module may use, matching the plugin loader. */
var ADAPTER_MODULE_EXTENSIONS = [".js", ".mjs", ".ts"];
/**
 * Resolve and validate an adapter module path against a root.
 *
 * Mirrors the plugin loader's rule so the two cannot drift: the path must stay
 * inside the root and must name a local JS or TS module. Loading arbitrary user
 * code is the point of the feature — the user is already able to run their own
 * program — so the constraint here is about accidental escapes, not sandboxing.
 */
function validateProviderAdapterPath(root, path) {
    var resolved = (0, node_path_1.resolve)(root, path);
    var inside = (0, node_path_1.relative)((0, node_path_1.resolve)(root), resolved);
    if (inside !== "" && (inside.startsWith("..") || (0, node_path_1.isAbsolute)(inside)))
        throw new Error("provider adapter path escapes the workspace root");
    if (!(0, node_path_1.isAbsolute)(resolved) ||
        !ADAPTER_MODULE_EXTENSIONS.some(function (extension) { return resolved.endsWith(extension); }))
        throw new Error("provider adapter module must be a local .js, .mjs or .ts file");
    return resolved;
}
/** The shape a loaded module's default export must have. */
function assertAdapterShape(value) {
    if (typeof value !== "object" || value === null)
        throw new Error("provider adapter module must default-export an adapter object");
    var candidate = value;
    if (typeof candidate.format !== "string" || candidate.format.length === 0)
        throw new Error("provider adapter must declare a non-empty `format` string; it is the " +
            "registry key and must match the endpoint's `protocol.format`");
    if (typeof candidate.create !== "function")
        throw new Error("provider adapter must expose a `create(options)` factory");
    return candidate;
}
/**
 * Load and register the adapters named by endpoint configuration.
 *
 * A module is registered under its resolved path as the source id, so a reload
 * can withdraw exactly what a previous load installed without touching the
 * built-ins.
 *
 * Failures are returned rather than thrown: one broken module must not stop the
 * session from starting, and the caller publishes each as a diagnostic so the
 * cause is visible before dispatch repeats it.
 */
function loadProviderAdapterModules(input) {
    return __awaiter(this, void 0, void 0, function () {
        var results, registered, _i, _a, request, entry, module_1, adapter, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    results = [];
                    registered = [];
                    _i = 0, _a = input.requests;
                    _b.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    request = _a[_i];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    entry = validateProviderAdapterPath(input.workspaceRoot, request.module);
                    return [4 /*yield*/, Promise.resolve("".concat((0, node_url_1.pathToFileURL)(entry).href)).then(function (s) { return require(s); })];
                case 3:
                    module_1 = (_b.sent());
                    adapter = assertAdapterShape(module_1.default);
                    if (adapter.format !== request.format)
                        throw new Error("adapter declares format \"".concat(adapter.format, "\" but the endpoint ") +
                            "declares \"".concat(request.format, "\"; they must match"));
                    (0, provider_adapters_1.registerProviderAdapter)(adapter, entry);
                    registered.push(entry);
                    results.push({ providerID: request.providerID, module: entry, ok: true });
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _b.sent();
                    results.push({
                        providerID: request.providerID,
                        module: request.module,
                        ok: false,
                        error: error_1 instanceof Error ? error_1.message : String(error_1),
                    });
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/, {
                        results: results,
                        withdraw: function () {
                            // By module path, which is the source id each was registered under. A
                            // module that failed to load registered nothing, so withdrawing the ones
                            // that succeeded is exactly the whole set.
                            for (var _i = 0, registered_1 = registered; _i < registered_1.length; _i++) {
                                var entry = registered_1[_i];
                                (0, provider_adapters_1.unregisterProviderAdapters)(entry);
                            }
                        },
                    }];
            }
        });
    });
}
/**
 * The adapter modules currently registered, and the only way to replace them.
 *
 * Held here rather than by a caller because there are two: initialization loads
 * them once, and a config reload must replace them when the configured set
 * changes. A holder in each caller would let the two disagree about which
 * modules are live — and `registerProviderAdapter` throws on a duplicate format,
 * so a disagreement surfaces as a failed reload rather than a stale adapter.
 */
var currentLoad;
/**
 * Load the configured adapter modules, withdrawing whatever a previous call
 * loaded. Safe to call repeatedly, which is what a config reload needs.
 */
function reloadProviderAdapterModules(input) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentLoad === null || currentLoad === void 0 ? void 0 : currentLoad.withdraw();
                    return [4 /*yield*/, loadProviderAdapterModules(input)];
                case 1:
                    currentLoad = _a.sent();
                    return [2 /*return*/, currentLoad.results];
            }
        });
    });
}
/** Every module-provided format, for diagnostics and tests. */
function providerAdapterModuleRequests(providers) {
    var _a, _b;
    var requests = [];
    for (var _i = 0, _c = Object.entries(providers !== null && providers !== void 0 ? providers : {}); _i < _c.length; _i++) {
        var _d = _c[_i], providerID = _d[0], provider = _d[1];
        var format = (_a = provider === null || provider === void 0 ? void 0 : provider.protocol) === null || _a === void 0 ? void 0 : _a.format;
        var module_2 = (_b = provider === null || provider === void 0 ? void 0 : provider.protocol) === null || _b === void 0 ? void 0 : _b.module;
        if (!format || !module_2)
            continue;
        requests.push({ providerID: providerID, format: format, module: module_2 });
    }
    return requests;
}
