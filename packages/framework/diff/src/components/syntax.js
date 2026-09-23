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
exports.highlightLine = highlightLine;
var lowlight_1 = require("lowlight");
var lowlight = (0, lowlight_1.createLowlight)(lowlight_1.all);
function walk(node, parts) {
    var _a, _b, _c, _d, _e;
    if (node.type === "text") {
        if (node.value)
            parts.push({ text: node.value, cls: "" });
        return;
    }
    if (node.type === "element") {
        var className = Array.isArray((_a = node.properties) === null || _a === void 0 ? void 0 : _a.className)
            ? node.properties.className.join(" ")
            : ((_c = (_b = node.properties) === null || _b === void 0 ? void 0 : _b.className) !== null && _c !== void 0 ? _c : "");
        var childParts = [];
        for (var _i = 0, _f = (_d = node.children) !== null && _d !== void 0 ? _d : []; _i < _f.length; _i++) {
            var child = _f[_i];
            walk(child, childParts);
        }
        if (!childParts.length)
            return;
        // Merge contiguous tokens under the same class.
        for (var _g = 0, childParts_1 = childParts; _g < childParts_1.length; _g++) {
            var part = childParts_1[_g];
            var cls = className ? "".concat(className, " ").concat(part.cls).trim() : part.cls;
            var last = parts.at(-1);
            if (last && last.cls === cls)
                last.text += part.text;
            else
                parts.push(__assign(__assign({}, part), { cls: cls }));
        }
        return;
    }
    for (var _h = 0, _j = (_e = node.children) !== null && _e !== void 0 ? _e : []; _h < _j.length; _h++) {
        var child = _j[_h];
        walk(child, parts);
    }
}
var MAX_AUTO_HIGHLIGHT_LENGTH = 2000;
function highlightLine(text, language) {
    try {
        // highlightAuto is extremely expensive on long/generated lines. When no
        // language hint is available, render plain text instead of blocking the UI.
        if (!language && text.length > MAX_AUTO_HIGHLIGHT_LENGTH)
            return [{ text: text, cls: "" }];
        var tree = language && lowlight.registered(language)
            ? lowlight.highlight(language, text)
            : lowlight.highlightAuto(text);
        var parts = [];
        walk(tree, parts);
        return parts.length ? parts : [{ text: text, cls: "" }];
    }
    catch (_a) {
        return [{ text: text, cls: "" }];
    }
}
