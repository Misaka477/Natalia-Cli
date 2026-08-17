import { expect, test } from "bun:test";
import {
  buildAgentModelOptions,
  buildAgentDetailOptions,
  buildAgentOptions,
  buildAgentVariantOptions,
} from "../src/component/DialogAgent";
import { configV3Schema } from "@natalia/contracts";

test("agent dialog exposes only visible non-subagent agents", () => {
  expect(
    buildAgentOptions([
      {
        name: "review",
        description: "Review changes",
        mode: "primary",
        hidden: false,
        allowedTools: [],
        excludedTools: [],
        mcpServers: [],
      },
      {
        name: "worker",
        description: "",
        mode: "subagent",
        hidden: false,
        allowedTools: [],
        excludedTools: [],
        mcpServers: [],
      },
      {
        name: "hidden",
        description: "",
        mode: "primary",
        hidden: true,
        allowedTools: [],
        excludedTools: [],
        mcpServers: [],
      },
    ]),
  ).toEqual([
    {
      title: "review",
      value: "review",
      description: "Review changes",
      footer: undefined,
    },
  ]);
});

test("agent details retain runtime policy metadata without exposing system prompts", () => {
  expect(
    buildAgentDetailOptions({
      name: "review",
      description: "Review changes",
      mode: "primary",
      hidden: false,
      model: "beta",
      variant: "careful",
      maxSteps: 12,
      allowedTools: ["read_file"],
      excludedTools: ["run_shell"],
      mcpServers: ["docs"],
      permissions: {
        tools: { allow: ["grep"], exclude: ["write_file"] },
      },
    }),
  ).toEqual([
    { title: "Mode", value: "mode", description: "primary", disabled: true },
    {
      title: "Model",
      value: "model",
      description: "beta · careful",
      disabled: true,
    },
    { title: "Step limit", value: "steps", description: "12", disabled: true },
    {
      title: "Tool policy",
      value: "tools",
      description: "allow grep, exclude write_file",
      disabled: true,
    },
    {
      title: "MCP servers",
      value: "mcp",
      description: "docs",
      disabled: true,
    },
  ]);
});

test("agent override options use configured model refs", () => {
  const config = configV3Schema.parse({
    version: 3,
    defaultModel: { provider: "local", model: "alpha" },
    providers: {
      local: {
        name: "Local",
        driver: "openai",
        connection: { apiKey: "test" },
      },
    },
    catalog: {
      providers: {
        local: { models: { alpha: { name: "alpha" }, beta: { name: "beta" } } },
      },
    },
  });
  const agent = {
    name: "review",
    description: "",
    mode: "primary" as const,
    hidden: false,
    allowedTools: [],
    excludedTools: [],
    mcpServers: [],
  };
  expect(
    buildAgentModelOptions(config, agent).map((option) => option.value),
  ).toEqual(["", "local/alpha", "local/beta"]);
  expect(
    buildAgentVariantOptions(config, "local/beta").map(
      (option) => option.value,
    ),
  ).toEqual([""]);
});
