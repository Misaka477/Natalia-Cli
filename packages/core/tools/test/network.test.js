"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
function ctx(settings) {
    return { workspaceRoot: "/ws", settings: settings };
}
var strict = { allowLocalhost: false, allowPrivate: false };
(0, bun_test_1.test)("assertNetworkURL allows public http(s) hosts, IPv4 and IPv6", function () {
    (0, bun_test_1.expect)(function () {
        return (0, src_1.assertNetworkURL)("https://example.com/a", ctx({}));
    }).not.toThrow();
    (0, bun_test_1.expect)(function () { return (0, src_1.assertNetworkURL)("https://8.8.8.8/", ctx({})); }).not.toThrow();
    (0, bun_test_1.expect)(function () {
        return (0, src_1.assertNetworkURL)("https://[2606:4700::1111]/", ctx({}));
    }).not.toThrow();
});
(0, bun_test_1.test)("assertNetworkURL blocks loopback and private on both IPv4 and IPv6", function () {
    var _loop_1 = function (url) {
        (0, bun_test_1.expect)(function () { return (0, src_1.assertNetworkURL)(url, ctx(strict)); }, url).toThrow(/not allowed/);
    };
    // The IPv6 cases are the point: Node serializes IPv6 hostnames bracketed
    // ([::1]), so a `host === "::1"` check never fires, and an IPv4-only private
    // regex misses fc00::/7 and fe80::/10 — an SSRF bypass when a caller opts out
    // of localhost/private access.
    for (var _i = 0, _a = [
        "http://127.0.0.1/",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://172.16.0.1/",
        "http://[::1]/", // IPv6 loopback
        "http://[fd00::1]/", // IPv6 unique-local fc00::/7
        "http://[fd12:3456::1]/", // IPv6 unique-local (fd..)
        "http://[fe80::1]/", // IPv6 link-local fe80::/10
    ]; _i < _a.length; _i++) {
        var url = _a[_i];
        _loop_1(url);
    }
});
(0, bun_test_1.test)("assertNetworkURL permits loopback/private unless explicitly disallowed", function () {
    // Default (unset) allows them; only an explicit false blocks.
    (0, bun_test_1.expect)(function () { return (0, src_1.assertNetworkURL)("http://127.0.0.1/", ctx({})); }).not.toThrow();
    (0, bun_test_1.expect)(function () { return (0, src_1.assertNetworkURL)("http://[::1]/", ctx({})); }).not.toThrow();
});
(0, bun_test_1.test)("assertNetworkURL enforces scheme and denied-host rules", function () {
    (0, bun_test_1.expect)(function () { return (0, src_1.assertNetworkURL)("ftp://example.com/", ctx({})); }).toThrow(/scheme is not allowed/);
    (0, bun_test_1.expect)(function () {
        return (0, src_1.assertNetworkURL)("https://evil.com/", ctx({ deniedHosts: ["evil.com"] }));
    }).toThrow(/host denied/);
});
