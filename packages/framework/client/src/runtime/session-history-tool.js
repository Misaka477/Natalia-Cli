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
exports.createSessionHistoryTool = createSessionHistoryTool;
var session_store_1 = require("@anthelia/session-store");
var DEFAULT_LIMIT = 40;
var MAX_LIMIT = 200;
/**
 * Model-facing transcript paging.
 *
 * The store's `messages` query pages from the SQLite message index (falling back
 * to the session record), so a model can walk arbitrarily far back through the
 * session without the runtime materialising the whole journal. The response
 * carries `cursor.previous` (older rows) and `cursor.next` (newer rows); passing
 * a cursor back is how the model "turns the page".
 */
function createSessionHistoryTool(ctx) {
    return {
        name: "session_history",
        description: "Read the session transcript as a JSON page of projected turn/message rows. Your own context is a recent window, not the whole session, so use this to retrieve concrete earlier details. The response carries cursor.previous (the page of older rows) and cursor.next (the page of newer rows); pass one of those opaque strings back as `cursor` to turn the page. Keep paging until you find what you need or cursor.previous is absent (you reached the start).",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                cursor: {
                    type: "string",
                    description: "Opaque cursor string from a previous session_history response: use cursor.previous for older rows, cursor.next for newer.",
                },
                limit: {
                    type: "number",
                    description: "Rows per page (1-200, default 40).",
                },
                order: {
                    type: "string",
                    enum: ["asc", "desc"],
                    description: "Page order; omit when passing a cursor (the cursor carries it).",
                },
            },
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var sessionID, exec, attached, session, store, args, limit, page;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _c.sent();
                            sessionID = ((_a = context.sessionID) !== null && _a !== void 0 ? _a : ctx.ports.getSessionID());
                            if (!sessionID)
                                return [2 /*return*/, JSON.stringify({ data: [], cursor: {} })];
                            exec = ctx.ports.getExecutionBySession().get(sessionID);
                            attached = ctx.ports.getSession();
                            session = (_b = exec === null || exec === void 0 ? void 0 : exec.session) !== null && _b !== void 0 ? _b : ((attached === null || attached === void 0 ? void 0 : attached.id) === sessionID ? attached : undefined);
                            store = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                            if (!store || !session)
                                return [2 /*return*/, JSON.stringify({
                                        data: [],
                                        cursor: {},
                                        error: "session_unavailable",
                                    })];
                            args = parsed;
                            limit = typeof args.limit === "number" && Number.isFinite(args.limit)
                                ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(args.limit)))
                                : DEFAULT_LIMIT;
                            return [4 /*yield*/, store.messages(sessionID, session, __assign(__assign({ limit: limit }, (typeof args.cursor === "string" && args.cursor
                                    ? { cursor: args.cursor }
                                    : {})), (args.order === "asc" || args.order === "desc"
                                    ? { order: args.order }
                                    : {})))];
                        case 2:
                            page = _c.sent();
                            return [2 /*return*/, JSON.stringify(page)];
                    }
                });
            });
        },
    };
}
