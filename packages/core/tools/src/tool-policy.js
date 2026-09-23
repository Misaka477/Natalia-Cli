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
exports.createToolPolicyHookLayer = createToolPolicyHookLayer;
function createToolPolicyHookLayer(policy, hooks) {
    var allowPatterns = compilePatterns(policy === null || policy === void 0 ? void 0 : policy.allow);
    var excludePatterns = compilePatterns(policy === null || policy === void 0 ? void 0 : policy.exclude);
    function isToolAllowed(toolName) {
        if (allowPatterns.length > 0 &&
            !allowPatterns.some(function (pattern) { return pattern.test(toolName); }))
            return false;
        return !excludePatterns.some(function (pattern) { return pattern.test(toolName); });
    }
    return {
        isToolAllowed: isToolAllowed,
        filterTools: function (tools) { return tools.filter(function (tool) { return isToolAllowed(tool.name); }); },
        preExecute: function (event) {
            return __awaiter(this, void 0, void 0, function () {
                var diagnostics, result;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            diagnostics = [];
                            if (!isToolAllowed(event.toolName)) {
                                diagnostics.push("blocked by policy: ".concat(event.toolName));
                                return [2 /*return*/, { allowed: false, diagnostics: diagnostics }];
                            }
                            return [4 /*yield*/, ((_a = hooks === null || hooks === void 0 ? void 0 : hooks.preExecute) === null || _a === void 0 ? void 0 : _a.call(hooks, event))];
                        case 1:
                            result = _b.sent();
                            if (result) {
                                diagnostics.push.apply(diagnostics, result.diagnostics);
                                if (!result.allowed)
                                    return [2 /*return*/, {
                                            allowed: false,
                                            diagnostics: diagnostics,
                                            clearTerminal: result.clearTerminal,
                                        }];
                            }
                            return [2 /*return*/, { allowed: true, diagnostics: diagnostics }];
                    }
                });
            });
        },
        postExecute: function (event) {
            return __awaiter(this, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ((_a = hooks === null || hooks === void 0 ? void 0 : hooks.postExecute) === null || _a === void 0 ? void 0 : _a.call(hooks, event))];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
function compilePatterns(patterns) {
    if (!(patterns === null || patterns === void 0 ? void 0 : patterns.length))
        return [];
    return patterns.map(function (pattern) {
        var escaped = pattern
            .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
            .replace(/\\\*/gu, ".*");
        return new RegExp("^".concat(escaped, "$"), "u");
    });
}
