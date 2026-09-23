"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryService = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/**
 * The retry service token. The id is the wire name the runtime has always
 * resolved; the token adds the typed face and lives in the package that owns
 * the mechanism, so consumers import the service and its name from one place.
 */
exports.retryService = (0, runtime_services_1.defineService)("retry.service", {
    scope: "workspace",
    capability: "services",
});
