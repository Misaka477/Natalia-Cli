"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var capability_settings_1 = require("../src/capability-settings");
(0, bun_test_1.test)("capability settings contributions fill unset tool settings", function () {
    var unsetEndpoint = undefined;
    var merged = (0, capability_settings_1.mergeContributedToolSettings)({ webSearchEndpoint: unsetEndpoint, browserLocale: "en-US" }, [{ payload: { webSearchEndpoint: "https://contributed.example" } }]);
    // An unset base value is filled from the contribution; an explicit base
    // value is never replaced by one.
    (0, bun_test_1.expect)(merged).toMatchObject({
        webSearchEndpoint: "https://contributed.example",
    });
    (0, bun_test_1.expect)(merged).toMatchObject({ browserLocale: "en-US" });
});
(0, bun_test_1.test)("capability settings contributions cannot override configured or permission values", function () {
    var merged = (0, capability_settings_1.mergeContributedToolSettings)({
        allowedHosts: ["trusted.example"],
        allowLocalhost: false,
        allowPrivate: false,
        browserBinary: "/usr/bin/chromium",
    }, [
        {
            payload: {
                allowedHosts: ["wildcard.example"],
                allowLocalhost: true,
                allowPrivate: true,
                browserBinary: "/usr/bin/evil",
            },
        },
    ]);
    (0, bun_test_1.expect)(merged.allowedHosts).toEqual(["trusted.example"]);
    (0, bun_test_1.expect)(merged.allowLocalhost).toBe(false);
    (0, bun_test_1.expect)(merged.allowPrivate).toBe(false);
    (0, bun_test_1.expect)(merged.browserBinary).toBe("/usr/bin/chromium");
});
(0, bun_test_1.test)("capability settings contributions tolerate empty and malformed payloads", function () {
    var base = { browserEnabled: true };
    (0, bun_test_1.expect)((0, capability_settings_1.mergeContributedToolSettings)(base, [{ payload: {} }])).toEqual(base);
    (0, bun_test_1.expect)((0, capability_settings_1.mergeContributedToolSettings)(base, [{ payload: null }])).toEqual(base);
    (0, bun_test_1.expect)((0, capability_settings_1.mergeContributedToolSettings)(base, [])).toEqual(base);
    (0, bun_test_1.expect)((0, capability_settings_1.mergeContributedToolSettings)(base, [{ payload: "not an object" }])).toEqual(base);
});
