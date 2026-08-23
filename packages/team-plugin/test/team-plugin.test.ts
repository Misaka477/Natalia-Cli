import { expect, test } from "bun:test";
import { createPluginRegistry, type Plugin } from "@natalia/plugin";
import {
  SANDBOX_SERVICE,
  SUBAGENTS_SERVICE,
  TEAM_BEHAVIOR_SERVICE,
  type TeamBehaviorService,
} from "@natalia/runtime-services";
import { SANDBOX_PLUGIN_ID } from "@natalia/sandbox-plugin";
import { SUBAGENTS_PLUGIN_ID } from "@natalia/subagents-plugin";
import { createToolRegistry } from "@natalia/tools";
import { createTeamPlugin, TEAM_PLUGIN_ID } from "../src/index";

function servicePlugin(input: {
  id: string;
  service: string;
  value: unknown;
}): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: input.id,
      version: "1.0.0",
      name: input.id,
      description: "test dependency",
      entry: `natalia:${input.id}`,
      scope: "workspace",
      provides: [input.service],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      api.services.provide(input.service, input.value);
    },
  };
}

test("team plugin declares its service and package dependencies", () => {
  const manifest = createTeamPlugin().manifest;
  expect(manifest.apiVersion).toBe(2);
  if (manifest.apiVersion !== 2) throw new Error("team plugin must use v2");
  expect(manifest.requires).toEqual([SUBAGENTS_SERVICE, SANDBOX_SERVICE]);
  expect(manifest.provides).toEqual([TEAM_BEHAVIOR_SERVICE]);
  expect(manifest.dependencies.map((dependency) => dependency.id)).toEqual([
    SUBAGENTS_PLUGIN_ID,
    SANDBOX_PLUGIN_ID,
  ]);
  expect(manifest.integrationPoints).toEqual(["tools", "services"]);
});

test("team plugin owns both tools and unload removes them", async () => {
  const tools = createToolRegistry([]);
  const services = new Map<string, unknown>();
  const owners = new Map<string, string>();
  const registry = createPluginRegistry({
    tools,
    service: <T>(name: string) => services.get(name) as T | undefined,
    registerOwner: (manifest) => ({
      contribute: (kind, name, payload) => {
        owners.set(`${kind}:${name}`, manifest.id);
        if (kind === "services") services.set(name, payload);
        return () => {
          owners.delete(`${kind}:${name}`);
          if (kind === "services") services.delete(name);
        };
      },
      release: () => undefined,
    }),
  });
  const subagents = { enabled: () => false };
  const sandbox = { get: () => undefined };
  await registry.load(
    servicePlugin({
      id: SUBAGENTS_PLUGIN_ID,
      service: SUBAGENTS_SERVICE,
      value: subagents,
    }),
  );
  await registry.load(
    servicePlugin({
      id: SANDBOX_PLUGIN_ID,
      service: SANDBOX_SERVICE,
      value: sandbox,
    }),
  );
  await registry.load(createTeamPlugin());

  expect([...tools.keys()]).toEqual(["team_fanout", "team_review"]);
  expect(owners.get("tools:team_fanout")).toBe(TEAM_PLUGIN_ID);
  expect(
    (services.get(TEAM_BEHAVIOR_SERVICE) as TeamBehaviorService)
      .directive()
      .includes("explicitly requested the agent team"),
  ).toBe(true);

  await registry.unload(TEAM_PLUGIN_ID);
  expect([...tools.keys()]).toEqual([]);
  expect(services.has(TEAM_BEHAVIOR_SERVICE)).toBe(false);
});
