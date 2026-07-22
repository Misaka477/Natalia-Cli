import { createMemo, createSignal, onMount } from "solid-js";
import {
  modelSelectionStatus,
  resolveConfig,
  updateConfig,
} from "@natalia/config";
import type { ConfigV2, RuntimeModelSelection } from "@natalia/contracts";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { DialogVariant } from "./DialogVariant";
import { useDialog } from "../dialog/provider";
import { useLocal } from "../context/local";

export function buildModelOptions(
  config: ConfigV2,
  local: Pick<
    ReturnType<typeof useLocal>["state"],
    "favoriteModels" | "recentModels"
  >,
): DialogSelectOption<string>[] {
  const models = Object.entries(config.models ?? {}).filter(
    ([name]) => modelSelectionStatus(config, name).selected,
  );
  const section = (names: string[], category: string) =>
    names.flatMap((name) => {
      const model = config.models[name];
      if (!model) return [];
      return [
        {
          title: name,
          value: name,
          category,
          description: `${model.model} @ ${model.provider}`,
          footer: config.defaultModel === name ? "default" : undefined,
        },
      ];
    });
  const favorites = section(local.favoriteModels, "Favorites");
  const favoriteNames = new Set(favorites.map((item) => item.value));
  const recents = section(
    local.recentModels.filter((name) => !favoriteNames.has(name)),
    "Recent",
  );
  const repeated = new Set(
    [...favorites, ...recents].map((item) => item.value),
  );
  const providers = models
    .filter(([name]) => !repeated.has(name))
    .map(([name, model]) => ({
      title: name,
      value: name,
      category: model.provider,
      description: model.model,
      footer: config.defaultModel === name ? "default" : undefined,
    }));
  return [...favorites, ...recents, ...providers];
}

export function unavailableModelSummary(config: ConfigV2) {
  return Object.keys(config.models)
    .flatMap((name) => {
      const status = modelSelectionStatus(config, name);
      return status.selected
        ? []
        : [`${name}: ${status.reason ?? "unavailable"}`];
    })
    .join("; ");
}

export function DialogModel(props: {
  workspaceRoot: string;
  catalog?: () => Promise<
    import("@natalia/contracts").RuntimeModelCatalogEntry[]
  >;
  selection?: () => Promise<RuntimeModelSelection>;
  selectRuntimeModel?: (modelID?: string, variant?: string) => Promise<void>;
}) {
  const dialog = useDialog();
  const local = useLocal();
  const [config, setConfig] = createSignal<ConfigV2>();
  const [selection, setSelection] = createSignal<RuntimeModelSelection>();

  onMount(() => {
    void resolveConfig({ workspaceRoot: props.workspaceRoot }).then(
      ({ config }) => setConfig(config),
    );
    void props.selection?.().then(setSelection);
  });

  const options = createMemo<DialogSelectOption<string>[]>(() => {
    const resolved = config();
    if (!resolved) return [];
    return buildModelOptions(resolved, local.state);
  });

  async function select(option: DialogSelectOption<string>) {
    const resolved = config();
    if (!resolved || !resolved.models[option.value]) return;
    const next = structuredClone(resolved);
    next.defaultModel = option.value;
    await updateConfig(props.workspaceRoot, next);
    await props.selectRuntimeModel?.(option.value);
    setSelection({ modelID: option.value });
    setConfig(next);
    local.recordModel(option.value);
    dialog.pop();
  }

  return (
    <DialogSelect
      title="Select model"
      placeholder="Search models"
      options={options()}
      current={selection()?.modelID ?? config()?.defaultModel}
      emptyView={
        <text>
          {config()
            ? `No selectable models. ${unavailableModelSummary(config()!) || "Connect a provider first."}`
            : "Loading configured models..."}
        </text>
      }
      onSelect={(option) => void select(option)}
      preserveSelection
      actions={[
        {
          command: "model.dialog.favorite",
          title: "Favorite",
          onTrigger: (option) => local.toggleModelFavorite(option.value),
        },
        ...(props.catalog && props.selectRuntimeModel
          ? [
              {
                command: "model.dialog.variant",
                title: "Variant",
                disabled: (option: DialogSelectOption<string> | undefined) =>
                  !option || !config()?.models[option.value]?.variants,
                onTrigger: (option: DialogSelectOption<string>) => {
                  void props.catalog!().then((catalog) => {
                    const model = catalog.find(
                      (item) => item.id === option.value,
                    );
                    if (!model || !model.variants.length) return;
                    dialog.push(() => (
                      <DialogVariant
                        model={model}
                        current={
                          selection()?.modelID === model.id
                            ? selection()?.variant
                            : undefined
                        }
                        select={async (variant) => {
                          await props.selectRuntimeModel!(model.id, variant);
                          setSelection({ modelID: model.id, variant });
                        }}
                      />
                    ));
                  });
                },
              },
            ]
          : []),
      ]}
    />
  );
}
