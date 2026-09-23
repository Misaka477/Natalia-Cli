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
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverPluginManifests = discoverPluginManifests;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var manifest_1 = require("./manifest");
function discoverPluginManifests(root_1) {
    return __awaiter(this, arguments, void 0, function (root, options) {
        var dir, entries, manifests, directories, modulesDir, modules, _i, modules_1, entry, packagePath, _a, _b, scoped, _c, directories_1, directory, path, _d, _e, _f, _g, _h, _j, error_1;
        var _k;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    dir = (0, node_path_1.resolve)(root);
                    return [4 /*yield*/, (0, promises_1.readdir)(dir, { withFileTypes: true }).catch(function () { return []; })];
                case 1:
                    entries = _l.sent();
                    manifests = [];
                    directories = __spreadArray([
                        dir
                    ], entries
                        .filter(function (entry) { return entry.isDirectory(); })
                        .map(function (entry) { return (0, node_path_1.join)(dir, entry.name); }), true);
                    if (!(options.nodeModules !== false)) return [3 /*break*/, 9];
                    modulesDir = (0, node_path_1.join)(dir, "node_modules");
                    return [4 /*yield*/, (0, promises_1.readdir)(modulesDir, { withFileTypes: true }).catch(function () { return []; })];
                case 2:
                    modules = _l.sent();
                    _i = 0, modules_1 = modules;
                    _l.label = 3;
                case 3:
                    if (!(_i < modules_1.length)) return [3 /*break*/, 9];
                    entry = modules_1[_i];
                    if (!entry.isDirectory())
                        return [3 /*break*/, 8];
                    packagePath = (0, node_path_1.join)(modulesDir, entry.name);
                    if (!!entry.name.startsWith("@")) return [3 /*break*/, 4];
                    directories.push(packagePath);
                    return [3 /*break*/, 8];
                case 4:
                    _a = 0;
                    return [4 /*yield*/, (0, promises_1.readdir)(packagePath, {
                            withFileTypes: true,
                        }).catch(function () { return []; })];
                case 5:
                    _b = _l.sent();
                    _l.label = 6;
                case 6:
                    if (!(_a < _b.length)) return [3 /*break*/, 8];
                    scoped = _b[_a];
                    if (scoped.isDirectory())
                        directories.push((0, node_path_1.join)(packagePath, scoped.name));
                    _l.label = 7;
                case 7:
                    _a++;
                    return [3 /*break*/, 6];
                case 8:
                    _i++;
                    return [3 /*break*/, 3];
                case 9:
                    _c = 0, directories_1 = directories;
                    _l.label = 10;
                case 10:
                    if (!(_c < directories_1.length)) return [3 /*break*/, 15];
                    directory = directories_1[_c];
                    path = (0, node_path_1.join)(directory, "natalia.plugin.json");
                    _l.label = 11;
                case 11:
                    _l.trys.push([11, 13, , 14]);
                    _e = (_d = manifests).push;
                    _k = {};
                    _g = (_f = manifest_1.pluginManifestSchema).parse;
                    _j = (_h = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 12:
                    _e.apply(_d, [(_k.manifest = _g.apply(_f, [_j.apply(_h, [_l.sent()])]),
                            _k.path = path,
                            _k)]);
                    return [3 /*break*/, 14];
                case 13:
                    error_1 = _l.sent();
                    if (error_1.code !== "ENOENT")
                        throw error_1;
                    return [3 /*break*/, 14];
                case 14:
                    _c++;
                    return [3 /*break*/, 10];
                case 15: return [2 /*return*/, manifests];
            }
        });
    });
}
