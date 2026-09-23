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
exports.createPluginAdapterMaterializer = createPluginAdapterMaterializer;
function createPluginAdapterMaterializer(registry) {
    var instances = [];
    var closed = false;
    return {
        materialize: function (name, context) {
            return __awaiter(this, void 0, void 0, function () {
                var contribution, ownerID, instance;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (closed)
                                throw new Error("adapter materializer is closed");
                            if (instances.some(function (entry) { return entry.name === name; }))
                                throw new Error("adapter is already materialized: ".concat(name));
                            contribution = registry.contribution("adapters", name);
                            ownerID = registry.ownerOf("adapters", name);
                            if (!contribution || !ownerID)
                                throw new Error("adapter is not available: ".concat(name));
                            return [4 /*yield*/, contribution.create(context)];
                        case 1:
                            instance = _a.sent();
                            if (!instance || typeof instance.dispose !== "function")
                                throw new Error("adapter returned an invalid instance: ".concat(name));
                            instances.push({ name: name, ownerID: ownerID, instance: instance });
                            return [2 /*return*/, instance];
                    }
                });
            });
        },
        active: function () { return instances.map(function (_a) {
            var name = _a.name, ownerID = _a.ownerID;
            return ({ name: name, ownerID: ownerID });
        }); },
        close: function () {
            return __awaiter(this, void 0, void 0, function () {
                var errors, _i, _a, instance, error_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (closed)
                                return [2 /*return*/];
                            closed = true;
                            errors = [];
                            _i = 0, _a = __spreadArray([], instances, true).reverse();
                            _b.label = 1;
                        case 1:
                            if (!(_i < _a.length)) return [3 /*break*/, 6];
                            instance = _a[_i].instance;
                            _b.label = 2;
                        case 2:
                            _b.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, instance.dispose()];
                        case 3:
                            _b.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            error_1 = _b.sent();
                            errors.push(error_1);
                            return [3 /*break*/, 5];
                        case 5:
                            _i++;
                            return [3 /*break*/, 1];
                        case 6:
                            instances.length = 0;
                            if (errors.length)
                                throw new AggregateError(errors, "adapter cleanup failed");
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
