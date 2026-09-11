import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import type {
  RuntimeClient,
  RuntimeModelCatalogEntry,
} from "@natalia/contracts";
import type { AppState } from "@natalia/view-store";
import { Transcript } from "@natalia/ui-kit";
import { Composer } from "./components/Composer";
import { NeuSelect } from "./components/NeuSelect";
import type { Message } from "./types";
import { stableRows, type RowSignature } from "./stable-rows";

export function NiaPanel(props: {
  state: AppState;
  runtime?: RuntimeClient;
  sessionID?: string;
  catalog: RuntimeModelCatalogEntry[];
}) {
  const [draft, setDraft] = createSignal("");
  const [modelID, setModelID] = createSignal("");
  const [reasoning, setReasoning] = createSignal("medium");
  const [busy, setBusy] = createSignal(false);
  let niaObservedTop = 0;
  const niaTranscriptRef = createSignal<HTMLDivElement | undefined>(undefined);
  const [niaTranscriptEl, setNiaTranscriptEl] = niaTranscriptRef;
  const [niaFollowBottom, setNiaFollowBottom] = createSignal(true);
  const [niaShowJumpToBottom, setNiaShowJumpToBottom] = createSignal(false);
  let profileLoadToken = 0;

  const niaMessageCache = new Map<
    string,
    { signature: RowSignature; value: Message }
  >();

  const messages = createMemo<Message[]>(() => {
    const list = props.state.nia.messages;
    const activity = Boolean(props.state.nia.activity);
    const lastIndex = list.length - 1;
    return stableRows(
      niaMessageCache,
      list.map((msg, idx) => {
        const isLast = idx === lastIndex;
        const tool = msg.tool;
        if (tool) {
          return {
            id: msg.id,
            signature: [tool.name, tool.result, tool.summary, tool.status],
            create: () => ({
              id: msg.id,
              role: "assistant",
              content: "",
              toolCalls: [
                {
                  name: tool.name,
                  output: tool.result ?? tool.summary,
                  status: tool.status,
                  summary: tool.summary,
                },
              ],
            }),
          };
        }
        const role =
          msg.role === "user" ? ("user" as const) : ("assistant" as const);
        const content = msg.text + (msg.pendingText ?? "");
        const streaming = Boolean(activity && isLast && msg.role !== "user");
        return {
          id: msg.id,
          signature: [
            role,
            msg.role,
            msg.text,
            msg.pendingText ?? "",
            msg.reasoningVisible,
            content,
            streaming,
            isLast,
            activity,
          ],
          create: () => ({
            id: msg.id,
            role,
            thinking: msg.role === "thinking" && msg.reasoningVisible !== false,
            content,
            streaming,
          }),
        };
      }),
    );
  });

  const modelOptions = () =>
    props.catalog.map((entry) => ({
      value: entry.id,
      label: entry.id,
    }));

  onMount(() => {
    void loadProfile();
  });

  createEffect(() => {
    void loadProfile();
  });

  async function loadProfile() {
    const token = ++profileLoadToken;
    const requestedSessionID = props.sessionID;
    try {
      const profile = await props.runtime?.chatModelProfile?.(
        "nia",
        requestedSessionID,
      );
      if (token !== profileLoadToken || requestedSessionID !== props.sessionID)
        return;
      setModelID(profile?.normal?.modelID ?? "");
      setReasoning(profile?.normal?.reasoningEffort ?? "medium");
    } catch {
      // Profile may be unavailable until the runtime is fully ready.
    }
  }

  function handleNiaScroll() {
    const el = niaTranscriptEl();
    if (!el) return;
    const floor = Math.max(0, el.scrollHeight - el.clientHeight);
    const ledger = Math.min(niaObservedTop, floor);
    const movedByReader = Math.abs(el.scrollTop - ledger) > 1;
    if (!movedByReader) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      if (nearBottom) el.scrollTop = el.scrollHeight;
      niaObservedTop = el.scrollTop;
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setNiaFollowBottom(nearBottom);
    setNiaShowJumpToBottom(!nearBottom);
    niaObservedTop = el.scrollTop;
  }

  function jumpNiaToBottom() {
    const el = niaTranscriptEl();
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    niaObservedTop = el.scrollTop;
    setNiaFollowBottom(true);
    setNiaShowJumpToBottom(false);
  }

  const niaObserver =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => {
          if (niaFollowBottom() && niaTranscriptEl()) {
            const el = niaTranscriptEl()!;
            el.scrollTop = el.scrollHeight;
            niaObservedTop = el.scrollTop;
          }
        });
  onCleanup(() => niaObserver?.disconnect());

  createEffect(() => {
    const el = niaTranscriptEl();
    const content = el?.querySelector<HTMLElement>(
      ".natalia-transcript-content",
    );
    if (el) niaObserver?.observe(el);
    if (content) niaObserver?.observe(content);
    if (el) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (niaFollowBottom() && niaTranscriptEl()) {
            const target = niaTranscriptEl()!;
            target.scrollTop = target.scrollHeight;
            niaObservedTop = target.scrollTop;
          }
        });
      });
    }
  });

  async function saveProfile(patch: {
    modelID?: string;
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  }) {
    const current = await props.runtime
      ?.chatModelProfile?.("nia", props.sessionID)
      .catch(() => undefined);
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
      props.sessionID,
    );
  }

  async function submit() {
    const text = draft();
    if (!text.trim() || busy()) return;
    setBusy(true);
    // Match the Navi composer: clear immediately on send, not after the whole
    // chat turn finishes.
    setDraft("");
    try {
      const profile = await props.runtime?.chatModelProfile?.(
        "nia",
        props.sessionID,
      );
      await props.runtime?.chatSubmit?.({
        text,
        channel: "nia",
        sessionID: props.sessionID,
        ...(profile?.normal?.modelID
          ? {
              model: {
                modelID: profile.normal.modelID,
                ...(profile.normal.variant
                  ? { variant: profile.normal.variant }
                  : {}),
              },
            }
          : {}),
        reasoningEffort: (profile?.normal?.reasoningEffort ?? reasoning()) as
          | "minimal"
          | "low"
          | "medium"
          | "high"
          | "xhigh",
        ...(props.sessionID ? { sessionID: props.sessionID } : {}),
      });
    } catch (cause) {
      console.error("[nia-ui] submit failed", cause);
    } finally {
      setBusy(false);
    }
  }

  const active = () => props.state.nia.activity;

  return (
    <div class="neu-pane nia-flat-pane">
      <div class="neu-pane-header">
        <span class="neu-pane-title">Nia</span>
        <span class="neu-pane-header-actions">
          <span class="neu-pane-status" data-running={Boolean(active())}>
            {active() ? "running" : "idle"}
          </span>
        </span>
      </div>
      <div class="neu-pane-content">
        <div class="nia-transcript-wrap">
          <Transcript
            messages={messages()}
            emptyTitle="向 Nia 提问"
            emptyHint="Nia 用于审计，只读、不写代码、不写 Plan。"
            assistantName="Nia"
            assistantInitial="N"
            scrollRef={setNiaTranscriptEl}
            onScroll={handleNiaScroll}
          />
          <Show when={niaShowJumpToBottom()}>
            <button
              type="button"
              class="neu-jump-bottom"
              onClick={jumpNiaToBottom}
              title="跳到底部"
            >
              ↓
            </button>
          </Show>
        </div>
        <div class="neu-activity-bar" data-running={Boolean(active())}>
          <span class="neu-activity-pulse" />
          <span class="neu-activity-label">
            {active()
              ? active()?.phase === "using_tool"
                ? `使用 ${active()?.toolName ?? ""}`
                : active()?.phase === "thinking"
                  ? "思考中"
                  : "生成中"
              : "idle"}
          </span>
        </div>
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
                reasoningEffort: next as
                  | "minimal"
                  | "low"
                  | "medium"
                  | "high"
                  | "xhigh",
              });
            }}
            placeholder="Nia 推理"
            menuPosition="top"
          />
        </div>
        <Composer
          value={draft()}
          placeholder="向 Nia 提问…"
          busy={Boolean(active()) || busy()}
          onInput={setDraft}
          onStop={() => void props.runtime?.chatAbort?.("nia", props.sessionID)}
          onSubmit={() => void submit()}
        />
      </div>
    </div>
  );
}
