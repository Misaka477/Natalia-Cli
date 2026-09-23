"use strict";
/**
 * How a call fails, said in a way a program can act on.
 *
 * Every remote failure used to arrive as JSON-RPC `-32602` with a string, so a
 * consumer could not tell apart five situations that call for five different
 * reactions:
 *
 *   - the method does not exist        -> report a bug, or fall back
 *   - this runtime does not do it      -> hide the feature entirely
 *   - the parameters are wrong         -> fix the call
 *   - policy or state says no          -> tell the user, maybe retry later
 *   - something broke                  -> retry or escalate
 *
 * The codes below are the JSON-RPC ones plus two from the implementation-defined
 * server range; nothing is invented where the spec already has a word for it.
 *
 * Failures travel in two directions and this module serves both:
 *
 *   - **producers** (a runtime, a registry, the dispatcher) throw one of the
 *     typed failures so the transport can classify without guessing from message
 *     text. Guessing from text is what this module exists to abolish.
 *   - **consumers** catch `RuntimeRPCError` and switch on `failureKind()`.
 *
 * A refusal that is an *ordinary outcome* should not be here at all: it belongs
 * in the return value, so a caller cannot confuse it with a broken connection.
 * `reloadConfig(): {applied, reason?}` is the reference case. Use `RuntimeRefusal`
 * only where the operation has no value to answer with.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeVersionMismatchError = exports.RuntimeRPCError = exports.RuntimeInvalidRequest = exports.RuntimeMethodNotFound = exports.RuntimeInvalidParams = exports.RuntimeNotSupported = exports.RuntimeRefusal = exports.RUNTIME_RPC_ERROR_CODES = void 0;
exports.runtimeFailureData = runtimeFailureData;
exports.failureKind = failureKind;
exports.failureKindOfCode = failureKindOfCode;
/**
 * `-32000` and `-32001` sit in the JSON-RPC implementation-defined server range;
 * the rest are the spec's own.
 */
exports.RUNTIME_RPC_ERROR_CODES = {
    /** The envelope is not a request. */
    invalidRequest: -32600,
    /** No route by that name. */
    methodNotFound: -32601,
    /** The route exists and the arguments are wrong. Only that. */
    invalidParams: -32602,
    /** The route exists; this runtime does not implement the member behind it. */
    notSupported: -32000,
    /** Policy or current state says no. Carries a reason. */
    refused: -32001,
    /** Anything else. Carries no detail — see `RuntimeFailureData`. */
    internal: -32603,
};
var KIND_BY_CODE = new Map(Object.keys(exports.RUNTIME_RPC_ERROR_CODES).map(function (kind) { return [
    exports.RUNTIME_RPC_ERROR_CODES[kind],
    kind,
]; }));
/** Marker used instead of `instanceof`, which does not survive a worker hop. */
var FAILURE_MARKER = "nataliaRuntimeFailure";
function mark(error, data) {
    Object.defineProperty(error, FAILURE_MARKER, {
        value: data,
        enumerable: false,
    });
    return error;
}
/**
 * Reads the failure classification off an error, or `undefined` when the error
 * carries none. An unclassified error is deliberately *not* guessed at: it is
 * treated as internal, because inferring policy from prose is the failure mode
 * this module replaces.
 */
function runtimeFailureData(value) {
    if (!value || typeof value !== "object")
        return undefined;
    var data = value[FAILURE_MARKER];
    return data && typeof data === "object" ? data : undefined;
}
/**
 * Policy or state says no, and the operation has no return value able to say it.
 * Prefer a value; see this module's header.
 */
var RuntimeRefusal = /** @class */ (function (_super) {
    __extends(RuntimeRefusal, _super);
    function RuntimeRefusal(reason) {
        var _this = _super.call(this, reason) || this;
        _this.name = "RuntimeRefusal";
        mark(_this, { kind: "refused", reason: reason });
        return _this;
    }
    return RuntimeRefusal;
}(Error));
exports.RuntimeRefusal = RuntimeRefusal;
/**
 * This runtime does not implement the member, even though the route exists and
 * the type says the member is optional. Thrown by a runtime whose optional
 * dependency is absent — a terminal host that was never configured, for
 * instance — so the consumer hides the feature instead of retrying.
 */
var RuntimeNotSupported = /** @class */ (function (_super) {
    __extends(RuntimeNotSupported, _super);
    function RuntimeNotSupported(member, capability) {
        var _this = _super.call(this, "this runtime does not support ".concat(member)) || this;
        _this.name = "RuntimeNotSupported";
        mark(_this, { kind: "notSupported", member: member, capability: capability });
        return _this;
    }
    return RuntimeNotSupported;
}(Error));
exports.RuntimeNotSupported = RuntimeNotSupported;
/** The caller's arguments are wrong. Its message describes only the input. */
var RuntimeInvalidParams = /** @class */ (function (_super) {
    __extends(RuntimeInvalidParams, _super);
    function RuntimeInvalidParams(message) {
        var _this = _super.call(this, message) || this;
        _this.name = "RuntimeInvalidParams";
        mark(_this, { kind: "invalidParams" });
        return _this;
    }
    return RuntimeInvalidParams;
}(Error));
exports.RuntimeInvalidParams = RuntimeInvalidParams;
/**
 * No route by that name. Distinct from `RuntimeNotSupported`, which means the
 * route exists: one says "you and I disagree about the protocol", the other says
 * "this deployment cannot do that".
 */
var RuntimeMethodNotFound = /** @class */ (function (_super) {
    __extends(RuntimeMethodNotFound, _super);
    function RuntimeMethodNotFound(method) {
        var _this = _super.call(this, "unknown method: ".concat(method)) || this;
        _this.name = "RuntimeMethodNotFound";
        mark(_this, { kind: "methodNotFound", method: method });
        return _this;
    }
    return RuntimeMethodNotFound;
}(Error));
exports.RuntimeMethodNotFound = RuntimeMethodNotFound;
/** The envelope was not a request object at all. */
var RuntimeInvalidRequest = /** @class */ (function (_super) {
    __extends(RuntimeInvalidRequest, _super);
    function RuntimeInvalidRequest() {
        var _this = _super.call(this, "Invalid Request") || this;
        _this.name = "RuntimeInvalidRequest";
        mark(_this, { kind: "invalidRequest" });
        return _this;
    }
    return RuntimeInvalidRequest;
}(Error));
exports.RuntimeInvalidRequest = RuntimeInvalidRequest;
/** Consumer-side view of a failed call: a code, a kind, and structured data. */
var RuntimeRPCError = /** @class */ (function (_super) {
    __extends(RuntimeRPCError, _super);
    function RuntimeRPCError(input) {
        var _this = _super.call(this, input.message) || this;
        _this.name = "RuntimeRPCError";
        _this.code = input.code;
        _this.method = input.method;
        _this.data = input.data;
        return _this;
    }
    return RuntimeRPCError;
}(Error));
exports.RuntimeRPCError = RuntimeRPCError;
/**
 * What kind of failure this is, for a consumer that caught something. Returns
 * `undefined` for errors that never crossed the protocol (a fetch failure, an
 * abort), which a consumer must handle as a transport problem rather than an
 * answer from the runtime.
 */
function failureKind(value) {
    var _a, _b;
    if (value instanceof RuntimeRPCError)
        return (_a = KIND_BY_CODE.get(value.code)) !== null && _a !== void 0 ? _a : undefined;
    return (_b = runtimeFailureData(value)) === null || _b === void 0 ? void 0 : _b.kind;
}
/** The failure kind a code stands for, or `undefined` for a code we do not use. */
function failureKindOfCode(code) {
    return KIND_BY_CODE.get(code);
}
/**
 * The SDK understands API version N, and the runtime speaks a newer one. The
 * SDK refuses to guess: a changed protocol read with old assumptions is the
 * silent-breakage class this error exists to make loud. Both versions are on
 * the error so a consumer can decide (upgrade the SDK, or accept the gap).
 */
var RuntimeVersionMismatchError = /** @class */ (function (_super) {
    __extends(RuntimeVersionMismatchError, _super);
    function RuntimeVersionMismatchError(input) {
        var _this = _super.call(this, "runtime API version ".concat(input.serverVersion, " is newer than this SDK supports (").concat(input.supportedVersion, ")")) || this;
        _this.name = "RuntimeVersionMismatchError";
        _this.serverVersion = input.serverVersion;
        _this.supportedVersion = input.supportedVersion;
        return _this;
    }
    return RuntimeVersionMismatchError;
}(Error));
exports.RuntimeVersionMismatchError = RuntimeVersionMismatchError;
