import { expect, test } from "bun:test";
import { createSignal } from "solid-js";
import { render } from "@opentui/solid";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import type { TextareaRenderable } from "@opentui/core";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import {
  PromptAutocomplete,
  workflowRunUnavailableReason,
} from "../src/component/PromptAutocomplete";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

test("slash autocomplete selects an existing flow by keyboard", async () => {
  const setup = await createTestRenderer({ width: 100, height: 20 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const [input, setInput] = createSignal<TextareaRenderable>();
  const [text, setText] = createSignal("");
  try {
    await render(
      () => (
        <KeymapProvider keymap={keymap}>
          <box>
            <textarea
              ref={(value: TextareaRenderable) => {
                setInput(value);
                setTimeout(() => value.focus(), 1);
              }}
              onContentChange={() => setText(input()?.plainText ?? "")}
            />
            <PromptAutocomplete
              input={input}
              text={text}
              workflows={async () => [
                {
                  kind: "task",
                  path: "nightly.yaml",
                  id: "task_nightly",
                  displayName: "Nightly",
                },
                {
                  kind: "flow",
                  path: "cap:review/flow_review.yaml",
                  id: "flow_review",
                  displayName: "Review flow",
                },
              ]}
              attach={() => undefined}
              mentionAgent={() => undefined}
              mentionResource={() => undefined}
            />
          </box>
        </KeymapProvider>
      ),
      setup.renderer,
    );
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    await Bun.sleep(20);
    await keys.typeText("/");
    await Bun.sleep(20);
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("/task");
    expect(setup.captureCharFrame()).toContain("/flow");
    keys.pressArrow("down");
    keys.pressEnter();
    await Bun.sleep(20);
    await setup.renderOnce();
    expect(input()?.plainText).toBe("/flow ");
    expect(setup.captureCharFrame()).toContain("Review flow");
    keys.pressEnter();
    await Bun.sleep(20);
    await setup.renderOnce();
    expect(input()?.plainText).toBe("/flow cap:review/flow_review.yaml");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});

test("capability workflow paths never fall through to the disk subprocess", () => {
  expect(workflowRunUnavailableReason("review.yaml")).toBeUndefined();
  expect(workflowRunUnavailableReason("cap:review/flow_review.yaml")).toContain(
    "not available through this TUI transport",
  );
});
