"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("runtime config service is exposed by its kernel name", function () {
    (0, bun_test_1.expect)(src_1.RUNTIME_CONFIG_SERVICE).toBe("runtime.config");
});
(0, bun_test_1.test)("the config value contract is the resolved ConfigV3", function () {
    var config = {
        version: 3,
        defaultAgentMode: "ask",
    };
    (0, bun_test_1.expect)(config.version).toBe(3);
});
