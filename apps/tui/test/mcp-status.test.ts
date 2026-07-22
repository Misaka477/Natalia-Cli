import { expect, test } from "bun:test";
import { initialState, reduceState } from "../src/context/state";

test("MCP status events project lifecycle state for dialogs", () => {
  const state = reduceState(structuredClone(initialState), {
    type: "mcp.status",
    server: "docs",
    status: "connected",
    tools: 3,
  });
  expect(state.mcp.docs).toEqual({
    type: "mcp.status",
    server: "docs",
    status: "connected",
    tools: 3,
  });
  expect(state.footer).toBe("MCP docs: connected");
});
