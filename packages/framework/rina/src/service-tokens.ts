import { defineService } from "@anthelia/runtime-services";
import type { CacheFabric } from "./cache";

/**
 * `rina.*` as a tokenized service (architecture decisions: RINA's
 * cache/memory mechanisms belong to the Anthelia engine; the contract is a
 * token).
 *
 * Consumed engine-side today — the L1 read-cache wrap in the tool pipeline
 * and the workspace write hooks. The plugin-facing `ctx.cache` port arrives
 * with the first plugin consumer, not before: a port nothing can call yet
 * is scaffolding.
 */
export const rinaCache = defineService<CacheFabric>("rina.cache", {
  scope: "workspace",
  capability: "services",
});
