import { expect, test } from "bun:test";
import {
  buildAgentModelOptions,
  buildAgentDetailOptions,
  buildAgentOptions,
  buildAgentVariantOptions,
} from "../src/component/DialogAgent";
import { configV2Schema } from "@natalia/contracts";

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

test("agent override options use the configured model catalog and variants", () => {
  const config = configV2Schema.parse({
    version: 2,
    defaultModel: "alpha",
    models: {
      alpha: { provider: "local", model: "alpha" },
      beta: {
        provider: "local",
        model: "beta",
        variants: { careful: { model: "beta-careful" } },
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
  ).toEqual(["", "alpha", "beta"]);
  expect(
    buildAgentVariantOptions(config, "beta").map((option) => option.value),
  ).toEqual(["", "careful"]);
});
