"use strict";
/**
 * The engine substrate's public surface.
 *
 * Worker entrypoints (`.worker.ts`) are deliberately NOT re-exported:
 * they execute `parentPort`-guarded code at module load, and pulling one
 * into the barrel would throw on the very first main-thread import of
 * this package. A worker is instantiated by path/URL, never imported.
 */
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
__exportStar(require("./context"), exports);
__exportStar(require("./initialize-types"), exports);
__exportStar(require("./options"), exports);
__exportStar(require("./performance-trace"), exports);
__exportStar(require("./plan-doc-port"), exports);
__exportStar(require("./plugin-discovery"), exports);
__exportStar(require("./plugin-mount"), exports);
__exportStar(require("./plugin-owner"), exports);
__exportStar(require("./plugins-controller"), exports);
__exportStar(require("./ports"), exports);
__exportStar(require("./ports-client-surface"), exports);
__exportStar(require("./ports-extra"), exports);
__exportStar(require("./ports-initialize"), exports);
__exportStar(require("./projection-contributions"), exports);
__exportStar(require("./repository-refs"), exports);
__exportStar(require("./session-event-retention"), exports);
__exportStar(require("./session-event-window"), exports);
__exportStar(require("./session-execution-state"), exports);
__exportStar(require("./session-facts"), exports);
__exportStar(require("./session-full-events"), exports);
__exportStar(require("./session-project-client"), exports);
__exportStar(require("./session-window"), exports);
__exportStar(require("./status-config"), exports);
__exportStar(require("./transcript-page"), exports);
__exportStar(require("./worker-pool"), exports);
