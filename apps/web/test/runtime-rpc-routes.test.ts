import { expect, test } from "bun:test";
import { RPC_METHOD_ROUTES } from "../src/runtime-rpc";

test("web runtime routes expose the paged transcript surfaces", () => {
  expect(RPC_METHOD_ROUTES.chatMessagesPage).toBe("chat.messages.page");
  expect(RPC_METHOD_ROUTES.subagentHistoryPage).toBe(
    "subagent.history.page",
  );
});
