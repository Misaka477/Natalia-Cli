import type { RuntimeEvent } from "@natalia/contracts";

export function retryDisplayLine(event: RuntimeEvent) {
  if (event.type === "step.retry") {
    return `Retrying after ${event.reason}${event.statusCode ? ` (${event.statusCode})` : ""} · attempt ${event.attempt}/${event.maxAttempts} · waiting ${formatWait(event.waitMs)}`;
  }
  if (event.type === "step.retry.cleared") {
    return `Retry recovered after ${event.attempts} attempts`;
  }
  if (event.type === "step.retry.exhausted") {
    return `Retry exhausted after ${event.attempts}/${event.maxAttempts}: ${event.message}`;
  }
  return undefined;
}

function formatWait(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
