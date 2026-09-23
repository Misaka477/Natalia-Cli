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
var collab_1 = require("@natalia/collab");
function tool(name) {
    return {
        name: name,
        description: name,
        requiresApproval: false,
        parameters: { type: "object", properties: {}, additionalProperties: false },
        execute: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, "ok"];
                });
            });
        },
    };
}
(0, bun_test_1.test)("Nia exposes run_shell for verification while Navi does not", function () {
    var readFile = tool("read_file");
    var runShell = tool("run_shell");
    var ctx = {
        state: {
            tools: new Map([
                [readFile.name, readFile],
                [runShell.name, runShell],
            ]),
        },
        ports: {
            getActiveExec: function () { return undefined; },
            currentSessionSnapshot: function () { return undefined; },
            createCollabChatTool: function () { return tool("collab_chat"); },
        },
    };
    var chatTools = (0, collab_1.createChatTools)(ctx);
    (0, bun_test_1.expect)(chatTools.niaChatTools().map(function (item) { return item.name; })).toContain("run_shell");
    (0, bun_test_1.expect)(chatTools.naviChatTools().map(function (item) { return item.name; })).not.toContain("run_shell");
});
(0, bun_test_1.test)("Nia run_shell wrapper enforces the read-only policy", function () { return __awaiter(void 0, void 0, void 0, function () {
    var runShell, executed, ctx, chatTools, niaShell, context;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                runShell = tool("run_shell");
                executed = 0;
                runShell.execute = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        executed += 1;
                        return [2 /*return*/, "ok"];
                    });
                }); };
                ctx = {
                    state: {
                        tools: new Map([[runShell.name, runShell]]),
                    },
                    ports: {
                        getActiveExec: function () { return undefined; },
                        currentSessionSnapshot: function () { return undefined; },
                        createCollabChatTool: function () { return tool("collab_chat"); },
                    },
                };
                chatTools = (0, collab_1.createChatTools)(ctx);
                niaShell = chatTools
                    .niaChatTools()
                    .find(function (item) { return item.name === "run_shell"; });
                context = { workspaceRoot: process.cwd() };
                return [4 /*yield*/, (0, bun_test_1.expect)(niaShell.execute({ command: "git commit -m test" }, context)).rejects.toThrow(/read-only/u)];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(executed).toBe(0);
                return [4 /*yield*/, (0, bun_test_1.expect)(niaShell.execute({ command: "git status" }, context)).resolves.toBe("ok")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(executed).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
