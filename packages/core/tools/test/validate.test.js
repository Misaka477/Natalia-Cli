"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("nested array items and object properties report a readable path", function () {
    var schema = {
        type: "object",
        properties: {
            items: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        status: { type: "string", enum: ["pending", "done"] },
                        count: { type: "integer", minimum: 1 },
                    },
                    required: ["status"],
                },
            },
        },
        required: ["items"],
    };
    (0, bun_test_1.expect)((0, src_1.validateToolParameters)(schema, {
        items: [{ status: "pending", count: 2 }],
    })).toEqual([]);
    (0, bun_test_1.expect)((0, src_1.validateToolParameters)(schema, {
        items: [{ status: "bad" }, { count: 0 }],
    })).toEqual([
        { path: "items[0].status", message: "expected one of: pending, done" },
        { path: "items[1].status", message: 'missing required property "status"' },
        { path: "items[1].count", message: "must be at least 1" },
    ]);
});
