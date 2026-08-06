import type { ConfigV2, NataliaFlowDocument } from "@natalia/contracts";
import {
  decomposeFlowConditions,
  defaultExecutionProviderID,
  deleteFlowDocument,
  effectiveFlowPermissions,
  flowConditionModels,
  loadFlowDocument,
  newFlowID,
  saveFlowDocument,
  type FlowOverview,
  type FlowConditionModel,
  type FlowRow,
  type FlowStageRow,
} from "@natalia/client";
import { createSignal, onCleanup } from "solid-js";
import { useBindings } from "@opentui/keymap/solid";
import {
  previewCommandRuleImport,
  type CommandRuleImport,
} from "../app/permission-command-rules";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";
import { darkTheme } from "../theme/theme";

const MODULE_TYPES = [
  "read_search",
  "terminal",
  "shell_command",
  "workspace_changes",
  "web_fetch",
  "skills",
  "mcp",
  "plugins",
  "subagents",
  "report_output",
] as const;

type FlowModule = NataliaFlowDocument["modules"][number];
type FlowModuleType = FlowModule["type"];
type FlowNotification = { ok: boolean; message: string };

type FlowEditorScreen =
  | { kind: "summary" }
  | { kind: "discard-confirm" }
  | { kind: "save-confirm" }
  | { kind: "delete-confirm" }
  | { kind: "flow-name" }
  | { kind: "add-module" }
  | { kind: "module"; moduleID: string }
  | { kind: "module-type"; moduleID: string }
  | { kind: "module-name"; moduleID: string }
  | { kind: "module-instructions"; moduleID: string }
  | {
      kind: "module-conditions";
      moduleID: string;
      conditions: "minimumConditions" | "idealConditions";
    }
  | {
      kind: "module-condition-model";
      moduleID: string;
      conditions: "minimumConditions" | "idealConditions";
      objective: string;
    }
  | {
      kind: "module-condition-consent";
      moduleID: string;
      conditions: "minimumConditions" | "idealConditions";
      objective: string;
      modelID: string;
    }
  | {
      kind: "module-condition-preview";
      moduleID: string;
      conditions: "minimumConditions" | "idealConditions";
      objective: string;
      modelID: string;
      proposed: string[];
    }
  | { kind: "module-delete"; moduleID: string }
  | { kind: "module-command-rules"; moduleID: string }
  | { kind: "module-command-mode"; moduleID: string }
  | { kind: "module-command-add"; moduleID: string }
  | {
      kind: "module-command-preview";
      moduleID: string;
      preview: CommandRuleImport;
    }
  | { kind: "module-command-delete"; moduleID: string; command: string }
  | { kind: "module-extensions"; moduleID: string }
  | { kind: "module-path-rules"; moduleID: string }
  | {
      kind: "module-path-rules-edit";
      moduleID: string;
      scope: "read" | "write";
    }
  | { kind: "module-interactive"; moduleID: string }
  | { kind: "module-interactive-enable-any"; moduleID: string }
  | { kind: "module-interactive-add"; moduleID: string }
  | {
      kind: "module-interactive-preview";
      moduleID: string;
      preview: CommandRuleImport;
    }
  | { kind: "module-interactive-delete"; moduleID: string; command: string }
  | { kind: "permission-preview-profile" }
  | { kind: "permission-preview"; profileName: string }
  | { kind: "runtime-contract" }
  | { kind: "problems" };

/**
 * Flows are work definitions, not tool settings, so they get their own surface.
 * A flow no task can complete stays visible and says why.
 */
export function buildFlowOptions(
  overview: FlowOverview,
  options: { canCreate?: boolean } = {},
): DialogSelectOption<string>[] {
  return [
    ...overview.flows.map((flow) => ({
      title: flow.displayName,
      value: flow.path,
      category: flow.problems.length ? "Needs attention" : "Ready",
      description: flowSummary(flow),
      footer: flow.problems.length
        ? `${flow.problems.length} problem${flow.problems.length > 1 ? "s" : ""}`
        : undefined,
    })),
    ...overview.unreadable.map((broken) => ({
      title: broken.path,
      value: broken.path,
      category: "Unreadable",
      description: broken.reason.replace(/\s+/gu, " ").trim(),
      disabled: true,
    })),
    ...(options.canCreate
      ? [
          {
            title: "Create flow",
            value: "$create",
            category: "Action",
            description: "Define a new staged agent pipeline",
          },
        ]
      : []),
  ];
}

export function flowSummary(flow: FlowRow) {
  const stages = `${flow.enabledStages}/${flow.stages.length} stages`;
  return [
    stages,
    flow.usedBy.length
      ? `used by ${flow.usedBy.length} task${flow.usedBy.length > 1 ? "s" : ""}`
      : "used by no task",
  ].join(" · ");
}

export function conditionEvaluatorOptions(models: FlowConditionModel[]) {
  return models.map((model) => ({
    title: model.modelID,
    value: model.modelID,
    description: model.model === model.modelID ? undefined : model.model,
    footer: model.providerID === model.modelID ? undefined : model.providerID,
  }));
}

export function soleConditionEvaluator(models: FlowConditionModel[]) {
  return models.length === 1 ? models[0] : undefined;
}

/** One row per stage, in execution order, plus the reasons it cannot run. */
export function buildFlowDetail(flow: FlowRow): DialogSelectOption<string>[] {
  return [
    ...flow.stages.map((stage, index) => ({
      title: `${index + 1}. ${stage.displayName}`,
      value: stage.moduleID,
      category: stage.enabled ? "Stages" : "Disabled stages",
      description: flowStageSummary(stage),
    })),
    ...(flow.usedBy.length
      ? [
          {
            title: `Used by: ${flow.usedBy.join(", ")}`,
            value: "usedBy",
            category: "Definition",
          },
        ]
      : []),
    ...flow.problems.map((problem) => ({
      title: `Problem: ${problem}`,
      value: "problem",
      category: "Needs attention",
    })),
  ];
}

export function flowStageSummary(stage: FlowStageRow) {
  return [
    stage.moduleType,
    `${stage.minimumConditions} required`,
    ...(stage.idealConditions ? [`${stage.idealConditions} ideal`] : []),
    ...(stage.hasInstructions ? [] : ["no instructions"]),
    ...(stage.commandRules
      ? [`commands ${stage.commandRules.mode} (${stage.commandRules.commands})`]
      : []),
    ...(stage.interactivePrograms
      ? [
          stage.interactivePrograms === "any"
            ? "any interactive program"
            : `${stage.interactivePrograms} interactive programs`,
        ]
      : []),
  ].join(" · ");
}

/** Builds a new valid draft without writing a file until Save flow is selected. */
export function newFlowDraft(): NataliaFlowDocument {
  const flowID = newFlowID();
  return {
    kind: "natalia-flow",
    version: 1,
    flowID,
    displayName: "",
    modules: [newModule("read_search", "Read and search")],
  };
}

/** Preserves matching condition IDs so evidence remains meaningful after edits. */
export function flowConditionsFromLines(
  existing: FlowModule["minimumConditions"],
  value: string,
): FlowModule["minimumConditions"] {
  const reusable = new Map<string, string[]>();
  for (const condition of existing) {
    const ids = reusable.get(condition.text) ?? [];
    ids.push(condition.id);
    reusable.set(condition.text, ids);
  }
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({
      id:
        reusable.get(text)?.shift() ??
        `condition_${crypto.randomUUID().replace(/-/gu, "")}`,
      text,
    }));
}

export function DialogFlows(props: {
  overview: FlowOverview;
  workspaceRoot?: string;
  config?: ConfigV2;
  reload?: () => Promise<void>;
  loadFlow?: (path: string) => Promise<NataliaFlowDocument>;
  saveFlow?: (document: NataliaFlowDocument, path: string) => Promise<void>;
  deleteFlow?: (path: string) => Promise<void>;
  decomposeConditions?: (input: {
    modelID: string;
    objective: string;
  }) => Promise<{ conditions: Array<{ text: string }> }>;
  notify?: (outcome: FlowNotification) => void;
}) {
  const dialog = useDialog();
  let active = true;
  let loadingPath: string | undefined;
  onCleanup(() => {
    active = false;
  });
  const canEdit = Boolean(
    props.reload && (props.workspaceRoot || (props.loadFlow && props.saveFlow)),
  );
  const load =
    props.loadFlow ??
    (async (path: string) =>
      loadFlowDocument({ workspaceRoot: props.workspaceRoot!, path }));
  const save =
    props.saveFlow ??
    (async (document: NataliaFlowDocument, path: string) =>
      saveFlowDocument({
        workspaceRoot: props.workspaceRoot!,
        path,
        document,
      }).then(() => undefined));
  const remove =
    props.deleteFlow ??
    (async (path: string) =>
      deleteFlowDocument({ workspaceRoot: props.workspaceRoot!, path }));

  function openEditor(
    path: string,
    draft: NataliaFlowDocument,
    screen?: FlowEditorScreen,
    existing = true,
  ) {
    if (!active) return;
    dialog.push(() => (
      <FlowEditor
        draft={draft}
        path={path}
        config={props.config}
        save={save}
        reload={props.reload!}
        notify={props.notify}
        screen={screen}
        deleteFlow={remove}
        canDelete={existing && Boolean(props.workspaceRoot || props.deleteFlow)}
        decomposeConditions={
          props.decomposeConditions ??
          ((input) =>
            decomposeFlowConditions({ ...input, config: props.config! }))
        }
      />
    ));
  }

  return (
    <DialogSelect
      title="Flows"
      placeholder="Search flows"
      options={buildFlowOptions(props.overview, { canCreate: canEdit })}
      emptyView={<text>No flow documents under .natalia/flows.</text>}
      onSelect={(option) => {
        if (option.value === "$create") {
          const draft = newFlowDraft();
          openEditor(
            `${draft.flowID}.yaml`,
            draft,
            { kind: "flow-name" },
            false,
          );
          return;
        }
        const row = props.overview.flows.find(
          (entry) => entry.path === option.value,
        );
        if (!row) return;
        if (!canEdit) {
          dialog.push(() => (
            <DialogSelect
              title={`${row.displayName} · ${row.flowID}`}
              options={buildFlowDetail(row)}
              skipFilter
              onSelect={() => dialog.pop()}
            />
          ));
          return;
        }
        if (loadingPath) return;
        loadingPath = row.path;
        void load(row.path)
          .then((flow) => {
            if (active) openEditor(row.path, flow);
          })
          .catch((error) => {
            if (!active) return;
            props.notify?.({
              ok: false,
              message: error instanceof Error ? error.message : String(error),
            });
          })
          .finally(() => {
            if (active && loadingPath === row.path) loadingPath = undefined;
          });
      }}
    />
  );
}

function FlowEditor(props: {
  draft: NataliaFlowDocument;
  path: string;
  config?: ConfigV2;
  save: (document: NataliaFlowDocument, path: string) => Promise<void>;
  reload: () => Promise<void>;
  deleteFlow: (path: string) => Promise<void>;
  canDelete: boolean;
  decomposeConditions: (input: {
    modelID: string;
    objective: string;
  }) => Promise<{ conditions: Array<{ text: string }> }>;
  notify?: (outcome: FlowNotification) => void;
  screen?: FlowEditorScreen;
}) {
  const dialog = useDialog();
  const screen = props.screen ?? { kind: "summary" as const };
  const [saving, setSaving] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  let active = true;
  onCleanup(() => {
    active = false;
  });
  const advance = (
    draft: NataliaFlowDocument,
    next: FlowEditorScreen = { kind: "summary" },
  ) => {
    if (!active) return;
    dialog.pop();
    dialog.push(() => <FlowEditor {...props} draft={draft} screen={next} />);
  };
  const fail = (error: unknown) =>
    active &&
    props.notify?.({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });

  async function saveFlow() {
    if (saving()) return;
    setSaving(true);
    try {
      await props.save(props.draft, props.path);
      try {
        await props.reload();
      } catch (error) {
        props.notify?.({
          ok: true,
          message: `Saved ${props.draft.displayName}`,
        });
        if (active) {
          props.notify?.({
            ok: false,
            message: `Flow was saved, but the list could not refresh: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
          dialog.pop();
        }
        return;
      }
      props.notify?.({ ok: true, message: `Saved ${props.draft.displayName}` });
      if (active) dialog.pop();
    } catch (error) {
      if (active) fail(error);
    } finally {
      if (active) setSaving(false);
    }
  }

  async function deleteFlow() {
    if (deleting()) return;
    setDeleting(true);
    try {
      await props.deleteFlow(props.path);
      await props.reload();
      props.notify?.({
        ok: true,
        message: `Deleted ${props.draft.displayName}`,
      });
      if (active) dialog.pop();
    } catch (error) {
      if (active) fail(error);
    } finally {
      if (active) setDeleting(false);
    }
  }

  function goBack() {
    if (!active || saving() || deleting()) return;
    switch (screen.kind) {
      case "summary":
        advance(props.draft, { kind: "discard-confirm" });
        return;
      case "discard-confirm":
      case "save-confirm":
      case "delete-confirm":
        advance(props.draft);
        return;
      case "flow-name":
        if (!props.draft.displayName) dialog.pop();
        else advance(props.draft);
        return;
      case "add-module":
      case "permission-preview-profile":
      case "runtime-contract":
      case "problems":
        advance(props.draft);
        return;
      case "permission-preview":
        advance(props.draft, { kind: "permission-preview-profile" });
        return;
      case "module":
        advance(props.draft);
        return;
      case "module-type":
      case "module-name":
      case "module-instructions":
      case "module-conditions":
      case "module-delete":
        advance(props.draft, { kind: "module", moduleID: screen.moduleID });
        return;
      case "module-condition-model":
        advance(props.draft, {
          kind: "module-conditions",
          moduleID: screen.moduleID,
          conditions: screen.conditions,
        });
        return;
      case "module-condition-consent":
      case "module-condition-preview":
        advance(props.draft, {
          kind: "module-condition-model",
          moduleID: screen.moduleID,
          conditions: screen.conditions,
          objective: screen.objective,
        });
        return;
      case "module-command-rules":
      case "module-extensions":
        advance(props.draft, { kind: "module", moduleID: screen.moduleID });
        return;
      case "module-path-rules":
        advance(props.draft, { kind: "module", moduleID: screen.moduleID });
        return;
      case "module-path-rules-edit":
        advance(props.draft, {
          kind: "module-path-rules",
          moduleID: screen.moduleID,
        });
        return;
      case "module-command-mode":
      case "module-command-add":
      case "module-command-preview":
      case "module-command-delete":
        advance(props.draft, {
          kind: "module-command-rules",
          moduleID: screen.moduleID,
        });
        return;
      case "module-interactive":
        advance(props.draft, { kind: "module", moduleID: screen.moduleID });
        return;
      case "module-interactive-enable-any":
      case "module-interactive-add":
      case "module-interactive-preview":
      case "module-interactive-delete":
        advance(props.draft, {
          kind: "module-interactive",
          moduleID: screen.moduleID,
        });
    }
  }

  useBindings(() => ({
    mode: "modal",
    priority: 4,
    bindings: [
      {
        key: "escape",
        desc: "Back in flow editor",
        group: "Dialog",
        cmd: goBack,
      },
      {
        key: "ctrl+c",
        desc: "Back in flow editor",
        group: "Dialog",
        cmd: goBack,
      },
    ],
  }));

  if (screen.kind === "discard-confirm")
    return (
      <DialogSelect
        title="Discard Flow Edits?"
        options={[
          {
            title: "Keep editing",
            value: "$cancel",
            category: "Action",
          },
          {
            title: "Discard unsaved edits",
            value: "$confirm",
            category: "High impact",
            description: "The YAML definition has not been changed.",
          },
        ]}
        onSelect={(option) => {
          if (option.value === "$confirm") dialog.pop();
          else advance(props.draft);
        }}
      />
    );

  if (screen.kind === "save-confirm")
    return (
      <DialogSelect
        title="Save Flow for Unattended Execution?"
        locked={saving()}
        options={[
          {
            title: "Keep editing",
            value: "$cancel",
            category: "Action",
          },
          {
            title: flowDraftProblems(props.draft).length
              ? "Save flow (needs attention)"
              : "Save flow",
            value: "$confirm",
            category: "Action",
            description:
              "Unattended tasks using this flow will not wait for approval. Runtime policy still enforces profile and module boundaries.",
          },
          ...flowDraftProblems(props.draft).map((problem) => ({
            title: `Problem: ${problem}`,
            value: `problem:${problem}`,
            category: "Needs attention",
            description:
              "The YAML is valid, but unattended tasks using this flow will block until this is fixed.",
            readonly: true,
          })),
        ]}
        onSelect={(option) => {
          if (option.value === "$confirm") void saveFlow();
          else advance(props.draft);
        }}
      />
    );

  if (screen.kind === "delete-confirm")
    return (
      <DialogSelect
        title="Delete Flow Definition?"
        locked={deleting()}
        options={[
          {
            title: "Keep flow",
            value: "$cancel",
            category: "Action",
          },
          {
            title: "Delete flow definition",
            value: "$confirm",
            category: "High impact",
            description:
              "Only the YAML definition is removed. Tasks, execution history, waterlines, and alerts remain.",
          },
        ]}
        onSelect={(option) => {
          if (option.value === "$confirm") void deleteFlow();
          else advance(props.draft);
        }}
      />
    );

  if (screen.kind === "flow-name")
    return (
      <DialogPrompt
        title={props.draft.displayName ? "Flow Name" : "Create Flow"}
        description={() => (
          <text>
            Unattended execution will not wait for approval. Runtime policy
            still enforces profile and module boundaries.
          </text>
        )}
        value={props.draft.displayName}
        placeholder="Nightly log triage"
        validate={(value) =>
          value.trim() ? undefined : "A flow name is required"
        }
        onConfirm={(value) =>
          advance({ ...props.draft, displayName: value.trim() })
        }
      />
    );

  if (screen.kind === "add-module")
    return (
      <DialogSelect
        title="Add Flow Module"
        options={MODULE_TYPES.map((type) => ({
          title: moduleTypeTitle(type),
          value: type,
          description: moduleTypeDescription(type),
        }))}
        onSelect={(option) =>
          advance({
            ...props.draft,
            modules: [
              ...props.draft.modules,
              newModule(
                option.value as FlowModuleType,
                moduleTypeTitle(option.value),
              ),
            ],
          })
        }
      />
    );

  if (screen.kind === "permission-preview-profile") {
    const profiles = Object.entries(props.config?.permissionProfiles ?? {});
    return (
      <DialogSelect
        title="Preview Flow Permissions"
        options={[
          {
            title: "Back to flow",
            value: "$back",
            category: "Action",
          },
          ...profiles.map(([name, profile]) => ({
            title: name,
            value: name,
            category: "Permission Profiles",
            description: profile.description || `approval: ${profile.approval}`,
          })),
        ]}
        emptyView={<text>No permission profiles are configured.</text>}
        onSelect={(option) => {
          if (option.value === "$back") advance(props.draft);
          else
            advance(props.draft, {
              kind: "permission-preview",
              profileName: option.value,
            });
        }}
      />
    );
  }

  if (screen.kind === "permission-preview") {
    const profile = props.config?.permissionProfiles[screen.profileName];
    if (!profile)
      return (
        <DialogSelect
          title="Preview Flow Permissions"
          options={[
            {
              title: "Back to flow",
              value: "$back",
              category: "Action",
              description: "The selected permission profile no longer exists.",
            },
          ]}
          onSelect={() => advance(props.draft)}
        />
      );
    const preview = effectiveFlowPermissions({ profile, flow: props.draft });
    return (
      <DialogSelect
        title={`Permissions · ${screen.profileName}`}
        options={[
          {
            title: "Back to flow",
            value: "$back",
            category: "Action",
          },
          ...preview.modules.flatMap((module, index) => [
            {
              title: `${index + 1}. ${module.displayName}`,
              value: `module:${module.moduleID}`,
              category: module.blocked ? "Blocked" : "Effective permissions",
              description: module.blocked ?? module.moduleType,
              readonly: true,
            },
            {
              title: `Allowed: ${module.tools.allowed.join(", ") || "none"}`,
              value: `allowed:${module.moduleID}`,
              category: "Effective permissions",
              readonly: true,
            },
            ...(module.tools.denied.length
              ? [
                  {
                    title: `Denied: ${module.tools.denied.join(", ")}`,
                    value: `denied:${module.moduleID}`,
                    category: "Effective permissions",
                    readonly: true,
                  },
                ]
              : []),
            ...(module.commandRules.profile
              ? [
                  {
                    title: `Profile commands (${module.commandRules.profile.mode}): ${module.commandRules.profile.commands.join(", ") || "none"}`,
                    value: `profile-commands:${module.moduleID}`,
                    category: "Effective permissions",
                    readonly: true,
                  },
                ]
              : []),
            ...(module.commandRules.module
              ? [
                  {
                    title: `Module commands (${module.commandRules.module.mode}): ${module.commandRules.module.commands.join(", ") || "none"}`,
                    value: `module-commands:${module.moduleID}`,
                    category: "Effective permissions",
                    readonly: true,
                  },
                ]
              : []),
            {
              title: `Extensions: skills=${module.extensions.skills ? "on" : "off"}, mcp=${module.extensions.mcp ? "on" : "off"}, plugins=${module.extensions.plugins ? "on" : "off"}`,
              value: `extensions:${module.moduleID}`,
              category: "Effective permissions",
              readonly: true,
            },
            ...(module.interactivePrograms === "any"
              ? [
                  {
                    title: "Interactive programs: any",
                    value: `interactive:${module.moduleID}`,
                    category: "Effective permissions",
                    readonly: true,
                  },
                ]
              : module.interactivePrograms.length
                ? [
                    {
                      title: `Interactive programs: ${module.interactivePrograms.join(", ")}`,
                      value: `interactive:${module.moduleID}`,
                      category: "Effective permissions",
                      readonly: true,
                    },
                  ]
                : []),
          ]),
        ]}
        onSelect={(option) => {
          if (option.value === "$back") advance(props.draft);
        }}
      />
    );
  }

  if (screen.kind === "runtime-contract") return <FlowRuntimeContractDetail />;

  if (screen.kind === "problems") {
    return <FlowProblemDetail draft={props.draft} />;
  }

  if (screen.kind !== "summary") {
    const module = props.draft.modules.find(
      (item) => "moduleID" in screen && item.id === screen.moduleID,
    );
    if (!module) return <MissingModule draft={props.draft} advance={advance} />;
    const update = (change: (item: FlowModule) => FlowModule) =>
      updateFlowModule(props.draft, module.id, change);
    const returnToModule = (draft: NataliaFlowDocument) =>
      advance(draft, { kind: "module", moduleID: module.id });
    const returnToCommandRules = (draft: NataliaFlowDocument) =>
      advance(draft, { kind: "module-command-rules", moduleID: module.id });
    const returnToInteractive = (draft: NataliaFlowDocument) =>
      advance(draft, { kind: "module-interactive", moduleID: module.id });
    const returnToPathRules = (draft: NataliaFlowDocument) =>
      advance(draft, { kind: "module-path-rules", moduleID: module.id });
    return (
      <FlowModuleEditor
        draft={props.draft}
        module={module}
        screen={screen}
        advance={advance}
        fail={fail}
        config={props.config}
        decomposeConditions={props.decomposeConditions}
        update={update}
        returnToModule={returnToModule}
        returnToCommandRules={returnToCommandRules}
        returnToInteractive={returnToInteractive}
        returnToPathRules={returnToPathRules}
      />
    );
  }

  return (
    <DialogSelect
      title={`${props.draft.displayName} · ${props.draft.flowID}`}
      options={[
        {
          title: "Save flow",
          value: "$save",
          category: "Action",
          description: "Validate and atomically write the YAML definition",
        },
        ...(props.config
          ? [
              {
                title: "Preview permissions",
                value: "$preview",
                category: "Action",
                description:
                  "See profile/module boundaries; task-only issue and data-source tools are not included",
              },
            ]
          : []),
        ...(props.canDelete
          ? [
              {
                title: "Delete flow",
                value: "$delete",
                category: "High impact",
                description:
                  "Blocked while any task references this flow definition",
              },
            ]
          : []),
        ...(flowDraftProblems(props.draft).length
          ? [
              {
                title: `Review problems (${flowDraftProblems(props.draft).length})`,
                value: "$problems",
                category: "Needs attention",
                description: flowDraftProblems(props.draft)[0],
                footer: "Open for details",
              },
            ]
          : []),
        {
          title: "Unattended execution",
          value: "$notice",
          category: "Runtime contract",
          description: "Task runs will not wait for approval",
        },
        {
          title: `Flow Name: ${props.draft.displayName}`,
          value: "$name",
          category: "Definition",
        },
        ...props.draft.modules.map((module, index) => ({
          title: `${index + 1}. ${module.displayName}`,
          value: module.id,
          category: module.enabled ? "Modules" : "Disabled modules",
          description: `${module.type} · ${module.minimumConditions.length} required`,
        })),
        {
          title: "+ Add module",
          value: "$add",
          category: "Action",
          description: "Append a capability stage",
        },
      ]}
      onSelect={(option) => {
        if (option.value === "$save")
          advance(props.draft, { kind: "save-confirm" });
        else if (option.value === "$preview")
          advance(props.draft, { kind: "permission-preview-profile" });
        else if (option.value === "$name")
          advance(props.draft, { kind: "flow-name" });
        else if (option.value === "$delete")
          advance(props.draft, { kind: "delete-confirm" });
        else if (option.value === "$problems")
          advance(props.draft, { kind: "problems" });
        else if (option.value === "$notice")
          advance(props.draft, { kind: "runtime-contract" });
        else if (option.value === "$add")
          advance(props.draft, { kind: "add-module" });
        else if (!option.value.startsWith("$"))
          advance(props.draft, { kind: "module", moduleID: option.value });
      }}
    />
  );
}

function FlowProblemDetail(props: { draft: NataliaFlowDocument }) {
  const dialog = useDialog();
  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={darkTheme.text}>Flow Problems</text>
        <text fg={darkTheme.muted} onMouseUp={() => dialog.pop()}>
          esc
        </text>
      </box>
      <text fg={darkTheme.muted} wrapMode="word">
        {props.draft.displayName}
      </text>
      <text fg={darkTheme.muted} wrapMode="word">
        The YAML is valid, but unattended tasks using this flow will block until
        these problems are fixed.
      </text>
      {flowDraftProblems(props.draft).map((problem, index) => (
        <text fg={darkTheme.danger} wrapMode="word">
          {index + 1}. {problem}
        </text>
      ))}
    </box>
  );
}

function FlowRuntimeContractDetail() {
  const dialog = useDialog();
  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={darkTheme.text}>Runtime Contract</text>
        <text fg={darkTheme.muted} onMouseUp={() => dialog.pop()}>
          esc
        </text>
      </box>
      <text fg={darkTheme.text} wrapMode="word">
        Unattended execution
      </text>
      <text fg={darkTheme.muted} wrapMode="word">
        Task runs do not pause for app approval. Disallowed or approval-only
        actions fail closed.
      </text>
      <text fg={darkTheme.text} wrapMode="word">
        Foreground confirmation stays enforced
      </text>
      <text fg={darkTheme.muted} wrapMode="word">
        OS foreground confirmation cannot be disabled by a flow, task, profile,
        or module.
      </text>
      <text fg={darkTheme.text} wrapMode="word">
        Permission intersections still apply
      </text>
      <text fg={darkTheme.muted} wrapMode="word">
        Global, profile, agent, module, and runtime restrictions are intersected
        before execution.
      </text>
    </box>
  );
}

function MissingModule(props: {
  draft: NataliaFlowDocument;
  advance: (draft: NataliaFlowDocument, screen?: FlowEditorScreen) => void;
}) {
  return (
    <DialogSelect
      title="Flow Module"
      options={[
        {
          title: "Back to flow",
          value: "$back",
          description: "The selected module no longer exists in this draft.",
        },
      ]}
      onSelect={() => props.advance(props.draft)}
    />
  );
}

function FlowModuleEditor(props: ModuleEditorProps) {
  const { update, returnToModule } = props;
  const [decomposing, setDecomposing] = createSignal(false);

  async function decompose(
    screen: Extract<
      FlowEditorScreen,
      { kind: "module-condition-model" | "module-condition-consent" }
    >,
    modelID: string,
  ) {
    if (decomposing()) return;
    setDecomposing(true);
    try {
      const result = await props.decomposeConditions({
        modelID,
        objective: screen.objective,
      });
      props.advance(props.draft, {
        kind: "module-condition-preview",
        moduleID: screen.moduleID,
        conditions: screen.conditions,
        objective: screen.objective,
        modelID,
        proposed: result.conditions.map((condition) => condition.text),
      });
    } catch (error) {
      props.fail(error);
    } finally {
      setDecomposing(false);
    }
  }

  if (props.screen.kind === "module-type")
    return (
      <DialogSelect
        title="Module Type"
        current={props.module.type}
        options={MODULE_TYPES.map((type) => ({
          title: moduleTypeTitle(type),
          value: type,
          description: moduleTypeDescription(type),
        }))}
        onSelect={(option) =>
          returnToModule(
            update((module) => ({
              ...module,
              type: option.value as FlowModuleType,
            })),
          )
        }
      />
    );

  if (props.screen.kind === "module-name")
    return (
      <DialogPrompt
        title="Module Name"
        value={props.module.displayName}
        validate={(value) =>
          value.trim() ? undefined : "Name cannot be empty"
        }
        onConfirm={(value) =>
          returnToModule(
            update((module) => ({ ...module, displayName: value.trim() })),
          )
        }
      />
    );

  if (props.screen.kind === "module-instructions")
    return (
      <DialogPrompt
        title="Module Instructions"
        value={props.module.instructions}
        placeholder="Describe what this stage must do"
        onConfirm={(value) =>
          returnToModule(
            update((module) => ({ ...module, instructions: value.trim() })),
          )
        }
      />
    );

  if (props.screen.kind === "module-conditions") {
    const key = props.screen.conditions;
    const title =
      key === "minimumConditions" ? "Minimum Completion" : "Ideal Outcome";
    return (
      <DialogPrompt
        title={title}
        description={() => (
          <text>
            Describe the goal naturally. An evaluator model will split it into
            auditable conditions for you to confirm.
          </text>
        )}
        value={props.module[key].map((condition) => condition.text).join("\n")}
        validate={(value) =>
          value.trim() ? undefined : "A completion objective is required"
        }
        onConfirm={(value) => {
          const screen = {
            kind: "module-condition-model",
            moduleID: props.module.id,
            conditions: key,
            objective: value.trim(),
          } as const;
          const models = props.config ? flowConditionModels(props.config) : [];
          const model = soleConditionEvaluator(models);
          if (!model) {
            props.advance(props.draft, screen);
            return;
          }
          const executionProvider = props.config
            ? defaultExecutionProviderID(props.config)
            : undefined;
          if (executionProvider && executionProvider !== model.providerID)
            props.advance(props.draft, {
              kind: "module-condition-consent",
              moduleID: screen.moduleID,
              conditions: screen.conditions,
              objective: screen.objective,
              modelID: model.modelID,
            });
          else void decompose(screen, model.modelID);
        }}
      />
    );
  }

  if (props.screen.kind === "module-condition-model") {
    const screen = props.screen;
    const models = props.config ? flowConditionModels(props.config) : [];
    return (
      <DialogSelect
        title="Choose Condition Evaluator"
        locked={decomposing()}
        options={conditionEvaluatorOptions(models)}
        flat
        emptyView={<text>No enabled evaluator model is configured.</text>}
        onSelect={(option) => {
          const model = models.find((entry) => entry.modelID === option.value);
          if (!model) return;
          const executionProvider = props.config
            ? defaultExecutionProviderID(props.config)
            : undefined;
          if (executionProvider && executionProvider !== model.providerID)
            props.advance(props.draft, {
              kind: "module-condition-consent",
              moduleID: screen.moduleID,
              conditions: screen.conditions,
              objective: screen.objective,
              modelID: model.modelID,
            });
          else void decompose(screen, model.modelID);
        }}
      />
    );
  }

  if (props.screen.kind === "module-condition-consent") {
    const screen = props.screen;
    const providerID = props.config?.models[screen.modelID]?.provider;
    return (
      <DialogSelect
        title="Send Goal to Another Provider?"
        locked={decomposing()}
        options={[
          {
            title: "Choose another model",
            value: "$cancel",
            category: "Action",
          },
          {
            title: `Send goal to ${providerID ?? "selected provider"}`,
            value: "$confirm",
            category: "External data",
            description:
              "Only this completion-goal text is sent. Runtime messages, tool output, terminal output, secrets, and task consent are not included.",
          },
        ]}
        onSelect={(option) => {
          if (option.value === "$confirm")
            void decompose(screen, screen.modelID);
          else
            props.advance(props.draft, {
              kind: "module-condition-model",
              moduleID: screen.moduleID,
              conditions: screen.conditions,
              objective: screen.objective,
            });
        }}
      />
    );
  }

  if (props.screen.kind === "module-condition-preview") {
    const screen = props.screen;
    const title =
      screen.conditions === "minimumConditions"
        ? "Confirm Minimum Conditions"
        : "Confirm Ideal Conditions";
    return (
      <DialogSelect
        title={title}
        options={[
          { title: "Revise objective", value: "$back", category: "Action" },
          {
            title: "Use these conditions",
            value: "$confirm",
            category: "Action",
            description: `${screen.proposed.length} conditions from ${screen.modelID}`,
          },
          ...screen.proposed.map((condition, index) => ({
            title: `${index + 1}. ${condition}`,
            value: `condition:${index}`,
            category: "Proposed conditions",
            readonly: true,
          })),
        ]}
        onSelect={(option) => {
          if (option.value === "$back")
            props.advance(props.draft, {
              kind: "module-conditions",
              moduleID: screen.moduleID,
              conditions: screen.conditions,
            });
          else if (option.value === "$confirm")
            returnToModule(
              update((module) => ({
                ...module,
                [screen.conditions]: flowConditionsFromLines(
                  module[screen.conditions],
                  screen.proposed.join("\n"),
                ),
              })),
            );
        }}
      />
    );
  }

  if (props.screen.kind === "module-delete")
    return (
      <DialogSelect
        title="Delete Flow Module?"
        options={[
          { title: "Keep module", value: "$cancel", category: "Action" },
          {
            title: "Delete module",
            value: "$confirm",
            category: "High impact",
            description: `Remove ${props.module.displayName} from the execution pipeline`,
          },
        ]}
        onSelect={(option) => {
          if (option.value === "$cancel") returnToModule(props.draft);
          else if (props.draft.modules.length === 1)
            props.fail("A flow must contain at least one module");
          else
            props.advance({
              ...props.draft,
              modules: props.draft.modules.filter(
                (module) => module.id !== props.module.id,
              ),
            });
        }}
      />
    );

  if (props.screen.kind === "module-command-rules")
    return <ModuleCommandRules {...props} />;
  if (props.screen.kind === "module-command-mode")
    return <ModuleCommandMode {...props} />;
  if (props.screen.kind === "module-command-add")
    return <ModuleCommandAdd {...props} />;
  if (props.screen.kind === "module-command-preview")
    return <ModuleCommandPreview {...props} />;
  if (props.screen.kind === "module-command-delete")
    return <ModuleCommandDelete {...props} />;
  if (props.screen.kind === "module-extensions")
    return <ModuleExtensions {...props} />;
  if (props.screen.kind === "module-path-rules")
    return <ModulePathRules {...props} />;
  if (props.screen.kind === "module-path-rules-edit")
    return <ModulePathRulesEdit {...props} />;
  if (props.screen.kind === "module-interactive")
    return <ModuleInteractivePrograms {...props} />;
  if (props.screen.kind === "module-interactive-enable-any")
    return <ModuleInteractiveAllowAny {...props} />;
  if (props.screen.kind === "module-interactive-add")
    return <ModuleInteractiveAdd {...props} />;
  if (props.screen.kind === "module-interactive-preview")
    return <ModuleInteractivePreview {...props} />;
  if (props.screen.kind === "module-interactive-delete")
    return <ModuleInteractiveDelete {...props} />;

  const index = props.draft.modules.findIndex(
    (module) => module.id === props.module.id,
  );
  const supportsCommands =
    props.module.type === "terminal" || props.module.type === "shell_command";
  const supportsInteractive = props.module.type === "terminal";
  const supportsPathScope = props.module.type === "workspace_changes";
  return (
    <DialogSelect
      title={props.module.displayName}
      options={[
        { title: "Back to flow", value: "$back", category: "Action" },
        {
          title: "Module Type",
          value: "$type",
          category: "Definition",
          description: moduleTypeTitle(props.module.type),
        },
        {
          title: "Enabled",
          value: "$enabled",
          description: props.module.enabled ? "yes" : "no",
        },
        {
          title: "Display Name",
          value: "$name",
          description: props.module.displayName,
        },
        {
          title: "Instructions",
          value: "$instructions",
          description: props.module.instructions.trim() ? "configured" : "none",
        },
        {
          title: "Minimum Completion",
          value: "$minimum",
          description: `${props.module.minimumConditions.length} required conditions`,
        },
        {
          title: "Ideal Outcome",
          value: "$ideal",
          description: `${props.module.idealConditions.length} optional conditions`,
        },
        ...(supportsCommands
          ? [
              {
                title: "Command Rules",
                value: "$commands",
                category: "Restrictions",
                description: commandRuleSummary(props.module),
              },
            ]
          : []),
        {
          title: "Extensions",
          value: "$extensions",
          category: "Restrictions",
          description: moduleExtensionSummary(props.module),
        },
        ...(supportsPathScope
          ? [
              {
                title: "Path Scope",
                value: "$path-rules",
                category: "Restrictions",
                description: pathScopeSummary(props.module),
              },
            ]
          : []),
        ...(supportsInteractive
          ? [
              {
                title: "Interactive Programs",
                value: "$interactive",
                category: "Restrictions",
                description: interactiveProgramSummary(props.module),
              },
            ]
          : []),
        {
          title: "Move Up",
          value: "$up",
          category: "Order",
          disabled: index === 0,
        },
        {
          title: "Move Down",
          value: "$down",
          category: "Order",
          disabled: index === props.draft.modules.length - 1,
        },
        {
          title: "Delete Module",
          value: "$delete",
          category: "High impact",
          description:
            props.draft.modules.length === 1
              ? "A flow must keep at least one module"
              : "Remove this stage from the execution pipeline",
          disabled: props.draft.modules.length === 1,
        },
      ]}
      onSelect={(option) => {
        if (option.value === "$back") props.advance(props.draft);
        else if (option.value === "$type")
          props.advance(props.draft, {
            kind: "module-type",
            moduleID: props.module.id,
          });
        else if (option.value === "$enabled")
          returnToModule(
            update((module) => ({ ...module, enabled: !module.enabled })),
          );
        else if (option.value === "$name")
          props.advance(props.draft, {
            kind: "module-name",
            moduleID: props.module.id,
          });
        else if (option.value === "$instructions")
          props.advance(props.draft, {
            kind: "module-instructions",
            moduleID: props.module.id,
          });
        else if (option.value === "$minimum")
          props.advance(props.draft, {
            kind: "module-conditions",
            moduleID: props.module.id,
            conditions: "minimumConditions",
          });
        else if (option.value === "$ideal")
          props.advance(props.draft, {
            kind: "module-conditions",
            moduleID: props.module.id,
            conditions: "idealConditions",
          });
        else if (option.value === "$commands")
          props.advance(props.draft, {
            kind: "module-command-rules",
            moduleID: props.module.id,
          });
        else if (option.value === "$extensions")
          props.advance(props.draft, {
            kind: "module-extensions",
            moduleID: props.module.id,
          });
        else if (option.value === "$path-rules")
          props.advance(props.draft, {
            kind: "module-path-rules",
            moduleID: props.module.id,
          });
        else if (option.value === "$interactive")
          props.advance(props.draft, {
            kind: "module-interactive",
            moduleID: props.module.id,
          });
        else if (option.value === "$up" || option.value === "$down")
          props.advance(
            reorderFlowModule(props.draft, index, option.value === "$up"),
          );
        else if (option.value === "$delete")
          props.advance(props.draft, {
            kind: "module-delete",
            moduleID: props.module.id,
          });
      }}
    />
  );
}

function ModuleCommandRules(props: ModuleEditorProps) {
  const rules = props.module.commandRules ?? {
    mode: "none" as const,
    rules: [],
  };
  return (
    <DialogSelect
      title="Module Command Rules"
      options={[
        { title: "Back to module", value: "$back", category: "Action" },
        {
          title: `Mode: ${rules.mode}`,
          value: "$mode",
          category: "Definition",
        },
        {
          title: "+ Add commands",
          value: "$add",
          category: "Action",
          description: "Paste one simple Bash command per line",
        },
        ...rules.rules.map((rule) => ({
          title: rule.command,
          value: `rule:${rule.command}`,
          category: "Rules",
          description: rule.reason ?? "select to remove",
        })),
      ]}
      onSelect={(option) => {
        if (option.value === "$back") props.returnToModule(props.draft);
        else if (option.value === "$mode")
          props.advance(props.draft, {
            kind: "module-command-mode",
            moduleID: props.module.id,
          });
        else if (option.value === "$add")
          props.advance(props.draft, {
            kind: "module-command-add",
            moduleID: props.module.id,
          });
        else if (option.value.startsWith("rule:"))
          props.advance(props.draft, {
            kind: "module-command-delete",
            moduleID: props.module.id,
            command: option.value.slice("rule:".length),
          });
      }}
    />
  );
}

function ModuleCommandMode(props: ModuleEditorProps) {
  const rules = props.module.commandRules ?? {
    mode: "none" as const,
    rules: [],
  };
  return (
    <DialogSelect
      title="Command Rule Mode"
      current={rules.mode}
      options={["blacklist", "whitelist", "none"].map((mode) => ({
        title: mode,
        value: mode,
      }))}
      onSelect={(option) =>
        props.returnToModule(
          props.update((module) => ({
            ...module,
            commandRules: {
              mode: option.value as "blacklist" | "whitelist" | "none",
              rules: module.commandRules?.rules ?? [],
            },
          })),
        )
      }
    />
  );
}

function ModuleCommandAdd(props: ModuleEditorProps) {
  return (
    <DialogPrompt
      title="Add Module Commands"
      description={() => <text>One simple Bash command per line.</text>}
      placeholder="git status\ngit diff\nnpm test"
      onConfirm={(value) => {
        void previewCommandRuleImport(
          value,
          props.module.commandRules?.rules ?? [],
        )
          .then((preview) =>
            props.advance(props.draft, {
              kind: "module-command-preview",
              moduleID: props.module.id,
              preview,
            }),
          )
          .catch(props.fail);
      }}
    />
  );
}

function ModuleCommandPreview(props: ModuleEditorProps) {
  const preview = props.screen as Extract<
    FlowEditorScreen,
    { kind: "module-command-preview" }
  >;
  return (
    <DialogSelect
      title="Command Rule Preview"
      options={[
        { title: "Back to rules", value: "$back", category: "Action" },
        {
          title: preview.preview.rejected
            ? "Fix rejected commands before saving"
            : `Add ${preview.preview.rules.length} commands`,
          value: "$save",
          category: "Action",
          description: preview.preview.rejected
            ? "Invalid commands are never saved."
            : "Rules are parsed again at execution time.",
          disabled: preview.preview.rejected,
        },
        ...preview.preview.previews.map((entry) => ({
          title: `${entry.line}: ${entry.command || "(blank)"}`,
          value: `line:${entry.line}`,
          category: "Import preview",
          description: `${entry.status}: ${entry.detail}`,
          readonly: true,
        })),
      ]}
      onSelect={(option) => {
        if (option.value === "$back") props.returnToCommandRules(props.draft);
        else if (option.value === "$save")
          props.returnToCommandRules(
            props.update((module) => ({
              ...module,
              commandRules: {
                mode: module.commandRules?.mode ?? "none",
                rules: [
                  ...(module.commandRules?.rules ?? []),
                  ...preview.preview.rules,
                ],
              },
            })),
          );
      }}
    />
  );
}

function ModuleCommandDelete(props: ModuleEditorProps) {
  const screen = props.screen as Extract<
    FlowEditorScreen,
    { kind: "module-command-delete" }
  >;
  return (
    <DialogSelect
      title="Remove Command Rule?"
      options={[
        { title: "Keep rule", value: "$cancel", category: "Action" },
        {
          title: `Remove ${screen.command}`,
          value: "$confirm",
          category: "High impact",
        },
      ]}
      onSelect={(option) => {
        if (option.value === "$cancel") props.returnToCommandRules(props.draft);
        else
          props.returnToCommandRules(
            props.update((module) => ({
              ...module,
              commandRules: {
                mode: module.commandRules?.mode ?? "none",
                rules: (module.commandRules?.rules ?? []).filter(
                  (rule) => rule.command !== screen.command,
                ),
              },
            })),
          );
      }}
    />
  );
}

function ModuleExtensions(props: ModuleEditorProps) {
  const extensions = props.module.extensions;
  const updateExtension = (extension: "skills" | "mcp" | "plugins") => {
    const disabled = extensions?.[extension] === false;
    const next = { ...extensions, [extension]: disabled ? undefined : false };
    const compact = Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    );
    props.returnToModule(
      props.update((module) => ({
        ...module,
        ...(Object.keys(compact).length ? { extensions: compact } : {}),
        ...(Object.keys(compact).length ? {} : { extensions: undefined }),
      })),
    );
  };
  return (
    <DialogSelect
      title="Module Extensions"
      options={[
        { title: "Back to module", value: "$back", category: "Action" },
        ...(["skills", "mcp", "plugins"] as const).map((extension) => ({
          title: extension,
          value: extension,
          category: "Extensions",
          description:
            extensions?.[extension] === false
              ? "disabled for this module"
              : "inherits the permission profile",
        })),
      ]}
      onSelect={(option) => {
        if (option.value === "$back") props.returnToModule(props.draft);
        else updateExtension(option.value as "skills" | "mcp" | "plugins");
      }}
    />
  );
}

/** One workspace path scope per line: `allow docs/**` or `deny secrets/**`. */
export function parsePathScopeInput(value: string): {
  allow: string[];
  deny: string[];
  rejected: string[];
} {
  const allow: string[] = [];
  const deny: string[] = [];
  const rejected: string[] = [];
  for (const raw of value.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(allow|deny)\s+(.+)$/u.exec(line);
    if (!match) {
      rejected.push(line);
      continue;
    }
    const pattern = match[2]!.trim();
    if (!pattern) {
      rejected.push(line);
      continue;
    }
    (match[1] === "allow" ? allow : deny).push(pattern);
  }
  return { allow, deny, rejected };
}

function pathScopeLabel(pattern: string, allow?: boolean) {
  return `${allow === true ? "allow" : "deny"} ${pattern}`;
}

export function pathScopeSummary(module: FlowModule) {
  const files = module.permissions?.files;
  const rules = [
    ...(files?.writePaths ?? []).map((rule) =>
      pathScopeLabel(rule.pattern, rule.allow),
    ),
    ...(files?.readPaths ?? []).map((rule) =>
      pathScopeLabel(rule.pattern, rule.allow),
    ),
  ];
  return rules.length ? rules.join(", ") : "unrestricted";
}

function ModulePathRules(props: ModuleEditorProps) {
  const files = props.module.permissions?.files;
  const write = files?.writePaths ?? [];
  const read = files?.readPaths ?? [];
  return (
    <DialogSelect
      title="Module Path Scope"
      options={[
        { title: "Back to module", value: "$back", category: "Action" },
        {
          title: "Edit Write Scope",
          value: "$write",
          category: "Workspace Changes",
          description: write.length
            ? write
                .map((rule) => pathScopeLabel(rule.pattern, rule.allow))
                .join(", ")
            : "unrestricted writes",
        },
        {
          title: "Edit Read Scope",
          value: "$read",
          category: "Workspace Changes",
          description: read.length
            ? read
                .map((rule) => pathScopeLabel(rule.pattern, rule.allow))
                .join(", ")
            : "unrestricted reads",
        },
      ]}
      onSelect={(option) => {
        if (option.value === "$back") props.returnToModule(props.draft);
        else
          props.advance(props.draft, {
            kind: "module-path-rules-edit",
            moduleID: props.module.id,
            scope: option.value === "$write" ? "write" : "read",
          });
      }}
    />
  );
}

function ModulePathRulesEdit(props: ModuleEditorProps) {
  const screen = props.screen as Extract<
    FlowEditorScreen,
    { kind: "module-path-rules-edit" }
  >;
  const key = screen.scope === "write" ? "writePaths" : "readPaths";
  const otherKey = screen.scope === "write" ? "readPaths" : "writePaths";
  const current = props.module.permissions?.files?.[key] ?? [];
  return (
    <DialogPrompt
      title={screen.scope === "write" ? "Write Path Scope" : "Read Path Scope"}
      description={() => (
        <text>
          One workspace-relative glob per line: "allow docs/**" or "deny
          secrets/**". Deny rules always win over allow rules.
        </text>
      )}
      value={current
        .map((rule) => pathScopeLabel(rule.pattern, rule.allow))
        .join("\n")}
      placeholder={"allow docs/**\ndeny secrets/**"}
      onConfirm={(value) => {
        const parsed = parsePathScopeInput(value);
        if (parsed.rejected.length) {
          props.fail(
            `Invalid path scope lines: ${parsed.rejected.join(", ")}. Use "allow <glob>" or "deny <glob>".`,
          );
          return;
        }
        props.returnToPathRules(
          props.update((module) => {
            const files = module.permissions?.files ?? {
              readPaths: [],
              writePaths: [],
            };
            return {
              ...module,
              permissions: {
                ...module.permissions,
                files: {
                  readPaths: files.readPaths ?? [],
                  writePaths: files.writePaths ?? [],
                  [key]: [
                    ...parsed.deny.map((pattern) => ({
                      pattern,
                      allow: false as const,
                    })),
                    ...parsed.allow.map((pattern) => ({
                      pattern,
                      allow: true as const,
                    })),
                  ],
                  [otherKey]: files[otherKey] ?? [],
                },
              },
            };
          }),
        );
      }}
    />
  );
}

function ModuleInteractivePrograms(props: ModuleEditorProps) {
  const interactive = props.module.interactivePrograms ?? {
    allowAny: false,
    allow: [],
  };
  return (
    <DialogSelect
      title="Interactive Programs · High Risk"
      options={[
        { title: "Back to module", value: "$back", category: "Action" },
        {
          title: "Allow any interactive program",
          value: "$any",
          category: "High risk",
          description: interactive.allowAny
            ? "ON · unrestricted after foreground confirmation"
            : "OFF · use the explicit launch-command list below",
        },
        {
          title: "+ Add launch commands",
          value: "$add",
          category: "Action",
          description: "One simple Bash launch command per line",
        },
        ...interactive.allow.map((rule) => ({
          title: rule.command,
          value: `program:${rule.command}`,
          category: "Allowed launches",
          description: rule.reason ?? "select to remove",
        })),
      ]}
      onSelect={(option) => {
        if (option.value === "$back") props.returnToModule(props.draft);
        else if (option.value === "$any") {
          if (interactive.allowAny)
            props.returnToInteractive(
              props.update((module) => ({
                ...module,
                interactivePrograms: { ...interactive, allowAny: false },
              })),
            );
          else
            props.advance(props.draft, {
              kind: "module-interactive-enable-any",
              moduleID: props.module.id,
            });
        } else if (option.value === "$add")
          props.advance(props.draft, {
            kind: "module-interactive-add",
            moduleID: props.module.id,
          });
        else if (option.value.startsWith("program:"))
          props.advance(props.draft, {
            kind: "module-interactive-delete",
            moduleID: props.module.id,
            command: option.value.slice("program:".length),
          });
      }}
    />
  );
}

function ModuleInteractiveAllowAny(props: ModuleEditorProps) {
  const interactive = props.module.interactivePrograms ?? {
    allowAny: false,
    allow: [],
  };
  return (
    <DialogSelect
      title="Allow Any Interactive Program?"
      options={[
        {
          title: "Keep explicit allow-list",
          value: "$cancel",
          category: "Action",
        },
        {
          title: "Enable unrestricted interactive programs",
          value: "$confirm",
          category: "High risk",
          description:
            "Any simple launch allowed by command policy may take over after OS foreground confirmation. Later input bypasses Bash Command Rules.",
        },
      ]}
      onSelect={(option) => {
        if (option.value === "$cancel") props.returnToInteractive(props.draft);
        else
          props.returnToInteractive(
            props.update((module) => ({
              ...module,
              interactivePrograms: { ...interactive, allowAny: true },
            })),
          );
      }}
    />
  );
}

function ModuleInteractiveAdd(props: ModuleEditorProps) {
  return (
    <DialogPrompt
      title="Allow Interactive Programs"
      description={() => (
        <text>
          High risk: foreground program input follows its own protocol. One
          simple Bash launch command per line.
        </text>
      )}
      placeholder="vim\npython\npsql"
      onConfirm={(value) => {
        void previewCommandRuleImport(
          value,
          props.module.interactivePrograms?.allow ?? [],
        )
          .then((preview) =>
            props.advance(props.draft, {
              kind: "module-interactive-preview",
              moduleID: props.module.id,
              preview,
            }),
          )
          .catch(props.fail);
      }}
    />
  );
}

function ModuleInteractivePreview(props: ModuleEditorProps) {
  const screen = props.screen as Extract<
    FlowEditorScreen,
    { kind: "module-interactive-preview" }
  >;
  return (
    <DialogSelect
      title="Interactive Program Preview · High Risk"
      options={[
        { title: "Back to programs", value: "$back", category: "Action" },
        {
          title: screen.preview.rejected
            ? "Fix rejected launch commands"
            : `Allow ${screen.preview.rules.length} launch commands`,
          value: "$save",
          category: "High risk",
          description: screen.preview.rejected
            ? "Invalid commands are never saved."
            : "Foreground process confirmation remains required at runtime.",
          disabled: screen.preview.rejected,
        },
        ...screen.preview.previews.map((entry) => ({
          title: `${entry.line}: ${entry.command || "(blank)"}`,
          value: `line:${entry.line}`,
          category: "Import preview",
          description: `${entry.status}: ${entry.detail}`,
          readonly: true,
        })),
      ]}
      onSelect={(option) => {
        if (option.value === "$back") props.returnToInteractive(props.draft);
        else if (option.value === "$save")
          props.returnToInteractive(
            props.update((module) => ({
              ...module,
              interactivePrograms: {
                allowAny: module.interactivePrograms?.allowAny ?? false,
                allow: [
                  ...(module.interactivePrograms?.allow ?? []),
                  ...screen.preview.rules,
                ],
              },
            })),
          );
      }}
    />
  );
}

function ModuleInteractiveDelete(props: ModuleEditorProps) {
  const screen = props.screen as Extract<
    FlowEditorScreen,
    { kind: "module-interactive-delete" }
  >;
  return (
    <DialogSelect
      title="Remove Interactive Program?"
      options={[
        { title: "Keep program", value: "$cancel", category: "Action" },
        {
          title: `Stop allowing ${screen.command}`,
          value: "$confirm",
          category: "High impact",
        },
      ]}
      onSelect={(option) => {
        if (option.value === "$cancel") props.returnToInteractive(props.draft);
        else
          props.returnToInteractive(
            props.update((module) => ({
              ...module,
              interactivePrograms: {
                allowAny: module.interactivePrograms?.allowAny ?? false,
                allow: (module.interactivePrograms?.allow ?? []).filter(
                  (rule) => rule.command !== screen.command,
                ),
              },
            })),
          );
      }}
    />
  );
}

type ModuleEditorProps = {
  draft: NataliaFlowDocument;
  module: FlowModule;
  screen: Exclude<
    FlowEditorScreen,
    | { kind: "summary" }
    | { kind: "flow-name" }
    | { kind: "add-module" }
    | { kind: "permission-preview-profile" }
    | { kind: "permission-preview" }
  >;
  advance: (draft: NataliaFlowDocument, screen?: FlowEditorScreen) => void;
  fail: (error: unknown) => void;
  config?: ConfigV2;
  decomposeConditions: (input: {
    modelID: string;
    objective: string;
  }) => Promise<{ conditions: Array<{ text: string }> }>;
  update: (change: (module: FlowModule) => FlowModule) => NataliaFlowDocument;
  returnToModule: (draft: NataliaFlowDocument) => void;
  returnToCommandRules: (draft: NataliaFlowDocument) => void;
  returnToInteractive: (draft: NataliaFlowDocument) => void;
  returnToPathRules: (draft: NataliaFlowDocument) => void;
};

function updateFlowModule(
  draft: NataliaFlowDocument,
  moduleID: string,
  change: (module: FlowModule) => FlowModule,
) {
  return {
    ...draft,
    modules: draft.modules.map((module) =>
      module.id === moduleID ? change(structuredClone(module)) : module,
    ),
  };
}

export function reorderFlowModule(
  draft: NataliaFlowDocument,
  from: number,
  moveUp: boolean,
): NataliaFlowDocument {
  const to = from + (moveUp ? -1 : 1);
  if (to < 0 || to >= draft.modules.length) return draft;
  const modules = [...draft.modules];
  const [module] = modules.splice(from, 1);
  modules.splice(to, 0, module!);
  return { ...draft, modules };
}

/** Saveable drafts can still need attention before an unattended task can run. */
export function flowDraftProblems(draft: NataliaFlowDocument): string[] {
  const problems: string[] = [];
  if (!draft.modules.some((module) => module.enabled))
    problems.push("no module is enabled, so the flow can never complete");
  for (const module of draft.modules)
    if (module.enabled && !module.minimumConditions.length)
      problems.push(
        `module has no minimum completion condition: ${module.displayName}`,
      );
  return problems;
}

function newModule(type: FlowModuleType, displayName: string): FlowModule {
  return {
    id: `module_${crypto.randomUUID().replace(/-/gu, "")}`,
    type,
    displayName,
    enabled: true,
    instructions: "",
    minimumConditions: [],
    idealConditions: [],
  };
}

function commandRuleSummary(module: FlowModule) {
  const rules = module.commandRules;
  return rules
    ? `${rules.mode}, ${rules.rules.length} commands`
    : "not configured";
}

function interactiveProgramSummary(module: FlowModule) {
  const programs = module.interactivePrograms;
  if (!programs?.allowAny && !programs?.allow.length)
    return "disabled (no launch commands allowed)";
  if (programs.allowAny) return "any launch command · high risk";
  return `${programs.allow.length} high-risk launch commands`;
}

function moduleExtensionSummary(module: FlowModule) {
  return (["skills", "mcp", "plugins"] as const)
    .map(
      (extension) =>
        `${extension}=${
          module.extensions?.[extension] === false ? "off" : "profile"
        }`,
    )
    .join(", ");
}

function moduleTypeTitle(type: string) {
  return type
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" & ");
}

function moduleTypeDescription(type: FlowModuleType | string) {
  const descriptions: Record<string, string> = {
    read_search: "Read files and search workspace content",
    terminal: "Operate a managed interactive terminal",
    shell_command: "Run bounded one-shot shell commands",
    workspace_changes: "Create and edit workspace files",
    web_fetch: "Fetch and inspect remote web content",
    skills: "Load configured skills",
    mcp: "Use configured MCP capabilities",
    plugins: "Use configured plugin capabilities",
    subagents: "Delegate work to subagents",
    report_output: "Publish findings and final output",
  };
  return descriptions[type] ?? type;
}
