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
exports.createRetryService = createRetryService;
var runtime_1 = require("@natalia/runtime");
function createRetryService(input) {
    return {
        policy: input.policy,
        run: function (context, fn, options) {
            if (options === void 0) { options = {}; }
            return (0, runtime_1.runWithRetry)(context, fn, __assign(__assign({}, options), { policy: input.policy() }));
        },
    };
}
