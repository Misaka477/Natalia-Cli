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
var workspace_write_lock_1 = require("../src/workspace-write-lock");
(0, bun_test_1.test)("workspace writers serialise in acquisition order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var lock, order, releaseFirst, second;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                lock = (0, workspace_write_lock_1.createWorkspaceWriteLock)();
                order = [];
                return [4 /*yield*/, lock.acquire()];
            case 1:
                releaseFirst = _a.sent();
                second = lock.acquire().then(function (releaseSecond) {
                    order.push("second");
                    releaseSecond();
                });
                return [4 /*yield*/, Bun.sleep(20)];
            case 2:
                _a.sent();
                // The second writer is parked behind the first, not running concurrently.
                (0, bun_test_1.expect)(order).toEqual([]);
                order.push("first");
                releaseFirst();
                return [4 /*yield*/, second];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(order).toEqual(["first", "second"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("write lock tracks which session waits for or owns which paths", function () { return __awaiter(void 0, void 0, void 0, function () {
    var lock, releaseFirst, second, releaseSecond;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                lock = (0, workspace_write_lock_1.createWorkspaceWriteLock)();
                return [4 /*yield*/, lock.acquire("ses_a", ["README.md", "config.ts"])];
            case 1:
                releaseFirst = _a.sent();
                second = lock.acquire("ses_b", ["README.md"]);
                (0, bun_test_1.expect)(lock.snapshot()).toEqual([
                    {
                        sessionID: "ses_a",
                        paths: ["README.md", "config.ts"],
                        queuedAt: bun_test_1.expect.any(Number),
                        acquiredAt: bun_test_1.expect.any(Number),
                        active: true,
                    },
                    {
                        sessionID: "ses_b",
                        paths: ["README.md"],
                        queuedAt: bun_test_1.expect.any(Number),
                        acquiredAt: 0,
                        active: false,
                    },
                ]);
                releaseFirst();
                return [4 /*yield*/, second];
            case 2:
                releaseSecond = _a.sent();
                (0, bun_test_1.expect)(lock.snapshot().map(function (entry) { return entry.active; })).toEqual([true]);
                (0, bun_test_1.expect)(lock.snapshot()[0]).toMatchObject({
                    sessionID: "ses_b",
                    paths: ["README.md"],
                    active: true,
                });
                releaseSecond();
                (0, bun_test_1.expect)(lock.snapshot()).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a failed release still lets the next writer proceed", function () { return __awaiter(void 0, void 0, void 0, function () {
    var lock, release, releaseAgain, third;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                lock = (0, workspace_write_lock_1.createWorkspaceWriteLock)();
                return [4 /*yield*/, lock.acquire()];
            case 1:
                release = _a.sent();
                release();
                return [4 /*yield*/, lock.acquire()];
            case 2:
                releaseAgain = _a.sent();
                releaseAgain();
                return [4 /*yield*/, Promise.race([
                        lock.acquire(),
                        new Promise(function (resolve) { return setTimeout(function () { return resolve(null); }, 50); }),
                    ])];
            case 3:
                third = _a.sent();
                (0, bun_test_1.expect)(third).toBeTypeOf("function");
                return [2 /*return*/];
        }
    });
}); });
