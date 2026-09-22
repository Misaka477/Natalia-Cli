import { ObjectStore } from "@natalia/object-store";
import type { ConfigV3, RuntimeEvent } from "@natalia/contracts";
import {
  GENERATION_SCHEMA,
  type CompositionPointer,
  type Generation,
  type GenerationPluginRef,
} from "@natalia/contracts";

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
  return parsed;
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
}): Generation {
  const plugins: GenerationPluginRef[] = input.catalog
    .map(({ id, enabled, fingerprint }) => ({ id, enabled, fingerprint }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    schema: GENERATION_SCHEMA,
    config: input.config,
    plugins,
  };
}

/**
 * Derives the composition pointer from an event stream. The last recorded
 * switch wins (`to` becomes current, its `from` becomes previous); a stream
 * without switches has no pointer, which is a valid state — the composition
 * existed before anyone pointed at it.
 */
export function deriveCompositionPointer(
  events: Iterable<RuntimeEvent>,
): CompositionPointer {
  let current: string | undefined;
  let previous: string | undefined;
  for (const event of events) {
    if (event.type !== "composition.switched") continue;
    previous = event.from ?? previous;
    current = event.to;
  }
  return {
    ...(current ? { current } : {}),
    ...(previous ? { previous } : {}),
  };
}
