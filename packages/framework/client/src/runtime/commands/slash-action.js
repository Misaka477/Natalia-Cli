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
exports.tryActionSlashCommand = tryActionSlashCommand;
function tryActionSlashCommand(deps) {
    return __awaiter(this, void 0, void 0, function () {
        var trimmed, commandExec, agents, name_1, agent, waiters, _i, waiters_1, resolveWaiter;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            trimmed = deps.text.trim();
            commandExec = deps.commandExec;
            if (trimmed === "/agents") {
                agents = (_b = (_a = deps.agentRegistry) === null || _a === void 0 ? void 0 : _a.selectable()) !== null && _b !== void 0 ? _b : [];
                deps.publish({
                    type: "content.delta",
                    id: deps.id,
                    text: agents.length
                        ? agents
                            .map(function (agent) { return "".concat(agent.name, ": ").concat(agent.description); })
                            .join("\n")
                        : "no selectable agents configured",
                });
                deps.publish({ type: "content.done", id: deps.id });
                deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
                return [2 /*return*/, true];
            }
            if (trimmed.startsWith("/agent ")) {
                name_1 = trimmed.slice("/agent ".length).trim();
                if (!name_1)
                    throw new Error("agent name is required");
                agent = (_c = deps.agentRegistry) === null || _c === void 0 ? void 0 : _c.select(name_1);
                if (!agent)
                    throw new Error("agent not found: ".concat(name_1));
                commandExec.selectedAgent = agent;
                if (commandExec === deps.getActiveExec()) {
                    deps.applyAgentPolicy();
                }
                deps.applyAgentProvider(commandExec);
                deps.publish({ type: "agent.selection", name: agent.name, pending: false });
                deps.publish({
                    type: "content.delta",
                    id: deps.id,
                    text: "selected agent ".concat(agent.name),
                });
                deps.publish({ type: "content.done", id: deps.id });
                deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
                return [2 /*return*/, true];
            }
            if (trimmed === "/pause") {
                commandExec.paused = true;
                if (commandExec === deps.getActiveExec())
                    deps.setPaused(true);
                deps.publish({ type: "turn.paused", id: deps.id, reason: "slash command" });
                deps.publish({
                    type: "content.delta",
                    id: deps.id,
                    text: "runtime paused",
                });
                deps.publish({ type: "content.done", id: deps.id });
                deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
                return [2 /*return*/, true];
            }
            if (trimmed === "/resume") {
                commandExec.paused = false;
                if (commandExec === deps.getActiveExec())
                    deps.setPaused(false);
                waiters = commandExec.pauseWaiters;
                commandExec.pauseWaiters = [];
                for (_i = 0, waiters_1 = waiters; _i < waiters_1.length; _i++) {
                    resolveWaiter = waiters_1[_i];
                    resolveWaiter();
                }
                deps.publish({ type: "turn.resumed", id: deps.id });
                deps.publish({
                    type: "content.delta",
                    id: deps.id,
                    text: "runtime resumed",
                });
                deps.publish({ type: "content.done", id: deps.id });
                deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
                return [2 /*return*/, true];
            }
            return [2 /*return*/, false];
        });
    });
}
