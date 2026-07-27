import type { MessageBlock } from "./context/state";

export const historyCacheLimit = 300;
export const historyCacheWatermark = 240;

export type HistoryCacheResult = {
  messages: MessageBlock[];
  evicted: boolean;
};

/** Keeps whole user turns only; durable history remains cursor-reloadable. */
export function boundHistoryCache(
  messages: MessageBlock[],
  direction: "older" | "newer",
): HistoryCacheResult {
  if (messages.length <= historyCacheLimit) return { messages, evicted: false };
  const excess = messages.length - historyCacheWatermark;
  if (direction === "older") {
    let start = messages.length;
    let removed = 0;
    while (start > 0) {
      start--;
      removed++;
      if (removed >= excess && messages[start]?.role === "user") break;
    }
    return { messages: messages.slice(0, start), evicted: true };
  }
  let end = 0;
  let removed = 0;
  while (end < messages.length) {
    if (removed >= excess && end > 0 && messages[end]?.role === "user") break;
    end++;
    removed++;
  }
  return { messages: messages.slice(end), evicted: true };
}
