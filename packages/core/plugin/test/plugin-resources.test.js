"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var validResource = {
    name: "session-todo-store",
    kind: "workspace-file",
    access: "read",
    scope: "session",
    path: ".natalia/todos/{sessionID}.json",
};
(0, bun_test_1.test)("a valid plugin workspace resource declaration is recognized", function () {
    (0, bun_test_1.expect)((0, src_1.isPluginWorkspaceResource)(validResource)).toBe(true);
    (0, bun_test_1.expect)((0, src_1.isPluginWorkspaceResource)(__assign(__assign({}, validResource), { readers: ["natalia.ui.todo"], audit: true }))).toBe(true);
});
(0, bun_test_1.test)("plugin-declared params are accepted and resolved as single segments", function () {
    var resource = __assign(__assign({}, validResource), { name: "workspace-skill-document", scope: "workspace", params: ["skillName"], path: ".natalia/skills/{skillName}/SKILL.md" });
    (0, bun_test_1.expect)((0, src_1.isPluginWorkspaceResource)(resource)).toBe(true);
    (0, bun_test_1.expect)((0, src_1.pluginWorkspaceResourcePath)(resource, { skillName: "release" })).toBe(".natalia/skills/release/SKILL.md");
    (0, bun_test_1.expect)((0, src_1.pluginWorkspaceResourcePath)(resource, {})).toBeUndefined();
    (0, bun_test_1.expect)((0, src_1.pluginWorkspaceResourcePath)(resource, { skillName: "../secret" })).toBeUndefined();
    (0, bun_test_1.expect)((0, src_1.pluginWorkspaceResourcePath)(resource, { skillName: "a/b" })).toBeUndefined();
});
(0, bun_test_1.test)("invalid declared params are rejected", function () {
    for (var _i = 0, _a = [
        __assign(__assign({}, validResource), { params: "skillName" }),
        __assign(__assign({}, validResource), { params: ["bad-name"] }),
        __assign(__assign({}, validResource), { params: ["skillName", "skillName"] }),
        __assign(__assign({}, validResource), { params: ["sessionID"] }),
        __assign(__assign({}, validResource), { params: ["skillName"], path: ".natalia/skills/{other}/SKILL.md" }),
    ]; _i < _a.length; _i++) {
        var resource = _a[_i];
        (0, bun_test_1.expect)((0, src_1.isPluginWorkspaceResource)(resource)).toBe(false);
    }
});
(0, bun_test_1.test)("invalid reader lists and audit flags are rejected", function () {
    (0, bun_test_1.expect)((0, src_1.isPluginWorkspaceResource)(__assign(__assign({}, validResource), { readers: ["ok", 1] }))).toBe(false);
    (0, bun_test_1.expect)((0, src_1.isPluginWorkspaceResource)(__assign(__assign({}, validResource), { readers: [""] }))).toBe(false);
    (0, bun_test_1.expect)((0, src_1.isPluginWorkspaceResource)(__assign(__assign({}, validResource), { audit: "yes" }))).toBe(false);
});
(0, bun_test_1.test)("unsafe or unsupported workspace resource templates are rejected", function () {
    for (var _i = 0, _a = [
        "/absolute.json",
        "../outside.json",
        ".natalia/todos/*.json",
        ".natalia/todos/**",
        ".natalia/todos/{sessionID}/{unknown}.json",
        ".natalia/todos/{other}.json",
        ".natalia/todos//double.json",
    ]; _i < _a.length; _i++) {
        var path = _a[_i];
        (0, bun_test_1.expect)((0, src_1.isPluginWorkspaceResource)(__assign(__assign({}, validResource), { path: path }))).toBe(false);
    }
});
(0, bun_test_1.test)("resource path templates resolve only with safe trusted params", function () {
    (0, bun_test_1.expect)((0, src_1.pluginWorkspaceResourcePath)(validResource, { sessionID: "ses_current" })).toBe(".natalia/todos/ses_current.json");
    (0, bun_test_1.expect)((0, src_1.pluginWorkspaceResourcePath)(validResource, {})).toBeUndefined();
    (0, bun_test_1.expect)((0, src_1.pluginWorkspaceResourcePath)(validResource, { sessionID: "../secret" })).toBeUndefined();
    (0, bun_test_1.expect)((0, src_1.pluginWorkspaceResourcePath)(validResource, { sessionID: "a/b" })).toBeUndefined();
});
(0, bun_test_1.test)("workspace path normalization keeps matching on a single POSIX shape", function () {
    (0, bun_test_1.expect)((0, src_1.normalizePluginWorkspacePath)("./.natalia//todos/x.json")).toBe(".natalia/todos/x.json");
    (0, bun_test_1.expect)((0, src_1.normalizePluginWorkspacePath)(".natalia/../x.json")).toBeUndefined();
    (0, bun_test_1.expect)((0, src_1.normalizePluginWorkspacePath)("/x.json")).toBeUndefined();
});
