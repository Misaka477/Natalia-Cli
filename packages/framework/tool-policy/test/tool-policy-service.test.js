"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var src_2 = require("../src");
(0, bun_test_1.test)("tool policy service owns the unique policy funnel", function () {
    var service = (0, src_2.createToolPolicyService)();
    (0, bun_test_1.expect)(src_1.toolPolicy.id).toBe("tool.policy");
    (0, bun_test_1.expect)(service.createExecutionPipeline).toBeTypeOf("function");
    (0, bun_test_1.expect)(service.createHookLayer).toBeTypeOf("function");
    (0, bun_test_1.expect)(service.evaluatePermissionRules).toBeTypeOf("function");
    (0, bun_test_1.expect)(service.workspaceWritePathForTool).toBeTypeOf("function");
    (0, bun_test_1.expect)(service.workspaceWritePathsForTool).toBeTypeOf("function");
    (0, bun_test_1.expect)(service.commandTextForTool).toBeTypeOf("function");
    (0, bun_test_1.expect)(service.createExecutionPipeline()).toBeDefined();
});
