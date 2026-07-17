import { expect, test } from "bun:test";
import {
  FakeRetryProvider,
  retryScenarios,
  type FakeRetryOutcome,
} from "@natalia/testing";
import {
  mapHttpStatusToErrorKind,
  parseRetryAfterMs,
  providerError,
  providerErrorFromHttp,
  retryDelayMs,
  runStreamingWithRetry,
  runWithRetry,
  shouldRetryProviderError,
  type ProviderError,
} from "../src";

const noSleep = async (_ms: number) => undefined;

test("provider adapter maps status codes to typed error kinds without string contains", () => {
  expect(mapHttpStatusToErrorKind(408)).toBe("timeout");
  expect(mapHttpStatusToErrorKind(429)).toBe("rate_limit");
  expect(mapHttpStatusToErrorKind(500)).toBe("server");
  expect(mapHttpStatusToErrorKind(502)).toBe("server");
  expect(mapHttpStatusToErrorKind(503)).toBe("server");
  expect(mapHttpStatusToErrorKind(504)).toBe("server");
  expect(mapHttpStatusToErrorKind(401)).toBe("auth");
  expect(mapHttpStatusToErrorKind(403)).toBe("auth");
  expect(mapHttpStatusToErrorKind(400)).toBe("invalid_request");
  expect(mapHttpStatusToErrorKind(404)).toBe("invalid_request");
  expect(mapHttpStatusToErrorKind(422)).toBe("invalid_request");
  expect(
    providerErrorFromHttp({
      statusCode: 400,
      bodyCode: "context_length_exceeded",
    }).kind,
  ).toBe("context_limit");
});

test("retry policy retries only transient provider-neutral kinds", () => {
  for (const kind of [
    "timeout",
    "connection",
    "empty_response",
    "rate_limit",
    "server",
  ] as const) {
    expect(
      shouldRetryProviderError(providerError({ kind, message: kind })),
    ).toBe(true);
  }
  for (const kind of [
    "auth",
    "invalid_request",
    "context_limit",
    "cancel",
  ] as const) {
    expect(
      shouldRetryProviderError(providerError({ kind, message: kind })),
    ).toBe(false);
  }
});

test("backoff uses exponential jitter and bounded retry-after", () => {
  expect(
    retryDelayMs(
      providerError({ kind: "timeout", message: "timeout" }),
      1,
      undefined,
      () => 0,
    ),
  ).toBe(300);
  expect(
    retryDelayMs(
      providerError({ kind: "timeout", message: "timeout" }),
      2,
      undefined,
      () => 1,
    ),
  ).toBe(1101);
  expect(
    retryDelayMs(
      providerError({ kind: "rate_limit", message: "429", retryAfterMs: 9000 }),
      1,
    ),
  ).toBe(5000);
  expect(parseRetryAfterMs("2")).toBe(2000);
});

test("N timeout attempts then success emit StepRetry and clear banner", async () => {
  const provider = new FakeRetryProvider(retryScenarios.timeoutThenSuccess);
  const waits: number[] = [];
  const events: string[] = [];
  const result = await runFakeScenario(provider, {
    timer: async (ms) => {
      waits.push(ms);
    },
    random: () => 0,
    onEvent: (event) => events.push(event.type),
  });
  expect(result).toEqual(["final"]);
  expect(provider.attempts).toBe(3);
  expect(waits).toEqual([300, 600]);
  expect(events).toEqual(["step.retry", "step.retry", "step.retry.cleared"]);
});

test("connection, 429, 503, empty and Retry-After fixtures retry", async () => {
  for (const [name, scenario] of Object.entries({
    connectionThenSuccess: retryScenarios.connectionThenSuccess,
    rateLimitRetryAfter: retryScenarios.rateLimitRetryAfter,
    server503ThenSuccess: retryScenarios.server503ThenSuccess,
    emptyThenSuccess: retryScenarios.emptyThenSuccess,
  })) {
    const provider = new FakeRetryProvider(scenario);
    const waits: number[] = [];
    const result = await runFakeScenario(provider, {
      timer: async (ms) => {
        waits.push(ms);
      },
      random: () => 0,
    });
    expect(result.length, name).toBe(1);
    expect(provider.attempts, name).toBe(2);
    if (name === "rateLimitRetryAfter") expect(waits).toEqual([1200]);
  }
});

test("think-only abnormal failed attempt transient content does not commit", async () => {
  const provider = new FakeRetryProvider(retryScenarios.thinkOnlyThenSuccess);
  const committed: string[] = [];
  const result = await runFakeScenario(provider, {
    onCommit: (chunk) => committed.push(chunk),
    timer: noSleep,
    random: () => 0,
  });
  expect(result).toEqual(["clean final"]);
  expect(committed).toEqual(["clean final"]);
  expect(committed).not.toContain("hidden failed thought");
});

test("cancel, auth, invalid request and context limit do not retry", async () => {
  for (const kind of [
    "cancel",
    "auth",
    "invalid_request",
    "context_limit",
  ] as const) {
    const events: string[] = [];
    await expect(
      runWithRetry(
        { id: `turn_${kind}`, operation: "llm_step", step: 1 },
        async () => {
          throw providerError({ kind, message: `${kind} secret-token` });
        },
        { timer: noSleep, onEvent: (event) => events.push(event.type) },
      ),
    ).rejects.toMatchObject({ kind });
    expect(events).toEqual(["step.retry.exhausted"]);
  }
});

test("attempt exhausted emits redacted summary", async () => {
  const provider = new FakeRetryProvider(retryScenarios.exhausted);
  const messages: string[] = [];
  await expect(
    runFakeScenario(provider, {
      timer: noSleep,
      random: () => 0,
      onEvent: (event) => {
        if (event.type === "step.retry.exhausted") messages.push(event.message);
      },
    }),
  ).rejects.toMatchObject({ kind: "timeout" });
  expect(provider.attempts).toBe(3);
  expect(messages).toEqual(["timeout"]);
  expect(messages.join(" ")).not.toContain("secret");
});

async function runFakeScenario(
  provider: FakeRetryProvider,
  options: Parameters<typeof runStreamingWithRetry>[2] = {},
) {
  return runStreamingWithRetry(
    { id: "turn_retry", operation: "llm_step", step: 1 },
    async (_attempt, emitTransient) => {
      const outcome = await provider.complete(emitTransient);
      if (outcome.type === "error") throw toProviderError(outcome);
      if (outcome.type === "think-only") {
        throw providerError({
          kind: "empty_response",
          message: "think-only abnormal response",
        });
      }
      return outcome.chunks;
    },
    options,
  );
}

function toProviderError(
  outcome: Extract<FakeRetryOutcome, { type: "error" }>,
): ProviderError {
  return providerError({
    kind: outcome.kind,
    statusCode: outcome.statusCode,
    retryAfterMs: outcome.retryAfterMs,
    message: outcome.message ?? outcome.kind,
  });
}
