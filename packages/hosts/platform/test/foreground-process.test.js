"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var stat = function (input) {
    return "".concat(input.pid, " (").concat(input.name, ") S 1 ").concat(input.pid, " ").concat(input.pid, " ").concat(input.tty, " ").concat(input.foregroundGroup, " 4194304 0 0 0 0");
};
function io(input) {
    return {
        os: "linux",
        deviceNumber: function () { var _a; return (_a = input.device) !== null && _a !== void 0 ? _a : 1035; },
        processIDs: function () { return input.processes.map(function (process) { return process.pid; }); },
        processStat: function (pid) {
            var _a;
            return ((_a = input.unreadable) === null || _a === void 0 ? void 0 : _a.includes(pid))
                ? undefined
                : stat(input.processes.find(function (process) { return process.pid === pid; }));
        },
    };
}
(0, bun_test_1.test)("a process stat line survives a command name with spaces and parentheses", function () {
    (0, bun_test_1.expect)((0, src_1.parseProcessStat)("42 (my (odd) program) S 1 42 42 1035 77 4194304 0")).toEqual({
        pid: 42,
        name: "my (odd) program",
        tty: 1035,
        foregroundGroup: 77,
    });
    (0, bun_test_1.expect)((0, src_1.parseProcessStat)("nonsense")).toBeUndefined();
    (0, bun_test_1.expect)((0, src_1.parseProcessStat)("42 (bash) S")).toBeUndefined();
});
(0, bun_test_1.test)("the foreground program of a tty is read from the process table", function () {
    var probe = (0, src_1.foregroundProcessForTTY)("/dev/pts/3", io({
        processes: [
            { pid: 100, name: "bash", tty: 1035, foregroundGroup: 200 },
            { pid: 200, name: "vim", tty: 1035, foregroundGroup: 200 },
            { pid: 300, name: "unrelated", tty: 0, foregroundGroup: -1 },
        ],
    }));
    (0, bun_test_1.expect)(probe).toEqual({
        supported: true,
        process: { pid: 200, name: "vim" },
    });
});
(0, bun_test_1.test)("a shell in the foreground reports the shell itself", function () {
    (0, bun_test_1.expect)((0, src_1.foregroundProcessForTTY)("/dev/pts/3", io({
        processes: [
            { pid: 100, name: "bash", tty: 1035, foregroundGroup: 100 },
        ],
    }))).toEqual({ supported: true, process: { pid: 100, name: "bash" } });
});
(0, bun_test_1.test)("an unconfirmable foreground never masquerades as a known program", function () {
    // The group leader exists but cannot be read.
    (0, bun_test_1.expect)((0, src_1.foregroundProcessForTTY)("/dev/pts/3", io({
        processes: [
            { pid: 100, name: "bash", tty: 1035, foregroundGroup: 200 },
            { pid: 200, name: "vim", tty: 1035, foregroundGroup: 200 },
        ],
        unreadable: [200],
    }))).toMatchObject({ supported: false });
    // No process is attached to the tty at all.
    (0, bun_test_1.expect)((0, src_1.foregroundProcessForTTY)("/dev/pts/3", io({
        processes: [
            { pid: 300, name: "unrelated", tty: 7, foregroundGroup: 300 },
        ],
    }))).toEqual({ supported: true, process: undefined });
    (0, bun_test_1.expect)((0, src_1.foregroundProcessForTTY)("/dev/pts/3", {
        os: "linux",
        deviceNumber: function () { return undefined; },
    })).toMatchObject({ supported: false, reason: bun_test_1.expect.stringContaining("tty") });
    (0, bun_test_1.expect)((0, src_1.foregroundProcessForTTY)("", { os: "linux" })).toMatchObject({
        supported: false,
    });
});
(0, bun_test_1.test)("platforms without a process table report unsupported instead of guessing", function () {
    for (var _i = 0, _a = ["win32", "darwin"]; _i < _a.length; _i++) {
        var os = _a[_i];
        (0, bun_test_1.expect)((0, src_1.foregroundProcessForTTY)("/dev/pts/3", { os: os })).toMatchObject({
            supported: false,
            reason: bun_test_1.expect.stringContaining(os),
        });
    }
});
