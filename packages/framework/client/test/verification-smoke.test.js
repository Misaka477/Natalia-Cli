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
var bun_test_1 = require("bun:test");
var contracts_1 = require("@natalia/contracts");
var composition_1 = require("@natalia/composition");
var verification_faces_1 = require("../src/runtime/verification-faces");
/**
 * The smoke face (study §4.3): an isolated runtime boots with the
 * CANDIDATE's config and answers one turn — and the health criterion
 * refuses the silent fallback, because a smoke that booted defaults has
 * smoked nothing at all.
 */
var VALID_CONFIG = contracts_1.configV3Schema.parse({
    version: 3,
    providers: {
        smoke: {
            name: "Smoke",
            driver: "openai-compatible",
            connection: { apiKey: "test-secret" },
        },
    },
    catalog: {
        providers: { smoke: { models: { model: { name: "model" } } } },
    },
});
function candidate(config) {
    return (0, composition_1.buildGeneration)({
        config: config,
        catalog: [],
        policyRows: [],
    });
}
(0, bun_test_1.test)("a valid candidate boots, answers a turn, and reports healthy", function () { return __awaiter(void 0, void 0, void 0, function () {
    var check;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, verification_faces_1.smokeFace)({ timeoutMs: 30000 })(candidate(VALID_CONFIG))];
            case 1:
                check = _a.sent();
                (0, bun_test_1.expect)(check.check).toBe("smoke");
                (0, bun_test_1.expect)(check.ok).toBe(true);
                return [2 /*return*/];
        }
    });
}); }, 40000);
(0, bun_test_1.test)("a candidate whose config violates the schema is refused by name", function () { return __awaiter(void 0, void 0, void 0, function () {
    var broken, check;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                broken = __assign(__assign({}, VALID_CONFIG), { version: 4 });
                return [4 /*yield*/, (0, verification_faces_1.smokeFace)({ timeoutMs: 30000 })(candidate(broken))];
            case 1:
                check = _a.sent();
                (0, bun_test_1.expect)(check.ok).toBe(false);
                (0, bun_test_1.expect)(check.detail).toContain("candidate config invalid");
                return [2 /*return*/];
        }
    });
}); }, 40000);
(0, bun_test_1.test)("an impossible readiness deadline fails instead of hanging the gate", function () { return __awaiter(void 0, void 0, void 0, function () {
    var check;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, verification_faces_1.smokeFace)({ timeoutMs: 1 })(candidate(VALID_CONFIG))];
            case 1:
                check = _a.sent();
                (0, bun_test_1.expect)(check.ok).toBe(false);
                (0, bun_test_1.expect)(check.detail).toContain("session.ready");
                return [2 /*return*/];
        }
    });
}); }, 10000);
