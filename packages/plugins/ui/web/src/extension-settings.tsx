import { createSignal, For, Show } from "solid-js";
import { NeuSelect } from "./components/NeuSelect";
import type { McpView } from "@natalia/view-store";
import type { MCPServerConfig, RuntimeSkillCatalogEntry } from "@natalia/contracts";

type ExtensionKind = "mcp" | "skills";

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
  mcp?: Record<string, McpView>;
  skills?: RuntimeSkillCatalogEntry[];
}): ExtensionSection[] {
  const mcpRows = Object.entries(props.mcp ?? {}).map(([id, server]) => ({
    id,
    name: id,
    description: server.message ?? `${server.tools} tools`,
    enabled: server.status === "connected",
  }));
  const skillRows = (props.skills ?? []).map((skill) => ({
    id: skill.name,
    name: skill.name,
    description: skill.description || skill.source,
    enabled: true,
  }));
  return [
    {
      id: "mcp",
      title: "MCP",
      addLabel: "添加 MCP",
      rows: mcpRows,
    },
    {
      id: "skills",
      title: "Skills",
      addLabel: "添加技能",
      rows: skillRows,
    },
  ];
}

export function ExtensionSettingsContent(props: {
  mcp?: Record<string, McpView>;
  skills?: RuntimeSkillCatalogEntry[];
  onAddMcp?: (input: { name: string; config: MCPServerConfig }) => unknown;
  onRemoveMcp?: (name: string) => unknown;
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
            <Show when={rows(section.id).length} fallback={<div class="neu-settings-item"><div class="neu-settings-item-main"><span class="neu-settings-item-label">暂无{section.title}</span><span class="neu-settings-item-description">{section.id === "mcp" ? "点击下方添加 MCP" : "当前没有可用技能"}</span></div></div>}>
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
                    disabled={section.id === "skills"}
                    onClick={() => removeRow(section.id, index())}
                  >
                    删除
                  </button>
                </div>
              )}
            </For>
            </Show>

            <Show when={addingTo() === "mcp" && section.id === "mcp"}>
              <div class="neu-extension-form">
                <NeuSelect
                  value={mcpType()}
                  options={[
                    { value: "stdio", label: "stdio" },
                    { value: "http", label: "http" },
                  ]}
                  onChange={(value) => setMcpType(value as "stdio" | "http")}
                />
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
                when={section.id !== "skills"}
                fallback={<span class="neu-extension-disabled">Web 端暂不支持添加技能</span>}
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
