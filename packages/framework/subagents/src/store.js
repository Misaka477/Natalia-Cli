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
exports.SubagentStore = void 0;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var MANIFEST = "manifest.json";
var SubagentStore = /** @class */ (function () {
    function SubagentStore(workDir, sessionID) {
        this.sessionID = sessionID;
        if (sessionID) {
            this.dir = (0, node_path_1.resolve)(workDir !== null && workDir !== void 0 ? workDir : ".", ".natalia", "sessions", sessionID, "subagents");
        }
        else {
            this.dir = (0, node_path_1.resolve)(workDir !== null && workDir !== void 0 ? workDir : ".", ".natalia", "subagents");
        }
    }
    SubagentStore.prototype.load = function () {
        return __awaiter(this, void 0, void 0, function () {
            var records, migratedLegacy, content, raw, err_1, repaired;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        migratedLegacy = false;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 5]);
                        return [4 /*yield*/, (0, promises_1.readFile)(this.path(), "utf8")];
                    case 2:
                        content = _a.sent();
                        raw = JSON.parse(content);
                        records = Array.isArray(raw)
                            ? raw
                                .filter(function (r) { return isValidRecord(r); })
                                .map(function (record) {
                                var _a;
                                return (__assign(__assign({}, record), { continuation: (_a = record.continuation) !== null && _a !== void 0 ? _a : 0 }));
                            })
                            : [];
                        return [3 /*break*/, 5];
                    case 3:
                        err_1 = _a.sent();
                        if (err_1.code === "ENOENT")
                            return [2 /*return*/, []];
                        return [4 /*yield*/, this.loadLegacy()];
                    case 4:
                        records = _a.sent();
                        migratedLegacy = records.length > 0;
                        return [3 /*break*/, 5];
                    case 5:
                        repaired = this.backfillParentSession(records);
                        if (!(repaired.changed || migratedLegacy)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.save(repaired.records)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: return [2 /*return*/, repaired.records];
                }
            });
        });
    };
    SubagentStore.prototype.save = function (records) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.mkdir)(this.dir, { recursive: true, mode: 448 })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.writeFile)(this.path(), "".concat(JSON.stringify(records, null, 2), "\n"), {
                                mode: 384,
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SubagentStore.prototype.backfillParentSession = function (records) {
        var _this = this;
        if (!this.sessionID)
            return { records: records, changed: false };
        var changed = false;
        var repaired = records.map(function (record) {
            if (record.parentSessionID)
                return record;
            changed = true;
            return __assign(__assign({}, record), { parentSessionID: _this.sessionID });
        });
        return { records: repaired, changed: changed };
    };
    SubagentStore.prototype.loadLegacy = function () {
        return __awaiter(this, void 0, void 0, function () {
            var files, records, _i, files_1, entry, content, rec, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 8, , 9]);
                        return [4 /*yield*/, (0, promises_1.readdir)(this.dir, { withFileTypes: true })];
                    case 1:
                        files = _c.sent();
                        records = [];
                        _i = 0, files_1 = files;
                        _c.label = 2;
                    case 2:
                        if (!(_i < files_1.length)) return [3 /*break*/, 7];
                        entry = files_1[_i];
                        if (!entry.isFile() ||
                            !entry.name.endsWith(".json") ||
                            entry.name === MANIFEST)
                            return [3 /*break*/, 6];
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(this.dir, entry.name), "utf8")];
                    case 4:
                        content = _c.sent();
                        rec = JSON.parse(content);
                        if (isValidRecord(rec))
                            records.push(rec);
                        return [3 /*break*/, 6];
                    case 5:
                        _a = _c.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [2 /*return*/, records];
                    case 8:
                        _b = _c.sent();
                        return [2 /*return*/, []];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    SubagentStore.prototype.path = function () {
        return (0, node_path_1.join)(this.dir, MANIFEST);
    };
    return SubagentStore;
}());
exports.SubagentStore = SubagentStore;
function isValidRecord(r) {
    if (!r || typeof r !== "object")
        return false;
    var rec = r;
    return (typeof rec.id === "string" &&
        typeof rec.task === "string" &&
        typeof rec.status === "string" &&
        Array.isArray(rec.outputs));
}
