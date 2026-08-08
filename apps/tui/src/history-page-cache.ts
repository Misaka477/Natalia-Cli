/**
 * Transcript eviction for the paged history cache.
 *
 * The rule — evict whole user turns only — now lives in `@natalia/view-store`, so
 * every consumer of the projection gets it rather than each re-deriving it. This
 * module stays as the TUI's name for it.
 */
export {
  boundTranscript as boundHistoryCache,
  transcriptLimit as historyCacheLimit,
  transcriptWatermark as historyCacheWatermark,
} from "@natalia/view-store";
import type { TranscriptBound } from "@natalia/view-store";
import type { MessageBlock } from "./context/state";
export type HistoryCacheResult = TranscriptBound<MessageBlock>;
