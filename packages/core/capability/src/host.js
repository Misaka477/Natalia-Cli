"use strict";
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
exports.CapabilityHost = void 0;
var node_path_1 = require("node:path");
var errors_1 = require("./errors");
var registry_1 = require("./registry");
/** Adds execution leases to contribution storage without owning business cleanup. */
var CapabilityHost = /** @class */ (function () {
    function CapabilityHost(options) {
        if (options === void 0) { options = {}; }
        var _this = this;
        this.registry = new registry_1.CapabilityRegistry();
        this.leases = new Map();
        this.handles = new Set();
        this.disposed = false;
        this.workspaceRoot = options.workspaceRoot
            ? (0, node_path_1.resolve)(options.workspaceRoot)
            : undefined;
        this.view = {
            list: function () { return _this.list(); },
            has: function (id) { return _this.has(id); },
            scopeOf: function (id) { return _this.scopeOf(id); },
            withGrant: function (grant) { return _this.withGrant(grant); },
            overrides: function () { return _this.overrides(); },
            contributions: function (kind) { return _this.contributions(kind); },
            contribution: function (kind, name) {
                return _this.contribution(kind, name);
            },
            ownerOf: function (kind, name) { return _this.ownerOf(kind, name); },
            service: function (name) { return _this.service(name); },
            services: function () { return _this.services(); },
            onServiceUpdate: function (listener) { return _this.onServiceUpdate(listener); },
        };
    }
    CapabilityHost.prototype.registerOwner = function (registration) {
        var _this = this;
        this.assertActive();
        var inner = this.registry.registerOwner(registration);
        var released = false;
        var handle = Object.freeze({
            id: inner.id,
            contribute: inner.contribute,
            release: function () {
                if (released)
                    return;
                released = true;
                inner.release();
                _this.handles.delete(handle);
            },
        });
        this.handles.add(handle);
        return handle;
    };
    CapabilityHost.prototype.acquireExecutionLease = function (capabilityIDs) {
        var _this = this;
        var _a;
        this.assertActive();
        var requested = __spreadArray([], new Set(typeof capabilityIDs === "string" ? [capabilityIDs] : capabilityIDs), true);
        if (!requested.length)
            throw new errors_1.CapabilityLoadError("", "capability lease requires an id");
        for (var _i = 0, requested_1 = requested; _i < requested_1.length; _i++) {
            var id = requested_1[_i];
            if (!this.registry.has(id))
                throw new errors_1.CapabilityLoadError(id, "capability \"".concat(id, "\" is not visible for execution"));
        }
        for (var _b = 0, requested_2 = requested; _b < requested_2.length; _b++) {
            var id = requested_2[_b];
            this.leases.set(id, ((_a = this.leases.get(id)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        var released = false;
        return {
            capabilityIDs: requested,
            release: function () {
                var _a;
                if (released)
                    return;
                released = true;
                for (var _i = 0, requested_3 = requested; _i < requested_3.length; _i++) {
                    var id = requested_3[_i];
                    var remaining = ((_a = _this.leases.get(id)) !== null && _a !== void 0 ? _a : 1) - 1;
                    if (remaining)
                        _this.leases.set(id, remaining);
                    else
                        _this.leases.delete(id);
                }
            },
        };
    };
    CapabilityHost.prototype.dispose = function () {
        if (this.disposed)
            return;
        this.disposed = true;
        for (var _i = 0, _a = __spreadArray([], this.handles, true).reverse(); _i < _a.length; _i++) {
            var handle = _a[_i];
            handle.release();
        }
    };
    CapabilityHost.prototype.list = function () {
        return this.registry.list();
    };
    CapabilityHost.prototype.has = function (id) {
        return this.registry.has(id);
    };
    CapabilityHost.prototype.scopeOf = function (id) {
        return this.registry.scopeOf(id);
    };
    CapabilityHost.prototype.withGrant = function (grant) {
        return this.registry.withGrant(grant);
    };
    CapabilityHost.prototype.overrides = function () {
        return this.registry.overrides();
    };
    CapabilityHost.prototype.contributions = function (kind) {
        return this.registry.contributions(kind);
    };
    CapabilityHost.prototype.contribution = function (kind, name) {
        return this.registry.contribution(kind, name);
    };
    CapabilityHost.prototype.ownerOf = function (kind, name) {
        return this.registry.ownerOf(kind, name);
    };
    CapabilityHost.prototype.service = function (name) {
        return this.registry.service(name);
    };
    CapabilityHost.prototype.services = function () {
        return this.registry.services();
    };
    CapabilityHost.prototype.onServiceUpdate = function (listener) {
        return this.registry.onServiceUpdate(listener);
    };
    CapabilityHost.prototype.assertActive = function () {
        if (this.disposed)
            throw new errors_1.CapabilityLoadError("", "capability host is disposed");
    };
    return CapabilityHost;
}());
exports.CapabilityHost = CapabilityHost;
