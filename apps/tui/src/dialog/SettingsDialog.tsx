import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  type JSX,
} from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { ConfigV2 } from "@natalia/contracts";
import { resolveConfig, saveConfigFile } from "@natalia/config";
import { useAppState } from "../context/state";
import { useToast } from "../context/toast";
import { darkTheme } from "../theme/theme";
import { useBindings } from "@opentui/keymap/solid";
import { useDialog } from "./provider";
import { DialogSelect, type DialogSelectOption } from "./DialogSelect";
import { DialogPrompt } from "./DialogPrompt";
import { ThemeService } from "../theme/service";
import {
  loadLocalTuiState,
  trackModelUsage,
  toggleModelFavorite,
  sortModelOptions,
} from "../local";
import type { TuiConfig, TuiConfigWriteScope } from "../config";

type Row =
  | {
      kind: "info";
      label: string;
      value: string;
      scope?: "runtime" | "project" | "global" | "tui";
    }
  | {
      kind: "toggle";
      label: string;
      value: boolean;
      scope?: "runtime" | "project" | "global" | "tui";
      onChange(next: boolean): void;
    }
  | {
      kind: "action";
      label: string;
      hint: string;
      scope?: "runtime" | "project" | "global" | "tui";
      onActivate(): void;
    }
  | {
      kind: "legacy";
      label: string;
    };

type SettingsStep =
  | "model"
  | "theme"
  | "permission"
  | "mode"
  | "provider-kind"
  | "provider-name"
  | "provider-key"
  | "provider-url"
  | "provider-model"
  | "edit-provider"
  | "delete-provider"
  | "tui-scope";

function scopeTag(scope?: string) {
  if (!scope) return "";
  const colors: Record<string, string> = {
    runtime: darkTheme.success,
    project: darkTheme.accent,
    global: darkTheme.warning,
    tui: darkTheme.muted,
  };
  return ` [${scope}]`;
}

function RowItem(props: { row: Row; selected: boolean }) {
  const { row, selected } = props;
  const fg = selected ? darkTheme.accent : darkTheme.text;
  const bold = selected ? TextAttributes.BOLD : undefined;
  const marker = selected ? ">" : " ";

  if (row.kind === "info") {
    return (
      <box flexDirection="row" gap={1}>
        <text fg={fg} attributes={bold}>
          {marker}
          {row.label}
        </text>
        <text fg={darkTheme.muted}>{row.value}</text>
        {row.scope ? (
          <text fg={darkTheme.muted}>{scopeTag(row.scope)}</text>
        ) : null}
      </box>
    );
  }

  if (row.kind === "toggle") {
    return (
      <box flexDirection="row" gap={1}>
        <text fg={fg} attributes={bold}>
          {marker}
          {row.label}:{" "}
          <text fg={row.value ? darkTheme.success : darkTheme.danger}>
            {row.value ? "ON" : "OFF"}
          </text>
        </text>
        {row.scope ? (
          <text fg={darkTheme.muted}>{scopeTag(row.scope)}</text>
        ) : null}
      </box>
    );
  }

  if (row.kind === "action") {
    return (
      <box flexDirection="row" gap={1}>
        <text fg={fg} attributes={bold}>
          {marker}
          {row.label}
          <text fg={darkTheme.muted}> · {row.hint}</text>
        </text>
        {row.scope ? (
          <text fg={darkTheme.muted}>{scopeTag(row.scope)}</text>
        ) : null}
      </box>
    );
  }

  return <text fg={darkTheme.muted}> {row.label}</text>;
}

export function SettingsDialog(props: {
  tuiConfig?: TuiConfig;
  tuiWriteScope?: TuiConfigWriteScope;
  workspaceRoot?: string;
  onTuiConfigChange?: (config: TuiConfig, scope?: TuiConfigWriteScope) => void;
  onTuiConfigScopeChange?: (scope: TuiConfigWriteScope) => void;
}) {
  const { state } = useAppState();
  const toast = useToast();
  const dialog = useDialog();
  const [section, setSection] = createSignal(0);
  const [selected, setSelected] = createSignal(0);
  const [config, setConfig] = createSignal<ConfigV2>();
  const [localState, setLocalState] =
    createSignal<Awaited<ReturnType<typeof loadLocalTuiState>>>();
  const [projectConfigured, setProjectConfigured] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [providerDraft, setProviderDraft] = createSignal({
    type: "openai",
    name: "",
    apiKey: "",
    baseURL: "",
    model: "",
  });
  const [childOpen, setChildOpen] = createSignal(false);

  const providerNames = createMemo(() =>
    Object.keys(config()?.providers ?? {}),
  );

  const themeService = new ThemeService(props.workspaceRoot);

  const sections = [
    { id: "provider-model", label: "Provider & Model" },
    { id: "permission-mode", label: "Permission & Mode" },
    { id: "mcp", label: "MCP Servers" },
    { id: "theme", label: "Theme" },
    { id: "tui", label: "TUI Config" },
    { id: "run-config", label: "Runtime Config" },
    { id: "web-network", label: "Web & Network" },
    { id: "workspace-instructions", label: "Workspace & Instructions" },
    { id: "legacy", label: "Legacy" },
  ] as const;

  createEffect(() => {
    if (!props.workspaceRoot) return;
    void Promise.all([
      resolveConfig({ workspaceRoot: props.workspaceRoot }),
      loadLocalTuiState(props.workspaceRoot),
    ]).then(([result, local]) => {
      setConfig(result.config);
      setLocalState(local);
      setProjectConfigured(
        result.sources.some(
          (source) => source.scope === "project" && source.applied,
        ),
      );
    });
  });

  async function persistConfig(next: ConfigV2) {
    if (!props.workspaceRoot) return;
    try {
      await saveConfigFile(next, `${props.workspaceRoot}/.natalia/config.json`);
      setConfig(next);
      setProjectConfigured(true);
      setNotice("Saved to project config. New sessions load this.");
      toast.show({
        variant: "success",
        title: "Settings saved",
        message: "New sessions will load the project configuration.",
      });
    } catch (error) {
      toast.error(error);
    }
  }

  const rows = createMemo<Row[]>(() => {
    const cfg = config();
    const tui = props.tuiConfig;
    switch (section()) {
      case 0:
        return providerModelRows(
          cfg,
          state.statusSegments,
          projectConfigured(),
        );
      case 1:
        return permissionModeRows(cfg);
      case 2:
        return mcpRows(cfg, (next) => void persistConfig(next));
      case 3:
        return themeRows(tui, props.tuiWriteScope ?? "project");
      case 4:
        return tuiRows(tui, props.tuiWriteScope ?? "project", (next) =>
          props.onTuiConfigChange?.(next, props.tuiWriteScope),
        );
      case 5:
        return runtimeConfigRows(cfg, (next) => void persistConfig(next));
      case 6:
        return webNetworkRows(cfg);
      case 7:
        return workspaceInstructionsRows(cfg);
      default:
        return legacyRows();
    }
  });

  function openSubDialog(kind: SettingsStep) {
    switch (kind) {
      case "model":
        pushChild(() => (
          <DialogSelect
            title="Select Model"
            options={modelOptions()}
            onExtraKey={(key, option) => {
              if (key !== "f" || !props.workspaceRoot) return;
              void toggleModelFavorite(props.workspaceRoot, option.value);
              void loadLocalTuiState(props.workspaceRoot).then(setLocalState);
            }}
            onSelect={(option) => {
              if (props.workspaceRoot)
                void trackModelUsage(props.workspaceRoot, option.value);
              const next = structuredClone(config());
              if (next) {
                next.defaultModel = option.value;
                void persistConfig(next);
              }
              dialog.pop();
            }}
          />
        ));
        return;
      case "provider-kind":
        pushChild(() => (
          <DialogSelect
            title="Provider Type"
            options={["openai", "anthropic", "gemini", "openai-compatible"].map(
              (value) => ({
                value,
                title: value,
                description: "Native TS provider",
              }),
            )}
            onSelect={(option) => {
              setProviderDraft((draft) => ({ ...draft, type: option.value }));
              dialog.pop();
              openSubDialog("provider-name");
            }}
          />
        ));
        return;
      case "provider-name":
        promptStep(
          "Provider Name",
          "Unique project provider/profile name.",
          "provider-name",
          (value) => {
            setProviderDraft((draft) => ({ ...draft, name: value.trim() }));
            openSubDialog("provider-key");
          },
          (value) => (value.trim() ? undefined : "Provider name is required"),
        );
        return;
      case "provider-key":
        promptStep(
          "API Key",
          "Stored in 0600 project config and redacted in all UI summaries.",
          "provider-key",
          (value) => {
            setProviderDraft((draft) => ({ ...draft, apiKey: value.trim() }));
            openSubDialog("provider-url");
          },
          (value) => (value.trim() ? undefined : "API key is required"),
        );
        return;
      case "provider-url":
        promptStep(
          "Provider Endpoint",
          "Optional. Submit blank for the native provider default.",
          "provider-url",
          (value) => {
            setProviderDraft((draft) => ({ ...draft, baseURL: value.trim() }));
            openSubDialog("provider-model");
          },
        );
        return;
      case "provider-model":
        promptStep(
          "Model ID",
          "Provider model identifier.",
          "provider-model",
          (value) => {
            const draft = { ...providerDraft(), model: value.trim() };
            const next = structuredClone(config());
            if (next) {
              next.providers[draft.name] = {
                type: draft.type,
                apiKey: draft.apiKey,
                ...(draft.baseURL ? { baseURL: draft.baseURL } : {}),
                customHeaders: {},
              };
              next.models[draft.name] = {
                provider: draft.name,
                model: draft.model,
                contextWindow: "auto",
                maxOutputTokens: null,
                temperature: null,
                topP: null,
                reasoningEffort: null,
                thinkingEnabled: true,
                stream: true,
                requestTimeoutSec: null,
              };
              next.defaultModel = draft.name;
              void persistConfig(next);
            }
            dialog.pop();
          },
          (value) => (value.trim() ? undefined : "Model ID is required"),
        );
        return;
      case "permission":
        selectConfig(
          "Select Permission Profile",
          permissionOptions(),
          (next, value) => {
            next.defaultPermission = value;
          },
        );
        return;
      case "mode":
        selectConfig("Select Agent Mode", modeOptions(), (next, value) => {
          next.defaultMode = value;
        });
        return;
      case "theme":
        pushChild(() => (
          <DialogSelect
            title="Select Theme"
            options={themeOptions()}
            onSelect={(option) => {
              props.onTuiConfigChange?.(
                { ...props.tuiConfig!, theme: option.value },
                props.tuiWriteScope,
              );
              dialog.pop();
            }}
          />
        ));
        return;
      case "tui-scope":
        pushChild(() => (
          <DialogSelect
            title="TUI Write Scope"
            options={[
              {
                value: "project" as const,
                title: "Project",
                description: ".natalia/tui.json for this workspace",
              },
              {
                value: "global" as const,
                title: "Global",
                description:
                  "~/.config/natalia-cli/tui.json for all workspaces",
              },
            ]}
            onSelect={(option) => {
              props.onTuiConfigScopeChange?.(option.value);
              setNotice(
                `TUI changes will save to ${option.value === "global" ? "global" : "project"} config.`,
              );
              dialog.pop();
            }}
          />
        ));
        return;
      case "edit-provider":
      case "delete-provider":
        pushChild(() => (
          <DialogSelect
            title={
              kind === "edit-provider" ? "Edit Provider" : "Delete Provider"
            }
            options={providerNames().map((name) => ({
              value: name,
              title: name,
              description:
                kind === "edit-provider"
                  ? (config()?.providers[name]?.type ?? "")
                  : "Delete provider and associated model",
            }))}
            onSelect={(option) => selectProvider(kind, option.value)}
          />
        ));
    }
  }

  function promptStep(
    title: string,
    description: string,
    placeholder: string,
    next: (value: string) => void,
    validate?: (value: string) => string | undefined,
  ) {
    pushChild(() => (
      <DialogPrompt
        title={title}
        description={() => <text fg={darkTheme.muted}>{description}</text>}
        placeholder={placeholder}
        validate={validate}
        onConfirm={(value) => {
          dialog.pop();
          next(value);
        }}
      />
    ));
  }

  function selectConfig(
    title: string,
    options: DialogSelectOption<string>[],
    update: (next: ConfigV2, value: string) => void,
  ) {
    pushChild(() => (
      <DialogSelect
        title={title}
        options={options}
        onSelect={(option) => {
          const next = structuredClone(config());
          if (next) {
            update(next, option.value);
            void persistConfig(next);
          }
          dialog.pop();
        }}
      />
    ));
  }

  function selectProvider(
    kind: "edit-provider" | "delete-provider",
    name: string,
  ) {
    if (kind === "edit-provider") {
      const provider = config()?.providers[name];
      setProviderDraft({
        type: provider?.type ?? "openai",
        name,
        apiKey: provider?.apiKey ?? "",
        baseURL: provider?.baseURL ?? "",
        model: "",
      });
      dialog.pop();
      openSubDialog("provider-key");
      return;
    }
    const next = structuredClone(config());
    if (!next) return;
    delete next.providers[name];
    delete next.models[name];
    if (next.defaultModel === name) next.defaultModel = "";
    void persistConfig(next);
    setNotice(`Provider "${name}" deleted.`);
    toast.show({ variant: "success", message: `Provider "${name}" deleted` });
    dialog.pop();
  }

  function pushChild(element: () => JSX.Element) {
    setChildOpen(true);
    dialog.push(element, () => setChildOpen(false));
  }

  createEffect(() => {
    setSection(0);
    setSelected(0);
    setNotice("");
  });

  useBindings(() => ({
    mode: "modal",
    enabled: !childOpen(),
    bindings: [
      {
        key: "escape",
        desc: "Close dialog or sub-dialog",
        group: "Dialog",
        cmd: () => {
          dialog.clear();
        },
      },
    ],
  }));

  useBindings(() => ({
    mode: "modal",
    enabled: !childOpen(),
    bindings: [
      {
        key: "up",
        desc: "Previous row",
        group: "Dialog",
        cmd: () => setSelected((v) => Math.max(0, v - 1)),
      },
      {
        key: "down",
        desc: "Next row",
        group: "Dialog",
        cmd: () => setSelected((v) => Math.min(rows().length - 1, v + 1)),
      },
      {
        key: "left",
        desc: "Previous section",
        group: "Dialog",
        cmd: () => {
          setSection((v) => (v - 1 + sections.length) % sections.length);
          setSelected(0);
        },
      },
      {
        key: "right",
        desc: "Next section",
        group: "Dialog",
        cmd: () => {
          setSection((v) => (v + 1) % sections.length);
          setSelected(0);
        },
      },
      {
        key: "tab",
        desc: "Next section",
        group: "Dialog",
        cmd: () => {
          setSection((v) => (v + 1) % sections.length);
          setSelected(0);
        },
      },
      {
        key: "return",
        desc: "Activate row",
        group: "Dialog",
        cmd: () => {
          const row = rows()[selected()];
          if (row?.kind === "action") {
            if (row.label === "Switch model") openSubDialog("model");
            else if (row.label === "Switch theme") openSubDialog("theme");
            else if (row.label === "Switch permission")
              openSubDialog("permission");
            else if (row.label === "Switch mode") openSubDialog("mode");
            else if (row.label === "TUI write scope")
              openSubDialog("tui-scope");
            else if (row.label === "Edit provider")
              openSubDialog("edit-provider");
            else if (row.label === "Delete provider")
              openSubDialog("delete-provider");
            else if (row.label === "Add provider") {
              setProviderDraft({
                type: "openai",
                name: "",
                apiKey: "",
                baseURL: "",
                model: "",
              });
              openSubDialog("provider-kind");
            } else row.onActivate();
            return;
          }
          if (row?.kind === "toggle") {
            row.onChange(!row.value);
          }
        },
      },
      {
        key: "space",
        desc: "Toggle row",
        group: "Dialog",
        cmd: () => {
          const row = rows()[selected()];
          if (row?.kind === "action") {
            if (row.label === "Switch model") openSubDialog("model");
            else if (row.label === "Switch theme") openSubDialog("theme");
            else if (row.label === "Switch permission")
              openSubDialog("permission");
            else if (row.label === "Switch mode") openSubDialog("mode");
            else if (row.label === "TUI write scope")
              openSubDialog("tui-scope");
            else if (row.label === "Edit provider")
              openSubDialog("edit-provider");
            else if (row.label === "Delete provider")
              openSubDialog("delete-provider");
            else if (row.label === "Add provider") {
              setProviderDraft({
                type: "openai",
                name: "",
                apiKey: "",
                baseURL: "",
                model: "",
              });
              openSubDialog("provider-kind");
            } else row.onActivate();
            return;
          }
          if (row?.kind === "toggle") {
            row.onChange(!row.value);
          }
        },
      },
    ],
  }));

  const modelOptions = createMemo<DialogSelectOption<string>[]>(() => {
    const cfg = config();
    if (!cfg) return [];
    const local = localState();
    const names = sortModelOptions(
      Object.keys(cfg.models),
      local?.favoriteModels ?? [],
      local?.recentModels ?? [],
    );
    return names.map((name) => {
      const m = cfg.models[name];
      const tags: string[] = [];
      if (local?.favoriteModels.includes(name)) tags.push("★");
      if (local?.recentModels.includes(name)) tags.push("recent");
      return {
        value: name,
        title: name,
        description: `${m.model} @ ${m.provider}${tags.length ? ` · ${tags.join(" ")}` : ""}`,
      };
    });
  });

  const themeOptions = createMemo<DialogSelectOption<string>[]>(() => {
    const names = themeService.getBuiltinThemeNames();
    return names.map((name) => ({
      value: name,
      title: name,
      description: name === props.tuiConfig?.theme ? "current" : undefined,
    }));
  });
  const permissionOptions = createMemo<DialogSelectOption<string>[]>(() =>
    Object.entries(config()?.permissionProfiles ?? {}).map(
      ([name, profile]) => ({
        value: name,
        title: name,
        description: `${profile.approval} · ${profile.description}`,
      }),
    ),
  );
  const modeOptions = createMemo<DialogSelectOption<string>[]>(() =>
    Object.entries(config()?.modes ?? {}).map(([name, mode]) => ({
      value: name,
      title: name,
      description:
        mode.description || `${mode.allowedTools.length} allowed tools`,
    })),
  );

  return (
    <box
      flexDirection="column"
      gap={1}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={darkTheme.accent}>
          Settings Center
        </text>
        <text fg={darkTheme.muted}>runtime · project · tui config</text>
      </box>
      <text fg={darkTheme.muted}>
        Left/right section · Up/down row · Enter toggle/select · Escape close
      </text>
      <box flexDirection="row" gap={1}>
        <For each={sections}>
          {(sec, idx) => (
            <text
              fg={idx() === section() ? darkTheme.accent : darkTheme.muted}
              attributes={idx() === section() ? TextAttributes.BOLD : undefined}
            >
              {idx() === section() ? ">" : ""}
              {sec.label}
            </text>
          )}
        </For>
      </box>
      <scrollbox
        height={16}
        border={["left"]}
        borderColor={darkTheme.muted}
        flexDirection="column"
      >
        <For each={rows()}>
          {(row, idx) => <RowItem row={row} selected={idx() === selected()} />}
        </For>
      </scrollbox>
      <Show when={notice()}>
        <text fg={darkTheme.success}>{notice()}</text>
      </Show>
    </box>
  );
}

function providerModelRows(
  cfg: ConfigV2 | undefined,
  statusSegments: string[],
  projectConfigured: boolean,
): Row[] {
  const active = cfg?.models[cfg.defaultModel];
  const provider = active ? cfg?.providers[active.provider] : undefined;
  const runtimeModel =
    statusSegments.find((s) => s.startsWith("model:"))?.slice(6) ??
    "not connected";
  const runtimeProvider =
    statusSegments.find((s) => s.startsWith("provider:"))?.slice(9) ??
    "not connected";
  return [
    {
      kind: "info",
      label: "Runtime:",
      value: `${runtimeModel} @ ${runtimeProvider}`,
      scope: "runtime",
    },
    {
      kind: "info",
      label: "Project config:",
      value: projectConfigured
        ? "configured"
        : "not created (runtime fallback remains active)",
      scope: "project",
    },
    {
      kind: "info",
      label: "Project model:",
      value: cfg?.defaultModel || "(none set)",
      scope: "project",
    },
    {
      kind: "info",
      label: "Provider:",
      value: active?.provider ?? "-",
      scope: "project",
    },
    {
      kind: "info",
      label: "Type:",
      value: provider?.type ?? "unconfigured",
      scope: "project",
    },
    {
      kind: "action",
      label: "Switch model",
      hint: "Enter to browse",
      scope: "project",
      onActivate: () => {},
    },
    {
      kind: "action",
      label: "Edit provider",
      hint:
        cfg && Object.keys(cfg.providers).length
          ? "Enter to select"
          : "(no providers)",
      scope: "project",
      onActivate: () => {},
    },
    {
      kind: "action",
      label: "Delete provider",
      hint: "Enter to select and confirm",
      scope: "project",
      onActivate: () => {},
    },
    {
      kind: "action",
      label: "Add provider",
      hint: "Guided setup",
      scope: "project",
      onActivate: () => {},
    },
    {
      kind: "info",
      label: "Endpoint:",
      value: provider?.baseURL ?? "provider default",
      scope: "project",
    },
    {
      kind: "info",
      label: "API key:",
      value: provider?.apiKey ? "(set, redacted)" : "(not set)",
      scope: "project",
    },
  ];
}

function permissionModeRows(cfg: ConfigV2 | undefined): Row[] {
  const profiles = cfg?.permissionProfiles ?? {};
  const modeNames = Object.keys(cfg?.modes ?? {});
  const profileNames = Object.keys(profiles);
  const result: Row[] = [
    {
      kind: "info",
      label: "Default permission:",
      value: cfg?.defaultPermission ?? "ask",
      scope: "project",
    },
    {
      kind: "action",
      label: "Switch permission",
      hint: "Enter to select profile",
      scope: "project",
      onActivate: () => {},
    },
  ];
  for (const name of profileNames) {
    result.push({
      kind: "info",
      label: `  ${name}:`,
      value: profiles[name]?.description || profiles[name]?.approval || "-",
      scope: "project",
    });
  }
  result.push({
    kind: "info",
    label: "Default mode:",
    value: cfg?.defaultMode ?? "code",
    scope: "project",
  });
  result.push({
    kind: "action",
    label: "Switch mode",
    hint: "Enter to select mode",
    scope: "project",
    onActivate: () => {},
  });
  for (const name of modeNames) {
    result.push({
      kind: "info",
      label: `  ${name}:`,
      value: `${cfg!.modes[name]!.allowedTools.length} tools, ${cfg!.modes[name]!.excludedTools.length} excluded`,
      scope: "project",
    });
  }
  return result;
}

function mcpRows(
  cfg: ConfigV2 | undefined,
  onPersist: (next: ConfigV2) => void,
): Row[] {
  const servers = cfg?.mcpServers ?? {};
  const names = Object.keys(servers);
  if (!names.length) {
    return [
      {
        kind: "info",
        label: "No MCP servers configured.",
        value: "",
        scope: "project",
      },
    ];
  }
  return names.map((name) => ({
    kind: "toggle" as const,
    label: name,
    value: servers[name]?.enabled ?? true,
    scope: "project" as const,
    onChange: (enabled) => {
      const next = structuredClone(cfg!);
      next.mcpServers[name]!.enabled = enabled;
      onPersist(next);
    },
  }));
}

function themeRows(
  tui: TuiConfig | undefined,
  scope: TuiConfigWriteScope,
): Row[] {
  return [
    {
      kind: "info",
      label: "Current theme:",
      value: tui?.theme ?? "natalia-dark",
      scope,
    },
    {
      kind: "action",
      label: "Switch theme",
      hint: "Enter to browse built-in and custom themes",
      scope,
      onActivate: () => {},
    },
    {
      kind: "info",
      label: "Theme mode:",
      value: tui?.themeMode ?? "dark",
      scope,
    },
  ];
}

function tuiRows(
  tui: TuiConfig | undefined,
  scope: TuiConfigWriteScope,
  onChange: (next: TuiConfig) => void,
): Row[] {
  if (!tui) return [{ kind: "legacy", label: "TUI config not loaded" }];
  return [
    {
      kind: "action",
      label: "TUI write scope",
      hint: scope,
      scope,
      onActivate: () => {},
    },
    {
      kind: "toggle",
      label: "Tool details",
      value: tui.toolDetails === "expanded",
      scope,
      onChange: (next) =>
        onChange({ ...tui, toolDetails: next ? "expanded" : "collapsed" }),
    },
    {
      kind: "toggle",
      label: "Compact density",
      value: tui.density === "compact",
      scope,
      onChange: (next) =>
        onChange({ ...tui, density: next ? "compact" : "comfortable" }),
    },
    {
      kind: "toggle",
      label: "Follow bottom",
      value: tui.followBottom,
      scope,
      onChange: (next) => onChange({ ...tui, followBottom: next }),
    },
    {
      kind: "toggle",
      label: "Reasoning visible",
      value: tui.reasoning === "step",
      scope,
      onChange: (next) =>
        onChange({ ...tui, reasoning: next ? "step" : "hidden" }),
    },
    {
      kind: "toggle",
      label: "Scroll acceleration",
      value: tui.scrollAcceleration,
      scope,
      onChange: (next) => onChange({ ...tui, scrollAcceleration: next }),
    },
    {
      kind: "toggle",
      label: "Mouse support",
      value: tui.mouse,
      scope,
      onChange: (next) => onChange({ ...tui, mouse: next }),
    },
    {
      kind: "toggle",
      label: "Attention notifications",
      value: tui.attention.enabled,
      scope,
      onChange: (next) =>
        onChange({ ...tui, attention: { ...tui.attention, enabled: next } }),
    },
    {
      kind: "info",
      label: "Prompt max height:",
      value: String(tui.prompt.maxHeight),
      scope,
    },
    {
      kind: "info",
      label: "Scroll speed:",
      value: String(tui.scrollSpeed),
      scope,
    },
    {
      kind: "info",
      label: "Diff style:",
      value: tui.diffStyle,
      scope,
    },
    {
      kind: "info",
      label: "Leader timeout:",
      value: `${tui.leaderTimeoutMs}ms`,
      scope,
    },
  ];
}

function runtimeConfigRows(
  cfg: ConfigV2 | undefined,
  onChange: (next: ConfigV2) => void,
): Row[] {
  if (!cfg) return [{ kind: "legacy", label: "Config not loaded" }];
  return [
    {
      kind: "toggle",
      label: "Compaction",
      value: cfg.context.compactionEnabled,
      scope: "project",
      onChange: (next) => {
        const c = structuredClone(cfg);
        c.context.compactionEnabled = next;
        onChange(c);
      },
    },
    {
      kind: "info",
      label: "Compaction threshold:",
      value: `${cfg.context.compactionThresholdPercent}%`,
      scope: "project",
    },
    {
      kind: "info",
      label: "Preserved messages:",
      value: String(cfg.context.preservedRecentMessages),
      scope: "project",
    },
    {
      kind: "toggle",
      label: "Checkpointing",
      value: cfg.checkpoint.enabled,
      scope: "project",
      onChange: (next) => {
        const c = structuredClone(cfg);
        c.checkpoint.enabled = next;
        onChange(c);
      },
    },
    {
      kind: "info",
      label: "Max tracked files:",
      value: String(cfg.checkpoint.maxFiles),
      scope: "project",
    },
    {
      kind: "info",
      label: "Max steps per turn:",
      value: String(cfg.runtime.maxStepsPerTurn),
      scope: "project",
    },
    {
      kind: "info",
      label: "Max retry attempts:",
      value: String(cfg.runtime.maxAttemptsPerStep),
      scope: "project",
    },
    {
      kind: "info",
      label: "Request timeout:",
      value: `${cfg.runtime.timeouts.requestSec}s`,
      scope: "project",
    },
    {
      kind: "info",
      label: "Stream idle timeout:",
      value: `${cfg.runtime.timeouts.streamIdleSec}s`,
      scope: "project",
    },
  ];
}

function webNetworkRows(cfg: ConfigV2 | undefined): Row[] {
  if (!cfg) return [{ kind: "legacy", label: "Config not loaded" }];
  return [
    {
      kind: "info",
      label: "Web search endpoint:",
      value: cfg.webSearch.endpoint ?? "DuckDuckGo default",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Browser enabled:",
      value: cfg.browser.enabled ? "yes" : "no",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Browser binary:",
      value: cfg.browser.binary || "system default",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Allowed network hosts:",
      value: cfg.network.allowedHosts.length
        ? cfg.network.allowedHosts.join(", ")
        : "all (no restriction)",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Allow localhost:",
      value: cfg.network.allowLocalhost ? "yes" : "no",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Allow private network:",
      value: cfg.network.allowPrivate ? "yes" : "no",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Env allowlist:",
      value: cfg.security.envAllowlist.join(", ") || "(none)",
      scope: "project" as const,
    },
  ];
}

function workspaceInstructionsRows(cfg: ConfigV2 | undefined): Row[] {
  if (!cfg) return [{ kind: "legacy", label: "Config not loaded" }];
  return [
    {
      kind: "info",
      label: "Workspace root:",
      value: cfg.workspace.root || "current session root",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Additional dirs:",
      value: cfg.workspace.additionalDirs.join(", ") || "(none)",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Instructions enabled:",
      value: cfg.instructions.enabled ? "yes" : "no",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Include README:",
      value: cfg.instructions.includeReadme ? "yes" : "no",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Include docs:",
      value: cfg.instructions.includeDocs ? "yes" : "no",
      scope: "project" as const,
    },
    {
      kind: "info",
      label: "Instruction files:",
      value: cfg.instructions.extraFiles.join(", ") || "(none)",
      scope: "project" as const,
    },
  ];
}

function legacyRows(): Row[] {
  return [
    { kind: "legacy", label: "Legacy Go-only settings are not editable." },
    {
      kind: "legacy",
      label: "Hooks, browser policy, network policy: import diagnostics only.",
    },
  ];
}
