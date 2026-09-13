export function memoryTrace(
  label: string,
  extra?: Record<string, unknown>,
): void {
  if (process.env.NATALIA_MEMORY_TRACE !== "1") return;
  const usage = process.memoryUsage();
  console.warn(`[mem-trace] ${label}`, {
    rssMB: Math.round(usage.rss / 1048576),
    heapMB: Math.round(usage.heapUsed / 1048576),
    externalMB: Math.round(usage.external / 1048576),
    arrayBuffersMB: Math.round(usage.arrayBuffers / 1048576),
    ...extra,
  });
}
