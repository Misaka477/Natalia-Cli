"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cssVar = cssVar;
/**
 * Reads a CSS custom property from the document root. This lets JS-rendered
 * surfaces (CodeMirror, xterm, canvas renderers) follow the active UiSkin
 * without hardcoding colors.
 */
function cssVar(name, fallback) {
    if (fallback === void 0) { fallback = ""; }
    if (typeof document === "undefined")
        return fallback;
    var value = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    return value || fallback;
}
