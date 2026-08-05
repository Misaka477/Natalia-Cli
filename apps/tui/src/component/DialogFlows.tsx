import type { FlowOverview, FlowRow, FlowStageRow } from "@natalia/client";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";

/**
 * Flows are work definitions, not tool settings, so they get their own surface.
 * A flow no task can complete stays visible and says why.
 */
export function buildFlowOptions(
  overview: FlowOverview,
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
      ? [`${stage.interactivePrograms} interactive programs`]
      : []),
  ].join(" · ");
}

export function DialogFlows(props: { overview: FlowOverview }) {
  const dialog = useDialog();
  return (
    <DialogSelect
      title="Flows"
      placeholder="Search flows"
      options={buildFlowOptions(props.overview)}
      emptyView={<text>No flow documents under .natalia/flows.</text>}
      onSelect={(option) => {
        const flow = props.overview.flows.find(
          (entry) => entry.path === option.value,
        );
        if (!flow) return;
        dialog.push(() => (
          <DialogSelect
            title={`${flow.displayName} · ${flow.flowID}`}
            options={buildFlowDetail(flow)}
            skipFilter
            onSelect={() => dialog.pop()}
          />
        ));
      }}
    />
  );
}
