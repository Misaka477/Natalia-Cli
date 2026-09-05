import { createSignal, createEffect, For, Show, onCleanup, onMount } from "solid-js";
import type { AppState } from "@natalia/view-store";
import {
  describeRuntimeCapabilities,
  type ConfigV3,
  type RuntimeClient,
  type UiPanelRequirement,
} from "@natalia/contracts";
import { NeuSelect } from "./components/NeuSelect";

const BUILTIN_PERMISSION_PROFILES = ["ask", "auto", "read_only"];

const TOOL_FAMILIES = [
  "read_file",
  "glob",
  "grep",
  "read_media_file",
  "interactive_terminal_*",
  "terminal_observe",
  "run_shell",
  "write_file",
  "edit_file",
  "web_fetch",
  "web_search",
  "skill_load",
  "agent_*",
];

type CategoryId = "model" | "security" | "runtime" | "interface" | "storage" | "plugin";

type SettingItem = {
  label: string;
  description: string;
  value: string;
};

type Category = {
  id: CategoryId;
  label: string;
  items: SettingItem[];
};


const categories: Category[] = [
  {
    id: "model",
    label: "模型与 Agent",
    items: [
      { label: "Providers & Models", description: "配置 provider 并导入模型", value: "3 个 provider" },
      { label: "Default Model", description: "默认使用的模型", value: "Opus 4" },
      { label: "默认 Agent", description: "当前 agent / 默认使用的 agent", value: "默认" },
      { label: "自定义 Agent Mode", description: "创建、编辑并选择自定义 agent 运行模式", value: "code" },
      { label: "子 Agent 并发数", description: "团队子 agent 最大并发数", value: "3" },
    ],
  },
  {
    id: "security",
    label: "权限与安全",
    items: [
      { label: "Permission Profile", description: "选择、新增、编辑权限配置", value: "ask" },
      { label: "Web & Network", description: "搜索、浏览器、网络规则", value: "已配置" },
    ],
  },
  {
    id: "runtime",
    label: "运行时与上下文",
    items: [
      { label: "Max Steps", description: "单轮最大执行步数", value: "unlimited" },
      { label: "Max Retry", description: "单步最大重试次数", value: "3" },
      { label: "Request Timeout", description: "模型请求超时", value: "120s" },
      { label: "Compaction", description: "上下文压缩", value: "开启" },
      { label: "Compaction Threshold", description: "压缩触发阈值", value: "85%" },
      { label: "Checkpoint 目录", description: "额外 checkpoint 目录", value: "2 个" },
      { label: "Terminal Window Mode", description: "终端窗口模式", value: "auto" },
    ],
  },
  {
    id: "interface",
    label: "界面与服务",
    items: [
      { label: "Theme Mode", description: "切换浅色 / 深色 / 青柠黑", value: "浅色" },
      { label: "Density", description: "界面信息密度", value: "comfortable" },
      { label: "Diff Style", description: "diff 展示风格", value: "auto" },
      { label: "Tool Details", description: "工具卡默认展开状态", value: "expanded" },
      { label: "GPU 加速", description: "启用/关闭硬件加速（需重启 Desktop 生效）", value: "关闭" },
      { label: "Keybinds", description: "快捷键覆盖", value: "12 个" },
    ],
  },
  {
    id: "storage",
    label: "配置保存范围",
    items: [
      { label: "界面偏好保存范围", description: "主题 / 密度 / 快捷键保存位置", value: "项目" },
      { label: "运行时配置保存范围", description: "模型 / 权限 / 运行时设置保存位置", value: "全局" },
    ],
  },
];


export function SettingsPanel(props: {
  open: boolean;
  onClose: () => void;
  onOpenModels?: () => void;
  themeMode?: string;
  onCycleThemeMode?: () => void;
  state?: AppState;
  config?: ConfigV3;
  preferences?: {
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T): void;
  };
  registeredTools?: string[];
  onUpdateConfig?: (patch: Record<string, unknown>) => unknown;
  runtime?: RuntimeClient;
  host?: import("@natalia/ui-host").UiPluginContext["host"];
}) {
  const [activeCategory, setActiveCategory] = createSignal<CategoryId>("model");
  const [density, setDensity] = createSignal(props.preferences?.get<string>("density") ?? "comfortable");
  const [diffStyle, setDiffStyle] = createSignal(props.preferences?.get<string>("diffStyle") ?? "auto");
  const [toolDetails, setToolDetails] = createSignal(props.preferences?.get<string>("toolDetails") ?? "expanded");
  const [uiWriteScope, setUiWriteScope] = createSignal(props.preferences?.get<string>("uiWriteScope") ?? "project");
  const [gpuAcceleration, setGpuAcceleration] = createSignal<boolean>(props.preferences?.get<boolean>("gpuAcceleration") ?? false);

  const desktopElectron = (globalThis as { electron?: { invoke<T>(channel: string, args?: unknown): Promise<T> } }).electron;
  const [settingsPanel, setSettingsPanel] = createSignal<{
    pluginId: string;
    panelId: string;
  } | null>(null);
  let settingsPanelRef: HTMLDivElement | undefined;
  const [panelRevision, setPanelRevision] = createSignal(0);
  const [availablePluginIds, setAvailablePluginIds] = createSignal<Set<string>>(
    new Set(),
  );
  const [availableCapabilities, setAvailableCapabilities] = createSignal<Set<string>>(
    new Set(),
  );
  onMount(() => {
    const unsubscribe = props.host?.subscribePanels(() =>
      setPanelRevision((revision) => revision + 1),
    );
    onCleanup(() => unsubscribe?.());
    const runtime = props.runtime;
    if (!runtime) return;
    void (async () => {
      const [plugins, report] = await Promise.all([
        runtime.plugins?.(),
        Promise.resolve(describeRuntimeCapabilities(runtime)),
      ]);
      setAvailablePluginIds(
        new Set((plugins ?? []).map((plugin) => plugin.id)),
      );
      setAvailableCapabilities(
        new Set(
          report.groups.filter((group) => group.available).map((group) => group.name),
        ),
      );
    })();
  });
  function panelSatisfies(requirements?: UiPanelRequirement[]) {
    if (!requirements?.length) return true;
    return requirements.every((requirement) => {
      if (requirement.type === "plugin")
        return availablePluginIds().has(requirement.id);
      if (requirement.type === "capability")
        return availableCapabilities().has(requirement.id);
      if (requirement.type === "method")
        return typeof (props.runtime as unknown as Record<string, unknown>)[
          requirement.name
        ] === "function";
      return false;
    });
  }
  const settingsPanels = () => {
    panelRevision();
    return (
      props.host?.listPanels().filter((item) =>
        item.panel.region === "settings" &&
        panelSatisfies(item.panel.requires),
      ) ?? []
    );
  };
  const groupedSettingsPanels = () => {
    const groups = new Map<string, ReturnType<typeof settingsPanels>>();
    for (const item of settingsPanels()) {
      const group = item.panel.group ?? "插件设置";
      const list = groups.get(group) ?? [];
      list.push(item);
      groups.set(group, list);
    }
    return [...groups.entries()];
  };
  const categoriesWithPlugins = (): Category[] =>
    settingsPanels().length
      ? [...categories, { id: "plugin" as CategoryId, label: "插件配置", items: [] as Category["items"] }]
      : categories;
  createEffect(() => {
    if (props.open) {
      void desktopElectron
        ?.invoke<{ gpuEnabled?: boolean }>("desktop_get_setting", "gpuEnabled")
        .then((value) => {
          if (typeof value?.gpuEnabled === "boolean")
            setGpuAcceleration(value.gpuEnabled);
        })
        .catch(() => undefined);
    }
  });
  const [runtimeWriteScope, setRuntimeWriteScope] = createSignal(props.preferences?.get<string>("runtimeWriteScope") ?? "global");
  const current = () =>
    categoriesWithPlugins().find((category) => category.id === activeCategory()) ??
    categoriesWithPlugins()[0]!;

  function modelLabel(config: ConfigV3): string {
    const model = config.defaultModel;
    if (!model) return "未设置";
    if (typeof model === "string") return model;
    return `${model.provider}/${model.model}`;
  }

  function cyclePreference(
    key: string,
    current: string,
    values: string[],
    setter: (value: string) => void,
  ) {
    const next = values[(values.indexOf(current) + 1) % values.length]!;
    props.preferences?.set(key, next);
    setter(next);
  }

  const [editFieldLabel, setEditFieldLabel] = createSignal<string | undefined>();
  const [editFieldValue, setEditFieldValue] = createSignal("");
  let editFieldAction: ((value: string) => void) | undefined;
  const [modeEditorOpen, setModeEditorOpen] = createSignal(false);
  const [modeName, setModeName] = createSignal("code");
  const [modeDescription, setModeDescription] = createSignal("");
  const [modeSystemPrompt, setModeSystemPrompt] = createSignal("");
  const [modeModel, setModeModel] = createSignal("");
  const [modePermission, setModePermission] = createSignal("");
  const [modeAllowedTools, setModeAllowedTools] = createSignal("");
  const [modeExcludedTools, setModeExcludedTools] = createSignal("");
  const [modeMcpServers, setModeMcpServers] = createSignal("");
  const [permissionEditorOpen, setPermissionEditorOpen] = createSignal(false);
  const [permissionListOpen, setPermissionListOpen] = createSignal(false);
  const [permissionName, setPermissionName] = createSignal("ask");
  const [permissionDescription, setPermissionDescription] = createSignal("");
  const [permissionApproval, setPermissionApproval] = createSignal("ask");
  const [permissionAllowedTools, setPermissionAllowedTools] = createSignal("");
  const [permissionExcludedTools, setPermissionExcludedTools] = createSignal("");
  const [permissionCommandMode, setPermissionCommandMode] = createSignal("none");
  const [permissionCommandRules, setPermissionCommandRules] = createSignal("");
  const [permissionSkills, setPermissionSkills] = createSignal(true);
  const [permissionMcp, setPermissionMcp] = createSignal(true);
  const [permissionInteractiveAny, setPermissionInteractiveAny] = createSignal(false);
  const [permissionInteractiveAllow, setPermissionInteractiveAllow] = createSignal("");

  function openEdit(
    label: string,
    current: string,
    apply: (value: string) => void,
  ) {
    setEditFieldLabel(label);
    setEditFieldValue(current);
    editFieldAction = apply;
  }


  function openPermissionEditorFor(name: string) {
    const config = props.config;
    const profile = config?.agentModes?.[name];
    setPermissionName(name);
    setPermissionDescription(profile?.description ?? "");
    setPermissionApproval(profile?.approval ?? "ask");
    setPermissionAllowedTools((profile?.allowedTools ?? []).join(", "));
    setPermissionExcludedTools((profile?.excludedTools ?? []).join(", "));
    setPermissionCommandMode(profile?.commandRules?.mode ?? "none");
    setPermissionCommandRules((profile?.commandRules?.rules ?? []).join(", "));
    setPermissionSkills(profile?.skills !== false);
    setPermissionMcp(true);
    setPermissionInteractiveAny(Boolean(profile?.interactivePrograms?.allowAny));
    setPermissionInteractiveAllow((profile?.interactivePrograms?.allow ?? []).map((entry) => entry.command).join(", "));
    setPermissionEditorOpen(true);
  }

  function openNewPermissionEditor() {
    setPermissionName("");
    setPermissionDescription("");
    setPermissionApproval("ask");
    setPermissionAllowedTools("");
    setPermissionExcludedTools("");
    setPermissionCommandMode("none");
    setPermissionCommandRules("");
    setPermissionSkills(true);
    setPermissionMcp(true);
    setPermissionInteractiveAny(false);
    setPermissionInteractiveAllow("");
    setPermissionEditorOpen(true);
  }

  const editableActions: Record<string, () => void> = {
    "默认 Agent": () => {
      const current = props.config?.defaultAgent ?? "";
      openEdit("默认 Agent（defaultAgent）", current, (next) => {
        if (next) props.onUpdateConfig?.({ defaultAgent: next });
      });
    },
    "自定义 Agent Mode": () => {
      const config = props.config;
      const name = config?.defaultAgentMode ?? "code";
      const mode = config?.agentModes?.[name];
      setModeName(name);
      setModeDescription(mode?.description ?? "");
      setModeSystemPrompt(mode?.systemPrompt ?? "");
      setModeModel(mode?.model ?? "");
      setModePermission(mode?.approval ?? "ask");
      setModeAllowedTools((mode?.allowedTools ?? []).join(", "));
      setModeExcludedTools((mode?.excludedTools ?? []).join(", "));
      setModeMcpServers((mode?.mcpServers ?? []).join(", "));
      setModeEditorOpen(true);
    },
    "子 Agent 并发数": () => {
      const current = String(props.config?.team?.maxConcurrent ?? 4);
      openEdit("子 Agent 最大并发数", current, (raw) => {
        const value = Number(raw);
        if (Number.isInteger(value) && value >= 1 && value <= 32)
          props.onUpdateConfig?.({ team: { ...props.config?.team, maxConcurrent: value } });
      });
    },
    "Permission Profile": () => {
      setPermissionListOpen(true);
    },
    "Web & Network": () => {
      const current = props.config?.webSearch?.endpoint ?? "";
      openEdit("Web Search Endpoint", current, (next) => {
        props.onUpdateConfig?.({
          webSearch: { ...props.config?.webSearch, endpoint: next || null },
        });
      });
    },
    "Max Steps": () => {
      const current = props.config?.runtime?.maxStepsPerTurn
        ? String(props.config.runtime.maxStepsPerTurn)
        : "";
      openEdit("单轮最大执行步数", current, (raw) => {
        props.onUpdateConfig?.({
          runtime: {
            ...props.config?.runtime,
            maxStepsPerTurn: raw.trim() ? Number(raw) : undefined,
          },
        });
      });
    },
    "Max Retry": () => {
      const current = String(props.config?.runtime?.maxAttemptsPerStep ?? 3);
      openEdit("单步最大重试次数", current, (raw) => {
        const value = Number(raw);
        if (Number.isInteger(value) && value > 0)
          props.onUpdateConfig?.({ runtime: { ...props.config?.runtime, maxAttemptsPerStep: value } });
      });
    },
    "Request Timeout": () => {
      const current = String(props.config?.runtime?.timeouts?.requestSec ?? 120);
      openEdit("请求超时（秒）", current, (raw) => {
        const value = Number(raw);
        if (Number.isInteger(value) && value > 0)
          props.onUpdateConfig?.({
            runtime: {
              ...props.config?.runtime,
              timeouts: { ...props.config?.runtime?.timeouts, requestSec: value },
            },
          });
      });
    },
    "Compaction Threshold": () => {
      const current = String(props.config?.context?.compactionThresholdPercent ?? 85);
      openEdit("Compaction 阈值（%）", current, (raw) => {
        const value = Number(raw);
        if (Number.isInteger(value) && value > 0 && value <= 100)
          props.onUpdateConfig?.({ context: { ...props.config?.context, compactionThresholdPercent: value } });
      });
    },
    "Checkpoint 目录": () => {
      const current = (props.config?.checkpoint?.additionalDirs ?? []).join(",");
      openEdit("额外 checkpoint 目录（逗号分隔）", current, (raw) => {
        props.onUpdateConfig?.({
          checkpoint: {
            ...props.config?.checkpoint,
            additionalDirs: raw.split(",").map((entry) => entry.trim()).filter(Boolean),
          },
        });
      });
    },
    "Density": () => {
      cyclePreference("density", density(), ["comfortable", "compact"], setDensity);
    },
    "Diff Style": () => {
      cyclePreference("diffStyle", diffStyle(), ["auto", "unified", "split"], setDiffStyle);
    },
    "Tool Details": () => {
      cyclePreference("toolDetails", toolDetails(), ["expanded", "collapsed"], setToolDetails);
    },
    "GPU 加速": () => {
      const next = !gpuAcceleration();
      setGpuAcceleration(next);
      props.preferences?.set("gpuAcceleration", next);
      const electron = (globalThis as { electron?: { invoke<T>(channel: string, args?: unknown): Promise<T> } }).electron;
      void electron?.invoke("desktop_set_setting", { key: "gpuEnabled", value: next });
    },
    "Keybinds": () => {
      window.alert("当前版本快捷键覆盖请通过 TUI 快捷键配置。");
    },
    "界面偏好保存范围": () => {
      cyclePreference("uiWriteScope", uiWriteScope(), ["project", "global"], setUiWriteScope);
    },
    "运行时配置保存范围": () => {
      cyclePreference("runtimeWriteScope", runtimeWriteScope(), ["project", "global"], setRuntimeWriteScope);
    },
  };


  const modeModelOptions = () => {
    const config = props.config;
    if (!config) return [];
    const options: Array<{ value: string; label: string }> = [];
    for (const [providerID, provider] of Object.entries(config.catalog?.providers ?? {})) {
      for (const modelID of Object.keys(provider?.models ?? {})) {
        options.push({ value: `${providerID}/${modelID}`, label: `${providerID}/${modelID}` });
      }
    }
    return options;
  };

  const modePermissionOptions = () => [
    { value: "", label: "默认" },
    ...Object.keys(props.config?.agentModes ?? {}).map((name) => ({ value: name, label: name })),
  ];

  const modeToolOptions = () => {
    const current = new Set([
      ...modeAllowedTools().split(",").map((item) => item.trim()).filter(Boolean),
      ...modeExcludedTools().split(",").map((item) => item.trim()).filter(Boolean),
    ]);
    return [...new Set([...TOOL_FAMILIES, ...current])].sort();
  };

  const modeMcpOptions = () => Object.keys(props.config?.mcpServers ?? {});

  function toggleCsv(
    current: string,
    value: string,
    setter: (next: string) => void,
  ) {
    const items = current.split(",").map((item) => item.trim()).filter(Boolean);
    const next = items.includes(value)
      ? items.filter((item) => item !== value)
      : [...items, value];
    setter(next.join(", "));
  }

  function runtimeValue(label: string): string | undefined {
    const config = props.config;
    if (!config) return undefined;
    switch (label) {
      case "Providers & Models": return `${Object.keys(config.providers ?? {}).length} 个 provider`;
      case "Default Model": return modelLabel(config);
      case "默认 Agent": return (props.state?.agentSelection?.name ?? config.defaultAgent) || "默认";
      case "自定义 Agent Mode": return config.defaultAgentMode || "code";
      case "子 Agent 并发数": return String(config.team?.maxConcurrent ?? 4);
      case "Permission Profile": return config.defaultAgentMode ?? "ask";
      case "Web & Network": return config.webSearch?.endpoint ? "已配置" : "默认";
      case "Max Steps": return String(config.runtime?.maxStepsPerTurn ?? "unlimited");
      case "Max Retry": return String(config.runtime?.maxAttemptsPerStep ?? 3);
      case "Request Timeout": return `${config.runtime?.timeouts?.requestSec ?? 120}s`;
      case "Compaction": return config.context?.compactionEnabled ? "开启" : "关闭";
      case "Compaction Threshold": return `${config.context?.compactionThresholdPercent ?? 85}%`;
      case "Checkpoint 目录": return `${(config.checkpoint?.additionalDirs ?? []).length} 个`;
      case "Terminal Window Mode": return String(config.runtime?.terminal?.windowMode ?? "auto");
      case "Density": return density();
      case "Diff Style": return diffStyle();
      case "Tool Details": return toolDetails();
      case "GPU 加速": return gpuAcceleration() ? "开启" : "关闭";
      case "界面偏好保存范围": return uiWriteScope();
      case "运行时配置保存范围": return runtimeWriteScope();
      case "Keybinds": return "默认";
    }
    return undefined;
  }

  return (
    <Show when={props.open}>
      <div class="neu-settings-backdrop" onClick={props.onClose}>
        <div class="neu-settings-window" onClick={(event) => event.stopPropagation()}>
          <div class="neu-settings-header">
            <span class="neu-settings-title">设置</span>
            <button type="button" class="neu-settings-close" onClick={props.onClose} aria-label="关闭设置">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
          <div class="neu-settings-body">
            <nav class="neu-settings-categories">
              <For each={categoriesWithPlugins()}>
                {(category) => (
                  <button
                    type="button"
                    class="neu-settings-category"
                    data-active={activeCategory() === category.id}
                    onClick={() => {
                      setActiveCategory(category.id);
                      if (category.id === "plugin" && settingsPanel() && props.host) {
                        const selected = settingsPanel()!;
                        requestAnimationFrame(() => {
                          if (settingsPanelRef && props.host) {
                            void props.host.mountPanel(
                              selected.pluginId,
                              selected.panelId,
                              settingsPanelRef,
                            );
                          }
                        });
                      }
                    }}
                  >
                    {category.label}
                  </button>
                )}
              </For>
            </nav>
            <section class="neu-settings-content">
              <Show when={current().id === "plugin"}>
                <div class="neu-settings-content-title">插件配置</div>
                <For each={groupedSettingsPanels()}>
                  {([group, panels]) => (
                    <>
                      <Show when={group}>
                        <div class="neu-settings-content-title">{group}</div>
                      </Show>
                      <For each={panels}>
                        {(panel) => (
                          <div class="neu-settings-plugin-panel">
                            <button
                              type="button"
                              class="neu-settings-item neu-settings-item-button"
                              data-active={
                                settingsPanel()?.pluginId === panel.pluginId &&
                                settingsPanel()?.panelId === panel.panel.id
                              }
                              onClick={() => {
                                setSettingsPanel({
                                  pluginId: panel.pluginId,
                                  panelId: panel.panel.id,
                                });
                                requestAnimationFrame(() => {
                                  if (settingsPanelRef && props.host) {
                                    void props.host.mountPanel(
                                      panel.pluginId,
                                      panel.panel.id,
                                      settingsPanelRef,
                                    );
                                  }
                                });
                              }}
                            >
                              <div class="neu-settings-item-main">
                                <span class="neu-settings-item-label">{panel.panel.title}</span>
                                <span class="neu-settings-item-description">{panel.panel.group ?? "插件设置"}</span>
                              </div>
                            </button>
                            <Show
                              when={
                                settingsPanel()?.pluginId === panel.pluginId &&
                                settingsPanel()?.panelId === panel.panel.id
                              }
                            >
                              <div ref={settingsPanelRef} class="neu-settings-item neu-plugin-panel-body" />
                            </Show>
                          </div>
                        )}
                      </For>
                    </>
                  )}
                </For>
              </Show>
              <Show when={current().id !== "plugin"}>
                  <>
                    <div class="neu-settings-content-title">{current().label}</div>
                    <For each={current().items}>
                      {(item) => {
                        const value = runtimeValue(item.label) ?? item.value;
                        if (item.label === "Providers & Models" && props.onOpenModels) {
                          return (
                            <button
                              type="button"
                              class="neu-settings-item neu-settings-item-button"
                              onClick={() => props.onOpenModels?.()}
                            >
                              <div class="neu-settings-item-main">
                                <span class="neu-settings-item-label">{item.label}</span>
                                <span class="neu-settings-item-description">{item.description}</span>
                              </div>
                              <span class="neu-settings-item-value">{item.value}</span>
                            </button>
                          );
                        }
                        if (item.label === "Theme Mode" && props.onCycleThemeMode) {
                          return (
                            <button
                              type="button"
                              class="neu-settings-item neu-settings-item-button"
                              onClick={() => props.onCycleThemeMode?.()}
                            >
                              <div class="neu-settings-item-main">
                                <span class="neu-settings-item-label">{item.label}</span>
                                <span class="neu-settings-item-description">{item.description}</span>
                              </div>
                              <span class="neu-settings-item-value">
                                {props.themeMode === "dark" ? "深色" : props.themeMode === "lime" ? "青柠黑" : "浅色"}
                              </span>
                            </button>
                          );
                        }
                        if (item.label === "Compaction" && props.onUpdateConfig && props.config) {
                          return (
                            <button
                              type="button"
                              class="neu-settings-item neu-settings-item-button"
                              onClick={() => {
                                const next = !props.config?.context?.compactionEnabled;
                                props.onUpdateConfig?.({
                                  context: { ...props.config?.context, compactionEnabled: next },
                                });
                              }}
                            >
                              <div class="neu-settings-item-main">
                                <span class="neu-settings-item-label">{item.label}</span>
                                <span class="neu-settings-item-description">{item.description}</span>
                              </div>
                              <span class="neu-settings-item-value">{value}</span>
                            </button>
                          );
                        }
                        if (item.label === "Terminal Window Mode" && props.onUpdateConfig && props.config) {
                          return (
                            <button
                              type="button"
                              class="neu-settings-item neu-settings-item-button"
                              onClick={() => {
                                const modes = ["auto", "windowless", "window"] as const;
                                const current = props.config?.runtime?.terminal?.windowMode ?? "auto";
                                const index = modes.indexOf(current as (typeof modes)[number]);
                                const next = modes[(index + 1) % modes.length];
                                props.onUpdateConfig?.({
                                  runtime: {
                                    ...props.config?.runtime,
                                    terminal: { windowMode: next },
                                  },
                                });
                              }}
                            >
                              <div class="neu-settings-item-main">
                                <span class="neu-settings-item-label">{item.label}</span>
                                <span class="neu-settings-item-description">{item.description}</span>
                              </div>
                              <span class="neu-settings-item-value">{value}</span>
                            </button>
                          );
                        }
                        if (item.label === "GPU 加速") {
                          return (
                            <button
                              type="button"
                              class="neu-settings-item neu-settings-item-button"
                              onClick={() => {
                                const next = !gpuAcceleration();
                                console.log("[settings] GPU 加速 toggle", next);
                                setGpuAcceleration(next);
                                props.preferences?.set("gpuAcceleration", next);
                                const electron = (globalThis as { electron?: { invoke<T>(channel: string, args?: unknown): Promise<T> } }).electron;
                                void electron?.invoke("desktop_set_setting", { key: "gpuEnabled", value: next });
                              }}
                            >
                              <div class="neu-settings-item-main">
                                <span class="neu-settings-item-label">{item.label}</span>
                                <span class="neu-settings-item-description">{item.description}</span>
                              </div>
                              <span class="neu-settings-item-value">
                                {gpuAcceleration() ? "开启" : "关闭"}
                              </span>
                            </button>
                          );
                        }
                        if (editableActions[item.label] && props.onUpdateConfig) {
                          return (
                            <button
                              type="button"
                              class="neu-settings-item neu-settings-item-button"
                              onClick={editableActions[item.label]}
                            >
                              <div class="neu-settings-item-main">
                                <span class="neu-settings-item-label">{item.label}</span>
                                <span class="neu-settings-item-description">{item.description}</span>
                              </div>
                              <span class="neu-settings-item-value">{value}</span>
                            </button>
                          );
                        }
                        return (
                          <div class="neu-settings-item">
                            <div class="neu-settings-item-main">
                              <span class="neu-settings-item-label">{item.label}</span>
                              <span class="neu-settings-item-description">{item.description}</span>
                            </div>
                            <span class="neu-settings-item-value">{value}</span>
                          </div>
                        );
                      }}
                    </For>
                  </>
              </Show>
            </section>
          </div>
        </div>
      </div>
      <Show when={permissionListOpen()}>
        <div class="neu-settings-backdrop" onClick={() => setPermissionListOpen(false)}>
          <div class="neu-settings-window neu-edit-window" onClick={(event) => event.stopPropagation()}>
            <div class="neu-settings-header">
              <span class="neu-settings-title">权限配置</span>
              <button type="button" class="neu-settings-close" onClick={() => setPermissionListOpen(false)} aria-label="关闭">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="neu-settings-body neu-edit-body">
              <Show
                when={Object.entries(props.config?.agentModes ?? {})
                  .filter(([name]) => !BUILTIN_PERMISSION_PROFILES.includes(name))
                  .length}
                fallback={<div class="neu-settings-item"><div class="neu-settings-item-main"><span class="neu-settings-item-label">暂无自定义权限配置</span><span class="neu-settings-item-description">点击下方“新增权限配置”创建</span></div></div>}
              >
              <For each={Object.entries(props.config?.agentModes ?? {})
                .filter(([name]) => !BUILTIN_PERMISSION_PROFILES.includes(name))}>
                {([name, profile]) => (
                  <div class="neu-permission-row">
                    <button
                      type="button"
                      class="neu-settings-item neu-settings-item-button"
                      onClick={() => {
                        props.onUpdateConfig?.({ defaultAgentMode: name, defaultPermission: name });
                      }}
                    >
                      <div class="neu-settings-item-main">
                        <span class="neu-settings-item-label">
                          {name}{props.config?.defaultAgentMode === name ? "（默认）" : ""}
                        </span>
                        <span class="neu-settings-item-description">{profile.description || profile.approval}</span>
                      </div>
                      <span class="neu-settings-item-value">{profile.approval}</span>
                    </button>
                    <button
                      type="button"
                      class="neu-permission-edit"
                      onClick={() => { setPermissionListOpen(false); openPermissionEditorFor(name); }}
                    >
                      编辑
                    </button>
                  </div>
                )}
              </For>
              </Show>
              <div class="neu-extension-actions">
                <button type="button" class="neu-extension-add" onClick={() => { setPermissionListOpen(false); openNewPermissionEditor(); }}>
                  新增权限配置
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
      <Show when={permissionEditorOpen()}>
        <div class="neu-settings-backdrop" onClick={() => setPermissionEditorOpen(false)}>
          <div class="neu-settings-window neu-edit-window" onClick={(event) => event.stopPropagation()}>
            <div class="neu-settings-header">
              <span class="neu-settings-title">权限配置（Permission Profile）</span>
              <button type="button" class="neu-settings-close" onClick={() => setPermissionEditorOpen(false)} aria-label="关闭">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="neu-settings-body neu-edit-body">
              <div class="neu-form-field">
                <label class="neu-form-label">Profile 名称</label>
                <input class="neu-form-input" value={permissionName()} onInput={(e) => setPermissionName(e.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">描述</label>
                <input class="neu-form-input" value={permissionDescription()} onInput={(e) => setPermissionDescription(e.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Approval Mode</label>
                <NeuSelect
                  value={permissionApproval()}
                  options={[
                    { value: "ask", label: "ask" },
                    { value: "auto", label: "auto" },
                    { value: "read_only", label: "read_only" },
                  ]}
                  onChange={(value) => setPermissionApproval(value)}
                />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Allowed Tools（允许列表，留空不限制）</label>
                <div class="neu-tool-select-grid">
                  <For each={modeToolOptions()}>
                    {(tool) => (
                      <label class="neu-form-checkbox neu-tool-check">
                        <input
                          type="checkbox"
                          checked={permissionAllowedTools().split(",").map((item) => item.trim()).includes(tool)}
                          onChange={() => toggleCsv(permissionAllowedTools(), tool, setPermissionAllowedTools)}
                        />
                        <span>{tool}</span>
                      </label>
                    )}
                  </For>
                </div>
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Excluded Tools（黑名单）</label>
                <div class="neu-tool-select-grid">
                  <For each={modeToolOptions()}>
                    {(tool) => (
                      <label class="neu-form-checkbox neu-tool-check">
                        <input
                          type="checkbox"
                          checked={permissionExcludedTools().split(",").map((item) => item.trim()).includes(tool)}
                          onChange={() => toggleCsv(permissionExcludedTools(), tool, setPermissionExcludedTools)}
                        />
                        <span>{tool}</span>
                      </label>
                    )}
                  </For>
                </div>
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Command Rules Mode</label>
                <NeuSelect
                  value={permissionCommandMode()}
                  options={[
                    { value: "none", label: "none" },
                    { value: "blacklist", label: "blacklist" },
                    { value: "whitelist", label: "whitelist" },
                  ]}
                  onChange={(value) => setPermissionCommandMode(value)}
                />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Command Rules（逗号分隔）</label>
                <input class="neu-form-input" value={permissionCommandRules()} onInput={(e) => setPermissionCommandRules(e.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Interactive Programs（高风险启动命令）</label>
                <div class="neu-checkbox-list">
                  <label class="neu-form-checkbox">
                    <input type="checkbox" checked={permissionInteractiveAny()} onChange={() => setPermissionInteractiveAny((v) => !v)} />
                    <span>allowAny（任意启动命令）</span>
                  </label>
                </div>
                <input class="neu-form-input" value={permissionInteractiveAllow()} placeholder="允许的交互程序，逗号分隔" onInput={(e) => setPermissionInteractiveAllow(e.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Extensions</label>
                <div class="neu-checkbox-list">
                  <label class="neu-form-checkbox">
                    <input type="checkbox" checked={permissionSkills()} onChange={() => setPermissionSkills((v) => !v)} />
                    <span>skills</span>
                  </label>
                  <label class="neu-form-checkbox">
                    <input type="checkbox" checked={permissionMcp()} onChange={() => setPermissionMcp((v) => !v)} />
                    <span>mcp</span>
                  </label>
                </div>
              </div>
              <div class="neu-form-actions">
                <button type="button" class="neu-form-btn neu-form-cancel" onClick={() => setPermissionEditorOpen(false)}>取消</button>
                <button
                  type="button"
                  class="neu-form-btn neu-form-primary"
                  onClick={() => {
                    const name = permissionName().trim();
                    if (!name) return;
                    const split = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
                    props.onUpdateConfig?.({
                      permissionProfiles: {
                        ...props.config?.agentModes,
                        [name]: {
                          description: permissionDescription(),
                          approval: permissionApproval(),
                          permissions: {
                            tools: {
                              allow: split(permissionAllowedTools()),
                              exclude: split(permissionExcludedTools()),
                            },
                          },
                          commandRules: {
                            mode: permissionCommandMode() as "none" | "blacklist" | "whitelist",
                            rules: split(permissionCommandRules()),
                          },
                          interactivePrograms: {
                            allowAny: permissionInteractiveAny(),
                            allow: split(permissionInteractiveAllow()).map((command) => ({ command })),
                          },
                          extensions: {
                            skills: permissionSkills(),
                            mcp: permissionMcp(),
                          },
                        },
                      },
                      agentModes: {
                        ...props.config?.agentModes,
                        [name]: {
                          description: permissionDescription(),
                          approval: permissionApproval(),
                          systemPrompt: "",
                          model: undefined,
                          allowedTools: split(permissionAllowedTools()),
                          excludedTools: split(permissionExcludedTools()),
                          commandRules: {
                            mode: permissionCommandMode() as "none" | "blacklist" | "whitelist",
                            rules: split(permissionCommandRules()),
                          },
                          interactivePrograms: {
                            allowAny: permissionInteractiveAny(),
                            allow: split(permissionInteractiveAllow()).map((command) => ({ command })),
                          },
                          skills: permissionSkills(),
                          mcpServers: [],
                        },
                      },
                      defaultAgentMode: name,
                      defaultPermission: name,
                    });
                    setPermissionEditorOpen(false);
                  }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
      <Show when={modeEditorOpen()}>
        <div class="neu-settings-backdrop" onClick={() => setModeEditorOpen(false)}>
          <div class="neu-settings-window neu-edit-window" onClick={(event) => event.stopPropagation()}>
            <div class="neu-settings-header">
              <span class="neu-settings-title">自定义 Agent Mode</span>
              <button
                type="button"
                class="neu-settings-close"
                onClick={() => setModeEditorOpen(false)}
                aria-label="关闭"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="neu-settings-body neu-edit-body">
              <div class="neu-form-field">
                <label class="neu-form-label">Mode 名称</label>
                <input class="neu-form-input" value={modeName()} onInput={(e) => setModeName(e.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">描述</label>
                <input class="neu-form-input" value={modeDescription()} onInput={(e) => setModeDescription(e.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">System Prompt</label>
                <textarea class="neu-form-input neu-stash-textarea" value={modeSystemPrompt()} onInput={(e) => setModeSystemPrompt(e.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Model（可选）</label>
                <NeuSelect
                  value={modeModel()}
                  options={modeModelOptions()}
                  onChange={setModeModel}
                />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Approval Mode</label>
                <NeuSelect
                  value={modePermission()}
                  options={modePermissionOptions()}
                  onChange={setModePermission}
                />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Allowed Tools（允许列表，留空表示不限制）</label>
                <div class="neu-tool-select-grid">
                  <For each={modeToolOptions()}>
                    {(tool) => (
                      <label class="neu-form-checkbox neu-tool-check">
                        <input
                          type="checkbox"
                          checked={modeAllowedTools().split(",").map((item) => item.trim()).includes(tool)}
                          onChange={() => toggleCsv(modeAllowedTools(), tool, setModeAllowedTools)}
                        />
                        <span>{tool}</span>
                      </label>
                    )}
                  </For>
                </div>
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Excluded Tools（黑名单，选中即禁止使用）</label>
                <div class="neu-tool-select-grid">
                  <For each={modeToolOptions()}>
                    {(tool) => (
                      <label class="neu-form-checkbox neu-tool-check">
                        <input
                          type="checkbox"
                          checked={modeExcludedTools().split(",").map((item) => item.trim()).includes(tool)}
                          onChange={() => toggleCsv(modeExcludedTools(), tool, setModeExcludedTools)}
                        />
                        <span>{tool}</span>
                      </label>
                    )}
                  </For>
                </div>
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">MCP Servers（从已配置的 MCP 中选择此模式启用的服务，不影响全局配置）</label>
                <Show when={modeMcpOptions().length} fallback={<div class="neu-settings-item"><div class="neu-settings-item-main"><span class="neu-settings-item-label">暂无已配置的 MCP Server</span><span class="neu-settings-item-description">请先在“MCP”里添加</span></div></div>}>
                  <div class="neu-checkbox-list">
                    <For each={modeMcpOptions()}>
                      {(server) => (
                        <label class="neu-form-checkbox">
                          <input
                            type="checkbox"
                            checked={modeMcpServers().split(",").map((item) => item.trim()).includes(server)}
                            onChange={() => toggleCsv(modeMcpServers(), server, setModeMcpServers)}
                          />
                          <span>{server}</span>
                        </label>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              <div class="neu-form-actions">
                <button type="button" class="neu-form-btn neu-form-cancel" onClick={() => setModeEditorOpen(false)}>取消</button>
                <button
                  type="button"
                  class="neu-form-btn neu-form-primary"
                  onClick={() => {
                    const name = modeName().trim();
                    if (!name) return;
                    const split = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
                    props.onUpdateConfig?.({
                      agentModes: {
                        ...props.config?.agentModes,
                        [name]: {
                          description: modeDescription(),
                          systemPrompt: modeSystemPrompt(),
                          model: modeModel().trim() || undefined,
                          approval: modePermission().trim() || "ask",
                          allowedTools: split(modeAllowedTools()),
                          excludedTools: split(modeExcludedTools()),
                          mcpServers: split(modeMcpServers()),
                          skills: true,
                        },
                      },
                      defaultAgentMode: name,
                    });
                    setModeEditorOpen(false);
                  }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
      <Show when={editFieldLabel()}>
        <div class="neu-settings-backdrop" onClick={() => setEditFieldLabel(undefined)}>
          <div class="neu-settings-window neu-edit-window" onClick={(event) => event.stopPropagation()}>
            <div class="neu-settings-header">
              <span class="neu-settings-title">{editFieldLabel()}</span>
              <button
                type="button"
                class="neu-settings-close"
                onClick={() => setEditFieldLabel(undefined)}
                aria-label="关闭"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="neu-settings-body neu-edit-body">
              <input
                class="neu-form-input"
                value={editFieldValue()}
                onInput={(event) => setEditFieldValue(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    editFieldAction?.(editFieldValue());
                    setEditFieldLabel(undefined);
                  }
                }}
              />
              <div class="neu-form-actions">
                <button type="button" class="neu-form-btn neu-form-cancel" onClick={() => setEditFieldLabel(undefined)}>
                  取消
                </button>
                <button
                  type="button"
                  class="neu-form-btn neu-form-primary"
                  onClick={() => {
                    editFieldAction?.(editFieldValue());
                    setEditFieldLabel(undefined);
                  }}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
}
