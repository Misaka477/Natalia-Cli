import type { CompositionProfile } from "@anthelia/composition";
import {
  RESPONSE_CACHE_COMPOSITION_ROW_ID,
  responseCacheConfigSchema,
} from "@anthelia/contracts";

/**
 * RINA Phase 4's opt-in, read from the composition row
 * (`anthelia.cache.response`): the pure half of the wire, beside the
 * store-backend row's reader. Absence (or `disabled`) = false, so a
 * profile with no row behaves exactly as before the seam existed — no
 * profile changes behavior until a drop-in says `enabled: true`. The
 * config is parsed against its schema (an unknown key or a non-boolean
 * fails fast here, the same way the loader would have refused it).
 */
export function responseCacheEnabledFromProfile(
  profile: CompositionProfile | undefined,
): boolean {
  const row = profile?.rows.find(
    (candidate) => candidate.id === RESPONSE_CACHE_COMPOSITION_ROW_ID,
  );
  if (!row || row.disabled) return false;
  return responseCacheConfigSchema.parse(row.config).enabled;
}
