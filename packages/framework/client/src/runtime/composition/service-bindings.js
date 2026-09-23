"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCapabilityServiceBindings = createCapabilityServiceBindings;
/**
 * Backs a service directory with the capability registry's service bindings.
 *
 * Each provide registers its own owner: the registry's contribution model
 * already carries per-owner disposal, listener notification and precedence
 * resolution, so a service bound through the directory participates in exactly
 * the semantics plugin-provided services always had. The alternative — one
 * long-lived owner for every directory binding — would couple unrelated
 * services' lifetimes for no gain.
 */
function createCapabilityServiceBindings(registry) {
    return {
        provide: function (id, value, scope) {
            var owner = registry.registerOwner({
                id: "service:".concat(id),
                name: id,
                version: "1.0.0",
                scope: scope !== null && scope !== void 0 ? scope : "process",
                grants: ["services"],
            });
            owner.contribute("services", id, value);
            var released = false;
            return function () {
                if (released)
                    return;
                released = true;
                owner.release();
            };
        },
        get: function (id) { return registry.service(id); },
    };
}
