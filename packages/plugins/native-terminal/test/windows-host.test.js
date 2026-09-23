"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var node_path_1 = require("node:path");
var index_1 = require("../src/index");
(0, bun_test_1.test)("pane command keeps the exact POSIX shell invocation", function () {
    (0, bun_test_1.expect)((0, index_1.nativeTerminalPaneCommand)("interactive-agent", "linux")).toEqual([
        "/bin/sh",
        "-lc",
        "interactive-agent",
    ]);
});
(0, bun_test_1.test)("pane command uses a bash-compatible shell on Windows", function () {
    var bash = node_path_1.win32.join("C:\\tools", "bash.exe");
    var previous = process.env.NATALIA_BASH_EXECUTABLE;
    process.env.NATALIA_BASH_EXECUTABLE = bash;
    try {
        (0, bun_test_1.expect)((0, index_1.nativeTerminalPaneCommand)("interactive-agent", "win32")).toEqual([
            bash,
            "-lc",
            "interactive-agent",
        ]);
    }
    finally {
        if (previous === undefined)
            delete process.env.NATALIA_BASH_EXECUTABLE;
        else
            process.env.NATALIA_BASH_EXECUTABLE = previous;
    }
});
(0, bun_test_1.test)("fork executable resolution applies the Windows suffix", function () {
    // An absent build directory proves the probed name rather than a real binary.
    (0, bun_test_1.expect)((0, index_1.resolveNataliaWezTermForkExecutable)({
        os: "win32",
        buildDir: "/definitely/missing",
    })).toBeUndefined();
    (0, bun_test_1.expect)((0, index_1.resolveNataliaWezTermForkExecutable)({
        os: "linux",
        buildDir: "/definitely/missing",
    })).toBeUndefined();
});
(0, bun_test_1.test)("font fallback keeps the POSIX CJK chain unchanged", function () {
    (0, bun_test_1.expect)((0, index_1.monospaceFontFallback)("linux")).toEqual([
        "JetBrains Mono",
        "Noto Sans Mono CJK SC",
        "Noto Sans CJK SC",
        "Noto Color Emoji",
    ]);
});
(0, bun_test_1.test)("font fallback offers Windows CJK families", function () {
    var fonts = (0, index_1.monospaceFontFallback)("win32");
    (0, bun_test_1.expect)(fonts).toContain("Consolas");
    (0, bun_test_1.expect)(fonts.some(function (font) { return font.includes("YaHei"); })).toBe(true);
    (0, bun_test_1.expect)(fonts).not.toContain("Noto Sans Mono CJK SC");
});
