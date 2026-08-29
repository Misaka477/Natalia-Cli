"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var identity_1 = require("../src/identity");
(0, bun_test_1.test)("the example web UI plugin contributes Main and Chat panels", function () {
    (0, bun_test_1.expect)(identity_1.EXAMPLE_WEB_UI_PLUGIN_ID).toBe("natalia.ui.web.example");
    (0, bun_test_1.expect)(identity_1.EXAMPLE_WEB_UI_PANELS.map(function (panel) { return panel.id; })).toEqual([
        "main",
        "chat",
    ]);
    (0, bun_test_1.expect)(identity_1.EXAMPLE_WEB_UI_PANELS.map(function (panel) { return panel.title; })).toEqual([
        "Main",
        "Chat",
    ]);
});
