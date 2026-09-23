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
exports.createCheckpointFactory = createCheckpointFactory;
var node_path_1 = require("node:path");
var checkpoint_controller_1 = require("./checkpoint-controller");
/**
 * The checkpoint subsystem factory — framework-internal, not a plugin.
 *
 * Owns one checkpoint controller per session, so repeated accessor
 * construction for the same session returns the same controller and its
 * store/rollback policy state is preserved across calls.
 */
function createCheckpointFactory(input) {
    var controllers = new Map();
    return Object.assign(function (accessors) {
        var sessionID = accessors.sessionID();
        var existing = controllers.get(sessionID);
        if (existing)
            return existing;
        var controller = (0, checkpoint_controller_1.createCheckpointController)(__assign({ workspaceRoot: input.workspaceRoot, storeDir: input.checkpointDir
                ? (0, node_path_1.join)(input.checkpointDir, sessionID)
                : undefined }, accessors));
        controllers.set(sessionID, controller);
        return controller;
    }, {
        close: function () {
            controllers.clear();
        },
    });
}
