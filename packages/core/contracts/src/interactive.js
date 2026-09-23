"use strict";
/**
 * Interactive protocol types shared between the runtime and any UI.
 *
 * These belong to contracts (the kernel's shared-contract layer), not to a UI
 * package, so the kernel never depends on a host: `@natalia/ui-model` imports
 * them from here rather than the reverse (audit A-03, contracts -> ui-model).
 */
Object.defineProperty(exports, "__esModule", { value: true });
