import { expect, test } from "bun:test";
import { createPluginRegistry, type Plugin } from "@natalia/plugin";
import {
  SANDBOX_CONTROLLER_SERVICE,
  SANDBOX_PLUGIN_ID,
} from "@natalia/sandbox-plugin";
import {
  SUBAGENTS_CONTROLLER_SERVICE,
  SUBAGENTS_PLUGIN_ID,
} from "@natalia/subagents-plugin";
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
  expect(manifest.requires).toEqual([
    SUBAGENTS_CONTROLLER_SERVICE,
    SANDBOX_CONTROLLER_SERVICE,
  ]);
  expect(manifest.dependencies.map((dependency) => dependency.id)).toEqual([
    SUBAGENTS_PLUGIN_ID,
    SANDBOX_PLUGIN_ID,
  ]);
  expect(manifest.integrationPoints).toEqual(["tools"]);
});

test("team plugin owns both tools and unload removes them", async () => {
  const tools = createToolRegistry([]);
  const services = new Map<string, unknown>();
  const owners = new Map<string, string>();
  const registry = createPluginRegistry({
    tools,
    service: <T>(name: string) => services.get(name) as T | undefined,
    contribute: (manifest, context) => {
      return (kind, name, payload) => {
        const owner = context.builtin ? manifest.id : `cap:${manifest.id}`;
        owners.set(`${kind}:${name}`, owner);
        if (kind === "services") services.set(name, payload);
        return () => {
          owners.delete(`${kind}:${name}`);
          if (kind === "services") services.delete(name);
        };
      };
    },
  });
  const subagents = { enabled: () => false };
  const sandbox = { get: () => undefined };
  await registry.loadBuiltin(
    servicePlugin({
      id: SUBAGENTS_PLUGIN_ID,
      service: SUBAGENTS_CONTROLLER_SERVICE,
      value: subagents,
    }),
  );
  await registry.loadBuiltin(
    servicePlugin({
      id: SANDBOX_PLUGIN_ID,
      service: SANDBOX_CONTROLLER_SERVICE,
      value: sandbox,
    }),
  );
  await registry.loadBuiltin(createTeamPlugin());

  expect([...tools.keys()]).toEqual(["team_fanout", "team_review"]);
  expect(owners.get("tools:team_fanout")).toBe(TEAM_PLUGIN_ID);

  await registry.unload(TEAM_PLUGIN_ID);
  expect([...tools.keys()]).toEqual([]);
});
