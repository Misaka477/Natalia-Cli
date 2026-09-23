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
exports.callRuntimeRPC = callRuntimeRPC;
/**
 * Caller side of the runtime RPC protocol. An external consumer needs only this
 * file: it speaks to a runtime over HTTP and never hosts one. The dispatcher
 * that answers these calls lives in `rpc.ts` behind the `./host` entry point,
 * so importing the protocol does not pull in a server.
 */
var contracts_1 = require("@natalia/contracts");
function callRuntimeRPC(input) {
    return __awaiter(this, void 0, void 0, function () {
        var response, body;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, ((_a = input.fetch) !== null && _a !== void 0 ? _a : globalThis.fetch)(new URL("/rpc", input.url), {
                        method: "POST",
                        headers: __assign({ "content-type": "application/json" }, (input.token ? { authorization: "Bearer ".concat(input.token) } : {})),
                        body: JSON.stringify({
                            jsonrpc: "2.0",
                            id: 1,
                            method: input.method,
                            params: input.params,
                        }),
                        signal: input.signal,
                    })];
                case 1:
                    response = _b.sent();
                    return [4 /*yield*/, response.json()];
                case 2:
                    body = (_b.sent());
                    // The failure is rethrown with its code and data intact. Throwing a plain
                    // Error here would put the caller straight back to matching message text,
                    // which is the thing the server side stopped doing.
                    if (body.error)
                        throw new contracts_1.RuntimeRPCError({
                            code: body.error.code,
                            message: body.error.message,
                            method: input.method,
                            data: body.error.data,
                        });
                    if (!response.ok)
                        throw new Error("runtime RPC failed with HTTP ".concat(response.status));
                    return [2 /*return*/, body.result];
            }
        });
    });
}
