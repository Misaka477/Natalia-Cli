"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeadlessRuntime = void 0;
var HeadlessRuntime = /** @class */ (function () {
    function HeadlessRuntime(options) {
        if (options === void 0) { options = {}; }
        var _a, _b;
        this.listeners = new Set();
        this.maxStepsPerTurn = (_a = options.maxStepsPerTurn) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY;
        this.requestTimeoutSec = (_b = options.requestTimeoutSec) !== null && _b !== void 0 ? _b : 120;
    }
    HeadlessRuntime.prototype.onEvent = function (listener) {
        var _this = this;
        this.listeners.add(listener);
        return function () { return _this.listeners.delete(listener); };
    };
    HeadlessRuntime.prototype.emit = function (event) {
        for (var _i = 0, _a = this.listeners; _i < _a.length; _i++) {
            var listener = _a[_i];
            listener(event);
        }
    };
    return HeadlessRuntime;
}());
exports.HeadlessRuntime = HeadlessRuntime;
