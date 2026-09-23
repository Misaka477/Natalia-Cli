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
exports.wireProviderModel = wireProviderModel;
/**
 * Framework subsystem composition — initialize/framework-provider-model.ts.
 *
 * Provider/model selection and the main agent loop are framework-internal
 * subsystems, not a plugin: this module constructs the controller directly and
 * contributes it as the `provider-model.controller` service plus the
 * `/models` and `/model` commands. The controller reads live host state through
 * the runtime ports, so it needs no recreation on config reload.
 */
var provider_model_1 = require("@anthelia/provider-model");
function wireProviderModel(ctx) {
    var registry = ctx.state.capabilityRegistry;
    var deps = ctx.state.initialize;
    var input = deps.providerModelPluginInput();
    var owner = registry.registerOwner({
        id: "natalia-provider-model",
        name: "Provider Model",
        version: "1.0.0",
        scope: "workspace",
        grants: ["services", "commands"],
    });
    var controller = (0, provider_model_1.createProviderModelController)(input);
    // The controller binds through the service directory; the owner stays for
    // the commands contribution below.
    ctx.state.serviceDirectory.provide(provider_model_1.providerModelController, controller);
    owner.contribute("commands", "models", {
        name: "models",
        title: "List models",
        run: function () {
            return __awaiter(this, void 0, void 0, function () {
                var models;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, input.commands.catalog()];
                        case 1:
                            models = _a.sent();
                            return [2 /*return*/, models.length
                                    ? models
                                        .map(function (model) {
                                        return "".concat(model.id, ": ").concat(model.name, " @ ").concat(model.provider).concat(model.variants.length ? " (".concat(model.variants.join(", "), ")") : "");
                                    })
                                        .join("\n")
                                    : "no selectable models configured"];
                    }
                });
            });
        },
    });
    owner.contribute("commands", "model", {
        name: "model",
        title: "Select model",
        run: function (invocation) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, modelID, variant;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _a = (_b = invocation === null || invocation === void 0 ? void 0 : invocation.args) !== null && _b !== void 0 ? _b : [], modelID = _a[0], variant = _a[1];
                            if (!modelID)
                                throw new Error("model ID is required");
                            if (!(invocation === null || invocation === void 0 ? void 0 : invocation.sessionID))
                                throw new Error("model selection requires a session");
                            return [4 /*yield*/, input.commands.select(invocation.sessionID, modelID, variant)];
                        case 1:
                            _c.sent();
                            return [2 /*return*/, "selected model ".concat(modelID).concat(variant ? " (".concat(variant, ")") : "")];
                    }
                });
            });
        },
    });
    return {
        close: function () {
            void controller.dispose();
        },
    };
}
