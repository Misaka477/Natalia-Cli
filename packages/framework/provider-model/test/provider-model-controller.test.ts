import { expect, test } from "bun:test";
import type { ProviderModelControllerInput } from "@natalia/runtime-services";
import { createProviderModelController } from "../src";

function controllerInput(
  onInitialize: () => void,
): ProviderModelControllerInput {
  return {
    initialize: onInitialize,
    runnerInput: () => {
      throw new Error("runner input should remain lazy");
    },
    commands: {
      catalog: async () => [],
      select: async () => undefined,
    },
    chat: {
      available: () => false,
      publish() {},
      runBody: async () => undefined,
      wake: async () => undefined,
    },
  };
}

test("provider model controller initializes and disposes chat work", async () => {
  let initialized = 0;
  const controller = createProviderModelController(
    controllerInput(() => {
      initialized += 1;
    }),
  );
  expect(initialized).toBe(1);

  await controller.dispose();
  await expect(
    controller.runChatTurn({
      sessionID: "ses_test" as never,
      text: "hello",
      responseMessageID: "msg_1",
    }),
  ).rejects.toThrow("provider/model controller disposed");
});
