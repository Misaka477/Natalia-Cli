import type { RuntimeClient } from "@natalia/contracts";

export function openExternalTerminal(input: { backend: RuntimeClient }) {
  if (!input.backend.nativeTerminalOpenHub)
    throw new Error("Native Terminal Host is unavailable in this runtime.");
  return input.backend.nativeTerminalOpenHub();
}
