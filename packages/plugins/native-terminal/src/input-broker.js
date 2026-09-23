"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATIVE_INPUT_BROKER_VERSION = void 0;
exports.decodeNativeInputClaim = decodeNativeInputClaim;
exports.encodeNativeInputDecision = encodeNativeInputDecision;
exports.decodeNativeInputDecision = decodeNativeInputDecision;
exports.nativeInputBrokerEndpoint = nativeInputBrokerEndpoint;
exports.nativeInputBrokerDecision = nativeInputBrokerDecision;
exports.NATIVE_INPUT_BROKER_VERSION = 2;
function decodeNativeInputClaim(frame) {
    return parse(frame, validateNativeInputClaim);
}
function encodeNativeInputDecision(decision) {
    validateNativeInputDecision(decision);
    return "".concat(JSON.stringify(decision), "\n");
}
function decodeNativeInputDecision(frame) {
    return parse(frame, validateNativeInputDecision);
}
function nativeInputBrokerEndpoint(input) {
    var _a, _b;
    if (!validSegment(input.daemonID))
        throw new Error("native input broker daemon ID is invalid");
    var endpoint = ((_a = input.platform) !== null && _a !== void 0 ? _a : process.platform) === "win32"
        ? "\\\\.\\pipe\\natalia-native-input-".concat(input.daemonID)
        : "".concat(input.runtimeDir, "/natalia-native-input-").concat(input.daemonID, ".sock");
    if (((_b = input.platform) !== null && _b !== void 0 ? _b : process.platform) !== "win32" &&
        endpoint.length >= 104)
        throw new Error("native input broker socket path is too long; use a short XDG_RUNTIME_DIR-backed runtime directory");
    return endpoint;
}
function nativeInputBrokerDecision(input) {
    var permit = input.event.token === input.expectedToken &&
        input.event.terminalID === "pane_".concat(input.event.paneID) &&
        input.knownPanes.has(input.event.paneID);
    return {
        version: exports.NATIVE_INPUT_BROKER_VERSION,
        type: "decision",
        nonce: input.event.nonce,
        permit: permit,
        reason: permit ? "accepted" : "denied",
    };
}
function validateNativeInputClaim(value) {
    var _a, _b, _c;
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("native input broker claim must be an object");
    var claim = value;
    if (claim.version !== exports.NATIVE_INPUT_BROKER_VERSION ||
        claim.type !== "claim" ||
        !validSegment(claim.nonce) ||
        !validSegment(claim.token) ||
        !validSegment(claim.terminalID) ||
        !Number.isSafeInteger(claim.paneID) ||
        !["keyboard", "ime_commit", "paste"].includes((_a = claim.kind) !== null && _a !== void 0 ? _a : "") ||
        !Number.isSafeInteger(claim.byteLength) ||
        ((_b = claim.byteLength) !== null && _b !== void 0 ? _b : 0) < 1 ||
        ((_c = claim.byteLength) !== null && _c !== void 0 ? _c : 0) > 64 * 1024)
        throw new Error("native input broker claim is invalid");
}
function parse(frame, validate) {
    var value;
    try {
        value = JSON.parse(frame);
    }
    catch (_a) {
        throw new Error("native input broker frame is not valid JSON");
    }
    validate(value);
    return value;
}
function validateNativeInputDecision(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("native input broker decision must be an object");
    var decision = value;
    if (decision.version !== exports.NATIVE_INPUT_BROKER_VERSION ||
        decision.type !== "decision" ||
        !validSegment(decision.nonce) ||
        typeof decision.permit !== "boolean" ||
        (decision.reason !== undefined &&
            !["accepted", "denied", "expired", "invalid"].includes(decision.reason)))
        throw new Error("native input broker decision is invalid");
}
function validSegment(value) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,256}$/u.test(value);
}
