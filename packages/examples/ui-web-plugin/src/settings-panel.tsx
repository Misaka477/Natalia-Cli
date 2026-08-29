import { createSignal, For, Show } from "solid-js";
import type { AppState } from "@natalia/view-store";
import type { ConfigV3, MCPServerConfig } from "@natalia/contracts";
import { ExtensionSettingsContent } from "./extension-settings";
import { NeuSelect } from "./components/NeuSelect";

const TOOL_FAMILIES = [
  "flow_module_complete",
  "read_file",
  "glob",
  "grep",
  "read_media_file",
  "read_data_source",
  "interactive_terminal_*",
  "terminal_observe",
  "run_shell",
  "write_file",
  "edit_file",
  "web_fetch",
  "web_search",
  "browser_visit",
  "browser_screenshot",
  "skill_load",
  "agent_*",
  "report_issue",
];

type CategoryId = "model" | "security" | "runtime" | "extensions" | "interface" | "storage";

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

type ExtensionRow = {
  name: string;
  description: string;
  enabled: boolean;
};

type ExtensionSection = {
  id: "mcp" | "plugins" | "skills";
  title: string;
  addLabel: string;
  rows: ExtensionRow[];
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
      { label: "Permission Profile", description: "选择权限 profile", value: "default" },
      { label: "Approval Mode", description: "工具执行的审批策略", value: "自动审批" },
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
    id: "extensions",
    label: "扩展",
    items: [],
  },
  {
    id: "interface",
    label: "界面与服务",
    items: [
      { label: "Theme Mode", description: "切换浅色 / 深色 / 跟随系统", value: "浅色" },
      { label: "Density", description: "界面信息密度", value: "comfortable" },
      { label: "Diff Style", description: "diff 展示风格", value: "auto" },
      { label: "Tool Details", description: "工具卡默认展开状态", value: "expanded" },
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

const initialExtensionSections: ExtensionSection[] = [
  {
    id: "mcp",
    title: "MCP",
    addLabel: "添加 MCP",
    rows: [
      { name: "filesystem", description: "本地文件系统 MCP", enabled: true },
      { name: "context7", description: "文档检索 MCP", enabled: true },
      { name: "github", description: "GitHub MCP", enabled: false },
    ],
  },
  {
    id: "plugins",
    title: "Plugins",
    addLabel: "安装插件",
    rows: [
      { name: "team", description: "团队协作插件", enabled: true },
      { name: "task-workflow", description: "任务工作流插件", enabled: true },
      { name: "local-tools", description: "本地工具集合", enabled: true },
      { name: "skills", description: "技能扩展包", enabled: false },
    ],
  },
  {
    id: "skills",
    title: "Skills",
    addLabel: "添加技能",
    rows: [
      { name: "code-review", description: "代码审查技能", enabled: true },
      { name: "plan-writer", description: "计划撰写技能", enabled: true },
      { name: "debugger", description: "调试技能", enabled: false },
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
  onAddMcp?: (input: { name: string; config: MCPServerConfig }) => unknown;
  onRemoveMcp?: (name: string) => unknown;
  onAddPlugin?: (spec: string) => unknown;
  onRemovePlugin?: (name: string) => unknown;
}) {
  const [activeCategory, setActiveCategory] = createSignal<CategoryId>("model");
  const [sections, setSections] = createSignal<ExtensionSection[]>(
    initialExtensionSections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => ({ ...row })),
    })),
  );
  const [addingTo, setAddingTo] = createSignal<string | null>(null);
  const [newName, setNewName] = createSignal("");
  const [newDesc, setNewDesc] = createSignal("");
  const [density, setDensity] = createSignal(props.preferences?.get<string>("density") ?? "comfortable");
  const [diffStyle, setDiffStyle] = createSignal(props.preferences?.get<string>("diffStyle") ?? "auto");
  const [toolDetails, setToolDetails] = createSignal(props.preferences?.get<string>("toolDetails") ?? "expanded");
  const [uiWriteScope, setUiWriteScope] = createSignal(props.preferences?.get<string>("uiWriteScope") ?? "project");
  const [runtimeWriteScope, setRuntimeWriteScope] = createSignal(props.preferences?.get<string>("runtimeWriteScope") ?? "global");
  const current = () => categories.find((category) => category.id === activeCategory())!;

  function toggleRow(sectionId: string, index: number) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              rows: section.rows.map((row, i) =>
                i === index ? { ...row, enabled: !row.enabled } : row,
              ),
            }
          : section,
      ),
    );
  }

  function removeRow(sectionId: string, index: number) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              rows: section.rows.filter((_, i) => i !== index),
            }
          : section,
      ),
    );
  }

  function addRow(sectionId: string) {
    const name = newName().trim();
    const description = newDesc().trim();
    if (!name) return;
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              rows: [...section.rows, { name, description, enabled: false }],
            }
          : section,
      ),
    );
    setAddingTo(null);
    setNewName("");
    setNewDesc("");
  }

  function startAdd(sectionId: string) {
    setAddingTo(sectionId);
    setNewName("");
    setNewDesc("");
  }

  const extensionRows = (sectionId: string) =>
    sections().find((section) => section.id === sectionId)?.rows ?? [];
  const extensionAddLabel = (sectionId: string) =>
    sections().find((section) => section.id === sectionId)?.addLabel ?? "添加";

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

  function openEdit(
    label: string,
    current: string,
    apply: (value: string) => void,
  ) {
    setEditFieldLabel(label);
    setEditFieldValue(current);
    editFieldAction = apply;
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
      const name = config?.defaultMode ?? "code";
      const mode = config?.modes?.[name];
      setModeName(name);
      setModeDescription(mode?.description ?? "");
      setModeSystemPrompt(mode?.systemPrompt ?? "");
      setModeModel(mode?.model ?? "");
      setModePermission(mode?.permission ?? "");
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
      const current = props.config?.defaultPermission ?? "ask";
      openEdit("Permission Profile（defaultPermission）", current, (next) => {
        if (next) props.onUpdateConfig?.({ defaultPermission: next });
      });
    },
    "Approval Mode": () => {
      const config = props.config;
      if (!config) return;
      const profile = config.defaultPermission ?? "ask";
      const current = config.permissionProfiles?.[profile]?.approval ?? "ask";
      const next = current === "ask" ? "auto" : current === "auto" ? "read_only" : "ask";
      props.onUpdateConfig?.({
        permissionProfiles: {
          ...config.permissionProfiles,
          [profile]: { approval: next },
        },
      });
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
    ...Object.keys(props.config?.permissionProfiles ?? {}).map((name) => ({ value: name, label: name })),
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
      case "自定义 Agent Mode": return config.defaultMode || "code";
      case "子 Agent 并发数": return String(config.team?.maxConcurrent ?? 4);
      case "Permission Profile": return config.defaultPermission ?? "ask";
      case "Approval Mode": return config.permissionProfiles?.[config.defaultPermission ?? "ask"]?.approval ?? "ask";
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
              <For each={categories}>
                {(category) => (
                  <button
                    type="button"
                    class="neu-settings-category"
                    data-active={activeCategory() === category.id}
                    onClick={() => setActiveCategory(category.id)}
                  >
                    {category.label}
                  </button>
                )}
              </For>
            </nav>
            <section class="neu-settings-content">
              <Show
                when={current().id === "extensions"}
                fallback={
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
                                {props.themeMode === "dark" ? "深色" : props.themeMode === "system" ? "系统" : "浅色"}
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
                }
              >
                <ExtensionSettingsContent plugins={props.state?.plugins} mcp={props.state?.mcp} onAddMcp={props.onAddMcp} onRemoveMcp={props.onRemoveMcp} onAddPlugin={props.onAddPlugin} onRemovePlugin={props.onRemovePlugin} />
              </Show>
            </section>
          </div>
        </div>
      </div>
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
                <label class="neu-form-label">Permission Profile（可选）</label>
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
                      modes: {
                        ...props.config?.modes,
                        [name]: {
                          description: modeDescription(),
                          systemPrompt: modeSystemPrompt(),
                          model: modeModel().trim() || undefined,
                          permission: modePermission().trim() || undefined,
                          allowedTools: split(modeAllowedTools()),
                          excludedTools: split(modeExcludedTools()),
                          mcpServers: split(modeMcpServers()),
                        },
                      },
                      defaultMode: name,
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
