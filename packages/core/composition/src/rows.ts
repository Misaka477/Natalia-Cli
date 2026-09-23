import {
  CONFINEMENT_COMPOSITION_ROW_ID,
  CONFINEMENT_MODES,
  OBJECTSTORE_COMPOSITION_ROW_ID,
  confinementConfigSchema,
  objectStoreConfigSchema,
} from "@anthelia/contracts";
import type { CompositionRowRegistration } from "./profile";

/**
 * THE registered rows, one list, three consumers (spec §6.5's
 * registry-as-input): the boot registers exactly this, the codegen
 * writes composition.d.ts from exactly this, and the freshness gate
 * turns red when the two ever part ways. A row enters here only with a
 * real consumer (§6.7.2 — no consumerless rows in the profile).
 */
export const compositionRowRegistrations: readonly CompositionRowRegistration[] =
  [
    {
      // The ONE row with a consumer today: the file-effect mode read by
      // the tool pipeline (round57). impl is empty on purpose — the
      // confinement backend is discovered at runtime, not selected.
      rowID: CONFINEMENT_COMPOSITION_ROW_ID,
      implIDs: [],
      legalSummary: `mode ∈ ${CONFINEMENT_MODES.join(" | ")}`,
      configSchema: confinementConfigSchema,
      configSchemaRef: {
        from: "@anthelia/contracts",
        name: "confinementConfigSchema",
      },
    },

    {
      // Decision17's factory form for the store backend: the CODE
      // registers what can be bound (the two implementations below),
      // the DATA selects what to bind (the row's `impl`); absence in a
      // profile = the TypeScript implementation, so no profile changes
      // behavior. The consumer is real today: the wire applies it to
      // configureObjectStoreBackend at boot and at every reload.
      rowID: OBJECTSTORE_COMPOSITION_ROW_ID,
      implIDs: ["typescript", "rust"],
      legalSummary: `impl ∈ typescript | rust`,
      configSchema: objectStoreConfigSchema,
      configSchemaRef: {
        from: "@anthelia/contracts",
        name: "objectStoreConfigSchema",
      },
    },
  ];
