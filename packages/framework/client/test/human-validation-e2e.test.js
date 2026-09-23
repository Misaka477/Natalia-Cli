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
var src_1 = require("../src");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var e2e_harness_1 = require("./e2e-harness");
/**
 * EI Phase 0: the user records a human validation note on a completion card
 * ("用户走 UI 补 humanValidation"). It is durable and the completions read
 * surface merges the latest note onto the card (the user has the last word).
 */
(0, bun_test_1.test)("a user records human validation and it lands on the completion card", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, client, cards, recorded, card, refused;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("human-validation-e2e")];
            case 1:
                root = _d.sent();
                sessionID = "ses_human_validation";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 2:
                _d.sent();
                return [4 /*yield*/, client.recordCompletion({
                        taskID: "task_build",
                        objective: "ship the build check",
                        changeSummary: "added the build check",
                        validations: [
                            { command: "bun run typecheck", result: "passed", safeSummary: "ok" },
                        ],
                    })];
            case 3:
                _d.sent();
                return [4 /*yield*/, client.completions({ sessionID: sessionID })];
            case 4:
                cards = _d.sent();
                (0, bun_test_1.expect)(cards.items.map(function (c) { return c.taskID; })).toContain("task_build");
                (0, bun_test_1.expect)((_a = cards.items.find(function (c) { return c.taskID === "task_build"; })) === null || _a === void 0 ? void 0 : _a.humanValidation).toBeUndefined();
                return [4 /*yield*/, client.recordHumanValidation({ taskID: "task_build", validation: "reviewed by the release owner" }, sessionID)];
            case 5:
                recorded = _d.sent();
                (0, bun_test_1.expect)(recorded.recorded).toBe(true);
                return [4 /*yield*/, client.completions({ sessionID: sessionID })];
            case 6:
                cards = _d.sent();
                card = cards.items.find(function (c) { return c.taskID === "task_build"; });
                // The human note is merged onto the card and overrides the model's.
                (0, bun_test_1.expect)(card === null || card === void 0 ? void 0 : card.humanValidation).toBe("reviewed by the release owner");
                // A second note wins (last write).
                return [4 /*yield*/, client.recordHumanValidation({ taskID: "task_build", validation: "re-reviewed after the fix" }, sessionID)];
            case 7:
                // A second note wins (last write).
                _d.sent();
                return [4 /*yield*/, client.completions({ sessionID: sessionID })];
            case 8:
                cards = _d.sent();
                (0, bun_test_1.expect)((_b = cards.items.find(function (c) { return c.taskID === "task_build"; })) === null || _b === void 0 ? void 0 : _b.humanValidation).toBe("re-reviewed after the fix");
                return [4 /*yield*/, client.recordHumanValidation({ taskID: "task_missing", validation: "n/a" }, sessionID)];
            case 9:
                refused = _d.sent();
                (0, bun_test_1.expect)(refused.recorded).toBe(true); // recorded as a durable note; the card has no task
                return [4 /*yield*/, ((_c = client.dispose) === null || _c === void 0 ? void 0 : _c.call(client))];
            case 10:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
