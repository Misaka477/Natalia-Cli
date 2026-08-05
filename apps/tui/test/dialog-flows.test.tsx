import { expect, test } from "bun:test";
import { createSignal, onMount } from "solid-js";
import { createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { FlowOverview, FlowRow } from "@natalia/client";
import {
  buildFlowDetail,
  buildFlowOptions,
  DialogFlows,
  flowStageSummary,
  flowSummary,
} from "../src/component/DialogFlows";
import { DialogProvider, useDialog } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

function flow(overrides: Partial<FlowRow> = {}): FlowRow {
  return {
    flowID: "flow_log_triage",
    displayName: "Nightly log triage",
    path: "log-triage.yaml",
    stages: [
      {
        moduleID: "read_log",
        moduleType: "read_search",
        displayName: "Read the new log content",
        enabled: true,
        minimumConditions: 1,
        idealConditions: 1,
        hasInstructions: true,
        interactivePrograms: 0,
      },
      {
        moduleID: "report",
        moduleType: "report_output",
        displayName: "File or update the issues",
        enabled: true,
        minimumConditions: 1,
        idealConditions: 0,
        hasInstructions: true,
        interactivePrograms: 0,
      },
    ],
    enabledStages: 2,
    usedBy: ["task_nightly_log_triage"],
    problems: [],
    ...overrides,
  };
}

test("a flow row shows how many stages run and who runs it", () => {
  expect(flowSummary(flow())).toBe("2/2 stages · used by 1 task");
  // A flow nothing references is a real finding, not an empty field.
  expect(flowSummary(flow({ usedBy: [] }))).toContain("used by no task");
  expect(flowSummary(flow({ enabledStages: 1 }))).toContain("1/2 stages");
});

test("a stage row exposes what the evaluator and the policy will use", () => {
  expect(flowStageSummary(flow().stages[0]!)).toBe(
    "read_search · 1 required · 1 ideal",
  );
  expect(
    flowStageSummary({
      ...flow().stages[0]!,
      hasInstructions: false,
      idealConditions: 0,
      commandRules: { mode: "whitelist", commands: 2 },
      interactivePrograms: 1,
    }),
  ).toBe(
    "read_search · 1 required · no instructions · commands whitelist (2) · 1 interactive programs",
  );
});

test("a flow that can never complete is grouped apart and explains itself", () => {
  const options = buildFlowOptions({
    flows: [
      flow(),
      flow({
        flowID: "flow_broken",
        displayName: "Broken",
        path: "broken.yaml",
        problems: ["no stage is enabled, so the flow can never complete"],
      }),
    ],
    unreadable: [{ path: "torn.yaml", reason: "flowID: Required" }],
  });
  expect(options.map((option) => [option.category, option.title])).toEqual([
    ["Ready", "Nightly log triage"],
    ["Needs attention", "Broken"],
    ["Unreadable", "torn.yaml"],
  ]);
  expect(options[1]!.footer).toBe("1 problem");
  expect(options[2]!.disabled).toBe(true);
});

test("the detail view lists stages in execution order and separates disabled ones", () => {
  const detail = buildFlowDetail(
    flow({
      stages: [
        { ...flow().stages[0]! },
        { ...flow().stages[1]!, enabled: false },
      ],
      enabledStages: 1,
      problems: ["stage has no minimum completion condition: report"],
    }),
  );
  expect(detail.map((entry) => [entry.category, entry.title])).toEqual([
    ["Stages", "1. Read the new log content"],
    ["Disabled stages", "2. File or update the issues"],
    ["Definition", "Used by: task_nightly_log_triage"],
    [
      "Needs attention",
      "Problem: stage has no minimum completion condition: report",
    ],
  ]);
});

test("the flows dialog renders the flows and their stage counts", async () => {
  const overview: FlowOverview = { flows: [flow()], unreadable: [] };
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const [current] = createSignal(overview);
  function Harness() {
    const dialog = useDialog();
    onMount(() => dialog.push(() => <DialogFlows overview={current()} />));
    return null;
  }
  try {
    await render(
      () => (
        <KeymapProvider keymap={keymap}>
          <DialogProvider>
            <Harness />
          </DialogProvider>
        </KeymapProvider>
      ),
      setup.renderer,
    );
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Flows");
    expect(frame).toContain("Nightly log triage");
    expect(frame).toContain("2/2 stages");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});
