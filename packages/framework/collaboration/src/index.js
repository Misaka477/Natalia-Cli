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
exports.terminalInputRisk = exports.terminalApprovalScope = exports.readOnlyToolMessage = exports.createMailboxAcknowledgeTool = exports.buildMailboxStatus = exports.buildMailboxQueued = exports.createInteractiveWaiter = exports.collaborationWaiter = exports.createCollaborationService = exports.COLLABORATION_SERVICE = exports.collaborationTools = void 0;
__exportStar(require("./contracts"), exports);
var collaboration_tools_1 = require("./collaboration-tools");
Object.defineProperty(exports, "collaborationTools", { enumerable: true, get: function () { return collaboration_tools_1.collaborationTools; } });
var collaboration_service_1 = require("./collaboration-service");
Object.defineProperty(exports, "COLLABORATION_SERVICE", { enumerable: true, get: function () { return collaboration_service_1.COLLABORATION_SERVICE; } });
Object.defineProperty(exports, "createCollaborationService", { enumerable: true, get: function () { return collaboration_service_1.createCollaborationService; } });
var interactive_waiter_1 = require("./interactive-waiter");
Object.defineProperty(exports, "collaborationWaiter", { enumerable: true, get: function () { return interactive_waiter_1.collaborationWaiter; } });
Object.defineProperty(exports, "createInteractiveWaiter", { enumerable: true, get: function () { return interactive_waiter_1.createInteractiveWaiter; } });
var runtime_services_1 = require("@natalia/runtime-services");
Object.defineProperty(exports, "buildMailboxQueued", { enumerable: true, get: function () { return runtime_services_1.buildMailboxQueued; } });
Object.defineProperty(exports, "buildMailboxStatus", { enumerable: true, get: function () { return runtime_services_1.buildMailboxStatus; } });
var runtime_services_2 = require("@natalia/runtime-services");
Object.defineProperty(exports, "createMailboxAcknowledgeTool", { enumerable: true, get: function () { return runtime_services_2.createMailboxAcknowledgeTool; } });
Object.defineProperty(exports, "readOnlyToolMessage", { enumerable: true, get: function () { return runtime_services_2.readOnlyToolMessage; } });
Object.defineProperty(exports, "terminalApprovalScope", { enumerable: true, get: function () { return runtime_services_2.terminalApprovalScope; } });
Object.defineProperty(exports, "terminalInputRisk", { enumerable: true, get: function () { return runtime_services_2.terminalInputRisk; } });
