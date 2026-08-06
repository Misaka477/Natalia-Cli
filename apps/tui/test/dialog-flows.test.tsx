import { expect, test } from "bun:test";
import { createSignal, onMount } from "solid-js";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { configV2Schema, type NataliaFlowDocument } from "@natalia/contracts";
import type { FlowOverview, FlowRow } from "@natalia/client";
import {
  buildFlowDetail,
  buildFlowOptions,
  conditionEvaluatorOptions,
  DialogFlows,
  flowConditionsFromLines,
  flowDraftProblems,
  newFlowDraft,
  parsePathScopeInput,
  reorderFlowModule,
  flowStageSummary,
  flowSummary,
  soleConditionEvaluator,
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

test("condition evaluator choices do not repeat identical provider and model labels", () => {
  expect(
    conditionEvaluatorOptions([
      {
        modelID: "deepseek-v4-flash",
        providerID: "deepseek-v4-flash",
        model: "deepseek-v4-flash",
      },
      {
        modelID: "reviewer",
        providerID: "deepseek",
        model: "deepseek-v4-flash",
      },
    ]),
  ).toEqual([
    {
      title: "deepseek-v4-flash",
      value: "deepseek-v4-flash",
      description: undefined,
      footer: undefined,
    },
    {
      title: "reviewer",
      value: "reviewer",
      description: "deepseek-v4-flash",
      footer: "deepseek",
    },
  ]);
});

test("a sole condition evaluator is selected without showing a chooser", () => {
  const model = {
    modelID: "deepseek-v4-flash",
    providerID: "deepseek-v4-flash",
    model: "deepseek-v4-flash",
  };
  expect(soleConditionEvaluator([])).toBeUndefined();
  expect(soleConditionEvaluator([model])).toBe(model);
  expect(
    soleConditionEvaluator([model, { ...model, modelID: "reviewer" }]),
  ).toBeUndefined();
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

test("flow drafts preserve condition IDs and module identity while editing", () => {
  const draft = newFlowDraft();
  const first = draft.modules[0]!;
  const withConditions: NataliaFlowDocument = {
    ...draft,
    displayName: "Review",
    modules: [
      {
        ...first,
        minimumConditions: [
          { id: "condition_existing", text: "Read every changed file" },
        ],
      },
      {
        id: "module_report",
        type: "report_output",
        displayName: "Report",
        enabled: true,
        instructions: "",
        minimumConditions: [],
        idealConditions: [],
      },
    ],
  };
  expect(
    flowConditionsFromLines(
      withConditions.modules[0]!.minimumConditions,
      "Read every changed file\nRecord findings",
    ),
  ).toMatchObject([
    { id: "condition_existing", text: "Read every changed file" },
    { text: "Record findings" },
  ]);
  expect(
    reorderFlowModule(withConditions, 1, true).modules.map(
      (module) => module.id,
    ),
  ).toEqual(["module_report", first.id]);
  expect(flowDraftProblems(withConditions)).toEqual([
    "module has no minimum completion condition: Report",
  ]);
});

test("path scope input parses allow and deny globs and rejects garbage", () => {
  expect(
    parsePathScopeInput("allow docs/**\ndeny secrets/**\n\nallow tests/**"),
  ).toEqual({
    allow: ["docs/**", "tests/**"],
    deny: ["secrets/**"],
    rejected: [],
  });
  expect(parsePathScopeInput("docs/**\nallow")).toEqual({
    allow: [],
    deny: [],
    rejected: ["docs/**", "allow"],
  });
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

test("the flow summary opens the runtime contract and explains draft problems", async () => {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const document: NataliaFlowDocument = {
    kind: "natalia-flow",
    version: 1,
    flowID: "flow_attention",
    displayName: "Needs attention",
    modules: [
      {
        id: "write",
        type: "workspace_changes",
        displayName: "Workspace Changes",
        enabled: true,
        instructions: "",
        minimumConditions: [],
        idealConditions: [],
      },
    ],
  };
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogFlows
          overview={{
            flows: [
              flow({
                flowID: document.flowID,
                displayName: document.displayName,
                path: "attention.yaml",
                problems: [
                  "module has no minimum completion condition: Workspace Changes",
                ],
              }),
            ],
            unreadable: [],
          }}
          workspaceRoot="/tmp/natalia-flow-dialog"
          loadFlow={async () => document}
          saveFlow={async () => undefined}
          reload={async () => undefined}
        />
      )),
    );
    return null;
  }
  const renderOnce = async () => {
    await Bun.sleep(20);
    await setup.renderOnce();
  };
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
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    await renderOnce();
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("Unattended execution");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Runtime Contract");
    expect(setup.captureCharFrame()).toContain("Unattended execution");
    expect(setup.captureCharFrame()).toContain("Disallowed or");
    expect(setup.captureCharFrame()).toContain(
      "approval-only actions fail closed",
    );
    expect(setup.captureCharFrame()).toContain(
      "Foreground confirmation stays enforced",
    );
    keys.pressEscape();
    await renderOnce();
    await keys.typeText("Review problems");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Flow Problems");
    expect(setup.captureCharFrame()).toContain(
      "module has no minimum completion condition",
    );
    expect(setup.captureCharFrame()).toContain("Workspace Changes");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});

test("creating a flow keeps a draft until explicit unattended-save confirmation", async () => {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const [current, setCurrent] = createSignal<FlowOverview>({
    flows: [],
    unreadable: [],
  });
  let saved: NataliaFlowDocument | undefined;
  let reloads = 0;
  const notifications: string[] = [];
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogFlows
          overview={current()}
          workspaceRoot="/tmp/natalia-flow-dialog"
          saveFlow={async (document) => {
            saved = structuredClone(document);
          }}
          loadFlow={async () => {
            throw new Error("new flow creation must not load a document");
          }}
          reload={async () => {
            reloads++;
            if (!saved) return;
            setCurrent({
              unreadable: [],
              flows: [
                flow({
                  flowID: saved.flowID,
                  displayName: saved.displayName,
                  path: `${saved.flowID}.yaml`,
                  stages: saved.modules.map((module) => ({
                    moduleID: module.id,
                    moduleType: module.type,
                    displayName: module.displayName,
                    enabled: module.enabled,
                    minimumConditions: module.minimumConditions.length,
                    idealConditions: module.idealConditions.length,
                    hasInstructions: Boolean(module.instructions),
                    interactivePrograms: 0,
                  })),
                  enabledStages: saved.modules.filter(
                    (module) => module.enabled,
                  ).length,
                  usedBy: [],
                  problems: [],
                }),
              ],
            });
          }}
          notify={(outcome) => notifications.push(outcome.message)}
        />
      )),
    );
    return null;
  }
  const renderOnce = async (delay = 20) => {
    await Bun.sleep(delay);
    await setup.renderOnce();
  };
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
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    await renderOnce();
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Create Flow");
    await keys.typeText("Nightly review");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Save flow");
    expect(saved).toBeUndefined();

    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain(
      "Save Flow for Unattended Execution?",
    );
    expect(saved).toBeUndefined();
    keys.pressArrow("down");
    keys.pressEnter();
    await renderOnce(40);

    expect(saved).toMatchObject({
      displayName: "Nightly review",
      modules: [expect.objectContaining({ type: "read_search" })],
    });
    expect(reloads).toBe(1);
    expect(notifications).toContain("Saved Nightly review");
    expect(setup.captureCharFrame()).toContain("Nightly review");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});

test("condition authoring confirms cross-provider decomposition before saving", async () => {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const config = configV2Schema.parse({
    version: 2,
    defaultModel: "execution",
    providers: {
      local: { type: "openai-compatible", apiKey: "local-key" },
      external: { type: "anthropic", apiKey: "external-key" },
    },
    models: {
      execution: { provider: "local", model: "execution-model" },
      evaluator: { provider: "external", model: "evaluator-model" },
    },
  });
  const document: NataliaFlowDocument = {
    kind: "natalia-flow",
    version: 1,
    flowID: "flow_review",
    displayName: "Review",
    modules: [
      {
        id: "module_read",
        type: "read_search",
        displayName: "Read",
        enabled: true,
        instructions: "",
        minimumConditions: [],
        idealConditions: [],
      },
    ],
  };
  const calls: Array<{ modelID: string; objective: string }> = [];
  let saved: NataliaFlowDocument | undefined;
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogFlows
          overview={{ flows: [flow({ usedBy: [] })], unreadable: [] }}
          workspaceRoot="/tmp/natalia-flow-dialog"
          config={config}
          loadFlow={async () => document}
          saveFlow={async (next) => {
            saved = structuredClone(next);
          }}
          decomposeConditions={async (input) => {
            calls.push(input);
            return {
              conditions: [
                { text: "Read every changed file" },
                { text: "Record evidence for each finding" },
              ],
            };
          }}
          reload={async () => undefined}
        />
      )),
    );
    return null;
  }
  const renderOnce = async () => {
    await Bun.sleep(30);
    await setup.renderOnce();
  };
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
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    await renderOnce();
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("Read");
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("Minimum Completion");
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("Read changes and record evidence");
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("evaluator");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain(
      "Send Goal to Another Provider?",
    );
    expect(setup.captureCharFrame()).toContain(
      "Only this completion-goal text",
    );
    expect(calls).toEqual([]);
    keys.pressArrow("down");
    keys.pressEnter();
    await renderOnce();
    expect(calls).toEqual([
      {
        modelID: "evaluator",
        objective: "Read changes and record evidence",
      },
    ]);
    expect(setup.captureCharFrame()).toContain("Confirm Minimum Conditions");
    expect(setup.captureCharFrame()).toContain("Read every changed file");
    expect(saved).toBeUndefined();
    keys.pressArrow("down");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("2 required conditions");
    keys.pressEscape();
    await renderOnce();
    await keys.typeText("Save flow");
    keys.pressEnter();
    await renderOnce();
    keys.pressArrow("down");
    keys.pressEnter();
    await renderOnce();
    expect(saved?.modules[0]?.minimumConditions).toMatchObject([
      { text: "Read every changed file" },
      { text: "Record evidence for each finding" },
    ]);
    expect(
      saved?.modules[0]?.minimumConditions.every((entry) => entry.id),
    ).toBe(true);
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});

test("condition decomposition shows progress while the evaluator is pending", async () => {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const config = configV2Schema.parse({
    version: 2,
    defaultModel: "evaluator",
    providers: {
      local: { type: "openai-compatible", apiKey: "local-key" },
    },
    models: {
      evaluator: { provider: "local", model: "evaluator-model" },
    },
  });
  let resolve!: (value: { conditions: Array<{ text: string }> }) => void;
  const pending = new Promise<{ conditions: Array<{ text: string }> }>(
    (done) => (resolve = done),
  );
  const document: NataliaFlowDocument = {
    kind: "natalia-flow",
    version: 1,
    flowID: "flow_pending",
    displayName: "Pending",
    modules: [
      {
        id: "read",
        type: "read_search",
        displayName: "Read",
        enabled: true,
        instructions: "",
        minimumConditions: [],
        idealConditions: [],
      },
    ],
  };
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogFlows
          overview={{ flows: [flow()], unreadable: [] }}
          workspaceRoot="/tmp/natalia-flow-dialog"
          config={config}
          loadFlow={async () => document}
          saveFlow={async () => undefined}
          decomposeConditions={() => pending}
          reload={async () => undefined}
        />
      )),
    );
    return null;
  }
  const renderOnce = async () => {
    await Bun.sleep(20);
    await setup.renderOnce();
  };
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
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    await renderOnce();
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("Read");
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("Minimum Completion");
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("Read the changed files");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Decomposing Conditions");
    expect(setup.captureCharFrame()).toContain("Waiting for evaluator");
    resolve({ conditions: [{ text: "Read every changed file" }] });
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Confirm Minimum Conditions");
    expect(setup.captureCharFrame()).toContain("Read every changed file");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Read the changed files");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});

test("deleting a flow defaults to keeping it and returns to the refreshed list", async () => {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const [current, setCurrent] = createSignal<FlowOverview>({
    flows: [flow({ usedBy: [] })],
    unreadable: [],
  });
  const deleted: string[] = [];
  const notifications: string[] = [];
  const document: NataliaFlowDocument = {
    kind: "natalia-flow",
    version: 1,
    flowID: "flow_log_triage",
    displayName: "Nightly log triage",
    modules: [
      {
        id: "read_log",
        type: "read_search",
        displayName: "Read the new log content",
        enabled: true,
        instructions: "",
        minimumConditions: [{ id: "c1", text: "Read new content" }],
        idealConditions: [],
      },
    ],
  };
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogFlows
          overview={current()}
          workspaceRoot="/tmp/natalia-flow-dialog"
          loadFlow={async () => document}
          saveFlow={async () => undefined}
          deleteFlow={async (path) => {
            deleted.push(path);
          }}
          reload={async () => {
            setCurrent({ flows: [], unreadable: [] });
          }}
          notify={(outcome) => notifications.push(outcome.message)}
        />
      )),
    );
    return null;
  }
  const renderOnce = async () => {
    await Bun.sleep(20);
    await setup.renderOnce();
  };
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
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    await renderOnce();
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("Delete flow");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Delete Flow Definition?");
    expect(setup.captureCharFrame()).toContain("Only the YAML definition");
    keys.pressEnter();
    await renderOnce();
    expect(deleted).toEqual([]);
    expect(setup.captureCharFrame()).toContain("Save flow");

    await keys.typeText("Delete flow");
    keys.pressEnter();
    await renderOnce();
    keys.pressArrow("down");
    keys.pressEnter();
    await renderOnce();
    expect(deleted).toEqual(["log-triage.yaml"]);
    expect(notifications).toContain("Deleted Nightly log triage");
    expect(setup.captureCharFrame()).toContain("Create flow");
    expect(setup.captureCharFrame()).not.toContain("Nightly log triage");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});

test("Escape returns through flow editor screens before discarding a draft", async () => {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  let saved = false;
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogFlows
          overview={{ flows: [], unreadable: [] }}
          workspaceRoot="/tmp/natalia-flow-dialog"
          loadFlow={async () => {
            throw new Error("not used");
          }}
          saveFlow={async () => {
            saved = true;
          }}
          reload={async () => undefined}
        />
      )),
    );
    return null;
  }
  const renderOnce = async () => {
    await Bun.sleep(20);
    await setup.renderOnce();
  };
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
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    await renderOnce();
    keys.pressEnter();
    await renderOnce();
    await keys.typeText("Discardable flow");
    keys.pressEnter();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Save flow");

    keys.pressEscape();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Discard Flow Edits?");
    keys.pressEscape();
    await renderOnce();
    expect(setup.captureCharFrame()).toContain("Save flow");
    keys.pressEscape();
    await renderOnce();
    keys.pressArrow("down");
    keys.pressEnter();
    await renderOnce();

    expect(saved).toBe(false);
    expect(setup.captureCharFrame()).toContain("Flows");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});

test("a completed load cannot reopen a Flow editor after the list is closed", async () => {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  let resolveLoad: ((flow: NataliaFlowDocument) => void) | undefined;
  const loading = new Promise<NataliaFlowDocument>((resolve) => {
    resolveLoad = resolve;
  });
  let dialogStackLength = -1;
  function Harness() {
    const dialog = useDialog();
    onMount(() => {
      dialog.push(() => (
        <DialogFlows
          overview={{ flows: [flow()], unreadable: [] }}
          workspaceRoot="/tmp/natalia-flow-dialog"
          loadFlow={async () => loading}
          saveFlow={async () => undefined}
          reload={async () => undefined}
        />
      ));
      dialogStackLength = dialog.stack.length;
    });
    return null;
  }
  const renderOnce = async () => {
    await Bun.sleep(20);
    await setup.renderOnce();
  };
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
    const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
    await renderOnce();
    keys.pressEnter();
    await renderOnce();
    keys.pressEscape();
    await renderOnce();
    expect(dialogStackLength).toBe(1);

    resolveLoad!({
      kind: "natalia-flow",
      version: 1,
      flowID: "flow_log_triage",
      displayName: "Nightly log triage",
      modules: [
        {
          id: "read_log",
          type: "read_search",
          displayName: "Read the new log content",
          enabled: true,
          instructions: "",
          minimumConditions: [],
          idealConditions: [],
        },
      ],
    });
    await renderOnce();
    expect(setup.captureCharFrame()).not.toContain("flow_log_triage");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});
