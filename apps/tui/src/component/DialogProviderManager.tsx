import { createMemo, createSignal, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import {
  configureProviderModels,
  discoverProviderModels,
} from "@natalia/config";
import {
  modelRefKey,
  type ConfigV3,
  type ModelCapabilities,
  type ModelOverride,
} from "@natalia/contracts";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { useDialog } from "../dialog/provider";
import { darkTheme } from "../theme/theme";

export const PROVIDER_DRIVERS = [
  {
    value: "openai",
    title: "OpenAI",
    description: "API key",
    category: "Popular",
  },
  {
    value: "anthropic",
    title: "Anthropic",
    description: "API key",
    category: "Popular",
  },
  {
    value: "gemini",
    title: "Gemini",
    description: "API key",
    category: "Popular",
  },
  {
    value: "openai-compatible",
    title: "OpenAI Compatible",
    description: "Custom endpoint",
    category: "Other",
  },
  {
    value: "anthropic-compatible",
    title: "Anthropic Compatible",
    description: "Messages API endpoint",
    category: "Other",
  },
] as const;

export function providerBaseURLHint(driver: string): string {
  switch (driver) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com";
    case "anthropic-compatible":
      return "https://api.example.com/v1";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta";
    default:
      return "https://api.example.com/v1";
  }
}

export function providerDrivers(): DialogSelectOption<string>[] {
  return PROVIDER_DRIVERS.map((driver) => ({ ...driver }));
}

export type ProviderModelRow = {
  modelID: string;
  key: string;
  name: string;
  enabled: boolean;
  source: "discovery" | "manual";
  status: "stable" | "experimental" | "deprecated";
  isDefault: boolean;
  capabilities: ModelCapabilities;
  thinkingEnabled: boolean;
};

const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
  toolCall: true,
  reasoning: true,
  thinking: true,
  imageInput: false,
  pdfInput: false,
  videoInput: false,
};

/** The models a provider exposes: catalog entries merged with user overrides. */
export function providerModels(
  config: ConfigV3,
  providerID: string,
): ProviderModelRow[] {
  const catalogModels = config.catalog?.providers?.[providerID]?.models ?? {};
  const overrides = config.modelOverrides ?? {};
  const ids = new Set<string>([
    ...Object.keys(catalogModels),
    ...Object.keys(overrides)
      .filter((key) => key.startsWith(`${providerID}/`))
      .map((key) => key.slice(providerID.length + 1)),
  ]);
  const defaultKey = config.defaultModel
    ? modelRefKey(config.defaultModel)
    : undefined;
  return [...ids]
    .sort((left, right) => left.localeCompare(right))
    .map((modelID) => {
      const key = modelRefKey({ provider: providerID, model: modelID });
      const override = overrides[key];
      const catalog = catalogModels[modelID];
      return {
        modelID,
        key,
        name: override?.name ?? catalog?.name ?? modelID,
        enabled: override?.enabled !== false,
        source: catalog?.source ?? "manual",
        status: catalog?.status ?? "stable",
        isDefault: defaultKey === key,
        capabilities: catalog?.capabilities ?? DEFAULT_MODEL_CAPABILITIES,
        thinkingEnabled: override?.requestDefaults.thinkingEnabled ?? true,
      };
    });
}

export function providerModelCount(
  config: ConfigV3,
  providerID: string,
): number {
  return providerModels(config, providerID).length;
}

export function defaultModelRefKey(config: ConfigV3): string | undefined {
  return config.defaultModel ? modelRefKey(config.defaultModel) : undefined;
}

function cloneOverride(override?: ModelOverride): ModelOverride {
  return {
    enabled: override?.enabled ?? true,
    ...(override?.name ? { name: override.name } : {}),
    requestDefaults: {
      temperature: override?.requestDefaults.temperature ?? null,
      topP: override?.requestDefaults.topP ?? null,
      ...(override?.requestDefaults.stream !== undefined
        ? { stream: override.requestDefaults.stream }
        : {}),
      ...(override?.requestDefaults.thinkingEnabled !== undefined
        ? { thinkingEnabled: override.requestDefaults.thinkingEnabled }
        : {}),
    },
    requestOptions: { ...(override?.requestOptions ?? {}) },
    headers: { ...(override?.headers ?? {}) },
  };
}

function firstModelRef(config: ConfigV3) {
  for (const providerID of Object.keys(config.providers)) {
    const rows = providerModels(config, providerID);
    if (rows.length) return { provider: providerID, model: rows[0]!.modelID };
  }
  return null;
}

export function setProviderEnabled(
  config: ConfigV3,
  providerID: string,
  enabled: boolean,
): ConfigV3 {
  const next = structuredClone(config);
  const provider = next.providers[providerID];
  if (!provider) return next;
  next.providers[providerID] = { ...provider, enabled };
  return next;
}

export function setModelDefault(
  config: ConfigV3,
  providerID: string,
  modelID: string,
): ConfigV3 {
  const next = structuredClone(config);
  next.defaultModel = { provider: providerID, model: modelID };
  return next;
}

export function toggleModelEnabled(
  config: ConfigV3,
  providerID: string,
  modelID: string,
): ConfigV3 {
  const next = structuredClone(config);
  const key = modelRefKey({ provider: providerID, model: modelID });
  const current = next.modelOverrides[key];
  next.modelOverrides[key] = {
    ...cloneOverride(current),
    enabled: current?.enabled !== false ? false : true,
  };
  return next;
}

/** Records the request-level thinking preference without changing model facts. */
export function setModelThinkingEnabled(
  config: ConfigV3,
  providerID: string,
  modelID: string,
  thinkingEnabled: boolean,
): ConfigV3 {
  const next = structuredClone(config);
  const key = modelRefKey({ provider: providerID, model: modelID });
  const current = next.modelOverrides[key];
  next.modelOverrides[key] = {
    ...cloneOverride(current),
    requestDefaults: {
      ...cloneOverride(current).requestDefaults,
      thinkingEnabled,
    },
  };
  return next;
}

/** Updates a catalog capability selected by the operator for a known model. */
export function setModelCapability(
  config: ConfigV3,
  providerID: string,
  modelID: string,
  capability: keyof ModelCapabilities,
  enabled: boolean,
): ConfigV3 {
  const next = structuredClone(config);
  const model = next.catalog?.providers?.[providerID]?.models?.[modelID];
  if (!model) return next;
  model.capabilities = { ...model.capabilities, [capability]: enabled };
  return next;
}

export function deleteModel(
  config: ConfigV3,
  providerID: string,
  modelID: string,
): ConfigV3 {
  const next = structuredClone(config);
  delete next.catalog?.providers?.[providerID]?.models?.[modelID];
  delete next.modelOverrides[
    modelRefKey({ provider: providerID, model: modelID })
  ];
  if (
    next.defaultModel?.provider === providerID &&
    next.defaultModel.model === modelID
  )
    next.defaultModel = firstModelRef(next);
  return next;
}

export function deleteProvider(config: ConfigV3, providerID: string): ConfigV3 {
  const next = structuredClone(config);
  delete next.providers[providerID];
  if (next.catalog) delete next.catalog.providers[providerID];
  for (const key of Object.keys(next.modelOverrides))
    if (key.startsWith(`${providerID}/`)) delete next.modelOverrides[key];
  if (next.defaultModel?.provider === providerID)
    next.defaultModel = firstModelRef(next);
  return next;
}

export function upsertProvider(
  config: ConfigV3,
  input: {
    providerID: string;
    name?: string;
    driver: string;
    baseURL?: string;
    apiKey?: string;
  },
): ConfigV3 {
  const providerID = input.providerID.trim();
  if (!providerID) throw new Error("Provider ID is required");
  const next = structuredClone(config);
  const existing = next.providers[providerID];
  next.providers[providerID] = {
    name: input.name?.trim() || existing?.name || providerID,
    driver: input.driver,
    enabled: existing?.enabled ?? true,
    connection: {
      baseURL: input.baseURL?.trim() || existing?.connection?.baseURL,
      apiKey: input.apiKey?.trim() || existing?.connection?.apiKey,
      authHeader: existing?.connection?.authHeader,
    },
    requestDefaults: {
      stream: existing?.requestDefaults.stream ?? true,
      headers: { ...(existing?.requestDefaults.headers ?? {}) },
      options: { ...(existing?.requestDefaults.options ?? {}) },
    },
  };
  return next;
}

function parseModelIDs(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
}

function Status(props: {
  enabled: boolean;
  configured: boolean;
  modelCount: number;
}) {
  if (!props.enabled) {
    return (
      <span style={{ fg: darkTheme.muted }}>
        ○ Disabled · {props.modelCount} model
        {props.modelCount === 1 ? "" : "s"}
      </span>
    );
  }
  return (
    <span
      style={{
        fg: props.configured ? darkTheme.success : darkTheme.muted,
        attributes: props.configured ? TextAttributes.BOLD : undefined,
      }}
    >
      {props.configured
        ? `✓ ${props.modelCount} model${props.modelCount === 1 ? "" : "s"}`
        : `${props.modelCount} model${props.modelCount === 1 ? "" : "s"} · no key`}
    </span>
  );
}

type Screen =
  | { kind: "list" }
  | { kind: "add-id" }
  | { kind: "add-name"; id: string }
  | { kind: "add-driver"; id: string; name: string }
  | { kind: "add-url"; id: string; name: string; driver: string }
  | {
      kind: "add-key";
      id: string;
      name: string;
      driver: string;
      baseURL: string;
    }
  | {
      kind: "add-import";
      id: string;
      name: string;
      driver: string;
      baseURL: string;
      apiKey: string;
    }
  | {
      kind: "add-manual";
      id: string;
      name: string;
      driver: string;
      baseURL: string;
      apiKey: string;
      error?: string;
    }
  | {
      kind: "add-select";
      id: string;
      name: string;
      driver: string;
      baseURL: string;
      apiKey: string;
      models: string[];
    }
  | { kind: "edit"; providerID: string }
  | { kind: "edit-name"; providerID: string }
  | { kind: "edit-driver"; providerID: string }
  | { kind: "edit-url"; providerID: string }
  | { kind: "edit-key"; providerID: string }
  | { kind: "models"; providerID: string; selectedModelID?: string }
  | { kind: "model-settings"; providerID: string; modelID: string }
  | { kind: "models-select"; providerID: string; models: string[] }
  | { kind: "models-manual"; providerID: string; error?: string }
  | { kind: "model-delete"; providerID: string; modelID: string }
  | { kind: "delete"; providerID: string };

function parentScreen(screen: Screen): Screen | undefined {
  switch (screen.kind) {
    case "list":
      return undefined;
    case "add-id":
      return { kind: "list" };
    case "add-name":
      return { kind: "add-id" };
    case "add-driver":
      return { kind: "add-name", id: screen.id };
    case "add-url":
      return {
        kind: "add-driver",
        id: screen.id,
        name: screen.name,
      };
    case "add-key":
      return {
        kind: "add-url",
        id: screen.id,
        name: screen.name,
        driver: screen.driver,
      };
    case "add-import":
      return {
        kind: "add-key",
        id: screen.id,
        name: screen.name,
        driver: screen.driver,
        baseURL: screen.baseURL,
      };
    case "add-manual":
      return screen.driver === "anthropic-compatible"
        ? {
            kind: "add-key",
            id: screen.id,
            name: screen.name,
            driver: screen.driver,
            baseURL: screen.baseURL,
          }
        : {
            kind: "add-import",
            id: screen.id,
            name: screen.name,
            driver: screen.driver,
            baseURL: screen.baseURL,
            apiKey: screen.apiKey,
          };
    case "add-select":
      return {
        kind: "add-import",
        id: screen.id,
        name: screen.name,
        driver: screen.driver,
        baseURL: screen.baseURL,
        apiKey: screen.apiKey,
      };
    case "edit":
    case "delete":
      return { kind: "list" };
    case "edit-name":
    case "edit-driver":
    case "edit-url":
    case "edit-key":
      return { kind: "edit", providerID: screen.providerID };
    case "models":
      return { kind: "list" };
    case "model-settings":
      return {
        kind: "models",
        providerID: screen.providerID,
        selectedModelID: screen.modelID,
      };
    case "models-select":
    case "models-manual":
      return { kind: "models", providerID: screen.providerID };
    case "model-delete":
      return {
        kind: "models",
        providerID: screen.providerID,
        selectedModelID: screen.modelID,
      };
  }
}

/**
 * Provider and model configuration against the ConfigV3 layout. Wizard steps
 * replace the top dialog while carrying their working copy forward.
 */
export function DialogProviderManager(props: {
  config: ConfigV3;
  onPersist(next: ConfigV3): void;
  initialScreen?: Screen;
}) {
  const dialog = useDialog();
  const [config, setConfig] = createSignal(props.config);
  const [screen, setScreenState] = createSignal<Screen>(
    props.initialScreen ?? { kind: "list" },
  );
  const [busy, setBusy] = createSignal(false);
  const [discoveryError, setDiscoveryError] = createSignal("");

  function persist(next: ConfigV3) {
    setConfig(next);
    props.onPersist(next);
  }

  function setScreen(next: Screen) {
    setScreenState(next);
    dialog.replace(() => (
      <DialogProviderManager
        config={config()}
        onPersist={props.onPersist}
        initialScreen={next}
      />
    ));
  }

  function goBack() {
    const parent = parentScreen(screen());
    if (!parent) {
      dialog.pop();
      return;
    }
    setBusy(false);
    setDiscoveryError("");
    setScreen(parent);
  }

  const providers = createMemo(() => Object.entries(config().providers ?? {}));

  const listOptions = createMemo<DialogSelectOption<string>[]>(() => [
    ...providers().map(([id, provider]) => ({
      value: id,
      title: provider.name,
      description: `${provider.driver}${
        provider.connection?.apiKey ? "" : " · no API key"
      }`,
      category: "Providers",
      footer: (
        <Status
          enabled={provider.enabled}
          configured={Boolean(provider.connection?.apiKey)}
          modelCount={providerModelCount(config(), id)}
        />
      ),
    })),
    {
      value: "$add",
      title: "+ Add Provider",
      description: "Configure a provider and import models",
    },
  ]);

  // Each wizard step owns focusable input. Replacing the top dialog releases
  // the previous input and key bindings before mounting the next step.
  const current = screen();

  useBindings(() => ({
    mode: "modal",
    priority: 4,
    bindings: [
      {
        key: "escape",
        desc: current.kind === "list" ? "Close provider manager" : "Back",
        group: "Dialog",
        cmd: goBack,
      },
    ],
  }));

  if (current.kind === "add-id")
    return (
      <DialogPrompt
        title="Provider ID"
        description={() => (
          <text fg={darkTheme.muted}>
            Stable identifier used in model references (provider/model). It
            cannot be renamed later.
          </text>
        )}
        placeholder="my-provider"
        validate={(value) =>
          value.trim() ? undefined : "Provider ID is required"
        }
        onConfirm={(value) => {
          const id = value.trim();
          if (config().providers[id]) return;
          setScreen({ kind: "add-name", id });
        }}
      />
    );

  if (current.kind === "add-name")
    return (
      <DialogPrompt
        title="Provider Display Name"
        description={() => (
          <text fg={darkTheme.muted}>
            Editable label shown in menus. Leave empty to use the provider ID.
          </text>
        )}
        placeholder={current.id}
        onConfirm={(value) =>
          setScreen({
            kind: "add-driver",
            id: current.id,
            name: value.trim() || current.id,
          })
        }
      />
    );

  if (current.kind === "add-driver")
    return (
      <DialogSelect
        title="Provider Driver"
        options={providerDrivers()}
        onSelect={(option) =>
          setScreen({
            kind: "add-url",
            id: current.id,
            name: current.name,
            driver: option.value,
          })
        }
      />
    );

  if (current.kind === "add-url")
    return (
      <DialogPrompt
        title="API Base URL"
        description={() => (
          <text fg={darkTheme.muted}>
            {current.driver} — base URL used to reach the provider API.
          </text>
        )}
        placeholder={providerBaseURLHint(current.driver)}
        onConfirm={(value) =>
          setScreen({
            kind: "add-key",
            id: current.id,
            name: current.name,
            driver: current.driver,
            baseURL: value.trim(),
          })
        }
      />
    );

  if (current.kind === "add-key")
    return (
      <DialogPrompt
        title="API Key"
        description={() => (
          <text fg={darkTheme.muted}>
            Stored in config and redacted in the UI.
          </text>
        )}
        placeholder="sk-..."
        onConfirm={(value) => {
          const apiKey = value.trim();
          if (!apiKey) return;
          if (current.driver === "anthropic-compatible")
            setScreen({
              kind: "add-manual",
              id: current.id,
              name: current.name,
              driver: current.driver,
              baseURL: current.baseURL,
              apiKey,
            });
          else
            setScreen({
              kind: "add-import",
              id: current.id,
              name: current.name,
              driver: current.driver,
              baseURL: current.baseURL,
              apiKey,
            });
        }}
      />
    );

  if (current.kind === "add-import") {
    if (busy())
      return (
        <DialogSelect
          title="Discovering models"
          locked
          options={[
            {
              title: "Contacting provider…",
              value: "$busy",
              description: discoveryError() || undefined,
            },
          ]}
        />
      );
    return (
      <DialogSelect
        title={`Import models: ${current.name}`}
        options={[
          {
            title: "Discover models from this provider",
            value: "$discover",
            category: "Import",
            description: "List models from the provider API",
          },
          {
            title: "Enter model IDs manually",
            value: "$manual",
            category: "Import",
            description: "One model ID per line, for any endpoint",
          },
          {
            title: "Save provider without models",
            value: "$none",
            category: "Import",
            description: "Configure the connection only; import later",
          },
        ]}
        onSelect={(option) => {
          if (option.value === "$manual") {
            setScreen({
              kind: "add-manual",
              id: current.id,
              name: current.name,
              driver: current.driver,
              baseURL: current.baseURL,
              apiKey: current.apiKey,
            });
            return;
          }
          if (option.value === "$none") {
            persist(
              upsertProvider(config(), {
                providerID: current.id,
                name: current.name,
                driver: current.driver,
                baseURL: current.baseURL,
                apiKey: current.apiKey,
              }),
            );
            setScreen({ kind: "list" });
            return;
          }
          setBusy(true);
          setDiscoveryError("");
          void discoverProviderModels(
            current.driver,
            current.baseURL,
            current.apiKey,
          )
            .then((models) => {
              setBusy(false);
              if (!models.length)
                throw new Error("Provider returned no models");
              setScreen({
                kind: "add-select",
                id: current.id,
                name: current.name,
                driver: current.driver,
                baseURL: current.baseURL,
                apiKey: current.apiKey,
                models,
              });
            })
            .catch((error) => {
              setBusy(false);
              setScreen({
                kind: "add-manual",
                id: current.id,
                name: current.name,
                driver: current.driver,
                baseURL: current.baseURL,
                apiKey: current.apiKey,
                error: error instanceof Error ? error.message : String(error),
              });
            });
        }}
      />
    );
  }

  if (current.kind === "add-manual")
    return (
      <DialogPrompt
        title={`Model IDs: ${current.name}`}
        description={() => (
          <box gap={1}>
            <text fg={darkTheme.muted}>
              One model ID per line. Blank lines are ignored.
            </text>
            <Show when={current.error}>
              <text fg={darkTheme.danger} wrapMode="word">
                Discovery failed: {current.error}
              </text>
            </Show>
          </box>
        )}
        placeholder={"gpt-4o\nclaude-3-5-sonnet-latest"}
        validate={(value) =>
          parseModelIDs(value).length
            ? undefined
            : "At least one model ID is required"
        }
        onConfirm={(value) => {
          persist(
            configureProviderModels(config(), {
              providerID: current.id,
              providerName: current.name,
              driver: current.driver,
              baseURL: current.baseURL,
              apiKey: current.apiKey,
              source: "manual",
              modelIDs: parseModelIDs(value),
            }),
          );
          setScreen({ kind: "list" });
        }}
      />
    );

  if (current.kind === "add-select")
    return (
      <DialogModelMultiSelect
        title={`Import models: ${current.name}`}
        models={current.models.map((model) => ({ name: model }))}
        selected={current.models}
        onSave={(models) => {
          persist(
            configureProviderModels(config(), {
              providerID: current.id,
              providerName: current.name,
              driver: current.driver,
              baseURL: current.baseURL,
              apiKey: current.apiKey,
              source: "discovery",
              modelIDs: models,
            }),
          );
          setScreen({ kind: "list" });
        }}
      />
    );

  if (current.kind === "delete") {
    const provider = config().providers[current.providerID];
    return (
      <DialogSelect
        title="Delete Provider?"
        options={[
          {
            title: "Keep provider",
            value: "$cancel",
            category: "Action",
          },
          {
            title: `Delete ${provider?.name ?? current.providerID}`,
            value: "$confirm",
            category: "Delete",
            description:
              "Removes the provider, its catalog models and model overrides. The default model is repaired to the next available one.",
          },
        ]}
        onSelect={(option) => {
          if (option.value === "$confirm") {
            persist(deleteProvider(config(), current.providerID));
            setScreen({ kind: "list" });
          } else setScreen({ kind: "list" });
        }}
      />
    );
  }

  if (current.kind === "edit") {
    const provider = config().providers[current.providerID];
    if (!provider) {
      setScreen({ kind: "list" });
      return <span />;
    }
    return (
      <DialogSelect
        title={`Provider: ${provider.name}`}
        options={[
          {
            value: "name",
            title: "Display Name",
            description: provider.name,
          },
          {
            value: "driver",
            title: "Driver",
            description: provider.driver,
          },
          {
            value: "url",
            title: "API Base URL",
            description: provider.connection?.baseURL ?? "(none)",
          },
          {
            value: "key",
            title: "API Key",
            description: provider.connection?.apiKey ? "set" : "(none)",
          },
          {
            value: "toggle",
            title: "Enabled",
            description: provider.enabled ? "On" : "Off",
          },
        ]}
        onSelect={(option) => {
          if (option.value === "name") {
            setScreen({
              kind: "edit-name",
              providerID: current.providerID,
            });
            return;
          }
          if (option.value === "driver") {
            setScreen({
              kind: "edit-driver",
              providerID: current.providerID,
            });
            return;
          }
          if (option.value === "url") {
            setScreen({
              kind: "edit-url",
              providerID: current.providerID,
            });
            return;
          }
          if (option.value === "key") {
            setScreen({
              kind: "edit-key",
              providerID: current.providerID,
            });
            return;
          }
          if (option.value === "toggle") {
            persist(
              setProviderEnabled(
                config(),
                current.providerID,
                !provider.enabled,
              ),
            );
          }
        }}
      />
    );
  }

  if (current.kind === "edit-name")
    return (
      <DialogPrompt
        title="Provider Display Name"
        placeholder={config().providers[current.providerID]?.name}
        onConfirm={(value) => {
          const next = structuredClone(config());
          const provider = next.providers[current.providerID];
          if (provider) provider.name = value.trim() || current.providerID;
          persist(next);
          setScreen({ kind: "edit", providerID: current.providerID });
        }}
      />
    );

  if (current.kind === "edit-driver")
    return (
      <DialogSelect
        title="Provider Driver"
        current={config().providers[current.providerID]?.driver}
        options={providerDrivers()}
        onSelect={(option) => {
          const next = structuredClone(config());
          const provider = next.providers[current.providerID];
          if (provider) provider.driver = option.value;
          persist(next);
          setScreen({ kind: "edit", providerID: current.providerID });
        }}
      />
    );

  if (current.kind === "edit-url")
    return (
      <DialogPrompt
        title="API Base URL"
        placeholder={
          config().providers[current.providerID]?.connection?.baseURL ?? ""
        }
        onConfirm={(value) => {
          const next = structuredClone(config());
          const provider = next.providers[current.providerID];
          if (provider) {
            provider.connection = {
              ...provider.connection,
              baseURL: value.trim() || undefined,
            };
          }
          persist(next);
          setScreen({ kind: "edit", providerID: current.providerID });
        }}
      />
    );

  if (current.kind === "edit-key")
    return (
      <DialogPrompt
        title="API Key"
        placeholder="sk-..."
        onConfirm={(value) => {
          const key = value.trim();
          if (!key) return;
          const next = structuredClone(config());
          const provider = next.providers[current.providerID];
          if (provider) {
            provider.connection = { ...provider.connection, apiKey: key };
          }
          persist(next);
          setScreen({ kind: "edit", providerID: current.providerID });
        }}
      />
    );

  if (current.kind === "models") {
    const providerID = current.providerID;
    const provider = config().providers[providerID];
    if (!provider) {
      setScreen({ kind: "list" });
      return <span />;
    }
    const rows = providerModels(config(), providerID);
    if (busy())
      return (
        <DialogSelect
          title="Discovering models"
          locked
          options={[
            {
              title: "Contacting provider…",
              value: "$busy",
              description: discoveryError() || undefined,
            },
          ]}
        />
      );
    return (
      <DialogSelect
        title={`Models: ${provider.name}`}
        submitLabel="configure"
        closeLabel="back"
        current={current.selectedModelID}
        options={[
          ...rows.map((model) => ({
            value: model.modelID,
            title: `${model.enabled ? "[x]" : "[ ]"} ${model.name}`,
            category: model.enabled ? "Enabled" : "Disabled",
            description: model.modelID,
            footer: [
              model.isDefault
                ? "default"
                : model.source === "discovery"
                  ? model.status
                  : "manual",
              model.capabilities.reasoning ? "reasoning" : "no reasoning",
              model.capabilities.imageInput ? "image" : undefined,
            ]
              .filter(Boolean)
              .join(" · "),
          })),
          {
            value: "$discover",
            title: "+ Discover models",
            description: provider.connection?.apiKey
              ? "List models from the provider API"
              : "Requires an API key and base URL (edit the provider first)",
            disabled: !provider.connection?.apiKey,
          },
          {
            value: "$manual",
            title: "+ Add model IDs manually",
            description: "One model ID per line",
          },
        ]}
        preserveSelection
        onClose={goBack}
        actions={[
          {
            command: "provider.model.toggle",
            title: "toggle",
            disabled: (option) => !option || option.value.startsWith("$"),
            onTrigger: (option) => {
              persist(toggleModelEnabled(config(), providerID, option.value));
              setScreen({
                kind: "models",
                providerID,
                selectedModelID: option.value,
              });
            },
          },
          {
            command: "provider.model.default",
            title: "default",
            disabled: (option) => !option || option.value.startsWith("$"),
            onTrigger: (option) => {
              persist(setModelDefault(config(), providerID, option.value));
            },
          },
          {
            command: "provider.model.delete",
            title: "delete",
            disabled: (option) => !option || option.value.startsWith("$"),
            onTrigger: (option) =>
              setScreen({
                kind: "model-delete",
                providerID,
                modelID: option.value,
              }),
          },
        ]}
        onSelect={(option) => {
          if (option.value === "$discover") {
            setBusy(true);
            setDiscoveryError("");
            void discoverProviderModels(
              provider.driver,
              provider.connection?.baseURL ?? "",
              provider.connection?.apiKey ?? "",
            )
              .then((models) => {
                setBusy(false);
                if (!models.length)
                  throw new Error("Provider returned no models");
                const existing = new Set(
                  providerModels(config(), providerID).map(
                    (model) => model.modelID,
                  ),
                );
                setScreen({
                  kind: "models-select",
                  providerID,
                  models: models.filter((model) => !existing.has(model)),
                });
              })
              .catch((error) => {
                setBusy(false);
                setScreen({
                  kind: "models-manual",
                  providerID,
                  error: error instanceof Error ? error.message : String(error),
                });
              });
            return;
          }
          if (option.value === "$manual") {
            setScreen({ kind: "models-manual", providerID });
            return;
          }
          if (!option.value.startsWith("$")) {
            setScreen({
              kind: "model-settings",
              providerID,
              modelID: option.value,
            });
          }
        }}
      />
    );
  }

  if (current.kind === "model-settings") {
    const { providerID, modelID } = current;
    const row = providerModels(config(), providerID).find(
      (model) => model.modelID === modelID,
    );
    if (!row) {
      setScreen({ kind: "models", providerID });
      return <span />;
    }
    return (
      <DialogSelect
        title={`Model: ${row.name}`}
        submitLabel="toggle"
        closeLabel="back"
        options={[
          {
            value: "enabled",
            title: "Use this model",
            category: "Availability",
            description: row.enabled ? "Enabled" : "Disabled",
          },
          {
            value: "reasoning",
            title: "Model supports reasoning",
            category: "Capabilities",
            description: row.capabilities.reasoning ? "Yes" : "No",
          },
          {
            value: "thinking",
            title: "Model supports native thinking",
            category: "Capabilities",
            description: row.capabilities.thinking ? "Yes" : "No",
          },
          {
            value: "imageInput",
            title: "Model supports image input",
            category: "Capabilities",
            description: row.capabilities.imageInput ? "Yes" : "No",
          },
          {
            value: "thinkingEnabled",
            title: "Send thinking request",
            category: "Requests",
            description: row.capabilities.thinking
              ? row.thinkingEnabled
                ? "On"
                : "Off"
              : "Unavailable until native thinking support is enabled",
            disabled: !row.capabilities.thinking,
          },
        ]}
        onClose={goBack}
        onSelect={(option) => {
          if (option.value === "enabled") {
            persist(toggleModelEnabled(config(), providerID, modelID));
          } else if (option.value === "thinkingEnabled") {
            persist(
              setModelThinkingEnabled(
                config(),
                providerID,
                modelID,
                !row.thinkingEnabled,
              ),
            );
          } else if (
            option.value === "reasoning" ||
            option.value === "thinking" ||
            option.value === "imageInput"
          ) {
            persist(
              setModelCapability(
                config(),
                providerID,
                modelID,
                option.value,
                !row.capabilities[option.value],
              ),
            );
          }
          setScreen({ kind: "model-settings", providerID, modelID });
        }}
      />
    );
  }

  if (current.kind === "models-select") {
    const providerID = current.providerID;
    const provider = config().providers[providerID];
    if (!provider) {
      setScreen({ kind: "models", providerID });
      return <span />;
    }
    return (
      <DialogModelMultiSelect
        title={`Import models: ${provider.name}`}
        models={current.models.map((model) => ({ name: model }))}
        selected={current.models}
        onSave={(models) => {
          if (models.length) {
            persist(
              configureProviderModels(config(), {
                providerID,
                driver: provider.driver,
                baseURL: provider.connection?.baseURL,
                apiKey: provider.connection?.apiKey,
                source: "discovery",
                modelIDs: models,
              }),
            );
          }
          setScreen({ kind: "models", providerID });
        }}
      />
    );
  }

  if (current.kind === "models-manual") {
    const providerID = current.providerID;
    const provider = config().providers[providerID];
    if (!provider) {
      setScreen({ kind: "models", providerID });
      return <span />;
    }
    return (
      <DialogPrompt
        title={`Add Model IDs: ${provider.name}`}
        description={() => (
          <box gap={1}>
            <text fg={darkTheme.muted}>
              One model ID per line. Existing models keep their settings.
            </text>
            <Show when={current.error}>
              <text fg={darkTheme.danger} wrapMode="word">
                Discovery failed: {current.error}
              </text>
            </Show>
          </box>
        )}
        placeholder={"gpt-4o\nclaude-3-5-sonnet-latest"}
        validate={(value) =>
          parseModelIDs(value).length
            ? undefined
            : "At least one model ID is required"
        }
        onConfirm={(value) => {
          persist(
            configureProviderModels(config(), {
              providerID,
              driver: provider.driver,
              baseURL: provider.connection?.baseURL,
              apiKey: provider.connection?.apiKey,
              source: "manual",
              modelIDs: parseModelIDs(value),
            }),
          );
          setScreen({ kind: "models", providerID });
        }}
      />
    );
  }

  if (current.kind === "model-delete") {
    const { providerID, modelID } = current;
    const row = providerModels(config(), providerID).find(
      (model) => model.modelID === modelID,
    );
    return (
      <DialogSelect
        title="Delete Model?"
        options={[
          { title: "Keep model", value: "$cancel", category: "Action" },
          {
            title: `Delete ${row?.name ?? modelID}`,
            value: "$confirm",
            category: "Delete",
            description:
              "Removes the catalog entry and override. A deleted default model is repaired to the next available one.",
          },
        ]}
        onSelect={(option) => {
          if (option.value === "$confirm")
            persist(deleteModel(config(), providerID, modelID));
          setScreen({ kind: "models", providerID });
        }}
      />
    );
  }

  return (
    <DialogSelect
      title="Providers"
      options={listOptions()}
      preserveSelection
      actions={[
        {
          command: "provider.dialog.edit",
          title: "edit",
          disabled: (option) => !option || option.value === "$add",
          onTrigger: (option) =>
            setScreen({ kind: "edit", providerID: option.value }),
        },
        {
          command: "provider.dialog.models",
          title: "models",
          disabled: (option) => !option || option.value === "$add",
          onTrigger: (option) =>
            setScreen({ kind: "models", providerID: option.value }),
        },
        {
          command: "provider.dialog.toggle",
          title: "toggle",
          disabled: (option) => !option || option.value === "$add",
          onTrigger: (option) => {
            const provider = config().providers[option.value];
            if (provider)
              persist(
                setProviderEnabled(config(), option.value, !provider.enabled),
              );
          },
        },
        {
          command: "provider.dialog.delete",
          title: "delete",
          disabled: (option) => !option || option.value === "$add",
          onTrigger: (option) =>
            setScreen({ kind: "delete", providerID: option.value }),
        },
      ]}
      onSelect={(option) => {
        if (option.value === "$add") {
          setScreen({ kind: "add-id" });
          return;
        }
        setScreen({ kind: "models", providerID: option.value });
      }}
    />
  );
}

const SAVE = "$save";
const SELECT_ALL = "$select-all";
const INVERT = "$invert";

/** Multi-select batch model import, modeled on DialogToolMultiSelect. */
export function DialogModelMultiSelect(props: {
  title: string;
  models: Array<{ name: string; description?: string }>;
  selected: string[];
  onSave(models: string[]): void;
}) {
  const [selected, setSelected] = createSignal(new Set(props.selected));

  const options = createMemo<DialogSelectOption<string>[]>(() => [
    {
      title: `Save (${selected().size} selected)`,
      value: SAVE,
      description: "Import the selected models",
    },
    {
      title: "Select all",
      value: SELECT_ALL,
      description: `${props.models.length} models`,
    },
    {
      title: "Invert selection",
      value: INVERT,
      description: "Select unselected models and clear selected models",
    },
    ...props.models.map((model) => ({
      title: `${selected().has(model.name) ? "[x]" : "[ ]"} ${model.name}`,
      value: model.name,
      description: model.description,
      category: "Models",
    })),
  ]);

  function toggle(value: string) {
    if (value.startsWith("$")) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function activate(option: DialogSelectOption<string>) {
    if (option.value === SAVE) {
      props.onSave(
        props.models
          .map((model) => model.name)
          .filter((model) => selected().has(model)),
      );
      return;
    }
    if (option.value === SELECT_ALL) {
      setSelected(new Set(props.models.map((model) => model.name)));
      return;
    }
    if (option.value === INVERT) {
      const all = props.models.map((model) => model.name);
      setSelected(new Set(all.filter((model) => !selected().has(model))));
      return;
    }
    toggle(option.value);
  }

  return (
    <DialogSelect
      title={props.title}
      renderFilter={false}
      preserveSelection
      options={options()}
      actions={[
        {
          command: "provider.models.toggle",
          title: "toggle",
          disabled: (option) => !option || option.value.startsWith("$"),
          onTrigger: (option) => toggle(option.value),
        },
      ]}
      onSelect={activate}
    />
  );
}
