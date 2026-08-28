import type {
  ChatModelProfile,
  RuntimeModelCatalogEntry,
  RuntimeReasoningEffort,
} from "@natalia/contracts";
import type { UiPluginContext } from "@natalia/ui-host";
import { cloneState, selectPrimaryActivity } from "@natalia/view-store";
import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { AttachmentRow } from "./attachments";
import { PromptCards } from "./prompts";
import {
  REASONING_OPTIONS,
  createSessionController,
  type SessionToast,
} from "./session";
import { Sidebar, type NavWorkspace } from "./sidebar";
import { Composer, Transcript } from "./transcript";

export function App(props: { ctx: UiPluginContext }) {
  const [state, setState] = createSignal(
    cloneState(props.ctx.projection.getState()),
  );
  const [toast, setToast] = createSignal<SessionToast | undefined>();
  const [catalog, setCatalog] = createSignal<RuntimeModelCatalogEntry[]>([]);
  const [reasoning, setReasoning] = createSignal<
    RuntimeReasoningEffort | undefined
  >();
  const [mainDraft, setMainDraft] = createSignal("");
  const [chatDraft, setChatDraft] = createSignal("");
  const [rejecting, setRejecting] = createSignal<string | undefined>();
  const [rejectFeedback, setRejectFeedback] = createSignal("");
  const [mainFiles, setMainFiles] = createSignal<string[]>([]);
  const [chatFiles, setChatFiles] = createSignal<string[]>([]);
  const [expert, setExpert] = createSignal(false);
  const [chatProfile, setChatProfile] = createSignal<ChatModelProfile>({});
  const session = createSessionController(
    props.ctx.runtime,
    () => state(),
    (next) => setToast(next),
  );
  onCleanup(
    props.ctx.projection.subscribe((next) => setState(cloneState(next))),
  );
  onMount(() => void loadControls());

  async function loadControls() {
    const runtime = props.ctx.runtime;
    setCatalog((await runtime.modelCatalog?.()) ?? []);
    const selected = await runtime.modelSelection?.();
    if (selected?.modelID)
      setState((current) => ({ ...current, modelSelection: selected }));
    setReasoning(await runtime.reasoningEffort?.());
    const profile = await runtime.chatModelProfile?.();
    if (profile) {
      await session.setChatProfile(profile);
      setChatProfile(profile);
    }
  }

  function refresh() {
    setMainFiles(session.attachments());
    setChatFiles(session.chatAttachments());
    setExpert(session.chatExpert());
  }

  const workspaces = createMemo((): NavWorkspace[] => [
    {
      id: "ws-current",
      name: "natalia-cli",
      sessions: [
        {
          id: state().sessionID ?? "current",
          title: state().title || "Current session",
          state: state().activeTurn ? "running" : "idle",
          active: true,
        },
      ],
    },
  ]);
  const activity = () => selectPrimaryActivity(state());
  const modelName = () =>
    state().modelSelection?.modelID?.split("/").at(-1) ?? "no model";

  return (
    <div class="natalia-web">
      <Show when={toast()}>
        {(item) => <div class="natalia-web__toast">{item().text}</div>}
      </Show>
      <Sidebar workspaces={workspaces()} />
      <section class="natalia-web__pane" data-panel="main">
        <div class="natalia-web__head">
          <h2>Main</h2>
          <p>{activity()?.kind ?? state().status}</p>
          <span
            class="natalia-web__pill"
            data-live={state().activeTurn ? "true" : "false"}
          >
            {state().activeTurn ? "running" : "idle"} · {modelName()}
          </span>
        </div>
        <Transcript
          messages={state().messages}
          emptyTitle="Natalia is ready"
          emptyHint="Main writes, runs, and changes this workspace."
        />
        <div class="natalia-web__dock">
          <PromptCards
            state={state()}
            session={session}
            rejecting={rejecting()}
            rejectFeedback={rejectFeedback()}
            onRejecting={setRejecting}
            onFeedback={setRejectFeedback}
          />
          <Composer
            value={mainDraft()}
            placeholder={
              state().pendingApprovals.length
                ? "Answer the pending prompt above"
                : state().activeTurn
                  ? "Working — this message joins the current turn"
                  : "Ask Natalia to work in this repo"
            }
            busy={Boolean(state().activeTurn)}
            onInput={setMainDraft}
            onSubmit={() => {
              const text = mainDraft();
              setMainDraft("");
              void session.submitMain(text).then(refresh);
            }}
            onStop={() => session.stopMain()}
          >
            <select
              value={state().modelSelection?.modelID ?? ""}
              onChange={(event) => {
                const modelID = event.currentTarget.value;
                if (modelID) void session.selectModel(modelID);
              }}
            >
              <For each={catalog()}>
                {(entry) => <option value={entry.id}>{entry.name}</option>}
              </For>
            </select>
            <select
              value={reasoning() ?? ""}
              onChange={(event) => {
                const effort = (event.currentTarget.value || undefined) as
                  | RuntimeReasoningEffort
                  | undefined;
                setReasoning(effort);
                void session.setReasoning(effort);
              }}
            >
              <For each={REASONING_OPTIONS}>
                {(option) => (
                  <option value={option ?? ""}>{option ?? "standard"}</option>
                )}
              </For>
            </select>
            <AttachmentRow
              items={mainFiles()}
              onAdd={() => attach("main")}
              onRemove={(path) => {
                session.removeAttachment(path);
                refresh();
              }}
              onPaste={(event) => void paste(event, "main")}
            />
          </Composer>
        </div>
      </section>
      <section
        class="natalia-web__pane natalia-web__pane--chat"
        data-panel="chat"
      >
        <div class="natalia-web__head">
          <h2>Chat</h2>
          <p>Navi</p>
          <span
            class="natalia-web__pill"
            data-live={state().chatActivity ? "true" : "false"}
          >
            {state().chatActivity?.phase ?? (expert() ? "expert" : "std")}
          </span>
        </div>
        <Transcript
          messages={state().chatMessages}
          emptyTitle="Ask Navi"
          emptyHint="Chat plans and reviews. It does not write the workspace."
        />
        <div class="natalia-web__dock">
          <Composer
            value={chatDraft()}
            placeholder="Ask Navi..."
            busy={Boolean(state().chatActivity)}
            onInput={setChatDraft}
            onSubmit={() => {
              const text = chatDraft();
              setChatDraft("");
              void session.submitChat(text).then(refresh);
            }}
            onStop={() => void session.stopChat()}
          >
            <select
              value={chatProfile().normal?.modelID ?? ""}
              onChange={(event) => void setChatModel(event.currentTarget.value)}
            >
              <For each={catalog()}>
                {(entry) => <option value={entry.id}>{entry.name}</option>}
              </For>
            </select>
            <label class="natalia-web__toggle">
              <input
                type="checkbox"
                checked={expert()}
                onChange={(event) => {
                  session.setChatExpert(event.currentTarget.checked);
                  refresh();
                }}
              />
              Expert
            </label>
            <AttachmentRow
              items={chatFiles()}
              onAdd={() => attach("chat")}
              onRemove={(path) => {
                session.removeChatAttachment(path);
                refresh();
              }}
              onPaste={(event) => void paste(event, "chat")}
            />
          </Composer>
        </div>
      </section>
    </div>
  );

  function attach(target: "main" | "chat") {
    const next = window.prompt("Workspace-relative path");
    if (!next) return;
    const error =
      target === "chat"
        ? session.queueChatAttachment(next)
        : session.queueAttachment(next);
    if (error) setToast({ kind: "error", text: error });
    refresh();
  }

  async function setChatModel(modelID: string) {
    const next: ChatModelProfile = {
      ...session.chatProfile(),
      normal: modelID ? { modelID } : undefined,
    };
    await session.setChatProfile(next);
    setChatProfile(next);
  }

  async function paste(event: ClipboardEvent, target: "main" | "chat") {
    const image = await props.ctx.transport.readClipboardImage?.();
    if (!image) return;
    event.preventDefault();
    const path = `.natalia/attachments/${target}-pasted-${Date.now()}.png`;
    await props.ctx.transport.writeFile(path, image);
    const error =
      target === "chat"
        ? session.queueChatAttachment(path)
        : session.queueAttachment(path);
    if (error) setToast({ kind: "error", text: error });
    refresh();
  }
}
