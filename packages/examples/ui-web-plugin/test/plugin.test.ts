import { expect, test } from "bun:test";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { createUiPluginHost } from "@natalia/ui-host";
import { createExampleWebUiPlugin, EXAMPLE_WEB_UI_PLUGIN_ID } from "../src";

function fakeElement(tag: string): HTMLElement {
  const node = {
    tagName: tag.toUpperCase(),
    children: [] as HTMLElement[],
    className: "",
    dataset: {} as Record<string, string>,
    textContent: "",
    innerHTML: "",
    value: "",
    type: "",
    name: "",
    placeholder: "",
    replaceChildren(...next: HTMLElement[]) {
      node.children = next;
      node.innerHTML = next.length ? "mounted" : "";
      node.textContent = next.length ? "mounted" : "";
    },
    append(...next: HTMLElement[]) {
      node.children.push(...next);
      node.innerHTML = "mounted";
      node.textContent = "mounted";
    },
    appendChild(child: HTMLElement) {
      node.children.push(child);
      node.innerHTML = "mounted";
      node.textContent = "mounted";
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  return node as unknown as HTMLElement;
}

function stubDocument() {
  const previous = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tag: string) => fakeElement(tag),
    },
  });
  return () => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previous,
    });
  };
}

function runtimeFixture() {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const runtime = {
    start(next: (event: RuntimeEvent) => void) {
      sink = next;
      next({
        type: "session.created",
        sessionID: "ses_web" as never,
        title: "Web UI",
      });
    },
    async submit() {
      return {
        type: "turn.submitted" as const,
        id: "t1",
        text: "hi",
        byteLength: 2,
        lineCount: 1,
        sha256: "x",
      };
    },
    cancel() {},
  } as unknown as RuntimeClient;
  return { runtime, emit: (event: RuntimeEvent) => sink?.(event) };
}

test("the example web UI plugin contributes Main and Chat panels", async () => {
  const restore = stubDocument();
  try {
    const plugin = createExampleWebUiPlugin();
    expect(plugin.id).toBe(EXAMPLE_WEB_UI_PLUGIN_ID);
    expect(plugin.panels?.map((panel) => panel.id)).toEqual(["main", "chat"]);
    const host = await createUiPluginHost({
      root: fakeElement("div"),
      runtime: runtimeFixture().runtime,
    });
    const loaded = await host.load(plugin);
    expect(loaded.panels.map((panel) => panel.title)).toEqual(["Main", "Chat"]);
    expect(host.loaded()[0]?.plugin.id).toBe(EXAMPLE_WEB_UI_PLUGIN_ID);
    await host.unload(EXAMPLE_WEB_UI_PLUGIN_ID);
    await host.close();
  } finally {
    restore();
  }
});
