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
var policy_1 = require("../src/policy");
var contracts_1 = require("@natalia/contracts");
var service_1 = require("../src/service");
(0, bun_test_1.test)("provider policy defaults to the caller fallback", function () {
    (0, bun_test_1.expect)((0, policy_1.evaluatePolicy)([], "provider.use", "anthropic", "allow")).toBe("allow");
});
(0, bun_test_1.test)("model selection distinguishes configured, usable, policy allowed and selected", function () {
    var config = contracts_1.configV3Schema.parse({
        version: 3,
        providers: {
            company: {
                name: "Company",
                driver: "openai",
                connection: { apiKey: "local" },
            },
        },
        catalog: {
            providers: {
                company: {
                    models: {
                        "company-stable": { name: "company-stable" },
                        "company-experimental-fast": { name: "company-experimental-fast" },
                        "company-disabled": { name: "company-disabled" },
                    },
                },
            },
        },
        modelOverrides: {
            "company/company-disabled": { enabled: false },
        },
        experimental: {
            policies: [
                { effect: "deny", action: "provider.use", resource: "company/*" },
                {
                    effect: "allow",
                    action: "provider.use",
                    resource: "company/company-stable",
                },
            ],
        },
    });
    (0, bun_test_1.expect)((0, policy_1.modelSelectionStatus)(config, {
        provider: "company",
        model: "company-stable",
    })).toMatchObject({
        configured: true,
        usable: true,
        policyAllowed: true,
        selected: true,
    });
    (0, bun_test_1.expect)((0, policy_1.modelSelectionStatus)(config, {
        provider: "company",
        model: "company-experimental-fast",
    })).toMatchObject({
        usable: true,
        policyAllowed: false,
        reason: "provider_policy_denied",
    });
    (0, bun_test_1.expect)((0, policy_1.modelSelectionStatus)(config, {
        provider: "company",
        model: "company-disabled",
    })).toMatchObject({
        usable: false,
        reason: "model_disabled",
    });
    // Canonical `provider/model` strings are accepted like model refs.
    (0, bun_test_1.expect)((0, policy_1.modelSelectionStatus)(config, "company/company-stable").selected).toBe(true);
});
(0, bun_test_1.test)("provider policy applies the last matching wildcard rule", function () {
    var rules = [
        { effect: "deny", action: "provider.use", resource: "*" },
        { effect: "allow", action: "provider.use", resource: "company-*" },
        {
            effect: "deny",
            action: "provider.use",
            resource: "company-experimental-*",
        },
    ];
    (0, bun_test_1.expect)((0, policy_1.evaluatePolicy)(rules, "provider.use", "company-stable", "allow")).toBe("allow");
    (0, bun_test_1.expect)((0, policy_1.evaluatePolicy)(rules, "provider.use", "company-experimental-fast", "allow")).toBe("deny");
    (0, bun_test_1.expect)((0, policy_1.evaluatePolicy)(rules, "provider.use", "openai", "allow")).toBe("deny");
});
(0, bun_test_1.test)("a rejected configuration file reports why, not just that it failed", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, resolved, project;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-config-invalid-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        agentModes: {
                            unattended: {
                                approval: "not-a-mode",
                            },
                        },
                    }))];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, service_1.resolveConfig)({
                        workspaceRoot: root,
                        globalPath: (0, node_path_1.join)(root, "absent-global.json"),
                    })];
            case 4:
                resolved = _a.sent();
                project = resolved.sources.find(function (source) { return source.scope === "project"; });
                (0, bun_test_1.expect)(project.applied).toBe(false);
                // The operator has to be able to find the offending field: an ignored file
                // silently drops the profiles and command rules they thought were in effect.
                (0, bun_test_1.expect)(project.diagnostic).toContain("invalid_config:");
                (0, bun_test_1.expect)(project.diagnostic).toContain("approval");
                (0, bun_test_1.expect)(resolved.config.agentModes.unattended).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
