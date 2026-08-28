import { createSignal, For, Show } from "solid-js";
import type { AppState } from "@natalia/view-store";
import { ExtensionSettingsContent } from "./extension-settings";

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
      { label: "Agent Mode", description: "当前 agent 运行模式", value: "默认" },
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
                      {(item) => (
                        <Show
                          when={item.label === "Providers & Models" && props.onOpenModels}
                          fallback={
                            <Show
                              when={item.label === "Theme Mode" && props.onCycleThemeMode}
                              fallback={
                                <div class="neu-settings-item">
                                  <div class="neu-settings-item-main">
                                    <span class="neu-settings-item-label">{item.label}</span>
                                    <span class="neu-settings-item-description">{item.description}</span>
                                  </div>
                                  <span class="neu-settings-item-value">{item.value}</span>
                                </div>
                              }
                            >
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
                            </Show>
                          }
                        >
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
                        </Show>
                      )}
                    </For>
                  </>
                }
              >
                <ExtensionSettingsContent plugins={props.state?.plugins} mcp={props.state?.mcp} />
              </Show>
            </section>
          </div>
        </div>
      </div>
    </Show>
  );
}
