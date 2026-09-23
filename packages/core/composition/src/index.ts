export * from "./rows";
export * from "./profile";
export * from "./service-tokens";
export * from "./switch";
export * from "./verification";
import { ObjectStore } from "@anthelia/object-store";
import type {
  ConfigV3,
  ConstitutionRule,
  RuntimeEvent,
} from "@anthelia/contracts";
import {
  GENERATION_SCHEMA,
  type CompositionPointer,
  type Generation,
  type GenerationPluginRef,
} from "@anthelia/contracts";

/**
 * The composition generation store (master plan P2 / NGM study G1).
 *
 * A generation is content-addressed through the object store: identical
 * content produces the identical id, so generations deduplicate for free and
 * the id is a stable handle for the journal's `composition.switched` events.
 * Nothing here mutates a stored generation — a change is a new object, which
 * is what makes the running composition immutable and the candidate/rollback
 * model (G2-G4) possible on top.
 */

/** Serializes a generation deterministically. */
export function serializeGeneration(generation: Generation): string {
  return JSON.stringify(generation);
}

/** Parses and schema-checks a stored generation. */
export function parseGeneration(text: string): Generation {
  const parsed = JSON.parse(text) as Generation;
  if (parsed?.schema !== GENERATION_SCHEMA)
    throw new Error(
      `unknown generation schema: ${String(parsed?.schema)} (expected ${GENERATION_SCHEMA})`,
    );
  if (!Array.isArray(parsed.plugins))
    throw new Error("generation is missing its plugin catalog");
  // Generations stored before the constitution face existed carry no rows;
  // reading them as "carries no policy" is honest (the gate then fails
  // closed against active rules rather than inventing rows).
  return { ...parsed, policyRows: parsed.policyRows ?? [] };
}

/** Stores a generation, returning its content id. */
export async function storeGeneration(
  store: ObjectStore,
  generation: Generation,
): Promise<string> {
  return await store.put(serializeGeneration(generation));
}

/** Loads a generation by content id. */
export async function loadGeneration(
  store: ObjectStore,
  id: string,
): Promise<Generation> {
  const bytes = await store.get(id);
  return parseGeneration(bytes.toString("utf8"));
}

/** Builds a generation from the live config and the desired catalog. */
export function buildGeneration(input: {
  config: ConfigV3;
  catalog: ReadonlyArray<{
    id: string;
    enabled: boolean;
    fingerprint: string;
  }>;
  /**
   * The constitution rows this generation carries. Required rather than
   * defaulted: a generation that silently carries no policy would pass the
   * gate's constitution face by emptiness while the user's rules are active.
   */
  policyRows: readonly ConstitutionRule[];
}): Generation {
  const plugins: GenerationPluginRef[] = input.catalog
    .map(({ id, enabled, fingerprint }) => ({ id, enabled, fingerprint }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const policyRows = [...input.policyRows].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  return {
    schema: GENERATION_SCHEMA,
    config: input.config,
    plugins,
    policyRows,
  };
}

/**
 * Derives the composition pointer from an event stream.
 *
 * `current`/`previous` come from the recorded switches: the last switch wins,
 * its `from` becomes the rollback target. `candidate` is the most recent
 * proposal that was never switched to — the staged-but-uncommitted state.
 * A proposal that a later switch commits stops being a candidate. A stream
 * without any of these has no pointer, which is a valid state: the
 * composition existed before anyone pointed at it.
 */
export function deriveCompositionPointer(
  events: Iterable<RuntimeEvent>,
): CompositionPointer {
  let current: string | undefined;
  let previous: string | undefined;
  let candidate: string | undefined;
  for (const event of events) {
    if (event.type === "composition.switched") {
      previous = event.from ?? previous;
      current = event.to;
      if (candidate === event.to) candidate = undefined;
      continue;
    }
    if (event.type === "composition.proposed") candidate = event.candidateID;
  }
  return {
    ...(current ? { current } : {}),
    ...(previous ? { previous } : {}),
    ...(candidate ? { candidate } : {}),
  };
}
