import type { ErrorKind } from "@natalia/contracts";

export type { ErrorKind } from "@natalia/contracts";

export type ProviderErrorInput = {
  kind: ErrorKind;
  message: string;
  statusCode?: number;
  retryAfterMs?: number;
  cause?: unknown;
};

export class ProviderError extends Error {
  readonly kind: ErrorKind;
  readonly statusCode?: number;
  readonly retryAfterMs?: number;
  override readonly cause?: unknown;

  constructor(input: ProviderErrorInput) {
    super(input.message);
    this.name = "ProviderError";
    this.kind = input.kind;
    this.statusCode = input.statusCode;
    this.retryAfterMs = input.retryAfterMs;
    this.cause = input.cause;
  }
}

export function providerError(input: ProviderErrorInput) {
  return new ProviderError(input);
}

export function asProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return providerError({
      kind: "timeout",
      message: "provider request timed out",
      cause: error,
    });
  }
  return providerError({
    kind: "connection",
    message: "provider connection failed",
    cause: error,
  });
}

export function mapHttpStatusToErrorKind(statusCode: number): ErrorKind {
  if (statusCode === 408) return "timeout";
  if (statusCode === 429) return "rate_limit";
  if ([500, 502, 503, 504].includes(statusCode)) return "server";
  if (statusCode === 401 || statusCode === 403) return "auth";
  if ([400, 404, 422].includes(statusCode)) return "invalid_request";
  return statusCode >= 500 ? "server" : "invalid_request";
}

export function providerErrorFromHttp(input: {
  statusCode: number;
  statusText?: string;
  retryAfter?: string | null;
  message?: string;
  bodyCode?: string;
}) {
  const kind =
    input.bodyCode === "context_length_exceeded"
      ? "context_limit"
      : mapHttpStatusToErrorKind(input.statusCode);
  return providerError({
    kind,
    statusCode: input.statusCode,
    retryAfterMs: parseRetryAfterMs(input.retryAfter),
    message:
      input.message ?? input.statusText ?? `provider HTTP ${input.statusCode}`,
  });
}

export function parseRetryAfterMs(value?: string | null, now = Date.now()) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.round(seconds * 1000);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, date - now);
}

export function redactedProviderMessage(error: ProviderError) {
  return `${error.kind}${error.statusCode ? ` (${error.statusCode})` : ""}`;
}
