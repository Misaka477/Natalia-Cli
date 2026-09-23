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
var memory_trace_1 = require("../src/memory-trace");
(0, bun_test_1.test)("the RSS sampler is a no-op unless NATALIA_MEMORY_TRACE=1", function () {
    delete process.env.NATALIA_MEMORY_TRACE;
    var warnings = [];
    var original = console.warn;
    console.warn = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        warnings.push(args.map(String).join(" "));
    };
    try {
        (0, memory_trace_1.startMemoryTraceSampler)();
        (0, bun_test_1.expect)(warnings).toHaveLength(0);
    }
    finally {
        console.warn = original;
        (0, memory_trace_1.stopMemoryTraceSampler)();
    }
});
(0, bun_test_1.test)("the RSS sampler logs periodic samples when enabled", function () { return __awaiter(void 0, void 0, void 0, function () {
    var warnings, original;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                process.env.NATALIA_MEMORY_TRACE = "1";
                process.env.NATALIA_MEMORY_TRACE_INTERVAL_MS = "1000";
                warnings = [];
                original = console.warn;
                console.warn = function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    warnings.push(args.map(String).join(" "));
                };
                _a.label = 1;
            case 1:
                _a.trys.push([1, , 3, 4]);
                (0, memory_trace_1.startMemoryTraceSampler)();
                return [4 /*yield*/, Bun.sleep(1150)];
            case 2:
                _a.sent();
                (0, memory_trace_1.stopMemoryTraceSampler)();
                (0, bun_test_1.expect)(warnings.some(function (entry) { return entry.includes("[mem-trace] rss.sample"); })).toBe(true);
                return [3 /*break*/, 4];
            case 3:
                console.warn = original;
                (0, memory_trace_1.stopMemoryTraceSampler)();
                delete process.env.NATALIA_MEMORY_TRACE;
                delete process.env.NATALIA_MEMORY_TRACE_INTERVAL_MS;
                return [7 /*endfinally*/];
            case 4: return [2 /*return*/];
        }
    });
}); });
