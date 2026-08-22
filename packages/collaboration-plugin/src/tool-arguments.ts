function parseToolArguments(input: string) {
  if (!input.trim()) return {};
  return JSON.parse(input) as unknown;
}

export function tryParseToolArguments(input: string) {
  try {
    const parsed = parseToolArguments(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    // Detailed malformed-input validation happens at the tool boundary.
  }
  return {};
}

export { parseToolArguments };
