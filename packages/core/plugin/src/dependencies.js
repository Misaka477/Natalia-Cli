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
exports.resolvePluginDependencies = resolvePluginDependencies;
function resolvePluginDependencies(manifests, active, mounted) {
    if (active === void 0) { active = []; }
    if (mounted === void 0) { mounted = active; }
    var activeByID = new Map(active.map(function (manifest) { return [manifest.id, manifest]; }));
    var mountedByID = new Map(mounted.map(function (manifest) { return [manifest.id, manifest]; }));
    var byID = new Map();
    var denied = [];
    var pending = [];
    var blocked = new Set();
    var deny = function (id, reason) {
        if (blocked.has(id))
            return;
        blocked.add(id);
        denied.push({ id: id, reason: reason });
    };
    var pend = function (id, reason) {
        if (blocked.has(id))
            return;
        blocked.add(id);
        pending.push({ id: id, reason: reason });
    };
    for (var _i = 0, manifests_1 = manifests; _i < manifests_1.length; _i++) {
        var manifest = manifests_1[_i];
        if (activeByID.has(manifest.id)) {
            deny(manifest.id, "plugin already active: \"".concat(manifest.id, "\""));
            continue;
        }
        if (byID.has(manifest.id)) {
            deny(manifest.id, "duplicate plugin id: \"".concat(manifest.id, "\""));
            continue;
        }
        byID.set(manifest.id, manifest);
    }
    var available = new Map(__spreadArray(__spreadArray([], activeByID, true), byID, true));
    var conflictCandidates = new Map(__spreadArray(__spreadArray([], mountedByID, true), byID, true));
    var _loop_1 = function (manifest) {
        if (manifest.apiVersion !== 2 || blocked.has(manifest.id))
            return "continue";
        var conflict = __spreadArray([], conflictCandidates.values(), true).find(function (other) {
            return other.id !== manifest.id &&
                (manifest.conflicts.includes(other.id) ||
                    (other.apiVersion === 2 && other.conflicts.includes(manifest.id)));
        });
        if (conflict) {
            deny(manifest.id, "conflicts with \"".concat(conflict.id, "\""));
            return "continue";
        }
        for (var _d = 0, _e = manifest.dependencies; _d < _e.length; _d++) {
            var dependency = _e[_d];
            var candidate = available.get(dependency.id);
            if (!candidate) {
                if (!dependency.optional)
                    pend(manifest.id, "requires plugin \"".concat(dependency.id, "\" (").concat(dependency.spec, ")"));
                continue;
            }
            if (!satisfiesVersion(candidate.version, dependency.spec)) {
                if (dependency.optional)
                    continue;
                pend(manifest.id, "plugin \"".concat(dependency.id, "\" version ").concat(candidate.version, " does not satisfy ").concat(dependency.spec));
            }
        }
    };
    for (var _a = 0, manifests_2 = manifests; _a < manifests_2.length; _a++) {
        var manifest = manifests_2[_a];
        _loop_1(manifest);
    }
    // A required dependency that cannot activate also blocks every dependent.
    var changed = true;
    while (changed) {
        changed = false;
        for (var _b = 0, manifests_3 = manifests; _b < manifests_3.length; _b++) {
            var manifest = manifests_3[_b];
            if (manifest.apiVersion !== 2 || blocked.has(manifest.id))
                continue;
            var dependency = requiredDependencies(manifest).find(function (item) {
                return blocked.has(item.id);
            });
            if (!dependency)
                continue;
            pend(manifest.id, "requires unavailable plugin \"".concat(dependency.id, "\""));
            changed = true;
        }
    }
    var order = [];
    var remaining = new Set(manifests
        .map(function (manifest) { return manifest.id; })
        .filter(function (id) { return byID.has(id) && !blocked.has(id); }));
    while (remaining.size) {
        var ready = manifests.find(function (manifest) {
            if (!remaining.has(manifest.id))
                return false;
            if (manifest.apiVersion !== 2)
                return true;
            return orderedDependencies(manifest, byID).every(function (dependency) { return !remaining.has(dependency.id); });
        });
        var next = ready !== null && ready !== void 0 ? ready : manifests.find(function (manifest) { return remaining.has(manifest.id); });
        if (!next)
            break;
        if (!ready) {
            for (var _c = 0, remaining_1 = remaining; _c < remaining_1.length; _c++) {
                var id = remaining_1[_c];
                pend(id, "plugin dependency cycle");
            }
            break;
        }
        remaining.delete(next.id);
        order.push(next.id);
    }
    return { order: order, pending: pending, denied: denied };
}
function requiredDependencies(manifest) {
    return manifest.dependencies.filter(function (dependency) { return !dependency.optional; });
}
function orderedDependencies(manifest, candidates) {
    return manifest.dependencies.filter(function (dependency) {
        if (!dependency.optional)
            return true;
        var candidate = candidates.get(dependency.id);
        return !!candidate && satisfiesVersion(candidate.version, dependency.spec);
    });
}
function satisfiesVersion(version, spec) {
    if (spec === "*" || spec === "latest" || spec === "workspace:*")
        return true;
    var normalized = spec.startsWith("workspace:")
        ? spec.slice("workspace:".length)
        : spec;
    var parsed = parseVersion(version);
    if (!parsed)
        return version === normalized;
    if (normalized.startsWith("^")) {
        var base = parseVersion(normalized.slice(1));
        if (!base || compare(parsed, base) < 0)
            return false;
        if (base[0] > 0)
            return parsed[0] === base[0];
        if (base[1] > 0)
            return parsed[0] === 0 && parsed[1] === base[1];
        return parsed[0] === 0 && parsed[1] === 0 && parsed[2] === base[2];
    }
    if (normalized.startsWith("~")) {
        var base = parseVersion(normalized.slice(1));
        return (!!base &&
            parsed[0] === base[0] &&
            parsed[1] === base[1] &&
            compare(parsed, base) >= 0);
    }
    for (var _i = 0, _a = [">=", "<=", ">", "<"]; _i < _a.length; _i++) {
        var operator = _a[_i];
        if (normalized.startsWith(operator)) {
            var base = parseVersion(normalized.slice(operator.length));
            if (!base)
                return false;
            var result = compare(parsed, base);
            return operator === ">="
                ? result >= 0
                : operator === "<="
                    ? result <= 0
                    : operator === ">"
                        ? result > 0
                        : result < 0;
        }
    }
    var exact = parseVersion(normalized);
    return !!exact && compare(parsed, exact) === 0;
}
function parseVersion(value) {
    var match = /^(\d+)\.(\d+)\.(\d+)/u.exec(value.trim());
    return match
        ? [Number(match[1]), Number(match[2]), Number(match[3])]
        : undefined;
}
function compare(left, right) {
    for (var index = 0; index < 3; index += 1) {
        var difference = left[index] - right[index];
        if (difference)
            return difference;
    }
    return 0;
}
