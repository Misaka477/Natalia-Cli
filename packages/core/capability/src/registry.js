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
exports.CapabilityRegistry = void 0;
var errors_1 = require("./errors");
/** Authorized contribution storage. It does not execute owner lifecycle code. */
var CapabilityRegistry = /** @class */ (function () {
    function CapabilityRegistry() {
        this.ownersByID = new Map();
        this.effectiveOwners = new Map();
        this.effectivePrecedence = new Map();
        this.serviceListeners = new Set();
        this.overrideLog = [];
    }
    CapabilityRegistry.prototype.registerOwner = function (registration) {
        var _this = this;
        if (this.ownersByID.has(registration.id))
            throw new errors_1.CapabilityLoadError(registration.id, "capability owner \"".concat(registration.id, "\" is already registered"));
        var record = {
            registration: registration,
            token: {},
            contributions: new Map(),
            released: false,
        };
        this.ownersByID.set(registration.id, record);
        var handle = {
            id: registration.id,
            contribute: function (kind, name, payload) {
                return _this.contribute(record, record.token, kind, name, payload);
            },
            release: function () { return _this.releaseOwner(record, record.token); },
        };
        return Object.freeze(handle);
    };
    CapabilityRegistry.prototype.contribute = function (record, token, kind, name, payload) {
        var _this = this;
        var _a, _b, _c;
        this.assertAuthority(record, token);
        var registration = record.registration;
        if (!registration.grants.includes(kind))
            throw new errors_1.CapabilityLoadError(registration.id, "capability owner \"".concat(registration.id, "\" contributed ").concat(kind, " \"").concat(name, "\" without the \"").concat(kind, "\" grant"));
        if (!name)
            throw new errors_1.CapabilityLoadError(registration.id, "capability owner \"".concat(registration.id, "\" contributed a ").concat(kind, " with no name"));
        var key = contributionKey(kind, name);
        var existing = this.effectiveOwners.get(key);
        var ownExisting = existing === registration.id;
        if (existing !== undefined && !ownExisting) {
            var nextPrecedence = (_a = registration.precedence) !== null && _a !== void 0 ? _a : 0;
            var previousPrecedence = (_b = this.effectivePrecedence.get(key)) !== null && _b !== void 0 ? _b : 0;
            if (nextPrecedence <= previousPrecedence)
                throw new errors_1.CapabilityLoadError(registration.id, "capability owner \"".concat(registration.id, "\" cannot contribute ").concat(kind, " \"").concat(name, "\": already provided by \"").concat(existing, "\" at precedence ").concat(previousPrecedence));
            this.overrideLog.push({
                kind: kind,
                name: name,
                winner: registration.id,
                winnerPrecedence: nextPrecedence,
                loser: existing,
                loserPrecedence: previousPrecedence,
            });
        }
        var contribution = {
            capabilityID: registration.id,
            kind: kind,
            name: name,
            payload: payload,
        };
        record.contributions.set(key, contribution);
        this.effectiveOwners.set(key, registration.id);
        this.effectivePrecedence.set(key, (_c = registration.precedence) !== null && _c !== void 0 ? _c : 0);
        if (kind === "services")
            this.emitServiceUpdate(name, registration.id, existing);
        var active = true;
        return function () {
            if (!active)
                return;
            active = false;
            if (record.released || record.token !== token)
                return;
            if (record.contributions.get(key) !== contribution)
                return;
            record.contributions.delete(key);
            if (_this.effectiveOwners.get(key) !== registration.id)
                return;
            _this.effectiveOwners.delete(key);
            _this.effectivePrecedence.delete(key);
            if (kind === "services")
                _this.emitServiceUpdate(name, undefined);
        };
    };
    CapabilityRegistry.prototype.releaseOwner = function (record, token) {
        if (record.released)
            return;
        this.assertAuthority(record, token);
        record.released = true;
        for (var _i = 0, _a = record.contributions.values(); _i < _a.length; _i++) {
            var contribution = _a[_i];
            var key = contributionKey(contribution.kind, contribution.name);
            if (this.effectiveOwners.get(key) !== record.registration.id)
                continue;
            this.effectiveOwners.delete(key);
            this.effectivePrecedence.delete(key);
            if (contribution.kind === "services")
                this.emitServiceUpdate(contribution.name, undefined);
        }
        record.contributions.clear();
        this.ownersByID.delete(record.registration.id);
    };
    CapabilityRegistry.prototype.assertAuthority = function (record, token) {
        if (record.token !== token ||
            record.released ||
            this.ownersByID.get(record.registration.id) !== record)
            throw new errors_1.CapabilityLoadError(record.registration.id, "capability owner \"".concat(record.registration.id, "\" is released"));
    };
    CapabilityRegistry.prototype.list = function () {
        return __spreadArray([], this.ownersByID.values(), true).map(function (owner) { return owner.registration; });
    };
    CapabilityRegistry.prototype.has = function (id) {
        return this.ownersByID.has(id);
    };
    CapabilityRegistry.prototype.scopeOf = function (id) {
        var _a;
        return (_a = this.ownersByID.get(id)) === null || _a === void 0 ? void 0 : _a.registration.scope;
    };
    CapabilityRegistry.prototype.withGrant = function (grant) {
        return __spreadArray([], this.ownersByID.values(), true).filter(function (owner) { return owner.registration.grants.includes(grant); })
            .map(function (owner) { return owner.registration.id; });
    };
    CapabilityRegistry.prototype.overrides = function () {
        return __spreadArray([], this.overrideLog, true);
    };
    CapabilityRegistry.prototype.contributions = function (kind) {
        var result = [];
        for (var _i = 0, _a = this.ownersByID.values(); _i < _a.length; _i++) {
            var owner = _a[_i];
            for (var _b = 0, _c = owner.contributions.values(); _b < _c.length; _b++) {
                var contribution = _c[_b];
                if (contribution.kind === kind &&
                    this.effectiveOwners.get(contributionKey(contribution.kind, contribution.name)) === contribution.capabilityID)
                    result.push(contribution);
            }
        }
        return result;
    };
    CapabilityRegistry.prototype.contribution = function (kind, name) {
        var _a, _b;
        var ownerID = this.ownerOf(kind, name);
        if (!ownerID)
            return undefined;
        return (_b = (_a = this.ownersByID
            .get(ownerID)) === null || _a === void 0 ? void 0 : _a.contributions.get(contributionKey(kind, name))) === null || _b === void 0 ? void 0 : _b.payload;
    };
    CapabilityRegistry.prototype.ownerOf = function (kind, name) {
        return this.effectiveOwners.get(contributionKey(kind, name));
    };
    CapabilityRegistry.prototype.service = function (name) {
        return this.contribution("services", name);
    };
    CapabilityRegistry.prototype.services = function () {
        return this.contributions("services").map(function (entry) { return entry.name; });
    };
    CapabilityRegistry.prototype.onServiceUpdate = function (listener) {
        var _this = this;
        this.serviceListeners.add(listener);
        return function () { return _this.serviceListeners.delete(listener); };
    };
    CapabilityRegistry.prototype.emitServiceUpdate = function (name, provider, providerBefore) {
        var update = { name: name, provider: provider };
        if (providerBefore !== undefined)
            update.providerBefore = providerBefore;
        for (var _i = 0, _a = this.serviceListeners; _i < _a.length; _i++) {
            var listener = _a[_i];
            try {
                listener(update);
            }
            catch (_b) {
                // One observer cannot block storage updates or other observers.
            }
        }
    };
    return CapabilityRegistry;
}());
exports.CapabilityRegistry = CapabilityRegistry;
function contributionKey(kind, name) {
    return "".concat(kind, "\0").concat(name);
}
