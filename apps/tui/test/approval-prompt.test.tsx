import { expect, test } from "bun:test";
import { createSignal } from "solid-js";
import { createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { RuntimeClient } from "@natalia/contracts";
import type { ModalRequest } from "@natalia/ui-model";
import { PermissionPrompt } from "../src/routes/session/permission";
import { PromptRefProvider } from "../src/context/prompt";
import { ToastProvider, ToastRegion } from "../src/context/toast";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

const request = {
  kind: "approval",
  id: "req_1",
  priority: 10,
  sequence: 1,
  title: "Run a shell command",
  preview: "rm -rf build",
} as unknown as Extract<ModalRequest, { kind: "approval" }>;

/**
 * The prompt registers key bindings, so it needs a keymap. The assertions below
 * are about what it offers the user, not about which surface owns the keyboard.
 */
async function mountApproval(
  approvalRequest: Extract<ModalRequest, { kind: "approval" }> = request,
) {
  const setup = await createTestRenderer({ width: 80, height: 24 });
  const responses: unknown[] = [];
  const backend = {
    respondApproval(response: unknown) {
      responses.push(response);
    },
  } as unknown as RuntimeClient;
  const [mounted, setMounted] = createSignal(true);

  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  // Registers the "mode" layer field the prompt's bindings declare.
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ToastProvider>
          <ToastRegion />
          <PromptRefProvider>
            {mounted() ? (
              <PermissionPrompt
                request={approvalRequest}
                backend={backend}
                onExit={() => {}}
              />
            ) : null}
          </PromptRefProvider>
        </ToastProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  return { setup, responses, setMounted, disposeKeymap };
}

test("an approval states that escape does not answer it outright", async () => {
  const { setup, responses, setMounted, disposeKeymap } = await mountApproval();
  try {
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Permission required");
    // The hint has to stay truthful: escape starts a rejection that still needs
    // confirming, because a bare escape may have been aimed at another surface.
    expect(frame).toContain("Esc reject");
    expect(frame).not.toContain("esc reject");
    // Merely presenting the prompt must never answer it.
    expect(responses).toEqual([]);
  } finally {
    setMounted(false);
    disposeKeymap();
    setup.renderer.destroy();
  }
});

test("an approval offers all three explicit decisions", async () => {
  const { setup, responses, setMounted, disposeKeymap } = await mountApproval();
  try {
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Allow once");
    expect(frame).toContain("Allow session");
    expect(frame).toContain("Reject");
    expect(frame).toContain("Enter confirm");
    expect(frame).toContain("┌");
    expect(frame).toContain("└");
    expect(responses).toEqual([]);
  } finally {
    setMounted(false);
    disposeKeymap();
    setup.renderer.destroy();
  }
});

test("an approval labels the session grant with its permission family", async () => {
  const familyRequest = {
    ...request,
    permissionFamily: {
      label: "Filesystem reads",
      description: "Read workspace files.",
      scope: "All filesystem read tools in this session",
      sessionAction: "Allow reads for session",
    },
  };
  const { setup, setMounted, disposeKeymap } = await mountApproval(
    familyRequest as Extract<ModalRequest, { kind: "approval" }>,
  );
  try {
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Allow reads for session");
    expect(frame).toContain("All filesystem read tools in this session");
  } finally {
    setMounted(false);
    disposeKeymap();
    setup.renderer.destroy();
  }
});
