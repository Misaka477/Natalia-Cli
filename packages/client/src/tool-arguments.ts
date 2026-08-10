/**
 * Reading the raw arguments of a tool call.
 *
 * A model writes these as a JSON string, so nothing about them is guaranteed.
 * `parseToolArguments` throws, for the boundary that must reject a malformed call.
 * `tryParseToolArguments` gives up quietly, for the places that only glance at an
 * argument — a policy check or an approval preview must not fail a call because it
 * could not read its arguments, since the tool boundary validates them properly
 * and reports it there.
 */
export function parseToolArguments(input: string) {
  if (!input.trim()) return {};
  return JSON.parse(input) as unknown;
}

export function tryParseToolArguments(input: string) {
  try {
    const parsed = parseToolArguments(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    // Detailed malformed-input validation happens at the normal tool boundary.
  }
  return {};
}
