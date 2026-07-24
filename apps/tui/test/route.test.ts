import { expect, test } from "bun:test";
import { createRouteController } from "../src/context/route";

test("route close clears the subagent navigation stack", () => {
  const route = createRouteController();
  route.push({ kind: "subagent", id: "agent_a" });
  route.replace({ kind: "subagent", id: "agent_b" });
  route.close();
  route.back();
  expect(route.route()).toEqual({ kind: "none" });
});

test("subagent detail route returns to the parent session view", () => {
  const route = createRouteController();
  route.push({ kind: "subagent", id: "agent_a" });
  expect(route.route()).toEqual({ kind: "subagent", id: "agent_a" });
  route.back();
  expect(route.route()).toEqual({ kind: "none" });
});

test("terminal workspace route participates in navigation history", () => {
  const route = createRouteController();
  route.push({ kind: "subagent", id: "agent_a" });
  route.push({ kind: "terminal", id: "tty_a" });
  expect(route.route()).toEqual({ kind: "terminal", id: "tty_a" });
  route.back();
  expect(route.route()).toEqual({ kind: "subagent", id: "agent_a" });
  route.back();
  expect(route.route()).toEqual({ kind: "none" });
});
