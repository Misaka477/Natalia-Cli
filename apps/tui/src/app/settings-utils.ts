export function parseSettingsStringRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return undefined;
    return Object.entries(parsed).every(([, item]) => typeof item === "string")
      ? (parsed as Record<string, string>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function parseSettingsRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function parseCompactionThreshold(value: string) {
  const threshold = Number(value.trim());
  return Number.isInteger(threshold) && threshold >= 50 && threshold <= 99
    ? threshold
    : undefined;
}
