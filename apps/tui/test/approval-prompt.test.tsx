import { expect, test } from "bun:test";
import { createSignal } from "solid-js";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { RuntimeClient } from "@natalia/contracts";
import type { ModalRequest } from "@natalia/ui-model";
import {
  isLiveChatPlanApproval,
  PermissionPrompt,
} from "../src/routes/session/permission";
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
  const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
  return { setup, keys, responses, setMounted, disposeKeymap };
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

test("only a live_chat plan approval belongs in Chat", () => {
  const planRequest = {
    ...request,
    keyArguments: ["plan:navi"],
    permissionFamily: { id: "planning" },
  } as Extract<ModalRequest, { kind: "approval" }>;
  expect(
    isLiveChatPlanApproval(planRequest, {
      "plan:navi": { author: "live_chat" },
    }),
  ).toBe(true);
  expect(
    isLiveChatPlanApproval(planRequest, {
      "plan:navi": { author: "main_agent" },
    }),
  ).toBe(false);
  expect(isLiveChatPlanApproval(request)).toBe(false);
});

test("a plan approval keeps the full plan collapsed until d is pressed", async () => {
  const planRequest = {
    ...request,
    title: "Accept Navi's plan",
    preview: "Scan remaining modules",
    detail:
      "Plan plan:navi\nTitle: Scan remaining modules\nObjective: read-only review\nSteps:\n- s1: list gaps",
    permissionFamily: { id: "planning", label: "Planning" },
  } as Extract<ModalRequest, { kind: "approval" }>;
  const { setup, keys, setMounted, disposeKeymap } =
    await mountApproval(planRequest);
  try {
    const collapsed = setup.captureCharFrame();
    expect(collapsed).toContain("Scan remaining modules");
    expect(collapsed).toContain("Alt+d show full plan");
    expect(collapsed).not.toContain("list gaps");
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
