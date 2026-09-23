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
exports.sandboxTools = exports.sandboxToolFamily = exports.SnapshotStore = exports.createSandboxController = exports.SandboxPromotionConflict = exports.SnapshotSandboxManager = exports.WorktreeSandboxManager = exports.riskTierForPath = exports.riskTierForChanges = exports.requiresApproval = void 0;
/**
 * `@anthelia/sandbox` — the sandbox backends and their governance.
 *
 * `WorkspaceSandboxManager` is the directory-copy backend; `WorktreeSandboxManager`
 * extends it with git worktree/candidate/promotion/rollback semantics and is the
 * production backend when the workspace is a git repo. Both share the operational
 * surface (execute, resources, file ops, persistence).
 */
__exportStar(require("./workspace-manager"), exports);
var governance_1 = require("./governance");
Object.defineProperty(exports, "requiresApproval", { enumerable: true, get: function () { return governance_1.requiresApproval; } });
Object.defineProperty(exports, "riskTierForChanges", { enumerable: true, get: function () { return governance_1.riskTierForChanges; } });
Object.defineProperty(exports, "riskTierForPath", { enumerable: true, get: function () { return governance_1.riskTierForPath; } });
var worktree_sandbox_1 = require("./worktree-sandbox");
Object.defineProperty(exports, "WorktreeSandboxManager", { enumerable: true, get: function () { return worktree_sandbox_1.WorktreeSandboxManager; } });
var snapshot_sandbox_1 = require("./snapshot-sandbox");
Object.defineProperty(exports, "SnapshotSandboxManager", { enumerable: true, get: function () { return snapshot_sandbox_1.SnapshotSandboxManager; } });
var snapshot_store_1 = require("./snapshot-store");
Object.defineProperty(exports, "SandboxPromotionConflict", { enumerable: true, get: function () { return snapshot_store_1.SandboxPromotionConflict; } });
var sandbox_controller_1 = require("./sandbox-controller");
Object.defineProperty(exports, "createSandboxController", { enumerable: true, get: function () { return sandbox_controller_1.createSandboxController; } });
var snapshot_store_2 = require("./snapshot-store");
Object.defineProperty(exports, "SnapshotStore", { enumerable: true, get: function () { return snapshot_store_2.SnapshotStore; } });
var tools_1 = require("./tools");
Object.defineProperty(exports, "sandboxToolFamily", { enumerable: true, get: function () { return tools_1.sandboxToolFamily; } });
Object.defineProperty(exports, "sandboxTools", { enumerable: true, get: function () { return tools_1.sandboxTools; } });
