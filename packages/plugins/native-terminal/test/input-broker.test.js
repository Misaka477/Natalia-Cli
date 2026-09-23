"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("encodes native claim decisions", function () {
    (0, bun_test_1.expect)((0, src_1.decodeNativeInputDecision)((0, src_1.encodeNativeInputDecision)({
        version: src_1.NATIVE_INPUT_BROKER_VERSION,
        type: "decision",
        nonce: "nonce_1",
        permit: true,
        reason: "accepted",
    }))).toMatchObject({ permit: true, reason: "accepted" });
});
(0, bun_test_1.test)("accepts a byte-free native host pre-write claim", function () {
    var claim = (0, src_1.decodeNativeInputClaim)(JSON.stringify({
        version: src_1.NATIVE_INPUT_BROKER_VERSION,
        type: "claim",
        nonce: "nonce_native_host",
        token: "token_native_host",
        terminalID: "pane_42",
        paneID: 42,
        kind: "paste",
        byteLength: 42,
    }));
    (0, bun_test_1.expect)(claim).toMatchObject({
        type: "claim",
        kind: "paste",
        byteLength: 42,
    });
    (0, bun_test_1.expect)(claim).not.toHaveProperty("data");
    (0, bun_test_1.expect)((0, src_1.nativeInputBrokerDecision)({
        event: claim,
        expectedToken: "token_native_host",
        knownPanes: new Map([[42, "terminal_native_host"]]),
    })).toMatchObject({ permit: true, reason: "accepted" });
});
(0, bun_test_1.test)("rejects malformed claims and creates platform-private endpoints", function () {
    (0, bun_test_1.expect)(function () { return (0, src_1.decodeNativeInputClaim)('{"type":"input"}'); }).toThrow("invalid");
    (0, bun_test_1.expect)(function () {
        return (0, src_1.decodeNativeInputClaim)(JSON.stringify({
            version: src_1.NATIVE_INPUT_BROKER_VERSION,
            type: "claim",
            nonce: "nonce_mouse",
            token: "token_mouse",
            terminalID: "pane_7",
            paneID: 7,
            kind: "mouse",
            byteLength: 1,
        }));
    }).toThrow("invalid");
    (0, bun_test_1.expect)((0, src_1.nativeInputBrokerEndpoint)({
        runtimeDir: "/run/user/1000",
        daemonID: "daemon_1",
        platform: "linux",
    })).toBe("/run/user/1000/natalia-native-input-daemon_1.sock");
    (0, bun_test_1.expect)((0, src_1.nativeInputBrokerEndpoint)({
        runtimeDir: "ignored",
        daemonID: "daemon_1",
        platform: "win32",
    })).toBe("\\\\.\\pipe\\natalia-native-input-daemon_1");
});
(0, bun_test_1.test)("permits only a broker-authenticated mapped terminal", function () {
    var event = (0, src_1.decodeNativeInputClaim)(JSON.stringify({
        version: src_1.NATIVE_INPUT_BROKER_VERSION,
        type: "claim",
        nonce: "nonce_2",
        token: "token_2",
        terminalID: "pane_77",
        paneID: 77,
        kind: "keyboard",
        byteLength: 1,
    }));
    (0, bun_test_1.expect)((0, src_1.nativeInputBrokerDecision)({
        event: event,
        expectedToken: "token_2",
        knownPanes: new Map([[77, "terminal_2"]]),
    })).toMatchObject({ permit: true, reason: "accepted" });
    (0, bun_test_1.expect)((0, src_1.nativeInputBrokerDecision)({
        event: event,
        expectedToken: "wrong",
        knownPanes: new Map([[77, "terminal_2"]]),
    })).toMatchObject({ permit: false, reason: "denied" });
});
(0, bun_test_1.test)("uses identical claim wire frames for Unix sockets and Windows pipes", function () {
    var input = {
        version: src_1.NATIVE_INPUT_BROKER_VERSION,
        type: "claim",
        nonce: "nonce_cross_platform",
        token: "token_cross_platform",
        terminalID: "pane_7",
        paneID: 7,
        kind: "paste",
        byteLength: 18,
    };
    (0, bun_test_1.expect)((0, src_1.decodeNativeInputClaim)(JSON.stringify(input))).toEqual(input);
    (0, bun_test_1.expect)((0, src_1.nativeInputBrokerEndpoint)({
        runtimeDir: "/run/user/1000",
        daemonID: "daemon_cross_platform",
        platform: "darwin",
    })).toBe("/run/user/1000/natalia-native-input-daemon_cross_platform.sock");
    (0, bun_test_1.expect)((0, src_1.nativeInputBrokerEndpoint)({
        runtimeDir: "ignored",
        daemonID: "daemon_cross_platform",
        platform: "win32",
    })).toBe("\\\\.\\pipe\\natalia-native-input-daemon_cross_platform");
});
(0, bun_test_1.test)("rejects Unix broker paths that exceed the platform socket limit", function () {
    (0, bun_test_1.expect)(function () {
        return (0, src_1.nativeInputBrokerEndpoint)({
            runtimeDir: "/run/user/1000/".concat("deep/".repeat(30)),
            daemonID: "daemon_path_limit",
            platform: "linux",
        });
    }).toThrow("socket path is too long");
});
