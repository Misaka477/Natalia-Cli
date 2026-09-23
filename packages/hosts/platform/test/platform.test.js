"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var node_path_1 = require("node:path");
var index_1 = require("../src/index");
var windowsEnv = {
    ProgramFiles: "C:\\Program Files",
    LOCALAPPDATA: "C:\\Users\\demo\\AppData\\Local",
    APPDATA: "C:\\Users\\demo\\AppData\\Roaming",
    USERPROFILE: "C:\\Users\\demo",
};
var gitBash = node_path_1.win32.join(windowsEnv.ProgramFiles, "Git", "bin", "bash.exe");
(0, bun_test_1.describe)("platform identity", function () {
    (0, bun_test_1.test)("reports the injected platform rather than the host", function () {
        (0, bun_test_1.expect)((0, index_1.isWindows)("win32")).toBe(true);
        (0, bun_test_1.expect)((0, index_1.isWindows)("linux")).toBe(false);
        (0, bun_test_1.expect)((0, index_1.isWindows)("darwin")).toBe(false);
    });
    (0, bun_test_1.test)("joins with the target platform separator, not the host separator", function () {
        (0, bun_test_1.expect)((0, index_1.platformJoin)("win32", "C:\\Users\\demo", "AppData")).toBe("C:\\Users\\demo\\AppData");
        (0, bun_test_1.expect)((0, index_1.platformJoin)("linux", "/home/demo", ".config")).toBe("/home/demo/.config");
    });
});
(0, bun_test_1.describe)("executableName", function () {
    (0, bun_test_1.test)("leaves POSIX names untouched", function () {
        (0, bun_test_1.expect)((0, index_1.executableName)("wezterm-mux-server", "linux")).toBe("wezterm-mux-server");
    });
    (0, bun_test_1.test)("appends the Windows suffix exactly once", function () {
        (0, bun_test_1.expect)((0, index_1.executableName)("wezterm-mux-server", "win32")).toBe("wezterm-mux-server.exe");
        (0, bun_test_1.expect)((0, index_1.executableName)("wezterm.exe", "win32")).toBe("wezterm.exe");
        (0, bun_test_1.expect)((0, index_1.executableName)("WEZTERM.EXE", "win32")).toBe("WEZTERM.EXE");
    });
});
(0, bun_test_1.describe)("resolveBashExecutable", function () {
    (0, bun_test_1.test)("is not consulted on POSIX", function () {
        (0, bun_test_1.expect)((0, index_1.resolveBashExecutable)({ os: "linux", env: {} })).toBeUndefined();
    });
    (0, bun_test_1.test)("honours an explicit override on any platform", function () {
        (0, bun_test_1.expect)((0, index_1.resolveBashExecutable)({
            os: "linux",
            env: { NATALIA_BASH_EXECUTABLE: "/opt/bash" },
        })).toBe("/opt/bash");
    });
    (0, bun_test_1.test)("discovers Git for Windows under Program Files", function () {
        var resolved = (0, index_1.resolveBashExecutable)({
            os: "win32",
            env: windowsEnv,
            exists: function (path) { return path === gitBash; },
        });
        (0, bun_test_1.expect)(resolved).toBe(gitBash);
    });
    (0, bun_test_1.test)("falls back to the msys bash path", function () {
        var msys = node_path_1.win32.join(windowsEnv.ProgramFiles, "Git", "usr", "bin", "bash.exe");
        (0, bun_test_1.expect)((0, index_1.resolveBashExecutable)({
            os: "win32",
            env: windowsEnv,
            exists: function (path) { return path === msys; },
        })).toBe(msys);
    });
    (0, bun_test_1.test)("discovers a per-user Git installation", function () {
        var perUser = node_path_1.win32.join(windowsEnv.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe");
        (0, bun_test_1.expect)((0, index_1.resolveBashExecutable)({
            os: "win32",
            env: windowsEnv,
            exists: function (path) { return path === perUser; },
        })).toBe(perUser);
    });
    (0, bun_test_1.test)("returns undefined when no bash is installed", function () {
        (0, bun_test_1.expect)((0, index_1.resolveBashExecutable)({
            os: "win32",
            env: windowsEnv,
            exists: function () { return false; },
        })).toBeUndefined();
    });
});
(0, bun_test_1.describe)("profileShellCommand", function () {
    (0, bun_test_1.test)("preserves the existing POSIX invocation", function () {
        (0, bun_test_1.expect)((0, index_1.profileShellCommand)("echo hi", { os: "linux", env: {} })).toEqual({
            executable: "bash",
            args: ["-lc", "echo hi"],
        });
    });
    (0, bun_test_1.test)("preserves a call-site specific POSIX shell", function () {
        (0, bun_test_1.expect)((0, index_1.profileShellCommand)("echo hi", {
            os: "linux",
            env: {},
            posixShell: "/usr/bin/bash",
        })).toEqual({ executable: "/usr/bin/bash", args: ["-lc", "echo hi"] });
    });
    (0, bun_test_1.test)("keeps identical arguments on Windows so quoting is unchanged", function () {
        var resolved = (0, index_1.profileShellCommand)("echo hi", {
            os: "win32",
            env: windowsEnv,
            exists: function () { return true; },
        });
        (0, bun_test_1.expect)(resolved.args).toEqual(["-lc", "echo hi"]);
        (0, bun_test_1.expect)(resolved.executable.endsWith("bash.exe")).toBe(true);
    });
    (0, bun_test_1.test)("fails loudly instead of silently switching to cmd.exe", function () {
        (0, bun_test_1.expect)(function () {
            return (0, index_1.profileShellCommand)("echo hi", {
                os: "win32",
                env: windowsEnv,
                exists: function () { return false; },
            });
        }).toThrow(/bash-compatible shell is unavailable/u);
    });
});
(0, bun_test_1.describe)("isolatedShellCommand", function () {
    (0, bun_test_1.test)("keeps the profile-free argument vector on both platforms", function () {
        (0, bun_test_1.expect)((0, index_1.isolatedShellCommand)("echo hi", { os: "linux", env: {} }).args).toEqual(["--noprofile", "--norc", "-c", "echo hi"]);
        (0, bun_test_1.expect)((0, index_1.isolatedShellCommand)("echo hi", {
            os: "win32",
            env: windowsEnv,
            exists: function () { return true; },
        }).args).toEqual(["--noprofile", "--norc", "-c", "echo hi"]);
    });
});
(0, bun_test_1.describe)("process lifetime", function () {
    (0, bun_test_1.test)("keeps setsid on POSIX and drops it on Windows", function () {
        (0, bun_test_1.expect)((0, index_1.detachedShellPrefix)("linux")).toBe("setsid ");
        (0, bun_test_1.expect)((0, index_1.detachedShellPrefix)("win32")).toBe("");
    });
    (0, bun_test_1.test)("only Windows needs an external tree-kill command", function () {
        (0, bun_test_1.expect)((0, index_1.processTreeKillCommand)(1234, "linux")).toBeUndefined();
        (0, bun_test_1.expect)((0, index_1.processTreeKillCommand)(1234, "win32")).toEqual({
            executable: "taskkill",
            args: ["/PID", "1234", "/T", "/F"],
        });
    });
    (0, bun_test_1.test)("truncates a fractional pid", function () {
        var _a;
        (0, bun_test_1.expect)((_a = (0, index_1.processTreeKillCommand)(1234.7, "win32")) === null || _a === void 0 ? void 0 : _a.args[1]).toBe("1234");
    });
});
(0, bun_test_1.describe)("user directories", function () {
    (0, bun_test_1.test)("reproduces the previous POSIX config root", function () {
        (0, bun_test_1.expect)((0, index_1.globalConfigHome)({ os: "linux", env: { HOME: "/home/demo" } })).toBe("/home/demo/.config");
    });
    (0, bun_test_1.test)("does not let XDG_CONFIG_HOME change POSIX config resolution", function () {
        (0, bun_test_1.expect)((0, index_1.globalConfigHome)({
            os: "linux",
            env: { HOME: "/home/demo", XDG_CONFIG_HOME: "/elsewhere" },
        })).toBe("/home/demo/.config");
    });
    (0, bun_test_1.test)("uses APPDATA on Windows", function () {
        (0, bun_test_1.expect)((0, index_1.globalConfigHome)({ os: "win32", env: windowsEnv })).toBe(windowsEnv.APPDATA);
    });
    (0, bun_test_1.test)("derives a Windows config root without APPDATA", function () {
        (0, bun_test_1.expect)((0, index_1.globalConfigHome)({
            os: "win32",
            env: { USERPROFILE: "C:\\Users\\demo" },
        })).toBe(node_path_1.win32.join("C:\\Users\\demo", "AppData", "Roaming"));
    });
    (0, bun_test_1.test)("reproduces the previous POSIX state root", function () {
        (0, bun_test_1.expect)((0, index_1.userStateHome)({ os: "linux", env: { HOME: "/home/demo" } })).toBe("/home/demo/.local/state");
        (0, bun_test_1.expect)((0, index_1.userStateHome)({
            os: "linux",
            env: { HOME: "/home/demo", XDG_STATE_HOME: "/state" },
        })).toBe("/state");
    });
    (0, bun_test_1.test)("uses LOCALAPPDATA on Windows", function () {
        (0, bun_test_1.expect)((0, index_1.userStateHome)({ os: "win32", env: windowsEnv })).toBe(windowsEnv.LOCALAPPDATA);
    });
    (0, bun_test_1.test)("reports the POSIX runtime directory only when present", function () {
        (0, bun_test_1.expect)((0, index_1.userRuntimeHome)({ os: "linux", env: { XDG_RUNTIME_DIR: "/run/user/1" } })).toBe("/run/user/1");
        (0, bun_test_1.expect)((0, index_1.userRuntimeHome)({ os: "linux", env: {} })).toBeUndefined();
    });
    (0, bun_test_1.test)("uses a Windows local runtime root", function () {
        (0, bun_test_1.expect)((0, index_1.userRuntimeHome)({ os: "win32", env: windowsEnv })).toBe(windowsEnv.LOCALAPPDATA);
        (0, bun_test_1.expect)((0, index_1.userRuntimeHome)({ os: "win32", env: { TEMP: "C:\\Temp" } })).toBe("C:\\Temp");
    });
});
