import { createSignal, For, Show } from "solid-js";
import type { PluginView, McpView } from "@natalia/view-store";
import type { MCPServerConfig } from "@natalia/contracts";

type ExtensionKind = "mcp" | "plugins" | "skills";

type ExtensionRow = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

type ExtensionSection = {
  id: ExtensionKind;
  title: string;
  addLabel: string;
  rows: ExtensionRow[];
};

function buildInitialSections(props: {
  plugins?: Record<string, PluginView>;
  mcp?: Record<string, McpView>;
}): ExtensionSection[] {
  const mcpRows = Object.entries(props.mcp ?? {}).map(([id, server]) => ({
    id,
    name: id,
    description: server.message ?? `${server.tools} tools`,
    enabled: server.status === "connected",
  }));
  const pluginRows = Object.entries(props.plugins ?? {}).map(([id, plugin]) => ({
    id,
    name: id,
    description: plugin.detail ?? plugin.status,
    enabled: plugin.status === "loaded",
  }));
  return [
    {
      id: "mcp",
      title: "MCP",
      addLabel: "添加 MCP",
      rows: mcpRows.length
        ? mcpRows
        : [
            { id: "filesystem", name: "filesystem", description: "本地文件系统 MCP", enabled: true },
            { id: "context7", name: "context7", description: "文档检索 MCP", enabled: true },
            { id: "github", name: "github", description: "GitHub MCP", enabled: false },
          ],
    },
    {
      id: "plugins",
      title: "Plugins",
      addLabel: "安装插件",
      rows: pluginRows.length
        ? pluginRows
        : [
            { id: "team", name: "team", description: "团队协作插件", enabled: true },
            { id: "task-workflow", name: "task-workflow", description: "任务工作流插件", enabled: true },
          ],
    },
    {
      id: "skills",
      title: "Skills",
      addLabel: "添加技能",
      rows: [
        { id: "code-review", name: "code-review", description: "代码审查技能", enabled: true },
        { id: "plan-writer", name: "plan-writer", description: "计划撰写技能", enabled: true },
        { id: "debugger", name: "debugger", description: "调试技能", enabled: false },
      ],
    },
  ];
}

export function ExtensionSettingsContent(props: {
  plugins?: Record<string, PluginView>;
  mcp?: Record<string, McpView>;
  onAddMcp?: (input: { name: string; config: MCPServerConfig }) => unknown;
  onRemoveMcp?: (name: string) => unknown;
  onAddPlugin?: (spec: string) => unknown;
  onRemovePlugin?: (name: string) => unknown;
}) {
  const [sections, setSections] = createSignal<ExtensionSection[]>(
    buildInitialSections(props).map((section) => ({
      ...section,
      rows: section.rows.map((row) => ({ ...row })),
    })),
  );
  const [addingTo, setAddingTo] = createSignal<ExtensionKind | null>(null);
  const [mcpType, setMcpType] = createSignal<"stdio" | "http">("stdio");
  const [mcpCommand, setMcpCommand] = createSignal("");
  const [mcpArgs, setMcpArgs] = createSignal("");
  const [mcpUrl, setMcpUrl] = createSignal("");
  const [packageSpec, setPackageSpec] = createSignal("");
  const [skillSource, setSkillSource] = createSignal("");

  const rows = (kind: ExtensionKind) =>
    sections().find((section) => section.id === kind)?.rows ?? [];

  function toggleRow(kind: ExtensionKind, index: number) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === kind
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

  function removeRow(kind: ExtensionKind, index: number) {
    const row = rows(kind)[index];
    if (kind === "mcp" && row) props.onRemoveMcp?.(row.name);
    if (kind === "plugins" && row) props.onRemovePlugin?.(row.name);
    setSections((prev) =>
      prev.map((section) =>
        section.id === kind
          ? { ...section, rows: section.rows.filter((_, i) => i !== index) }
          : section,
      ),
    );
  }

  function closeAdd() {
    setAddingTo(null);
    setMcpCommand("");
    setMcpArgs("");
    setMcpUrl("");
    setPackageSpec("");
    setSkillSource("");
  }

  function addMcp() {
    if (mcpType() === "stdio" && !mcpCommand().trim()) return;
    if (mcpType() === "http" && !mcpUrl().trim()) return;
    const name =
      mcpType() === "stdio"
        ? mcpCommand().trim().split(/\s+/)[0] ?? "mcp-server"
        : new URL(mcpUrl()).hostname || "mcp-server";
    const description =
      mcpType() === "stdio"
        ? `stdio · ${mcpCommand().trim()} ${mcpArgs().trim()}`.trim()
        : `http · ${mcpUrl().trim()}`;
    setSections((prev) =>
      prev.map((section) =>
        section.id === "mcp"
          ? {
              ...section,
              rows: [
                ...section.rows,
                { id: name, name, description, enabled: true },
              ],
            }
          : section,
      ),
    );
    props.onAddMcp?.({
      name,
      config: {
        type: mcpType(),
        ...(mcpType() === "stdio"
          ? { command: mcpCommand().trim().split(/\s+/)[0], args: mcpArgs().trim().split(/\s+/).filter(Boolean) }
          : { url: mcpUrl().trim() }),
        enabled: true,
        headers: {},
        environment: {},
        timeoutSec: 30,
        allowedTools: [],
        excludedTools: [],
        readOnly: false,
      } as MCPServerConfig,
    });
    closeAdd();
  }

  function addPlugin() {
    const spec = packageSpec().trim();
    if (!spec) return;
    const name = spec.split("/").pop() ?? spec;
    setSections((prev) =>
      prev.map((section) =>
        section.id === "plugins"
          ? {
              ...section,
              rows: [
                ...section.rows,
                { id: spec, name, description: `npm package · ${spec}`, enabled: true },
              ],
            }
          : section,
      ),
    );
    props.onAddPlugin?.(spec);
    closeAdd();
  }

  function addSkill() {
    const source = skillSource().trim();
    if (!source) return;
    const name = source.split("/").pop() ?? source;
    setSections((prev) =>
      prev.map((section) =>
        section.id === "skills"
          ? {
              ...section,
              rows: [
                ...section.rows,
                { id: source, name, description: source.startsWith("http") ? `remote · ${source}` : `path · ${source}`, enabled: true },
              ],
            }
          : section,
      ),
    );
    closeAdd();
  }

  return (
    <div>
      <div class="neu-settings-content-title">扩展</div>
      <For each={sections()}>
        {(section) => (
          <div class="neu-extension-inline-section">
            <div class="neu-extension-inline-title">{section.title}</div>
            <For each={rows(section.id)}>
              {(row, index) => (
                <div class="neu-extension-row">
                  <span class="neu-extension-name">{row.name}</span>
                  <span class="neu-extension-description">{row.description}</span>
                  <span class="neu-extension-toggle" data-enabled={row.enabled}>
                    {row.enabled ? (section.id === "mcp" ? "已连接" : "已启用") : section.id === "mcp" ? "未连接" : "已禁用"}
                  </span>
                  <button
                    type="button"
                    class="neu-extension-btn"
                    onClick={() => toggleRow(section.id, index())}
                  >
                    {row.enabled ? "禁用" : "启用"}
                  </button>
                  <button
                    type="button"
                    class="neu-extension-btn neu-extension-remove"
                    disabled={section.id === "plugins" && !props.onRemovePlugin}
                    onClick={() => removeRow(section.id, index())}
                  >
                    删除
                  </button>
                </div>
              )}
            </For>

            <Show when={addingTo() === "mcp" && section.id === "mcp"}>
              <div class="neu-extension-form">
                <select
                  class="neu-form-input neu-form-select"
                  value={mcpType()}
                  onChange={(event) => setMcpType(event.currentTarget.value as "stdio" | "http")}
                >
                  <option value="stdio">stdio</option>
                  <option value="http">http</option>
                </select>
                <Show
                  when={mcpType() === "stdio"}
                  fallback={
                    <input
                      class="neu-form-input"
                      value={mcpUrl()}
                      placeholder="MCP URL（例如 https://example.com/mcp）"
                      onInput={(event) => setMcpUrl(event.currentTarget.value)}
                    />
                  }
                >
                  <input
                    class="neu-form-input"
                    value={mcpCommand()}
                    placeholder="command（例如 npx）"
                    onInput={(event) => setMcpCommand(event.currentTarget.value)}
                  />
                  <input
                    class="neu-form-input"
                    value={mcpArgs()}
                    placeholder="args（空格分隔）"
                    onInput={(event) => setMcpArgs(event.currentTarget.value)}
                  />
                </Show>
                <div class="neu-extension-form-actions">
                  <button type="button" class="neu-extension-btn" onClick={closeAdd}>取消</button>
                  <button type="button" class="neu-extension-btn neu-extension-primary-btn" onClick={addMcp}>添加</button>
                </div>
              </div>
            </Show>

            <Show when={addingTo() === "plugins" && section.id === "plugins"}>
              <div class="neu-extension-form">
                <input
                  class="neu-form-input"
                  value={packageSpec()}
                  placeholder="npm package spec，例如 @natalia/plugin-team"
                  onInput={(event) => setPackageSpec(event.currentTarget.value)}
                />
                <div class="neu-extension-form-actions">
                  <button type="button" class="neu-extension-btn" onClick={closeAdd}>取消</button>
                  <button type="button" class="neu-extension-btn neu-extension-primary-btn" onClick={addPlugin}>安装</button>
                </div>
              </div>
            </Show>

            <Show when={addingTo() === "skills" && section.id === "skills"}>
              <div class="neu-extension-form">
                <input
                  class="neu-form-input"
                  value={skillSource()}
                  placeholder="技能 URL 或本地路径"
                  onInput={(event) => setSkillSource(event.currentTarget.value)}
                />
                <div class="neu-extension-form-actions">
                  <button type="button" class="neu-extension-btn" onClick={closeAdd}>取消</button>
                  <button type="button" class="neu-extension-btn neu-extension-primary-btn" onClick={addSkill}>添加</button>
                </div>
              </div>
            </Show>

            <div class="neu-extension-actions">
              <Show
                when={section.id !== "plugins" || props.onAddPlugin}
                fallback={<span class="neu-extension-disabled">Web 端暂不支持安装插件</span>}
              >
                <button type="button" class="neu-extension-add" onClick={() => setAddingTo(section.id)}>
                  {section.addLabel}
                </button>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
