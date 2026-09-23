"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMemoryPreferenceStore = createMemoryPreferenceStore;
function createMemoryPreferenceStore(initial) {
    if (initial === void 0) { initial = {}; }
    var values = new Map(Object.entries(initial));
    var listeners = new Set();
    return {
        get: function (key) {
            return values.get(key);
        },
        set: function (key, value) {
            values.set(key, value);
            for (var _i = 0, listeners_1 = listeners; _i < listeners_1.length; _i++) {
                var listener = listeners_1[_i];
                listener(key, value);
            }
        },
        subscribe: function (listener) {
            listeners.add(listener);
            return function () {
                listeners.delete(listener);
            };
        },
    };
}
