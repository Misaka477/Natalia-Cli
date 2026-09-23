"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var model_ref_key_1 = require("../src/model-ref-key");
(0, bun_test_1.test)("agent model wins over session model and default", function () {
    var key = (0, model_ref_key_1.deriveModelRefKey)({
        agent: { model: "agent-model" },
        model: { modelID: "session-model" },
        defaultModel: "default-model",
    });
    (0, bun_test_1.expect)(key).toBe("agent-model");
});
(0, bun_test_1.test)("session model wins over the default when no agent model", function () {
    var key = (0, model_ref_key_1.deriveModelRefKey)({
        agent: {},
        model: { modelID: "session-model" },
        defaultModel: "default-model",
    });
    (0, bun_test_1.expect)(key).toBe("session-model");
});
(0, bun_test_1.test)("the default model is used when nothing is selected", function () {
    var key = (0, model_ref_key_1.deriveModelRefKey)({
        agent: {},
        model: {},
        defaultModel: "default-model",
    });
    (0, bun_test_1.expect)(key).toBe("default-model");
});
(0, bun_test_1.test)("returns undefined when no model can be resolved", function () {
    var key = (0, model_ref_key_1.deriveModelRefKey)({
        agent: {},
        model: {},
        defaultModel: undefined,
    });
    (0, bun_test_1.expect)(key).toBeUndefined();
});
