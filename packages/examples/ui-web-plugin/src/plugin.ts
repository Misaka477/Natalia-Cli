import {
  defineUiPlugin,
  type UiPlugin,
  type UiPluginContext,
} from "@natalia/ui-host";
import {
  displayText,
  type AppState,
  type MessageBlock,
} from "@natalia/view-store";

export const EXAMPLE_WEB_UI_PLUGIN_ID = "natalia.ui.web.example";

const styles = `
.natalia-example-ui { display:flex; flex-direction:column; height:100%; min-height:0; color:#e8eaed; background:#111318; font:14px/1.45 ui-sans-serif,system-ui,sans-serif; }
.natalia-example-ui__header { padding:12px 16px; border-bottom:1px solid #2a2f3a; }
.natalia-example-ui__header h1 { margin:0; font-size:16px; }
.natalia-example-ui__status { margin:4px 0 0; color:#9aa3b2; font-size:12px; }
.natalia-example-ui__layout { display:grid; grid-template-columns:1fr 1fr; gap:1px; flex:1; min-height:0; background:#2a2f3a; }
.natalia-example-ui__panel { display:flex; flex-direction:column; min-height:0; background:#111318; }
.natalia-example-ui__panel h2 { margin:0; padding:10px 16px; font-size:13px; border-bottom:1px solid #2a2f3a; }
.natalia-example-ui__transcript { flex:1; min-height:0; overflow:auto; padding:12px 16px; }
.natalia-example-ui__empty { color:#6b7380; }
.natalia-example-ui__message { margin:0 0 12px; }
.natalia-example-ui__message strong { display:block; font-size:11px; text-transform:uppercase; color:#9aa3b2; }
.natalia-example-ui__message pre { margin:4px 0 0; white-space:pre-wrap; }
.natalia-example-ui__composer { display:flex; gap:8px; padding:12px 16px; border-top:1px solid #2a2f3a; }
.natalia-example-ui__composer input { flex:1; background:#1a1d24; color:inherit; border:1px solid #2a2f3a; border-radius:6px; padding:8px 10px; }
.natalia-example-ui__composer button { background:#3d7bfd; color:#fff; border:0; border-radius:6px; padding:8px 12px; }
`;

export function createExampleWebUiPlugin(): UiPlugin {
  let unmount: (() => void) | undefined;
  let submitMain: ((text: string) => Promise<unknown>) | undefined;
  return defineUiPlugin({
    id: EXAMPLE_WEB_UI_PLUGIN_ID,
    name: "Example Web UI",
    version: "1.0.0",
    description: "Minimal Main + Chat panels for the UI plugin host.",
    events: ["runtime.*"],
    panels: [
      { id: "main", title: "Main", region: "main" },
      { id: "chat", title: "Chat", region: "side" },
    ],
    commands: [
      {
        id: "example.web.submit",
        title: "Submit to Main",
        run: async (args) => {
          if (!submitMain) throw new Error("plugin is not mounted");
          return submitMain(String(args ?? ""));
        },
      },
    ],
    mount(ctx) {
      const mounted = mountExampleWebUi(ctx);
      submitMain = mounted.submitMain;
      unmount = () => {
        mounted.dispose();
        submitMain = undefined;
        unmount = undefined;
      };
      return { dispose: unmount };
    },
    unmount() {
      unmount?.();
    },
  });
}

function mountExampleWebUi(ctx: UiPluginContext) {
  const root = ctx.root;
  root.replaceChildren();
  const style = document.createElement("style");
  style.textContent = styles;
  const shell = el("div", "natalia-example-ui");
  const header = el("header", "natalia-example-ui__header");
  const title = el("h1");
  title.textContent = "Natalia";
  const status = el("p", "natalia-example-ui__status");
  header.append(title, status);

  const layout = el("div", "natalia-example-ui__layout");
  const main = panel("main", "Main");
  const chat = panel("chat", "Chat");
  layout.append(main.section, chat.section);
  shell.append(header, layout);
  root.append(style, shell);

  const render = (state: AppState) => {
    title.textContent = state.title || "Natalia";
    status.textContent = `${state.status} · ${state.sessionID ?? "no session"}`;
    paintTranscript(main.body, state.messages);
    paintTranscript(chat.body, state.chatMessages);
  };
  render(ctx.projection.getState());
  const offProjection = ctx.projection.subscribe(render);

  const onMain = async (event: Event) => {
    event.preventDefault();
    const text = main.input.value.trim();
    if (!text) return;
    main.input.value = "";
    await ctx.runtime.submit(text);
  };
  const onChat = async (event: Event) => {
    event.preventDefault();
    const text = chat.input.value.trim();
    if (!text) return;
    chat.input.value = "";
    if (!ctx.runtime.chatSubmit) {
      ctx.logger.warn("chatSubmit is unavailable on this runtime");
      return;
    }
    await ctx.runtime.chatSubmit({ text });
  };
  main.form.addEventListener("submit", onMain);
  chat.form.addEventListener("submit", onChat);

  return {
    submitMain: (text: string) => ctx.runtime.submit(text),
    dispose() {
      offProjection();
      main.form.removeEventListener("submit", onMain);
      chat.form.removeEventListener("submit", onChat);
      root.replaceChildren();
    },
  };
}

function panel(id: string, heading: string) {
  const section = el(
    "section",
    `natalia-example-ui__panel natalia-example-ui__panel--${id}`,
  );
  section.dataset.panel = id;
  const h2 = el("h2");
  h2.textContent = heading;
  const body = el("div", "natalia-example-ui__transcript");
  const form = el("form", "natalia-example-ui__composer") as HTMLFormElement;
  const input = el("input") as HTMLInputElement;
  input.type = "text";
  input.name = id;
  input.placeholder = id === "chat" ? "Message Chat" : "Message Main";
  const button = el("button") as HTMLButtonElement;
  button.type = "submit";
  button.textContent = "Send";
  form.append(input, button);
  section.append(h2, body, form);
  return { section, body, form, input };
}

function paintTranscript(target: HTMLElement, messages: MessageBlock[]) {
  target.replaceChildren();
  if (messages.length === 0) {
    const empty = el("p", "natalia-example-ui__empty");
    empty.textContent = "No messages yet.";
    target.append(empty);
    return;
  }
  for (const block of messages) {
    const row = el(
      "article",
      `natalia-example-ui__message natalia-example-ui__message--${block.role}`,
    );
    const role = el("strong");
    role.textContent = block.role;
    const text = el("pre");
    text.textContent = displayText(block);
    row.append(role, text);
    target.append(row);
  }
}

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export default createExampleWebUiPlugin();
