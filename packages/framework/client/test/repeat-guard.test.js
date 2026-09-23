"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var repeat_guard_1 = require("../src/runtime/tool-execution/repeat-guard");
(0, bun_test_1.test)("repeat guard blocks the 11th identical call inside the window", function () {
    var store = new Map();
    var key = (0, repeat_guard_1.repeatKey)("run_shell", JSON.stringify({ command: "ls" }), "/ws");
    var last = { count: 0, blocked: false };
    for (var i = 0; i <= repeat_guard_1.REPEAT_MAX; i++) {
        last = (0, repeat_guard_1.recordRepeat)(store, key, 1000 + i * 1000);
    }
    (0, bun_test_1.expect)(last.count).toBe(repeat_guard_1.REPEAT_MAX + 1);
    (0, bun_test_1.expect)(last.blocked).toBe(true);
});
(0, bun_test_1.test)("repeat guard forgets calls outside the sliding window", function () {
    var store = new Map();
    var key = (0, repeat_guard_1.repeatKey)("run_shell", "pwd", "/ws");
    for (var i = 0; i < repeat_guard_1.REPEAT_MAX; i++)
        (0, repeat_guard_1.recordRepeat)(store, key, 1000 + i * 1000);
    var afterWindow = (0, repeat_guard_1.recordRepeat)(store, key, 1000 + repeat_guard_1.REPEAT_WINDOW_MS + 10000);
    (0, bun_test_1.expect)(afterWindow.blocked).toBe(false);
    (0, bun_test_1.expect)(afterWindow.count).toBe(1);
});
(0, bun_test_1.test)("clearRepeat resets a key after a successful execution", function () {
    var store = new Map();
    var key = (0, repeat_guard_1.repeatKey)("run_shell", "npm test", "/ws");
    for (var i = 0; i < repeat_guard_1.REPEAT_MAX; i++)
        (0, repeat_guard_1.recordRepeat)(store, key, 1000 + i);
    (0, repeat_guard_1.clearRepeat)(store, key);
    var next = (0, repeat_guard_1.recordRepeat)(store, key, 10000);
    (0, bun_test_1.expect)(next.count).toBe(1);
    (0, bun_test_1.expect)(next.blocked).toBe(false);
});
(0, bun_test_1.test)("repeat keys normalize workspace absolute paths", function () {
    var a = (0, repeat_guard_1.repeatKey)("run_shell", JSON.stringify({
        command: 'cd "/home/user/project/build" && cmake --build .',
    }), "/home/user/project");
    var b = (0, repeat_guard_1.repeatKey)("run_shell", JSON.stringify({
        command: 'cd "/home/user/project/build" && cmake --build .',
    }), "/home/user/project");
    (0, bun_test_1.expect)(a).toBe(b);
    (0, bun_test_1.expect)(a).toContain("<workspace>");
});
(0, bun_test_1.test)("repeat stores are independent per session", function () {
    var a = new Map();
    var b = new Map();
    var key = (0, repeat_guard_1.repeatKey)("run_shell", "ls", "/ws");
    for (var i = 0; i < repeat_guard_1.REPEAT_MAX; i++)
        (0, repeat_guard_1.recordRepeat)(a, key, 1000 + i);
    (0, bun_test_1.expect)((0, repeat_guard_1.recordRepeat)(a, key, 10000).blocked).toBe(true);
    (0, bun_test_1.expect)((0, repeat_guard_1.recordRepeat)(b, key, 10000).blocked).toBe(false);
});
