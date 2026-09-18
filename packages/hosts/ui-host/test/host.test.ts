import { expect, test } from "bun:test";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { createUiPluginHost, defineUiPlugin } from "../src";

function fakeRoot(): HTMLElement {
  const node = {
    tagName: "DIV",
    children: [] as unknown[],
    innerHTML: "",
    textContent: "",
    replaceChildren() {
      node.children = [];
      node.innerHTML = "";
      node.textContent = "";
    },
    appendChild(child: unknown) {
      node.children.push(child);
      return child;
    },
  };
  return node as unknown as HTMLElement;
}

function runtimeFixture() {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const submissions: string[] = [];
  const chat: string[] = [];
  const runtime = {
    start(next: (event: RuntimeEvent) => void) {
      sink = next;
      next({
        type: "session.created",
        sessionID: "ses_fixture" as never,
        title: "Fixture",
      });
      next({
        type: "session.ready",
        sessionID: "ses_fixture" as never,
      });
    },
    async submit(text: string) {
      submissions.push(text);
      const id = `turn_${submissions.length}`;
      sink?.({
        type: "turn.submitted",
        id,
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "x",
      });
      sink?.({ type: "content.done", id, text: `echo:${text}` });
      return {
        type: "turn.submitted" as const,
        id,
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "x",
      };
    },
    naviChat: {
      async submit(input: { text: string }) {
        chat.push(input.text);
        sink?.({
          type: "navi.chat.message.added",
          id: "chat_1",
          messageID: "msg_1",
          role: "user",
          text: input.text,
          at: "now",
        });
        return { messageID: "msg_1" };
      },
    },
    cancel() {},
  } as unknown as RuntimeClient;
  return {
    runtime,
    submissions: () => submissions,
    chat: () => chat,
    emit(event: RuntimeEvent) {
      sink?.(event);
    },
  };
}

test("the host loads a UI plugin, forwards events, and unloads it", async () => {
  const root = fakeRoot();
  const fixture = runtimeFixture();
  const seen: string[] = [];
  const plugin = defineUiPlugin({
    id: "example.web",
    name: "Example",
    version: "1.0.0",
    events: ["runtime.*"],
    panels: [
      { id: "main", title: "Main", region: "main" },
      { id: "chat", title: "Chat", region: "side" },
    ],
    commands: [
      {
        id: "example.ping",
        title: "Ping",
        run: () => "pong",
      },
    ],
    mount(ctx) {
      seen.push("mount");
      ctx.root.textContent = "plugin-root";
      const off = ctx.events.subscribe((event) => seen.push(event.type));
      return {
        dispose() {
          off();
          seen.push("dispose");
          ctx.root.textContent = "";
        },
      };
    },
  });
  const host = await createUiPluginHost({ root, runtime: fixture.runtime });
  const loaded = await host.load(plugin);
  host.projection.activateSession?.("ses_fixture");
  expect(loaded.panels.map((panel) => panel.id)).toEqual(["main", "chat"]);
  expect(host.loaded()).toHaveLength(1);
  expect(host.projection.getState().sessionID).toBe("ses_fixture");
  expect(host.projection.getState().title).toBe("Fixture");
  expect(await host.executeCommand("example.ping")).toBe("pong");
  await host.executeCommand("runtime.submit", "hello");
  expect(fixture.submissions()).toEqual(["hello"]);
  expect(host.projection.getState().messages.length).toBeGreaterThan(0);
  await host.executeCommand("runtime.chatSubmit", { text: "navi" });
  expect(fixture.chat()).toEqual(["navi"]);
  expect(host.projection.getState().navi.messages).toHaveLength(1);
  await host.unload("example.web");
  expect(host.loaded()).toHaveLength(0);
  expect(root.textContent).toBe("");
  expect(seen).toEqual([
    "mount",
    "session.created",
    "session.ready",
    "turn.submitted",
    "content.done",
    "navi.chat.message.added",
    "dispose",
  ]);
  await host.close();
});

test("loading the same UI plugin twice is rejected", async () => {
  const root = fakeRoot();
  const fixture = runtimeFixture();
  const plugin = defineUiPlugin({
    id: "example.web",
    name: "Example",
    version: "1.0.0",
    mount() {},
  });
  const host = await createUiPluginHost({ root, runtime: fixture.runtime });
  await host.load(plugin);
  await expect(host.load(plugin)).rejects.toThrow(
    "ui plugin already loaded: example.web",
  );
  await expect(host.executeCommand("missing")).rejects.toThrow(
    "command unavailable: missing",
  );
  await host.close();
});

test("the host does not paint business panels itself", async () => {
  const root = fakeRoot();
  const fixture = runtimeFixture();
  const host = await createUiPluginHost({ root, runtime: fixture.runtime });
  expect(root.textContent).toBe("");
  expect(root.innerHTML).toBe("");
  await host.close();
});

test("unloading stops event delivery and a closed host refuses new plugins", async () => {
  const root = fakeRoot();
  const fixture = runtimeFixture();
  const seen: string[] = [];
  const plugin = defineUiPlugin({
    id: "example.web",
    name: "Example",
    version: "1.0.0",
    mount(ctx) {
      const off = ctx.events.subscribe((event) => seen.push(event.type));
      return { dispose: off };
    },
  });
  const host = await createUiPluginHost({ root, runtime: fixture.runtime });
  await host.load(plugin);
  await host.unload("example.web");
  fixture.emit({
    type: "turn.started",
    id: "t-late",
  });
  expect(seen).toEqual(["session.created", "session.ready"]);
  await host.close();
  await expect(
    host.load(
      defineUiPlugin({
        id: "late",
        name: "Late",
        version: "1.0.0",
        mount() {},
      }),
    ),
  ).rejects.toThrow("ui plugin host is closed");
});

test("background session events stay cached across A to B to A activation", async () => {
  const fixture = runtimeFixture();
  const host = await createUiPluginHost({
    root: fakeRoot(),
    runtime: fixture.runtime,
  });
  await host.load(
    defineUiPlugin({ id: "cache", name: "Cache", version: "1", mount() {} }),
  );
  fixture.emit({
    type: "session.created",
    sessionID: "ses_a" as never,
    title: "A",
  });
  fixture.emit({
    type: "turn.submitted",
    id: "a1",
    text: "first",
    byteLength: 5,
    lineCount: 1,
    sha256: "x",
    sessionID: "ses_a" as never,
  });
  host.projection.activateSession?.("ses_b");
  fixture.emit({
    type: "content.delta",
    id: "a1",
    text: "background",
    sessionID: "ses_a" as never,
  });
  fixture.emit({
    type: "session.created",
    sessionID: "ses_b" as never,
    title: "B",
  });
  fixture.emit({
    type: "turn.submitted",
    id: "b1",
    text: "other",
    byteLength: 5,
    lineCount: 1,
    sha256: "x",
    sessionID: "ses_b" as never,
  });
  host.projection.activateSession?.("ses_a");
  expect(
    host.projection
      .getState()
      .messages.map((message) => message.text + message.pendingText),
  ).toContain("background");
  expect(
    host.projection.getState().messages.map((message) => message.text),
  ).not.toContain("other");
  await host.close();
});

test("workspace keys isolate identical session IDs", async () => {
  const fixture = runtimeFixture();
  const host = await createUiPluginHost({
    root: fakeRoot(),
    runtime: fixture.runtime,
  });
  await host.load(
    defineUiPlugin({
      id: "workspace-cache",
      name: "Workspace cache",
      version: "1",
      mount() {},
    }),
  );
  fixture.emit({
    type: "turn.submitted",
    id: "one",
    text: "workspace one",
    byteLength: 13,
    lineCount: 1,
    sha256: "x",
    sessionID: "ses_shared" as never,
    workspaceID: "one",
  });
  fixture.emit({
    type: "turn.submitted",
    id: "two",
    text: "workspace two",
    byteLength: 13,
    lineCount: 1,
    sha256: "x",
    sessionID: "ses_shared" as never,
    workspaceID: "two",
  });
  host.projection.activateSession?.("ses_shared", "one");
  expect(
    host.projection.getState().messages.map((message) => message.text),
  ).toContain("workspace one");
  expect(
    host.projection.getState().messages.map((message) => message.text),
  ).not.toContain("workspace two");
  host.projection.activateSession?.("ses_shared", "two");
  expect(
    host.projection.getState().messages.map((message) => message.text),
  ).toContain("workspace two");
  await host.close();
});
