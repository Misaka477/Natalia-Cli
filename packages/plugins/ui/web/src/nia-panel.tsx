import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import type {
  RuntimeClient,
  RuntimeModelCatalogEntry,
} from "@natalia/contracts";
import type { AppState } from "@natalia/view-store";
import { Transcript } from "./components/Transcript";
import { Composer } from "./components/Composer";
import { NeuSelect } from "./components/NeuSelect";
import type { Message } from "./types";

export function NiaPanel(props: { state: AppState; runtime?: RuntimeClient }) {
  const [draft, setDraft] = createSignal("");
  const [modelID, setModelID] = createSignal("");
  const [reasoning, setReasoning] = createSignal("medium");
  const [busy, setBusy] = createSignal(false);
  const [modelCatalog, setModelCatalog] = createSignal<
    RuntimeModelCatalogEntry[]
  >([]);

  const messages = createMemo<Message[]>(() =>
    (props.state.chatMessages ?? [])
      .filter((message) => (message.channel ?? "navi") === "nia")
      .map((msg, idx) => {
        if (msg.tool) {
          return {
            id: msg.id,
            role: "assistant",
            content: "",
            toolCalls: [
              {
                name: msg.tool.name,
                output: msg.tool.result ?? msg.tool.summary,
                status: msg.tool.status,
                summary: msg.tool.summary,
              },
            ],
          };
        }
        return {
          id: msg.id,
          role: msg.role === "user" ? "user" : "assistant",
          thinking: msg.role === "thinking" && msg.reasoningVisible !== false,
          content: msg.text + (msg.pendingText ?? ""),
          streaming: Boolean(
            props.state.chatActivity?.channel === "nia" &&
              idx === (props.state.chatMessages ?? []).length - 1 &&
              msg.role !== "user",
          ),
        };
      }),
  );

  const modelOptions = () =>
    modelCatalog().map((entry) => ({
      value: entry.id,
      label: entry.id,
    }));

  onMount(() => {
    void loadProfile();
    void loadCatalog();
  });

  async function loadCatalog() {
    try {
      const catalog = await props.runtime?.modelCatalog?.();
      setModelCatalog(catalog ?? []);
    } catch {
      // Catalog may be unavailable until the runtime is fully ready.
    }
  }

  async function loadProfile() {
    try {
      const profile = await props.runtime?.chatModelProfile?.("nia");
      setModelID(profile?.normal?.modelID ?? "");
      setReasoning(profile?.normal?.reasoningEffort ?? "medium");
    } catch {
      // Profile may be unavailable until the runtime is fully ready.
    }
  }

  async function saveProfile(patch: {
    modelID?: string;
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  }) {
    const current = await props.runtime?.chatModelProfile?.("nia").catch(() => undefined);
    await props.runtime?.setChatModelProfile?.(
      {
        ...(current ?? {}),
        normal: {
          ...(current?.normal ?? {}),
          ...(patch.modelID !== undefined ? { modelID: patch.modelID } : {}),
          ...(patch.reasoningEffort !== undefined
            ? { reasoningEffort: patch.reasoningEffort }
            : {}),
        },
      },
      "nia",
    );
  }

  async function submit() {
    const text = draft();
    if (!text.trim() || busy()) return;
    setBusy(true);
    try {
      await props.runtime?.chatSubmit?.({
        text,
        channel: "nia",
        reasoningEffort: reasoning() as "minimal" | "low" | "medium" | "high" | "xhigh",
      });
      setDraft("");
    } catch (cause) {
      console.error("[nia-ui] submit failed", cause);
    } finally {
      setBusy(false);
    }
  }

  const active = () =>
    props.state.chatActivity?.channel === "nia"
      ? props.state.chatActivity
      : undefined;

  return (
    <div class="review-pane">
      <div class="review-header">
        <div class="review-title">
          <span>Nia</span>
        </div>
        <div class="review-meta">
          <span class="review-count" data-running={Boolean(active())}>
            {active() ? "running" : "idle"}
          </span>
        </div>
      </div>
      <div class="review-body nia-panel-body">
        <Transcript
          messages={messages()}
          emptyTitle="向 Nia 提问"
          emptyHint="Nia 用于审计，只读、不写代码、不写 Plan。"
          assistantName="Nia"
          assistantInitial="N"
        />
        <Show when={active()}>
          <div class="neu-activity-bar" data-running={true}>
            <span class="neu-activity-pulse" />
            <span class="neu-activity-label">
              {active()?.phase === "using_tool"
                ? `使用 ${active()?.toolName ?? ""}`
                : active()?.phase === "thinking"
                  ? "思考中"
                  : "生成中"}
            </span>
          </div>
        </Show>
        <div class="neu-main-toolbar">
          <NeuSelect
            value={modelID()}
            options={modelOptions()}
            placeholder="Nia 模型"
            onChange={(next) => {
              setModelID(next);
              void saveProfile({ modelID: next });
            }}
            menuPosition="top"
          />
          <NeuSelect
            value={reasoning()}
            options={[
              { value: "minimal", label: "minimal" },
              { value: "low", label: "low" },
              { value: "medium", label: "medium" },
              { value: "high", label: "high" },
              { value: "xhigh", label: "xhigh" },
            ]}
            onChange={(next) => {
              setReasoning(next);
              void saveProfile({
                reasoningEffort: next as "minimal" | "low" | "medium" | "high" | "xhigh",
              });
            }}
            placeholder="Nia 推理"
            menuPosition="top"
          />
          <button
            type="button"
            class="neu-select-trigger"
            style={{ width: "auto" }}
            onClick={() =>
              void props.runtime?.chatSubmit?.({
                text: "请审计当前选中的 Plan，按计划源文件逐项核对。",
                channel: "nia",
              })
            }
          >
            手动启动
          </button>
        </div>
        <Composer
          value={draft()}
          placeholder="向 Nia 提问…"
          busy={Boolean(active()) || busy()}
          onInput={setDraft}
          onStop={() => void props.runtime?.chatAbort?.("nia")}
          onSubmit={() => void submit()}
        />
      </div>
    </div>
  );
}
