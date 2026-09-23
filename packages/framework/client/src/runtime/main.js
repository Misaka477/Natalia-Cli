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
Object.defineProperty(exports, "__esModule", { value: true });
exports.terminalInputRisk = exports.terminalApprovalScope = exports.EGRESS_ADVISORY = void 0;
exports.createRealRuntimeClient = createRealRuntimeClient;
var runtime_services_1 = require("@natalia/runtime-services");
Object.defineProperty(exports, "terminalApprovalScope", { enumerable: true, get: function () { return runtime_services_1.terminalApprovalScope; } });
Object.defineProperty(exports, "terminalInputRisk", { enumerable: true, get: function () { return runtime_services_1.terminalInputRisk; } });
var runtime_1 = require("@natalia/runtime");
var client_surface_1 = require("./client-surface");
var state_1 = require("./composition/state");
var foundation_1 = require("./composition/foundation");
var features_1 = require("./composition/features");
var services_1 = require("./composition/services");
var execution_1 = require("./composition/execution");
var initialize_1 = require("./composition/initialize");
var commands_1 = require("./commands");
Object.defineProperty(exports, "EGRESS_ADVISORY", { enumerable: true, get: function () { return commands_1.EGRESS_ADVISORY; } });
/** Explicit composition root for the production runtime client. */
function createRealRuntimeClient(options) {
    if (options === void 0) { options = {}; }
    var ctx = (0, state_1.createCompositionContext)(options);
    // Periodic RSS/heap samples when NATALIA_MEMORY_TRACE=1 (no-op otherwise).
    (0, runtime_1.startMemoryTraceSampler)();
    (0, foundation_1.wireFoundation)(ctx);
    var features = (0, features_1.wireFeatures)(ctx, options);
    var services = (0, services_1.wireServices)(ctx, options);
    var execution = (0, execution_1.wireExecution)(ctx, options);
    (0, initialize_1.wireInitialize)(ctx, options, __assign(__assign({}, features), execution), createRealRuntimeClient);
    ctx.ports.ensureReady = services.ensureReady;
    return (0, client_surface_1.createClientSurface)(ctx, options);
}
