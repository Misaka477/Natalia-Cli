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
function fakeRoot() {
    var node = {
        tagName: "DIV",
        children: [],
        innerHTML: "",
        textContent: "",
        replaceChildren: function () {
            node.children = [];
            node.innerHTML = "";
            node.textContent = "";
        },
        appendChild: function (child) {
            node.children.push(child);
            return child;
        },
    };
    return node;
}
function runtimeFixture() {
    var sink;
    var runtime = {
        start: function (next) {
            sink = next;
        },
        cancel: function () { },
    };
    return {
        runtime: runtime,
        emit: function (event) {
            sink === null || sink === void 0 ? void 0 : sink(event);
        },
    };
}
function page(turnID, text) {
    var submitted = {
        type: "turn.submitted",
        id: turnID,
        text: text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "x",
        sessionID: "ses_shared",
    };
    return {
        id: turnID,
        turnID: turnID,
        submitted: submitted,
        rows: [
            {
                id: "".concat(turnID, ":user"),
                turnID: turnID,
                kind: "user",
                event: submitted,
            },
        ],
    };
}
(0, bun_test_1.test)("a late workspace event must not fork an empty session state key", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fixture, host;
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                fixture = runtimeFixture();
                return [4 /*yield*/, (0, src_1.createUiPluginHost)({
                        root: fakeRoot(),
                        runtime: fixture.runtime,
                    })];
            case 1:
                host = _j.sent();
                return [4 /*yield*/, host.load((0, src_1.defineUiPlugin)({
                        id: "shadow-repro",
                        name: "Shadow repro",
                        version: "1",
                        mount: function () { },
                    }))];
            case 2:
                _j.sent();
                // Startup hydrates before the session list knows the workspace id, so the
                // state lands on the `default:` key.
                (_b = (_a = host.projection).activateSession) === null || _b === void 0 ? void 0 : _b.call(_a, "ses_shared");
                (_d = (_c = host.projection).hydrateMessages) === null || _d === void 0 ? void 0 : _d.call(_c, [page("t1", "history")], "newer");
                (0, bun_test_1.expect)(host.projection.getState().natalia.messages.length).toBe(1);
                // Switch away; the session is no longer active.
                (_f = (_e = host.projection).activateSession) === null || _f === void 0 ? void 0 : _f.call(_e, "ses_other");
                // A background event now carries the concrete workspace id. It must join the
                // existing `default:` state rather than fork a second shell key.
                fixture.emit({
                    type: "session.created",
                    sessionID: "ses_shared",
                    workspaceID: "ws_a",
                    title: "Shared",
                });
                // Returning to the session with the concrete workspace id must still show
                // the hydrated history, not an empty shell.
                (_h = (_g = host.projection).activateSession) === null || _h === void 0 ? void 0 : _h.call(_g, "ses_shared", "ws_a");
                (0, bun_test_1.expect)(host.projection.getState().sessionID).toBe("ses_shared");
                (0, bun_test_1.expect)(host.projection.getState().natalia.messages.map(function (message) { return message.text; })).toContain("history");
                return [4 /*yield*/, host.close()];
            case 3:
                _j.sent();
                return [2 /*return*/];
        }
    });
}); });
