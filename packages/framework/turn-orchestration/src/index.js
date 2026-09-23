"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTurnController = exports.turnController = void 0;
__exportStar(require("./contracts"), exports);
var service_token_1 = require("./service-token");
Object.defineProperty(exports, "turnController", { enumerable: true, get: function () { return service_token_1.turnController; } });
var turn_controller_1 = require("./turn-controller");
Object.defineProperty(exports, "createTurnController", { enumerable: true, get: function () { return turn_controller_1.createTurnController; } });
