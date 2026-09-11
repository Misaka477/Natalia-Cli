import { expect, test } from "bun:test";
import {
  RUNTIME_RPC_ERROR_CODES,
  type InputMutationResult,
  type RuntimeClient,
  type RuntimeEvent,
} from "@natalia/contracts";
import { handleRPCMessage } from "../src/host";

function stubClient(overrides: Partial<RuntimeClient> = {}): RuntimeClient {
  return {
    start() {},
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_1",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "stub",
      };
    },
    cancel() {},
    snapshot(): RuntimeEvent {
      return { type: "diagnostic", level: "info", message: "stub" };
    },
    diagnostic() {},
    lastSubmission() {
      return undefined;
    },
    respondApproval() {
      return { accepted: true };
    },
    respondQuestion() {
      return { accepted: true };
    },
    ...overrides,
  };
}

const result: InputMutationResult = {
  ok: true,
  input: { id: "in_1", text: "queued", delivery: "next-turn" },
};

test("input.remove/replace/promote validate params and delegate", async () => {
  const calls: Array<[string, unknown]> = [];
  const client = stubClient({
    async removeInput(input) {
      calls.push(["removeInput", input]);
      return result;
    },
    async replaceInput(input) {
      calls.push(["replaceInput", input]);
      return result;
    },
    async promoteInput(input) {
      calls.push(["promoteInput", input]);
      return result;
    },
  });

  const remove = await handleRPCMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "input.remove",
      params: { id: "in_1", sessionID: "ses_1" },
    },
    client,
  );
  expect(remove.result).toEqual(result);
  const replace = await handleRPCMessage(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "input.replace",
      params: { id: "in_1", text: "edited", sessionID: "ses_1" },
    },
    client,
  );
  expect(replace.result).toEqual(result);
  const promote = await handleRPCMessage(
    { jsonrpc: "2.0", id: 3, method: "input.promote", params: { id: "in_1" } },
    client,
  );
  expect(promote.result).toEqual(result);

  expect(calls).toEqual([
    ["removeInput", { id: "in_1", sessionID: "ses_1" }],
    ["replaceInput", { id: "in_1", text: "edited", sessionID: "ses_1" }],
    ["promoteInput", { id: "in_1" }],
  ]);
});

test("input mutations reject malformed params before touching the runtime", async () => {
  const client = stubClient({
    async removeInput() {
      throw new Error("must not be reached");
    },
    async replaceInput() {
      throw new Error("must not be reached");
    },
  });

  const missingId = await handleRPCMessage(
    { jsonrpc: "2.0", id: 1, method: "input.remove", params: {} },
    client,
  );
  expect(missingId.error?.code).toBe(RUNTIME_RPC_ERROR_CODES.invalidParams);
  expect(missingId.result).toBeUndefined();

  const missingText = await handleRPCMessage(
    { jsonrpc: "2.0", id: 2, method: "input.replace", params: { id: "in_1" } },
    client,
  );
  expect(missingText.error?.code).toBe(RUNTIME_RPC_ERROR_CODES.invalidParams);

  const badSession = await handleRPCMessage(
    {
      jsonrpc: "2.0",
      id: 3,
      method: "input.promote",
      params: { id: "in_1", sessionID: 7 },
    },
    client,
  );
  expect(badSession.error?.code).toBe(RUNTIME_RPC_ERROR_CODES.invalidParams);
});
