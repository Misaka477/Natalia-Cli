"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateToolParameters = validateToolParameters;
exports.assertValidToolParameters = assertValidToolParameters;
exports.validateToolOutput = validateToolOutput;
function joinPath(prefix, key) {
    return prefix ? "".concat(prefix, ".").concat(key) : key;
}
function validateToolParameters(schema, input) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        return [{ path: "", message: "expected an object" }];
    }
    return validateObject(schema, input, "");
}
function validateObject(schema, value, prefix) {
    var _a, _b;
    var errors = [];
    var properties = ((_a = schema.properties) !== null && _a !== void 0 ? _a : {});
    if (schema.additionalProperties === false) {
        for (var _i = 0, _c = Object.keys(value); _i < _c.length; _i++) {
            var key = _c[_i];
            if (!(key in properties))
                errors.push({
                    path: joinPath(prefix, key),
                    message: "unexpected property \"".concat(key, "\""),
                });
        }
    }
    for (var _d = 0, _e = (_b = schema.required) !== null && _b !== void 0 ? _b : []; _d < _e.length; _d++) {
        var key = _e[_d];
        if (!(key in value))
            errors.push({
                path: joinPath(prefix, key),
                message: "missing required property \"".concat(key, "\""),
            });
    }
    for (var _f = 0, _g = Object.entries(properties); _f < _g.length; _f++) {
        var _h = _g[_f], key = _h[0], raw = _h[1];
        if (!(key in value))
            continue;
        errors.push.apply(errors, validateValue(raw, value[key], joinPath(prefix, key)));
    }
    return errors;
}
/** Recursively validates a value, so `items`/`properties` errors carry a path. */
function validateValue(schema, value, path) {
    var type = schema.type;
    if (!type)
        return [];
    if (type === "string") {
        if (typeof value !== "string")
            return [{ path: path, message: "expected string, got ".concat(typeof value) }];
        if (typeof schema.minLength === "number" && value.length < schema.minLength)
            return [{ path: path, message: "string too short (min ".concat(schema.minLength, ")") }];
        if (typeof schema.maxLength === "number" && value.length > schema.maxLength)
            return [{ path: path, message: "string too long (max ".concat(schema.maxLength, ")") }];
        if (Array.isArray(schema.enum) &&
            !schema.enum.includes(value))
            return [
                {
                    path: path,
                    message: "expected one of: ".concat(schema.enum.join(", ")),
                },
            ];
        return [];
    }
    if (type === "number" || type === "integer") {
        if (typeof value !== "number" ||
            (type === "integer" && !Number.isInteger(value)))
            return [
                {
                    path: path,
                    message: "expected ".concat(type, ", got ").concat(typeof value).concat(typeof value === "number" ? " (non-integer)" : ""),
                },
            ];
        if (typeof schema.minimum === "number" && value < schema.minimum)
            return [{ path: path, message: "must be at least ".concat(schema.minimum) }];
        if (typeof schema.maximum === "number" && value > schema.maximum)
            return [{ path: path, message: "must be at most ".concat(schema.maximum) }];
        return [];
    }
    if (type === "boolean")
        return typeof value === "boolean"
            ? []
            : [{ path: path, message: "expected boolean, got ".concat(typeof value) }];
    if (type === "array") {
        if (!Array.isArray(value))
            return [{ path: path, message: "expected array, got ".concat(typeof value) }];
        var errors = [];
        if (typeof schema.minItems === "number" && value.length < schema.minItems)
            errors.push({
                path: path,
                message: "array too short (min ".concat(schema.minItems, ")"),
            });
        if (typeof schema.maxItems === "number" && value.length > schema.maxItems)
            errors.push({ path: path, message: "array too long (max ".concat(schema.maxItems, ")") });
        var items = schema.items;
        if (items)
            for (var index = 0; index < value.length; index += 1)
                errors.push.apply(errors, validateValue(items, value[index], "".concat(path, "[").concat(index, "]")));
        return errors;
    }
    if (type === "object") {
        if (typeof value !== "object" || value === null || Array.isArray(value))
            return [{ path: path, message: "expected object, got ".concat(typeof value) }];
        return validateObject(schema, value, path);
    }
    if (type === "null")
        return value === null ? [] : [{ path: path, message: "expected null" }];
    return [];
}
function assertValidToolParameters(schema, input) {
    var errors = validateToolParameters(schema, input);
    if (errors.length) {
        var detail = errors
            .map(function (e) { return "".concat(e.path || "(root)", ": ").concat(e.message); })
            .join("; ");
        throw new Error("tool parameter validation failed: ".concat(detail));
    }
}
/**
 * Validate a tool's output against the shape it declared.
 *
 * A tool's `execute` returns the model-facing string, not a value, so the
 * declared schema is a contract only for the tools whose result is JSON. The
 * check runs on that subset and skips everything else rather than forcing every
 * text-returning tool to wrap its output.
 *
 * A tool whose JSON has drifted from what it declared fails here, with the
 * exact paths, instead of handing the model a shape it was told to expect
 * differently — and the caller turns that into a normal tool failure.
 */
function validateToolOutput(schema, output) {
    var parsed;
    try {
        parsed = JSON.parse(output);
    }
    catch (_a) {
        // Not JSON: the schema describes a JSON result this call did not produce.
        return [];
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
        return [];
    return validateObject(schema, parsed, "value");
}
