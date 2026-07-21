import type { AgentDefinition } from "@natalia/agent";
import { resolveConfig, updateConfig } from "@natalia/config";
import type { ConfigV2 } from "@natalia/contracts";
import { createMemo, createSignal, onMount } from "solid-js";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";
import { useLocal } from "../context/local";

export function buildAgentOptions(
  agents: AgentDefinition[],
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
  agent: AgentDefinition,
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
  agents: AgentDefinition[];
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
  return (
    <DialogSelect
      title="Select agent"
      placeholder="Search agents"
      options={buildAgentOptions(props.agents)}
      current={props.current}
      emptyView={<text>No selectable agents configured.</text>}
      onSelect={select}
      onExtraKey={(_key, option) => edit(option)}
    />
  );
}

function DialogAgentOverride(props: {
  workspaceRoot: string;
  agent: AgentDefinition;
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
      ]}
      onSelect={(option) => {
        if (option.value === "model")
          dialog.push(() => (
            <DialogAgentModel
              workspaceRoot={props.workspaceRoot}
              agent={props.agent}
            />
          ));
        else
          dialog.push(() => (
            <DialogAgentVariant
              workspaceRoot={props.workspaceRoot}
              agent={props.agent}
              modelName={modelName()!}
            />
          ));
      }}
    />
  );
}

function DialogAgentModel(props: {
  workspaceRoot: string;
  agent: AgentDefinition;
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
    await updateConfig(props.workspaceRoot, next);
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
  agent: AgentDefinition;
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
    await updateConfig(props.workspaceRoot, next);
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
