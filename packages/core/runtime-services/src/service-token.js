"use strict";
/**
 * Service tokens — the one shape every cross-module service binding takes.
 *
 * A token is the typed, greppable name of a service. Its string id is the wire
 * name shared with the JSON contracts (manifest `provides`, composition rows),
 * and its phantom type parameter carries the service's TypeScript type to
 * consumers, so `ctx.get(token)` needs no `<T>` cast. Tokens are frozen data:
 * two independent definitions of the same id denote the same service, which is
 * what makes "token.id is the wire name" safe — a duplicated definition is a
 * second spelling of one wire, not a second service.
 *
 * The directory resolves tokens through a narrow bindings seam: the runtime
 * binding is backed by the capability registry's service contributions, a test
 * binding is a plain map, and the primitive knows about neither.
 */
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
exports.ServiceDirectory = void 0;
exports.defineService = defineService;
exports.createTestContext = createTestContext;
/**
 * Composition row namespaces are reserved for the declarative layer; a token id
 * colliding with one would blur "what is bound" (token) with "what is chosen"
 * (row). The reservation is fail-fast at definition time.
 */
var reservedIDPrefixes = [
    "anthelia.",
    "natalia.",
    "plugin:",
    "facet:",
];
/** Defines one service token. One line, in the package that owns the service. */
function defineService(id, meta) {
    if (meta === void 0) { meta = {}; }
    if (!id)
        throw new TypeError("service id must not be empty");
    for (var _i = 0, reservedIDPrefixes_1 = reservedIDPrefixes; _i < reservedIDPrefixes_1.length; _i++) {
        var prefix = reservedIDPrefixes_1[_i];
        if (id.startsWith(prefix))
            throw new TypeError("service id \"".concat(id, "\" uses the reserved prefix \"").concat(prefix, "\""));
    }
    var token = {
        id: id,
        meta: Object.freeze(__assign({}, meta)),
        mock: function (value) { return ({ token: token, value: value }); },
    };
    return Object.freeze(token);
}
/**
 * The typed face over a service bindings.
 *
 * Resolution is call-time, matching the ports semantics it migrates: modules
 * read services when they use them, so construction order never matters and a
 * replaced provider (plugin reload) is picked up by the next read. Activation
 * ordering and eager binding arrive with the composition substrate; until then
 * an eager cache here would freeze reloaded services, which is a bug, not an
 * optimization.
 */
var ServiceDirectory = /** @class */ (function () {
    function ServiceDirectory(bindings) {
        this.bindings = bindings;
    }
    /** Binds `value` to `token`; the disposer unbinds it. */
    ServiceDirectory.prototype.provide = function (token, value) {
        return this.bindings.provide(token.id, value, token.meta.scope);
    };
    /** Resolves `token`, failing loud when nothing provides it. */
    ServiceDirectory.prototype.get = function (token) {
        var value = this.bindings.get(token.id);
        if (value === undefined)
            throw new Error("service \"".concat(token.id, "\" is not provided"));
        return value;
    };
    /**
     * Resolves `token` when present, `undefined` when not. For consumers whose
     * contract tolerates a missing service (an optional plugin's registry), so
     * the tolerance is stated at the resolution instead of a try/catch per call
     * site.
     */
    ServiceDirectory.prototype.getOptional = function (token) {
        return this.bindings.get(token.id);
    };
    return ServiceDirectory;
}());
exports.ServiceDirectory = ServiceDirectory;
/**
 * Builds a test context from mock entries — the standard replacement for
 * hand-rolled port stubs. Entries are heterogeneous; duplicate ids fail fast
 * because two mocks for one wire is a test bug, not a merge.
 */
function createTestContext(entries) {
    var values = new Map();
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var entry = entries_1[_i];
        if (values.has(entry.token.id))
            throw new Error("duplicate test mock for service \"".concat(entry.token.id, "\""));
        values.set(entry.token.id, entry.value);
    }
    return new ServiceDirectory({
        provide: function (id, value) {
            values.set(id, value);
            return function () {
                values.delete(id);
            };
        },
        get: function (id) { return values.get(id); },
    });
}
