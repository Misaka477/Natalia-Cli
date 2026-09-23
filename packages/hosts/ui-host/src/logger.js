"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConsoleLogger = createConsoleLogger;
exports.createSilentLogger = createSilentLogger;
function createConsoleLogger(prefix) {
    if (prefix === void 0) { prefix = "ui-host"; }
    var format = function (message) { return "".concat(prefix, ": ").concat(message); };
    return {
        debug: function (message, extra) {
            if (extra === undefined)
                console.debug(format(message));
            else
                console.debug(format(message), extra);
        },
        info: function (message, extra) {
            if (extra === undefined)
                console.info(format(message));
            else
                console.info(format(message), extra);
        },
        warn: function (message, extra) {
            if (extra === undefined)
                console.warn(format(message));
            else
                console.warn(format(message), extra);
        },
        error: function (message, extra) {
            if (extra === undefined)
                console.error(format(message));
            else
                console.error(format(message), extra);
        },
    };
}
function createSilentLogger() {
    return {
        debug: function () { },
        info: function () { },
        warn: function () { },
        error: function () { },
    };
}
