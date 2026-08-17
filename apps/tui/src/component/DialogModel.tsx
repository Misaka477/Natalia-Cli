import { createEffect, createMemo, createSignal, onMount } from "solid-js";
import {
  modelSelectionStatus,
  resolveConfig,
  updateConfigAtScope,
} from "@natalia/config";
import {
  modelRefKey,
  parseModelRef,
  type ConfigV3,
  type ModelRef,
  type RuntimeModelSelection,
} from "@natalia/contracts";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { DialogVariant } from "./DialogVariant";
import { useDialog } from "../dialog/provider";
import { useLocal } from "../context/local";
import { useToast } from "../context/toast";

export type ModelConfigEntry = {
  /** Canonical `provider/model` reference used as the option value. */
  key: string;
  ref: ModelRef;
  providerID: string;
  modelID: string;
  name: string;
};

/** Every configured model ref: catalog entries merged with user overrides. */
export function listModelConfigs(config: ConfigV3): ModelConfigEntry[] {
  const keys = new Set<string>();
  for (const providerID of Object.keys(config.providers ?? {}))
    for (const modelID of Object.keys(
      config.catalog?.providers?.[providerID]?.models ?? {},
    ))
      keys.add(modelRefKey({ provider: providerID, model: modelID }));
  for (const key of Object.keys(config.modelOverrides ?? {})) {
    const ref = parseModelRef(key);
    if (config.providers[ref.provider]) keys.add(key);
  }
  const entries = [...keys].map((key) => {
    const ref = parseModelRef(key);
    return {
      key,
      ref,
      providerID: ref.provider,
      modelID: ref.model,
      name:
        config.modelOverrides[key]?.name ??
        config.catalog?.providers?.[ref.provider]?.models?.[ref.model]?.name ??
        ref.model,
    };
  });
  entries.sort((left, right) => left.key.localeCompare(right.key));
  return entries;
}

export function defaultModelKey(config: ConfigV3): string | undefined {
  return config.defaultModel ? modelRefKey(config.defaultModel) : undefined;
}

export function buildModelOptions(
  config: ConfigV3,
  local: Pick<
    ReturnType<typeof useLocal>["state"],
    "favoriteModels" | "recentModels"
  >,
): DialogSelectOption<string>[] {
  const models = listModelConfigs(config).filter(
    ({ key }) => modelSelectionStatus(config, key).selected,
  );
  const defaultKey = defaultModelKey(config);
  const section = (keys: string[], category: string) =>
    keys.flatMap((key) => {
      const model = models.find((entry) => entry.key === key);
      if (!model) return [];
      return [
        {
          title: model.name,
          value: model.key,
          category,
          description: `${model.providerID} / ${model.modelID}`,
          footer: defaultKey === model.key ? "default" : undefined,
        },
      ];
    });
  const favorites = section(local.favoriteModels, "Favorites");
  const favoriteKeys = new Set(favorites.map((item) => item.value));
  const recents = section(
    local.recentModels.filter((key) => !favoriteKeys.has(key)),
    "Recent",
  );
  const repeated = new Set(
    [...favorites, ...recents].map((item) => item.value),
  );
  const providers = models
    .filter((model) => !repeated.has(model.key))
    .map((model) => ({
      title: model.name,
      value: model.key,
      category: model.providerID,
      description: model.modelID,
      footer: defaultKey === model.key ? "default" : undefined,
    }));
  return [...favorites, ...recents, ...providers];
}

export function unavailableModelSummary(config: ConfigV3) {
  return listModelConfigs(config)
    .flatMap(({ key }) => {
      const status = modelSelectionStatus(config, key);
      return status.selected
        ? []
        : [`${key}: ${status.reason ?? "unavailable"}`];
    })
    .join("; ");
}

export function DialogModel(props: {
  workspaceRoot: string;
  globalPath?: string;
  catalog?: () => Promise<
    import("@natalia/contracts").RuntimeModelCatalogEntry[]
  >;
  selection?: () => Promise<RuntimeModelSelection>;
  selectRuntimeModel?: (modelID?: string, variant?: string) => Promise<void>;
  configRevision?: () => number;
  onPersist?(next: ConfigV3, base: ConfigV3): Promise<boolean | void>;
  onSelected?(selection: RuntimeModelSelection): void;
  onError?(error: unknown): void;
}) {
  const dialog = useDialog();
  const local = useLocal();
  const toast = useToast();
  const [config, setConfig] = createSignal<ConfigV3>();
  const [selection, setSelection] = createSignal<RuntimeModelSelection>();
  let configLoad = 0;

  createEffect(() => {
    props.configRevision?.();
    const load = ++configLoad;
    void resolveConfig({
      workspaceRoot: props.workspaceRoot,
      globalPath: props.globalPath,
    })
      .then(({ config }) => {
        if (load === configLoad) setConfig(config);
      })
      .catch((error) => (props.onError ?? toast.error)(error));
  });

  onMount(() => {
    void props.selection?.().then(setSelection);
  });

  const options = createMemo<DialogSelectOption<string>[]>(() => {
    const resolved = config();
    if (!resolved) return [];
    return buildModelOptions(resolved, local.state);
  });

  async function select(option: DialogSelectOption<string>) {
    const resolved = config();
    if (
      !resolved ||
      !listModelConfigs(resolved).some((m) => m.key === option.value)
    )
      return;
    const next = structuredClone(resolved);
    next.defaultModel = parseModelRef(option.value);
    const persisted = props.onPersist
      ? await props.onPersist(next, resolved)
      : await updateConfigAtScope(
          props.workspaceRoot,
          { defaultModel: next.defaultModel },
          "global",
          { globalPath: props.globalPath },
        );
    if (persisted === false) return;
    try {
      await props.selectRuntimeModel?.(option.value);
    } catch (error) {
      // Restore the previous config if runtime selection fails after the file
      // was written, keeping the picker from leaving the two states divergent.
      if (props.onPersist) await props.onPersist(resolved, next);
      else
        await updateConfigAtScope(
          props.workspaceRoot,
          { defaultModel: resolved.defaultModel },
          "global",
          { globalPath: props.globalPath },
        );
      throw error;
    }
    setSelection({ modelID: option.value });
    setConfig(next);
    local.recordModel(option.value);
    props.onSelected?.({ modelID: option.value });
    dialog.pop();
  }

  return (
    <DialogSelect
      title="Select default model"
      placeholder="Search models"
      submitLabel="default"
      options={options()}
      current={(() => {
        const resolved = config();
        return (
          selection()?.modelID ??
          (resolved?.defaultModel
            ? modelRefKey(resolved.defaultModel)
            : undefined)
        );
      })()}
      emptyView={
        <text>
          {config()
            ? `No selectable models. ${unavailableModelSummary(config()!) || "Connect a provider first."}`
            : "Loading configured models..."}
        </text>
      }
      onSelect={(option) =>
        void select(option).catch((error) =>
          (props.onError ?? toast.error)(error),
        )
      }
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
                onTrigger: (option: DialogSelectOption<string>) => {
                  void props.catalog!()
                    .then((catalog) => {
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
                            props.onSelected?.({
                              modelID: model.id,
                              variant,
                            });
                          }}
                        />
                      ));
                    })
                    .catch((error) => (props.onError ?? toast.error)(error));
                },
              },
            ]
          : []),
      ]}
    />
  );
}
