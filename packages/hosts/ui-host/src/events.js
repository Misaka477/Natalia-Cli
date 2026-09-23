"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventMatches = eventMatches;
exports.createUiEventBus = createUiEventBus;
function eventMatches(type, patterns) {
    if (!patterns || patterns.length === 0)
        return true;
    return patterns.some(function (pattern) { return matchPattern(type, pattern); });
}
function matchPattern(type, pattern) {
    if (pattern === "*" || pattern === "runtime.*")
        return true;
    var normalized = pattern.startsWith("runtime.")
        ? pattern.slice("runtime.".length)
        : pattern;
    if (normalized === "*" || normalized === "")
        return true;
    if (normalized.endsWith(".*")) {
        var prefix = normalized.slice(0, -1);
        var exact = normalized.slice(0, -2);
        return type === exact || type.startsWith(prefix);
    }
    return type === pattern || type === normalized;
}
function createUiEventBus() {
    var listeners = new Set();
    return {
        emit: function (event) {
            for (var _i = 0, listeners_1 = listeners; _i < listeners_1.length; _i++) {
                var entry = listeners_1[_i];
                if (eventMatches(event.type, entry.filter))
                    entry.listener(event);
            }
        },
        subscribe: function (listener, filter) {
            var entry = { listener: listener, filter: filter };
            listeners.add(entry);
            return function () {
                listeners.delete(entry);
            };
        },
    };
}
