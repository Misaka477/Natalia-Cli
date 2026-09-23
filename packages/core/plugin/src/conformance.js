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
exports.runPluginConformance = runPluginConformance;
var registry_1 = require("./registry");
function runPluginConformance(input) {
    return __awaiter(this, void 0, void 0, function () {
        var tools, contributed, releases, registry, result, setupFailed, error_1, sample;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tools = new Map();
                    contributed = [];
                    releases = [];
                    registry = (0, registry_1.createPluginRegistry)({
                        tools: {
                            set: function (name, tool) {
                                tools.set(name, tool);
                            },
                            get: function (name) {
                                return tools.get(name);
                            },
                            delete: function (name) {
                                tools.delete(name);
                            },
                        },
                        registerOwner: function () { return ({
                            contribute: function (_kind, name) {
                                contributed.push(name);
                                return function () {
                                    releases.push(name);
                                };
                            },
                            release: function () { return undefined; },
                        }); },
                    });
                    result = [];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, registry.load(input.plugin, input.config)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    setupFailed = error_1;
                    return [3 /*break*/, 4];
                case 4:
                    result.push(__assign({ name: "manifest-and-setup", passed: !setupFailed }, (setupFailed
                        ? {
                            detail: setupFailed instanceof Error
                                ? setupFailed.message
                                : String(setupFailed),
                        }
                        : {})));
                    if (!!setupFailed) return [3 /*break*/, 6];
                    result.push({
                        name: "tool-ownership",
                        passed: contributed.length > 0 && contributed.every(function (name) { return tools.has(name); }),
                        detail: contributed.length === 0 ? "plugin contributed no tools" : undefined,
                    });
                    sample = __spreadArray([], tools.entries(), true)[0];
                    result.push({
                        name: "approval-boundary",
                        passed: sample ? sample[1].requiresApproval === false : false,
                        detail: sample ? undefined : "plugin contributed no tools to check",
                    });
                    return [4 /*yield*/, registry.unload(input.plugin.manifest.id)];
                case 5:
                    _a.sent();
                    result.push({
                        name: "owned-registration-cleanup",
                        passed: tools.size === 0 &&
                            contributed.every(function (name) { return releases.includes(name); }),
                        detail: tools.size || contributed.length !== releases.length
                            ? "plugin registrations remained after unload"
                            : undefined,
                    });
                    _a.label = 6;
                case 6: return [2 /*return*/, result];
            }
        });
    });
}
