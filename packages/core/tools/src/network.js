"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNetworkURL = assertNetworkURL;
/**
 * Enforce the runtime's network policy for a URL.
 *
 * This is shared by the web and browser tool families: both can touch the
 * network, so both must apply the same allowed-scheme/denied-host rules.
 */
function assertNetworkURL(input, context) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var url = new URL(input);
    var allowedSchemes = (_b = (_a = context.settings) === null || _a === void 0 ? void 0 : _a.allowedSchemes) !== null && _b !== void 0 ? _b : ["https", "http"];
    if (!allowedSchemes.includes(url.protocol.slice(0, -1)))
        throw new Error("network scheme is not allowed: ".concat(url.protocol));
    var host = url.hostname.toLowerCase();
    // IPv6 literals arrive bracketed ([::1], [fd00::1]); the loopback and
    // private-range checks below work on the bare address.
    var bareHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
    var allowed = (_d = (_c = context.settings) === null || _c === void 0 ? void 0 : _c.allowedHosts) !== null && _d !== void 0 ? _d : [];
    var allowedGroups = (_f = (_e = context.settings) === null || _e === void 0 ? void 0 : _e.allowedHostGroups) !== null && _f !== void 0 ? _f : [allowed];
    var denied = (_h = (_g = context.settings) === null || _g === void 0 ? void 0 : _g.deniedHosts) !== null && _h !== void 0 ? _h : [];
    if (denied.some(function (pattern) { return hostMatches(host, pattern); }))
        throw new Error("network host denied: ".concat(host));
    if (allowedGroups.some(function (group) {
        return group.length && !group.some(function (pattern) { return hostMatches(host, pattern); });
    }))
        throw new Error("network host is not allowed: ".concat(host));
    var localhost = host === "localhost" ||
        bareHost === "::1" || // IPv6 loopback
        host.startsWith("127."); // IPv4 loopback
    if (localhost && ((_j = context.settings) === null || _j === void 0 ? void 0 : _j.allowLocalhost) === false)
        throw new Error("localhost network access is not allowed: ".concat(host));
    var privateAddress = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/u.test(host) || // IPv4 private
        /^f[cd][0-9a-f]{2}:/iu.test(bareHost) || // IPv6 unique-local fc00::/7
        /^fe[89ab][0-9a-f]:/iu.test(bareHost); // IPv6 link-local fe80::/10
    if (privateAddress && ((_k = context.settings) === null || _k === void 0 ? void 0 : _k.allowPrivate) === false)
        throw new Error("private network access is not allowed: ".concat(host));
}
function hostMatches(host, pattern) {
    var normalized = pattern.toLowerCase();
    return normalized.startsWith("*.")
        ? host.endsWith(normalized.slice(1))
        : host === normalized;
}
