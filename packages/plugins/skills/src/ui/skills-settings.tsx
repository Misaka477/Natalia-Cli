import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import type {
  RuntimeClient,
  RuntimeSkillCatalogEntry,
} from "@anthelia/contracts";
import type { UiEventBus } from "@natalia/ui-host";

export function SkillsSettings(props: {
  runtime: RuntimeClient;
  events: UiEventBus;
}) {
  const [skills, setSkills] = createSignal<RuntimeSkillCatalogEntry[]>([]);
  const [adding, setAdding] = createSignal(false);
  const [source, setSource] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [status, setStatus] = createSignal("");

  async function refresh() {
    const next = await props.runtime.skills?.();
    if (next) setSkills(next);
  }

  onMount(() => {
    void refresh();
    const off = props.events.subscribe((event) => {
      if (event.type === "content.done" || event.type === "turn.finished")
        void refresh();
    });
    onCleanup(off);
  });

  async function addSkill() {
    const input = source().trim();
    if (!input || busy()) return;
    setBusy(true);
    setStatus("");
    try {
      await props.runtime.commandExecute?.({
        name: "skill-install",
        raw: `/skill-install ${input}`,
        args: [input],
      });
      setSource("");
      setAdding(false);
      setStatus("已提交安装，技能安装完成后会自动刷新列表");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div class="neu-settings-content-title">Skill 配置</div>
      <Show
        when={skills().length}
        fallback={
          <div class="neu-settings-item">
            <div class="neu-settings-item-main">
              <span class="neu-settings-item-label">暂无技能</span>
              <span class="neu-settings-item-description">
                点击下方添加技能
              </span>
            </div>
          </div>
        }
      >
        <For each={skills()}>
          {(skill) => (
            <div class="neu-extension-row">
              <span class="neu-extension-name">{skill.name}</span>
              <span class="neu-extension-description">
                {skill.description || skill.source}
              </span>
              <span class="neu-extension-toggle" data-enabled={true}>
                已启用
              </span>
              <button
                type="button"
                class="neu-extension-btn neu-extension-remove"
                disabled={true}
              >
                删除
              </button>
            </div>
          )}
        </For>
      </Show>

      <Show when={adding()}>
        <div class="neu-extension-form">
          <input
            class="neu-form-input"
            value={source()}
            placeholder="技能 URL 或本地路径"
            onInput={(event) => setSource(event.currentTarget.value)}
          />
          <div class="neu-extension-form-actions">
            <button
              type="button"
              class="neu-extension-btn"
              onClick={() => {
                setAdding(false);
                setSource("");
              }}
            >
              取消
            </button>
            <button
              type="button"
              class="neu-extension-btn neu-extension-primary-btn"
              disabled={busy()}
              onClick={() => void addSkill()}
            >
              {busy() ? "提交中…" : "添加"}
            </button>
          </div>
        </div>
      </Show>

      <Show when={status()}>
        <div class="neu-settings-item-description" style="margin-top:8px;">
          {status()}
        </div>
      </Show>

      <div class="neu-extension-actions">
        <button
          type="button"
          class="neu-extension-add"
          onClick={() => setAdding(!adding())}
        >
          添加技能
        </button>
      </div>
    </div>
  );
}
