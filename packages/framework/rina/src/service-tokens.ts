import { defineService } from "@anthelia/runtime-services";
import type { CacheFabric } from "./cache";
import type { RinaMemoryService } from "./memory";
import type { ResponseCache } from "./response-cache";
import type { RinaVaultService } from "./vault";

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
/**
 * RINA Memory (Phase 7): the durable reusable knowledge store, one per
 * runtime, its own SQLite beside the vault's (the study's 复用冷档存储).
 * Its scope is the runtime's lifetime — the face that reads it is the
 * knowledge recall priority (State -> Workspace -> Global -> Vault).
 */
export const rinaMemory = defineService<RinaMemoryService>("rina.memory", {
  scope: "process",
  capability: "services",
});

export const rinaCache = defineService<CacheFabric>("rina.cache", {
  scope: "workspace",
  capability: "services",
});

export const rinaVault = defineService<RinaVaultService>("rina.vault", {
  scope: "process",
  capability: "services",
});

/**
 * The Phase 4 response cache: process-scoped, one per runtime, its own
 * metrics and default-off switch. The study's isolation rule rides the
 * key (sessionID is a key part), so a single process-wide cache never
 * spills one session's answers into another's.
 */
export const rinaResponseCache = defineService<ResponseCache>(
  "rina.response-cache",
  {
    scope: "process",
    capability: "services",
  },
);
