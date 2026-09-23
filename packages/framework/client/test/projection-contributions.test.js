"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var capability_1 = require("@natalia/capability");
var substrate_1 = require("@anthelia/substrate");
(0, bun_test_1.test)("projection contributions keep title and placement and drop unknown keys", function () {
    var registry = new capability_1.CapabilityRegistry();
    var owner = registry.registerOwner({
        id: "demo.plugin",
        name: "Demo",
        version: "1.0.0",
        scope: "workspace",
        grants: ["projections"],
    });
    owner.contribute("projections", "demo.card", {
        name: "demo.card",
        title: "Demo card",
        placement: "sidebar",
        text: "hello",
        reactNode: {},
    });
    owner.contribute("projections", "bad", {
        name: "bad",
        placement: "sidebar",
    });
    (0, bun_test_1.expect)((0, substrate_1.snapshotProjectionContributions)(registry)).toEqual([
        {
            name: "demo.card",
            title: "Demo card",
            placement: "sidebar",
            text: "hello",
        },
    ]);
});
