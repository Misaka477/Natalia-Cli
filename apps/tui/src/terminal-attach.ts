import type { RuntimeClient } from "@natalia/contracts";

export function openExternalTerminal(input: {
  backend: RuntimeClient;
  id: string;
  takeControl?: boolean;
  secureInput?: boolean;
  preferred?: string;
}) {
  if (!input.backend.nativeTerminalFocus)
    throw new Error("Native Terminal Host is unavailable in this runtime.");
  return input.backend.nativeTerminalFocus(input.id);
}
