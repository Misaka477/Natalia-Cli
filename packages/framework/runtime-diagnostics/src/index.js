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
exports.createRuntimeDiagnostics = createRuntimeDiagnostics;
function createRuntimeDiagnostics(options) {
    var _a, _b, _c, _d;
    var log = options.log.component("invariants");
    var enabled = (_a = options.enabled) !== null && _a !== void 0 ? _a : true;
    var allow = (_b = options.owners) === null || _b === void 0 ? void 0 : _b.allow;
    var block = (_d = (_c = options.owners) === null || _c === void 0 ? void 0 : _c.block) !== null && _d !== void 0 ? _d : [];
    var timer;
    var state = {
        enabled: enabled,
        ticks: 0,
        findings: 0,
        byInvariant: {},
    };
    /** key -> the payload that opened it: only transitions reach the journal. */
    var open = new Map();
    var findingKey = function (finding) {
        return "".concat(finding.owner, "|").concat(finding.invariant, "|").concat(finding.code, "|").concat(finding.detail);
    };
    function eligible(owner) {
        if (block.includes(owner))
            return false;
        if (allow && !allow.includes(owner))
            return false;
        return true;
    }
    return {
        tick: function (input) {
            var _a, _b, _c, _d;
            var _e, _f;
            state.ticks += 1;
            state.lastTickAt = new Date().toISOString();
            var findings = [];
            if (!enabled)
                return findings;
            var seen = new Set();
            for (var _i = 0, _g = options.sets; _i < _g.length; _i++) {
                var set = _g[_i];
                if (!eligible(set.owner))
                    continue;
                for (var _h = 0, _j = set.invariants; _h < _j.length; _h++) {
                    var invariant = _j[_h];
                    var violations = void 0;
                    try {
                        violations = invariant.check(input);
                    }
                    catch (error) {
                        // A crashing check is itself a diagnostic failure — recorded,
                        // never allowed to take the tick (or the runtime) down.
                        violations = [
                            {
                                code: "".concat(invariant.id, ".checker_crashed"),
                                detail: error instanceof Error ? error.message : String(error),
                            },
                        ];
                    }
                    for (var _k = 0, violations_1 = violations; _k < violations_1.length; _k++) {
                        var violation = violations_1[_k];
                        var finding = __assign({ at: new Date().toISOString(), owner: set.owner, invariant: invariant.id, code: violation.code, detail: violation.detail }, (violation.sessionID
                            ? { sessionID: violation.sessionID }
                            : {}));
                        findings.push(finding);
                        var key = findingKey(finding);
                        seen.add(key);
                        if (!open.has(key)) {
                            open.set(key, finding);
                            (_a = options.publish) === null || _a === void 0 ? void 0 : _a.call(options, __assign({ type: "invariant.violation", at: finding.at, owner: finding.owner, invariant: finding.invariant, code: finding.code, detail: finding.detail }, (finding.sessionID
                                ? { sessionID: finding.sessionID }
                                : {})));
                        }
                        state.findings += 1;
                        var owned = ((_b = (_e = state.byInvariant)[_f = set.owner]) !== null && _b !== void 0 ? _b : (_e[_f] = {}));
                        owned[invariant.id] = ((_c = owned[invariant.id]) !== null && _c !== void 0 ? _c : 0) + 1;
                        log.error("invariant violated", {
                            owner: set.owner,
                            invariant: invariant.id,
                            code: violation.code,
                            detail: violation.detail,
                        });
                    }
                }
            }
            for (var _l = 0, _m = __spreadArray([], open, true); _l < _m.length; _l++) {
                var _o = _m[_l], key = _o[0], finding = _o[1];
                if (seen.has(key))
                    continue;
                open.delete(key);
                (_d = options.publish) === null || _d === void 0 ? void 0 : _d.call(options, __assign({ type: "invariant.resolved", at: new Date().toISOString(), owner: finding.owner, invariant: finding.invariant, code: finding.code, detail: finding.detail }, (finding.sessionID
                    ? { sessionID: finding.sessionID }
                    : {})));
            }
            return findings;
        },
        setEnabled: function (next) {
            enabled = next;
            state.enabled = next;
            log.info("global switch", { enabled: next });
        },
        setOwnerFilter: function (filter) {
            var _a;
            allow = filter.allow;
            block = (_a = filter.block) !== null && _a !== void 0 ? _a : [];
            log.info("owner filter", {
                allow: allow ? __spreadArray([], allow, true) : "all",
                block: __spreadArray([], block, true),
            });
        },
        state: function () { return (__assign(__assign({}, state), { byInvariant: structuredClone(state.byInvariant) })); },
        start: function (intervalMs, collect) {
            var _this = this;
            var _a;
            this.stop();
            timer = setInterval(function () {
                void _this.tick(collect());
            }, intervalMs);
            (_a = timer.unref) === null || _a === void 0 ? void 0 : _a.call(timer);
        },
        stop: function () {
            if (timer)
                clearInterval(timer);
            timer = undefined;
        },
    };
}
// The SERVICE TOKEN lives in @natalia/runtime-services (the boundary-token
// rule from P1 — and structurally required: runtime-services already
// depends on framework/session, so a token here would close a composite
// reference cycle session -> this package -> runtime-services -> session).
