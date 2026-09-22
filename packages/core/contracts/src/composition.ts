import type { ConfigV3 } from "./schema-types";

/**
 * Composition generations (master plan P2, NGM study G1).
 *
 * A generation is a named, addressable snapshot of what the runtime is made
 * of. The study's full shape also carries prompts, skills, policy rows and
 * adapter bindings; this first cut holds only the two things that are real
 * and serializable today — the resolved config and the desired plugin
 * catalog — because a generation field without a producer is a stub.
 *
 * Plugins are referenced by identity plus the catalog's content fingerprint
 * rather than by embedding manifests: the fingerprint is the entry's content
 * hash, so a generation entry addresses exactly the content it was resolved
 * against, and the catalog itself stays the one place manifests live.
 */

export const GENERATION_SCHEMA = "natalia.generation/1" as const;

export type GenerationPluginRef = {
  id: string;
  enabled: boolean;
  /** The desired-catalog fingerprint of the plugin's content. */
  fingerprint: string;
};

export type Generation = {
  schema: typeof GENERATION_SCHEMA;
  /** The resolved runtime config this generation was composed with. */
  config: ConfigV3;
  /** The desired plugin catalog, by identity and content fingerprint. */
  plugins: GenerationPluginRef[];
};

/**
 * The generation pointer. It is derived from the journal rather than stored
 * beside it: the journal is the single source of truth, and a pointer record
 * that disagreed with the event stream would be a second source of truth.
 */
export type CompositionPointer = {
  /** The generation running now, if any switch has been recorded. */
  current?: string;
  /** The generation before the current one: the rollback target. */
  previous?: string;
  /** A staged candidate, once candidate staging exists. */
  candidate?: string;
};
