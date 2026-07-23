import { configPatch, resolveConfig, updateConfig } from "@natalia/config";
import type { ConfigV2, RuntimeAgentCatalogEntry } from "@natalia/contracts";
import { createMemo, createSignal, onMount } from "solid-js";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { useDialog } from "../dialog/provider";
import { useLocal } from "../context/local";

export function buildAgentOptions(
  agents: RuntimeAgentCatalogEntry[],
): DialogSelectOption<string>[] {
  return agents
    .filter((agent) => agent.mode !== "subagent" && !agent.hidden)
    .map((agent) => ({
      title: agent.name,
      value: agent.name,
      description: agent.description || undefined,
      footer: agent.mode === "all" ? "all modes" : undefined,
    }));
}

export function buildAgentModelOptions(
  config: ConfigV2,
  agent: RuntimeAgentCatalogEntry,
): DialogSelectOption<string>[] {
  return [
    {
      title: "Default model",
      value: "",
      description: config.defaultModel || "No default configured",
    },
    ...Object.entries(config.models).map(([name, model]) => ({
      title: name,
      value: name,
      description: `${model.model} @ ${model.provider}`,
    })),
  ];
}

export function buildAgentVariantOptions(
  config: ConfigV2,
  modelName: string,
): DialogSelectOption<string>[] {
  const model = config.models[modelName];
  return [
    { title: "Default variant", value: "" },
    ...Object.keys(model?.variants ?? {}).map((name) => ({
      title: name,
      value: name,
    })),
  ];
}

export function DialogAgent(props: {
  agents: RuntimeAgentCatalogEntry[];
  current?: string;
  selectAgent(name: string): void;
  workspaceRoot: string;
}) {
  const dialog = useDialog();
  const local = useLocal();
  const select = (option: DialogSelectOption<string>) => {
    props.selectAgent(option.value);
    local.selectAgent(option.value);
    dialog.pop();
  };
  const edit = (option: DialogSelectOption<string>) => {
    const agent = props.agents.find((item) => item.name === option.value);
    if (!agent) return;
    dialog.push(() => (
      <DialogAgentOverride workspaceRoot={props.workspaceRoot} agent={agent} />
    ));
  };
  const details = (option: DialogSelectOption<string>) => {
    const agent = props.agents.find((item) => item.name === option.value);
    if (!agent) return;
    dialog.push(() => <DialogAgentDetail agent={agent} />);
  };
  return (
    <DialogSelect
      title="Select agent"
      placeholder="Search agents"
      options={buildAgentOptions(props.agents)}
      current={props.current}
      emptyView={<text>No selectable agents configured.</text>}
      onSelect={select}
      preserveSelection
      actions={[
        {
          command: "agent.dialog.edit",
          title: "Edit",
          onTrigger: edit,
        },
        {
          command: "agent.dialog.details",
          title: "Details",
          onTrigger: details,
        },
      ]}
    />
  );
}

export function buildAgentDetailOptions(
  agent: RuntimeAgentCatalogEntry,
): DialogSelectOption<string>[] {
  const permissions = agent.permissions;
  const allowedTools = agent.allowedTools ?? [];
  const excludedTools = agent.excludedTools ?? [];
  const mcpServers = agent.mcpServers ?? [];
  const toolRules = [
    ...(permissions?.tools?.allow ?? []).map((value) => `allow ${value}`),
    ...(permissions?.tools?.exclude ?? []).map((value) => `exclude ${value}`),
  ];
  return [
    { title: "Mode", value: "mode", description: agent.mode, disabled: true },
    {
      title: "Model",
      value: "model",
      description: [agent.model ?? "Default model", agent.variant]
        .filter(Boolean)
        .join(" · "),
      disabled: true,
    },
    {
      title: "Step limit",
      value: "steps",
      description: agent.maxSteps ? String(agent.maxSteps) : "Runtime default",
      disabled: true,
    },
    {
      title: "Tool policy",
      value: "tools",
      description: toolRules.length
        ? toolRules.join(", ")
        : allowedTools.length || excludedTools.length
          ? [
              ...allowedTools.map((value) => `allow ${value}`),
              ...excludedTools.map((value) => `exclude ${value}`),
            ].join(", ")
          : "Runtime default",
      disabled: true,
    },
    {
      title: "MCP servers",
      value: "mcp",
      description: mcpServers.length
        ? mcpServers.join(", ")
        : "No agent-specific servers",
      disabled: true,
    },
  ];
}

function DialogAgentDetail(props: { agent: RuntimeAgentCatalogEntry }) {
  return (
    <DialogSelect
      title={`Agent details: ${props.agent.name}`}
      options={buildAgentDetailOptions(props.agent)}
      emptyView={<text>No agent metadata available.</text>}
    />
  );
}

function DialogAgentOverride(props: {
  workspaceRoot: string;
  agent: RuntimeAgentCatalogEntry;
}) {
  const dialog = useDialog();
  const [config, setConfig] = createSignal<ConfigV2>();
  onMount(() => {
    void resolveConfig({ workspaceRoot: props.workspaceRoot }).then(
      ({ config }) => setConfig(config),
    );
  });
  const modelName = () => props.agent.model ?? config()?.defaultModel;
  return (
    <DialogSelect
      title={`Agent override: ${props.agent.name}`}
      options={[
        {
          title: "Model",
          value: "model",
          description: props.agent.model ?? "Default model",
        },
        {
          title: "Variant",
          value: "variant",
          description: props.agent.variant ?? "Default variant",
          disabled: !modelName(),
        },
        {
          title: "System Prompt",
          value: "system",
          description: "Edit configuration override",
        },
        {
          title: "Step Limit",
          value: "steps",
          description: props.agent.maxSteps
            ? String(props.agent.maxSteps)
            : "Runtime default",
        },
        {
          title: "Allowed Tools",
          value: "allow",
          description: `${props.agent.allowedTools?.length ?? 0} tools`,
        },
        {
          title: "Excluded Tools",
          value: "exclude",
          description: `${props.agent.excludedTools?.length ?? 0} tools`,
        },
        {
          title: "MCP Servers",
          value: "mcp",
          description: `${props.agent.mcpServers?.length ?? 0} servers`,
        },
      ]}
      onSelect={(option) => {
        if (option.value === "model")
          dialog.push(() => (
            <DialogAgentModel
              workspaceRoot={props.workspaceRoot}
              agent={props.agent}
            />
          ));
        else if (option.value === "variant")
          dialog.push(() => (
            <DialogAgentVariant
              workspaceRoot={props.workspaceRoot}
              agent={props.agent}
              modelName={modelName()!}
            />
          ));
        else
          dialog.push(() => (
            <DialogAgentField
              workspaceRoot={props.workspaceRoot}
              agent={props.agent}
              field={
                option.value as "system" | "steps" | "allow" | "exclude" | "mcp"
              }
            />
          ));
      }}
    />
  );
}

function DialogAgentField(props: {
  workspaceRoot: string;
  agent: RuntimeAgentCatalogEntry;
  field: "system" | "steps" | "allow" | "exclude" | "mcp";
}) {
  const dialog = useDialog();
  const [config, setConfig] = createSignal<ConfigV2>();
  onMount(() => {
    void resolveConfig({ workspaceRoot: props.workspaceRoot }).then(
      ({ config }) => setConfig(config),
    );
  });
  const title = {
    system: "Agent System Prompt",
    steps: "Agent Step Limit",
    allow: "Agent Allowed Tools",
    exclude: "Agent Excluded Tools",
    mcp: "Agent MCP Servers",
  }[props.field];
  const placeholder =
    props.field === "system"
      ? (config()?.agents[props.agent.name]?.systemPrompt ?? "")
      : props.field === "steps"
        ? props.agent.maxSteps
          ? String(props.agent.maxSteps)
          : ""
        : props.field === "allow"
          ? (props.agent.allowedTools ?? []).join(", ")
          : props.field === "exclude"
            ? (props.agent.excludedTools ?? []).join(", ")
            : (props.agent.mcpServers ?? []).join(", ");
  return (
    <DialogPrompt
      title={title}
      description={() =>
        props.field === "steps"
          ? "Positive integer. Leave blank to use the runtime default."
          : props.field === "system"
            ? "Leave blank to clear the override."
            : "Comma-separated values."
      }
      placeholder={placeholder}
      validate={(value) =>
        props.field === "steps" &&
        value.trim() &&
        (!Number.isInteger(Number(value)) || Number(value) <= 0)
          ? "Step limit must be a positive integer."
          : undefined
      }
      onConfirm={(value) => {
        void resolveConfig({ workspaceRoot: props.workspaceRoot }).then(
          async ({ config }) => {
            const next = structuredClone(config);
            const agent = next.agents[props.agent.name];
            if (!agent) return;
            if (props.field === "system") agent.systemPrompt = value.trim();
            else if (props.field === "steps")
              agent.maxSteps = value.trim() ? Number(value) : undefined;
            else {
              const list = value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
              if (props.field === "allow") agent.allowedTools = list;
              else if (props.field === "exclude") agent.excludedTools = list;
              else agent.mcpServers = list;
            }
            await updateConfig(props.workspaceRoot, configPatch(config, next));
            dialog.pop();
          },
        );
      }}
    />
  );
}

function DialogAgentModel(props: {
  workspaceRoot: string;
  agent: RuntimeAgentCatalogEntry;
}) {
  const dialog = useDialog();
  const [config, setConfig] = createSignal<ConfigV2>();
  onMount(() => {
    void resolveConfig({ workspaceRoot: props.workspaceRoot }).then(
      ({ config }) => setConfig(config),
    );
  });
  const options = createMemo(() => {
    const value = config();
    return value ? buildAgentModelOptions(value, props.agent) : [];
  });
  const select = async (option: DialogSelectOption<string>) => {
    const resolved = config();
    if (!resolved) return;
    const next = structuredClone(resolved);
    const agent = next.agents[props.agent.name];
    if (!agent) return;
    agent.model = option.value || undefined;
    // Variants belong to a particular model and cannot outlive a model change.
    agent.variant = undefined;
    await updateConfig(props.workspaceRoot, configPatch(resolved, next));
    dialog.pop();
  };
  return (
    <DialogSelect
      title={`Model override: ${props.agent.name}`}
      options={options()}
      current={props.agent.model ?? ""}
      onSelect={(option) => void select(option)}
    />
  );
}

function DialogAgentVariant(props: {
  workspaceRoot: string;
  agent: RuntimeAgentCatalogEntry;
  modelName: string;
}) {
  const dialog = useDialog();
  const [config, setConfig] = createSignal<ConfigV2>();
  onMount(() => {
    void resolveConfig({ workspaceRoot: props.workspaceRoot }).then(
      ({ config }) => setConfig(config),
    );
  });
  const options = createMemo(() => {
    const value = config();
    return value ? buildAgentVariantOptions(value, props.modelName) : [];
  });
  const select = async (option: DialogSelectOption<string>) => {
    const resolved = config();
    if (!resolved) return;
    const next = structuredClone(resolved);
    const agent = next.agents[props.agent.name];
    if (!agent) return;
    agent.variant = option.value || undefined;
    await updateConfig(props.workspaceRoot, configPatch(resolved, next));
    dialog.pop();
  };
  return (
    <DialogSelect
      title={`Variant override: ${props.agent.name}`}
      options={options()}
      current={props.agent.variant ?? ""}
      onSelect={(option) => void select(option)}
    />
  );
}
