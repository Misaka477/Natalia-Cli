import { expect, test } from "bun:test";
import {
  buildAgentModelOptions,
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
        systemPrompt: "",
        mode: "primary",
        hidden: false,
        allowedTools: [],
        excludedTools: [],
        mcpServers: [],
      },
      {
        name: "worker",
        description: "",
        systemPrompt: "",
        mode: "subagent",
        hidden: false,
        allowedTools: [],
        excludedTools: [],
        mcpServers: [],
      },
      {
        name: "hidden",
        description: "",
        systemPrompt: "",
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
    systemPrompt: "",
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
