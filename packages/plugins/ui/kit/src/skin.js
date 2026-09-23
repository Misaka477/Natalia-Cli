"use strict";
/**
 * UI skin and layout profile protocol.
 *
 * The final goal is: writing one new skin file should be able to restyle the
 * whole UI, and a layout profile should be able to rearrange common shell
 * regions without touching component code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineUiSkin = defineUiSkin;
exports.applyUiSkin = applyUiSkin;
exports.defineUiLayoutProfile = defineUiLayoutProfile;
exports.defineUiShellLayoutPlugin = defineUiShellLayoutPlugin;
function defineUiSkin(skin) {
    return skin;
}
/**
 * Applies a skin to a root element by setting each token as a CSS custom
 * property. Also sets `data-theme` to the skin id so any CSS rules keyed on the
 * theme id keep working.
 */
function applyUiSkin(skin, root) {
    if (root === void 0) { root = typeof document !== "undefined"
        ? document.documentElement
        : undefined; }
    if (!root)
        return;
    root.dataset.theme = skin.id;
    for (var _i = 0, _a = Object.entries(skin.tokens); _i < _a.length; _i++) {
        var _b = _a[_i], name_1 = _b[0], value = _b[1];
        if (!name_1.startsWith("--"))
            continue;
        root.style.setProperty(name_1, value);
    }
}
/** Convenience for layout-only profiles that are not tied to a visual skin. */
function defineUiLayoutProfile(profile) {
    return profile;
}
function defineUiShellLayoutPlugin(plugin) {
    return plugin;
}
