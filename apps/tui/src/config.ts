/**
 * The interface-preference config moved to `@natalia/config` when the settings
 * surface went public; this module stays as the TUI's stable import path.
 */
export {
  resolveTuiConfig,
  saveTuiConfig,
  tuiConfigPath,
  tuiConfigSchema,
  type TuiConfig,
  type TuiConfigPatch,
  type TuiConfigSource,
  type TuiConfigWriteScope,
} from "@natalia/config";
