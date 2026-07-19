import { expect, test } from "bun:test";
import { createRouteController } from "../src/context/route";

test("route controller pushes and returns through in-app views", () => {
  const route = createRouteController();
  expect(route.route()).toEqual({ kind: "none" });

  route.push({ kind: "settings" });
  route.push({ kind: "status" });
  expect(route.route()).toEqual({ kind: "status" });

  route.back();
  expect(route.route()).toEqual({ kind: "settings" });
  route.back();
  expect(route.route()).toEqual({ kind: "none" });
});

test("route close clears the stack and replace preserves the current back target", () => {
  const route = createRouteController();
  route.push({ kind: "sessions" });
  route.replace({ kind: "settings" });
  route.back();
  expect(route.route()).toEqual({ kind: "none" });

  route.push({ kind: "palette" });
  route.push({ kind: "status" });
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
