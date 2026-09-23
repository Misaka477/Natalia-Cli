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
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
function registration(id, overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: id, name: id, version: "1.0.0", scope: "workspace", grants: ["tools"] }, overrides);
}
(0, bun_test_1.test)("an opaque owner handle authorizes contributions", function () {
    var _a;
    var registry = new src_1.CapabilityRegistry();
    var owner = registry.registerOwner(registration("cap.a"));
    owner.contribute("tools", "read", { run: function () { return "ok"; } });
    (0, bun_test_1.expect)(registry.ownerOf("tools", "read")).toBe("cap.a");
    (0, bun_test_1.expect)((_a = registry.contribution("tools", "read")) === null || _a === void 0 ? void 0 : _a.run()).toBe("ok");
    (0, bun_test_1.expect)(registry.scopeOf("cap.a")).toBe("workspace");
});
(0, bun_test_1.test)("authorization and names are checked at storage", function () {
    var registry = new src_1.CapabilityRegistry();
    var owner = registry.registerOwner(registration("cap.a"));
    (0, bun_test_1.expect)(function () { return owner.contribute("commands", "danger", {}); }).toThrow(/without the "commands" grant/u);
    (0, bun_test_1.expect)(function () { return owner.contribute("tools", "", {}); }).toThrow(/with no name/u);
});
(0, bun_test_1.test)("owner and individual contribution release are idempotent", function () {
    var registry = new src_1.CapabilityRegistry();
    var owner = registry.registerOwner(registration("cap.a"));
    var release = owner.contribute("tools", "read", 1);
    release();
    release();
    (0, bun_test_1.expect)(registry.contribution("tools", "read")).toBeUndefined();
    owner.contribute("tools", "write", 2);
    owner.release();
    owner.release();
    (0, bun_test_1.expect)(registry.has("cap.a")).toBe(false);
    (0, bun_test_1.expect)(registry.contributions("tools")).toEqual([]);
    (0, bun_test_1.expect)(function () { return owner.contribute("tools", "late", 3); }).toThrow(/is released/u);
});
(0, bun_test_1.test)("a forged structural handle cannot write owner storage", function () {
    var registry = new src_1.CapabilityRegistry();
    registry.registerOwner(registration("cap.a"));
    var forged = {
        id: "cap.a",
        contribute: function (_kind, _name, _payload) { return function () { }; },
        release: function () { },
    };
    forged.contribute("tools", "forged", 1);
    (0, bun_test_1.expect)(registry.ownerOf("tools", "forged")).toBeUndefined();
});
(0, bun_test_1.test)("duplicate owners and equal precedence contributions are refused", function () {
    var registry = new src_1.CapabilityRegistry();
    var first = registry.registerOwner(registration("cap.a"));
    first.contribute("tools", "shared", "a");
    (0, bun_test_1.expect)(function () { return registry.registerOwner(registration("cap.a")); }).toThrow(src_1.CapabilityLoadError);
    var second = registry.registerOwner(registration("cap.b"));
    (0, bun_test_1.expect)(function () { return second.contribute("tools", "shared", "b"); }).toThrow(/already provided/u);
});
(0, bun_test_1.test)("higher precedence replaces and records the effective contribution", function () {
    var registry = new src_1.CapabilityRegistry();
    registry
        .registerOwner(registration("base"))
        .contribute("tools", "shared", "base");
    var high = registry.registerOwner(registration("high", { precedence: 10 }));
    high.contribute("tools", "shared", "high");
    (0, bun_test_1.expect)(registry.contribution("tools", "shared")).toBe("high");
    (0, bun_test_1.expect)(registry.overrides()).toEqual([
        {
            kind: "tools",
            name: "shared",
            winner: "high",
            winnerPrecedence: 10,
            loser: "base",
            loserPrecedence: 0,
        },
    ]);
});
(0, bun_test_1.test)("service provide, update, and owner release notify consumers", function () {
    var registry = new src_1.CapabilityRegistry();
    var updates = [];
    registry.onServiceUpdate(function (update) { return updates.push(update); });
    var owner = registry.registerOwner(registration("store", { grants: ["services"] }));
    owner.contribute("services", "store", 1);
    owner.contribute("services", "store", 2);
    (0, bun_test_1.expect)(registry.service("store")).toBe(2);
    (0, bun_test_1.expect)(registry.contributions("services")).toHaveLength(1);
    owner.release();
    (0, bun_test_1.expect)(registry.service("store")).toBeUndefined();
    (0, bun_test_1.expect)(updates).toEqual([
        { name: "store", provider: "store" },
        { name: "store", provider: "store", providerBefore: "store" },
        { name: "store", provider: undefined },
    ]);
});
