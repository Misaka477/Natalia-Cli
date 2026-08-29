import { createSignal, createEffect, Show, onCleanup, onMount, For } from "solid-js";
import type { ConfigV3, RuntimeModelCatalogEntry, RuntimeModelSelection } from "@natalia/contracts";
import { NeuSelect } from "./components/NeuSelect";

type ModelView = "tree" | "edit-provider";

type ModelRow = {
  id: string;
  name: string;
  reasoning: boolean;
  image: boolean;
};

type HeaderRow = {
  name: string;
  value: string;
};

const providerApis = [
  { value: "openai", title: "OpenAI" },
  { value: "anthropic", title: "Anthropic" },
  { value: "gemini", title: "Gemini" },
  { value: "openai-compatible", title: "OpenAI Compatible" },
  { value: "anthropic-compatible", title: "Anthropic Compatible" },
];

export function ModelPanel(props: {
  open: boolean;
  onClose: () => void;
  catalog?: RuntimeModelCatalogEntry[];
  selection?: RuntimeModelSelection;
  providers?: ConfigV3["providers"];
  config?: ConfigV3;
  onSetDefault?: (modelID: string) => unknown;
  onAddProvider?: (input: {
    name: string;
    type: string;
    baseURL?: string;
    apiKey: string;
    label?: string;
    previousName?: string;
    headers?: Record<string, string>;
    models?: Array<{ id: string; name?: string; reasoning?: boolean; image?: boolean }>;
  }) => unknown;
}) {
  const [editingProvider, setEditingProvider] = createSignal<string | undefined>();
  const [view, setView] = createSignal<ModelView>("tree");
  const providers = () => {
    const groups = new Map<string, RuntimeModelCatalogEntry[]>();
    for (const entry of props.catalog ?? []) {
      const list = groups.get(entry.provider) ?? [];
      list.push(entry);
      groups.set(entry.provider, list);
    }
    return [...groups.entries()].map(([providerName, models]) => ({
      name: providerName,
      label: props.providers?.[providerName]?.name ?? providerName,
      status: "已连接",
      models: models.map((entry) => ({
        name: entry.id,
        default: props.selection?.modelID === entry.id,
      })),
    }));
  };
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set<string>());
  const [providerName, setProviderName] = createSignal("");
  const [providerLabel, setProviderLabel] = createSignal("");
  const [providerApi, setProviderApi] = createSignal("openai-compatible");
  const providerOptions = () => [
    ...(providerApis.some((api) => api.value === providerApi())
      ? []
      : [{ value: providerApi(), label: providerApi() }]),
    ...providerApis.map((api) => ({ value: api.value, label: api.title })),
  ];
  const [baseUrl, setBaseUrl] = createSignal("");
  const [apiKey, setApiKey] = createSignal("");
  const [models, setModels] = createSignal<ModelRow[]>([
    { id: "glm-5.3-flash", name: "glm-5.3-flash", reasoning: true, image: true },
  ]);
  const [headers, setHeaders] = createSignal<HeaderRow[]>([
    { name: "", value: "" },
  ]);

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function addModelRow() {
    setModels((prev) => [...prev, { id: "", name: "", reasoning: true, image: false }]);
  }

  function updateModel(index: number, patch: Partial<ModelRow>) {
    setModels((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function removeModel(index: number) {
    setModels((prev) => prev.filter((_, i) => i !== index));
  }

  function addHeaderRow() {
    setHeaders((prev) => [...prev, { name: "", value: "" }]);
  }

  function updateHeader(index: number, patch: Partial<HeaderRow>) {
    setHeaders((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function backToTree() {
    setView("tree");
  }

  function openEditProvider(providerName: string) {
    const provider = props.providers?.[providerName];
    if (!provider) return;
    const rawModels = props.config?.catalog?.providers?.[providerName]?.models ?? {};
    const rawModelRows = Object.entries(rawModels).map(([id, model]) => ({
      id,
      name: model.name || id,
      reasoning: Boolean(model.capabilities?.reasoning),
      image: Boolean(model.capabilities?.imageInput),
    }));
    const providerModels = rawModelRows.length
      ? rawModelRows
      : (props.catalog ?? [])
          .filter((entry) => entry.provider === providerName)
          .map((entry) => {
            const id = entry.id.startsWith(`${providerName}/`)
              ? entry.id.slice(providerName.length + 1)
              : entry.id;
            return {
              id,
              name: entry.name || id,
              reasoning: false,
              image: false,
            };
          });
    const realHeaders = Object.entries(provider.requestDefaults?.headers ?? {}).map(
      ([name, value]) => ({ name, value: String(value) }),
    );
    setEditingProvider(providerName);
    setProviderName(providerName);
    setProviderLabel(provider.name ?? providerName);
    setProviderApi(provider.driver);
    setBaseUrl(provider.connection?.baseURL ?? "");
    setApiKey(provider.connection?.apiKey ?? "");
    setModels(providerModels.length ? providerModels : [{ id: "", name: "", reasoning: true, image: false }]);
    setHeaders(realHeaders.length ? realHeaders : [{ name: "", value: "" }]);
    setView("edit-provider");
  }

  function openAddProvider() {
    setEditingProvider(undefined);
    setProviderName("");
    setProviderLabel("");
    setProviderApi("openai-compatible");
    setBaseUrl("");
    setApiKey("");
    setModels([{ id: "", name: "", reasoning: true, image: false }]);
    setHeaders([{ name: "", value: "" }]);
    setView("edit-provider");
  }

  function submitProvider() {
    const headerRecord: Record<string, string> = {};
    for (const header of headers()) {
      const name = header.name.trim();
      if (name) headerRecord[name] = header.value;
    }
    const modelRows = models()
      .filter((model) => model.id.trim())
      .map((model) => ({
        id: model.id.trim(),
        name: model.name.trim() || model.id.trim(),
        reasoning: model.reasoning,
        image: model.image,
      }));
    const targetID = providerName().trim() || editingProvider() || "";
    const providerInput = {
      name: targetID,
      type: providerApi(),
      label: providerLabel().trim() || undefined,
      previousName:
        editingProvider() && editingProvider() !== targetID
          ? editingProvider()
          : undefined,
      baseURL: baseUrl().trim() || undefined,
      apiKey: apiKey(),
      headers: Object.keys(headerRecord).length ? headerRecord : undefined,
      models: modelRows.length ? modelRows : undefined,
    };
    console.log("[provider-form] submit", JSON.stringify(providerInput, null, 2));
    props.onAddProvider?.(providerInput);
    setEditingProvider(undefined);
    backToTree();
  }

  createEffect(() => {
    if (props.open) {
      setView("tree");
      setEditingProvider(undefined);
      setExpanded(new Set<string>());
    }
  });

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => window.removeEventListener("keydown", handleKeydown));
  });

  return (
    <Show when={props.open}>
      <div class="neu-settings-backdrop" onClick={props.onClose}>
        <div class="neu-model-window" onClick={(event) => event.stopPropagation()}>
          <div class="neu-settings-header">
            <span class="neu-settings-title">
              {view() === "edit-provider" ? "编辑提供商" : "Providers & Models"}
            </span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭模型管理"
            >
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

          <Show when={view() === "tree"}>
            <div class="neu-model-tree">
              <For each={providers()}>
                {(provider) => (
                  <div class="neu-model-provider">
                    <div
                      class="neu-model-provider-header"
                      role="button"
                      tabIndex="0"
                      onClick={() => toggle(provider.name)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggle(provider.name);
                        }
                      }}
                    >
                      <svg
                        class="neu-model-chevron"
                        data-expanded={expanded().has(provider.name)}
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M6 4l4 4-4 4"
                          stroke="currentColor"
                          stroke-width="1.4"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                      <span class="neu-model-provider-name">{provider.label}</span>
                      <span class="neu-model-status" data-connected={provider.status === "已连接"}>
                        {provider.status}
                      </span>
                      <button
                        type="button"
                        class="neu-model-edit"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditProvider(provider.name);
                        }}
                      >
                        编辑
                      </button>
                    </div>
                    <Show when={expanded().has(provider.name)}>
                      <div class="neu-model-children">
                        <For each={provider.models}>
                          {(model) => (
                            <div class="neu-model-row">
                              <span class="neu-model-name">{model.name}</span>
                              <Show when={model.default}>
                                <span class="neu-model-default">默认</span>
                              </Show>
                              <button
                                type="button"
                                class="neu-model-set-default"
                                disabled={model.default}
                                onClick={() => props.onSetDefault?.(model.name)}
                              >
                                设为默认
                              </button>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
              <div class="neu-model-actions">
                <button type="button" class="neu-model-add" onClick={openAddProvider}>
                  添加 Provider
                </button>
              </div>
            </div>
          </Show>

          <Show when={view() === "edit-provider"}>
            <div class="neu-form">
              <div class="neu-form-field">
                <label class="neu-form-label" for="provider-name">提供商 ID</label>
                <input
                  id="provider-name"
                  class="neu-form-input"
                  value={providerName()}
                  placeholder="小写字母、数字、连字符或下划线"
                  onInput={(event) => setProviderName(event.currentTarget.value)}
                />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label" for="provider-label">Provider Name（显示名）</label>
                <input
                  id="provider-label"
                  class="neu-form-input"
                  value={providerLabel()}
                  placeholder="例如 GPT"
                  onInput={(event) => setProviderLabel(event.currentTarget.value)}
                />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label" for="provider-api">Provider API</label>
                <NeuSelect
                  value={providerApi()}
                  options={providerOptions()}
                  onChange={setProviderApi}
                />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label" for="provider-url">基础 URL</label>
                <input
                  id="provider-url"
                  class="neu-form-input"
                  value={baseUrl()}
                  placeholder="https://api.example.com/v1"
                  onInput={(event) => setBaseUrl(event.currentTarget.value)}
                />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label" for="provider-key">API 密钥</label>
                <input
                  id="provider-key"
                  class="neu-form-input"
                  type="password"
                  value={apiKey()}
                  placeholder="可选。请求头管理认证时可留空"
                  onInput={(event) => setApiKey(event.currentTarget.value)}
                />
              </div>

              <div class="neu-form-section-title">模型（只需填写模型 ID，名称会自动使用 ID）</div>
              <For each={models()}>
                {(model, index) => (
                  <div class="neu-model-edit-row">
                    <input
                      class="neu-form-input"
                      value={model.id}
                      placeholder="ID"
                      onInput={(event) => updateModel(index(), { id: event.currentTarget.value })}
                    />
                    <label class="neu-form-checkbox">
                      <input
                        type="checkbox"
                        checked={model.reasoning}
                        onChange={() => updateModel(index(), { reasoning: !model.reasoning })}
                      />
                      <span>推理</span>
                    </label>
                    <label class="neu-form-checkbox">
                      <input
                        type="checkbox"
                        checked={model.image}
                        onChange={() => updateModel(index(), { image: !model.image })}
                      />
                      <span>图片</span>
                    </label>
                    <button type="button" class="neu-model-remove" onClick={() => removeModel(index())}>
                      删除
                    </button>
                  </div>
                )}
              </For>
              <button type="button" class="neu-model-add neu-model-add-secondary neu-model-add-full" onClick={addModelRow}>
                + 添加模型
              </button>

              <div class="neu-form-section-title">请求头</div>
              <For each={headers()}>
                {(header, index) => (
                  <div class="neu-model-edit-row">
                    <input
                      class="neu-form-input"
                      value={header.name}
                      placeholder="Header Name"
                      onInput={(event) => updateHeader(index(), { name: event.currentTarget.value })}
                    />
                    <input
                      class="neu-form-input"
                      value={header.value}
                      placeholder="Value"
                      onInput={(event) => updateHeader(index(), { value: event.currentTarget.value })}
                    />
                    <button type="button" class="neu-model-remove" onClick={() => setHeaders((prev) => prev.filter((_, i) => i !== index()))}>
                      删除
                    </button>
                  </div>
                )}
              </For>
              <button type="button" class="neu-model-add neu-model-add-secondary neu-model-add-full" onClick={addHeaderRow}>
                + 添加请求头
              </button>

              <div class="neu-form-actions">
                <button type="button" class="neu-form-btn neu-form-cancel" onClick={backToTree}>取消</button>
                <button type="button" class="neu-form-btn neu-form-primary" onClick={submitProvider}>提交</button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
