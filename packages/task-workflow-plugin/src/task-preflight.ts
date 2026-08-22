import type { ConfigV3, NataliaTaskDocument } from "@natalia/contracts";
import { resolveEffectiveModel } from "@natalia/config";
import { taskAlertSubscriptions } from "@natalia/workflow";

/** Fails closed for every configured reference a task needs before execution. */
export function assertTaskReferences(input: {
  task: NataliaTaskDocument;
  config: ConfigV3;
}) {
  const profile = input.config.permissionProfiles[input.task.permissionProfile];
  if (!profile)
    throw new Error(
      `task permission profile not found: ${input.task.permissionProfile}`,
    );
  if (profile.approval !== "auto")
    throw new Error(
      `task permission profile must use auto approval: ${input.task.permissionProfile}`,
    );
  const issueTarget = input.task.issueTarget
    ? requireEnabledReference({
        kind: "issue target",
        key: input.task.issueTarget,
        entry: input.config.issueTargets[input.task.issueTarget],
      })
    : undefined;
  const dataSource = input.task.dataSource
    ? requireEnabledReference({
        kind: "data source",
        key: input.task.dataSource,
        entry: input.config.dataSources[input.task.dataSource],
      })
    : undefined;
  const dataSourceEntry = input.task.dataSource
    ? input.config.dataSources[input.task.dataSource]
    : undefined;
  if (dataSourceEntry?.kind === "timestamp" && !dataSourceEntry.timestampField)
    throw new Error(
      `task data source uses timestamp watermarks without a timestampField: ${input.task.dataSource}`,
    );
  const alertChannels = taskAlertSubscriptions(input.task.alerts).map(
    (subscription) => ({
      ...requireEnabledReference({
        kind: "alert channel",
        key: subscription.channel,
        entry: input.config.alertChannels[subscription.channel],
      }),
      on: subscription.on,
    }),
  );
  if (
    input.task.evaluator &&
    !resolveEffectiveModel(input.config, {
      provider: input.task.evaluator.provider,
      model: input.task.evaluator.model,
    })
  )
    throw new Error(
      `task evaluator model not found in config: ${input.task.evaluator.provider}/${input.task.evaluator.model}`,
    );
  return {
    permissionProfile: {
      key: input.task.permissionProfile,
      approval: profile.approval,
    },
    ...(issueTarget ? { issueTarget } : {}),
    ...(dataSource ? { dataSource } : {}),
    ...(alertChannels.length ? { alertChannels } : {}),
    ...(input.task.evaluator ? { evaluator: input.task.evaluator } : {}),
  };
}

function requireEnabledReference(input: {
  kind: string;
  key: string;
  entry: { enabled: boolean } | undefined;
}) {
  if (!input.entry)
    throw new Error(`task ${input.kind} not found: ${input.key}`);
  if (!input.entry.enabled)
    throw new Error(`task ${input.kind} is disabled: ${input.key}`);
  return { key: input.key };
}
