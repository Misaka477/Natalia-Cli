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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * The three-zone discipline, machine-checkable for the runtime zone
 * (architecture decisions §5): the runtime's telemetry belongs to the
 * operation log — leveled, correlated, rotated, redaction-sealed — not to
 * raw console streams.
 *
 * Scope: `packages/framework/client/src` (the runtime zone). The CLI's
 * stdout IS its UI and plugin logs are the plugin's own zone (self-
 * contained) — neither is this guard's business. One allowlist entry:
 * workspace-manager runs before any runtime exists (no service directory
 * to log through) — console there is the documented host-facade boundary
 * until the host data plane (decisions §6 / T4).
 */
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var ROOT = (0, node_path_1.resolve)(import.meta.dir, "../../../..");
var SCAN_DIR = (0, node_path_1.join)(ROOT, "packages/framework/client/src");
var ALLOW = new Set(["workspace-manager.ts"]);
var PATTERN = /console\.(log|warn|error|debug|info|trace|time|timeEnd|dir|table|group|groupEnd|assert|count)\s*\(/;
function walk(dir) {
    return __awaiter(this, void 0, void 0, function () {
        var entries, files, _i, entries_1, entry, full, _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, (0, promises_1.readdir)(dir, { withFileTypes: true })];
                case 1:
                    entries = _d.sent();
                    files = [];
                    _i = 0, entries_1 = entries;
                    _d.label = 2;
                case 2:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 6];
                    entry = entries_1[_i];
                    full = (0, node_path_1.join)(dir, entry.name);
                    if (!entry.isDirectory()) return [3 /*break*/, 4];
                    _b = (_a = files.push).apply;
                    _c = [files];
                    return [4 /*yield*/, walk(full)];
                case 3:
                    _b.apply(_a, _c.concat([(_d.sent())]));
                    return [3 /*break*/, 5];
                case 4:
                    if (entry.name.endsWith(".ts"))
                        files.push(full);
                    _d.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: return [2 /*return*/, files];
            }
        });
    });
}
var violations = [];
var _loop_1 = function (file) {
    var name_1 = (_a = file.split("/").pop()) !== null && _a !== void 0 ? _a : "";
    if (ALLOW.has(name_1))
        return "continue";
    var lines = (await (0, promises_1.readFile)(file, "utf8")).split("\n");
    lines.forEach(function (line, index) {
        if (PATTERN.test(line))
            violations.push("".concat(file.slice(ROOT.length + 1), ":").concat(index + 1, ": ").concat(line.trim().slice(0, 120)));
    });
};
for (var _i = 0, _b = await walk(SCAN_DIR); _i < _b.length; _i++) {
    var file = _b[_i];
    _loop_1(file);
}
if (violations.length > 0) {
    console.error("console guard: runtime-zone console use found (use the operation log):");
    for (var _c = 0, violations_1 = violations; _c < violations_1.length; _c++) {
        var violation = violations_1[_c];
        console.error("  " + violation);
    }
    console.error("allowed only in workspace-manager.ts (pre-runtime host facade, decisions §6)");
    process.exit(1);
}
console.log("console guard: ".concat(SCAN_DIR.slice(ROOT.length + 1), " clean (allowlist: ").concat(__spreadArray([], ALLOW, true).join(", ") || "none", ")"));
