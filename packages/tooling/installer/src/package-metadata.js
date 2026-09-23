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
exports.validateStagedPackage = validateStagedPackage;
exports.packageSource = packageSource;
exports.sourceSpec = sourceSpec;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
var plugin_1 = require("@natalia/plugin");
var closure_1 = require("./closure");
function validateStagedPackage(prefix, spec, expectedPackageName) {
    return __awaiter(this, void 0, void 0, function () {
        var dependencies, packageNames, packageName, packageDir, realNodeModules, realPackageDir, manifests, _a, manifest, manifestPath, realManifestPath, relativeManifest, entryPath, module, record, resolvedVersion, metadata;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, closure_1.closureDependencies)(prefix)];
                case 1:
                    dependencies = _b.sent();
                    packageNames = Object.keys(dependencies);
                    if (!expectedPackageName && packageNames.length !== 1)
                        throw new Error("plugin install must produce exactly one package; found ".concat(packageNames.length));
                    packageName = expectedPackageName !== null && expectedPackageName !== void 0 ? expectedPackageName : packageNames[0];
                    if (!dependencies[packageName])
                        throw new Error("installed package is missing from closure: ".concat(packageName));
                    packageDir = (0, closure_1.packageDirectory)(prefix, packageName);
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.join)(prefix, "node_modules"))];
                case 2:
                    realNodeModules = _b.sent();
                    return [4 /*yield*/, (0, promises_1.realpath)(packageDir)];
                case 3:
                    realPackageDir = _b.sent();
                    if (containedRelative(realNodeModules, realPackageDir) === undefined)
                        throw new Error("plugin package escapes node_modules: ".concat(packageDir));
                    return [4 /*yield*/, (0, plugin_1.discoverPluginManifests)(packageDir, {
                            nodeModules: false,
                        })];
                case 4:
                    manifests = _b.sent();
                    if (manifests.length !== 1)
                        throw new Error("installed package ".concat(packageName, " must contain exactly one natalia.plugin.json; found ").concat(manifests.length));
                    _a = manifests[0], manifest = _a.manifest, manifestPath = _a.path;
                    return [4 /*yield*/, (0, promises_1.realpath)(manifestPath)];
                case 5:
                    realManifestPath = _b.sent();
                    relativeManifest = containedRelative(realPackageDir, realManifestPath);
                    if (relativeManifest === undefined)
                        throw new Error("plugin manifest escapes package directory: ".concat(manifestPath));
                    return [4 /*yield*/, (0, promises_1.realpath)(new URL(manifest.entry, (0, node_url_1.pathToFileURL)(manifestPath).href))];
                case 6:
                    entryPath = _b.sent();
                    if (containedRelative(realPackageDir, entryPath) === undefined)
                        throw new Error("plugin entry escapes package directory: ".concat(manifest.entry));
                    return [4 /*yield*/, Promise.resolve("".concat("".concat((0, node_url_1.pathToFileURL)(entryPath).href, "?validation=").concat((0, node_crypto_1.randomUUID)()))).then(function (s) { return require(s); })];
                case 7:
                    module = (_b.sent());
                    validatePluginModule(module.default, manifest);
                    return [4 /*yield*/, (0, closure_1.readPackageRecord)(prefix, packageName)];
                case 8:
                    record = _b.sent();
                    if (!(record === null || record === void 0 ? void 0 : record.version))
                        throw new Error("package-lock is missing installed package record: ".concat(packageName));
                    resolvedVersion = record.version;
                    if (resolvedVersion !== manifest.version)
                        throw new Error("plugin ".concat(manifest.id, " manifest version ").concat(manifest.version, " does not match installed package ").concat(resolvedVersion));
                    metadata = __assign(__assign({ id: manifest.id, source: packageSource(spec), resolvedVersion: resolvedVersion }, ((record === null || record === void 0 ? void 0 : record.integrity) ? { integrity: record.integrity } : {})), { scope: manifest.scope, dependencies: manifest.apiVersion === 2
                            ? manifest.dependencies.map(function (dependency) { return ({
                                id: dependency.id,
                                resolvedVersion: "unresolved",
                                optional: dependency.optional,
                                peer: dependency.peer,
                            }); })
                            : [] });
                    return [2 /*return*/, { manifest: manifest, relativeManifest: relativeManifest, packageName: packageName, metadata: metadata }];
            }
        });
    });
}
function validatePluginModule(value, manifest) {
    var plugin = typeof value === "function" ? value() : value;
    if (!plugin || typeof plugin !== "object")
        throw new Error("plugin entry must have a default plugin or factory export");
    var candidate = plugin;
    if (typeof candidate.setup !== "function")
        throw new Error("plugin entry default export must have a setup function");
    var exportedManifest = plugin_1.pluginManifestSchema.parse(candidate.manifest);
    if (JSON.stringify(exportedManifest) !== JSON.stringify(manifest))
        throw new Error("plugin entry manifest does not match natalia.plugin.json");
}
function containedRelative(parent, child) {
    var value = (0, node_path_1.relative)(parent, child);
    if (value === ".." || value.startsWith("..".concat(node_path_1.sep)))
        return undefined;
    return value;
}
function packageSource(spec) {
    if (spec.startsWith("git+") || spec.endsWith(".git"))
        return { type: "git", url: spec };
    if (/^(?:https?:).*\.(?:tgz|tar\.gz)$/iu.test(spec))
        return { type: "tarball", url: spec };
    if (spec.startsWith("file:") || spec.startsWith(".") || spec.startsWith("/"))
        return { type: "path", path: spec.replace(/^file:/u, "") };
    return { type: "registry", spec: spec };
}
function sourceSpec(source) {
    if (source.type === "registry")
        return source.spec;
    if (source.type === "path")
        return "file:".concat(source.path);
    if (source.type === "tarball")
        return source.url;
    return source.ref ? "".concat(source.url, "#").concat(source.ref) : source.url;
}
