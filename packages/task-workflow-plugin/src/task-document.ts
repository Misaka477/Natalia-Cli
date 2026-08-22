import type {
  NataliaTaskDocument,
  NataliaTaskDocumentInput,
} from "@natalia/contracts";
import { nataliaTaskDocumentSchema } from "@natalia/contracts";
import { NataliaDocumentStore } from "@natalia/workflow";
import {
  generateTaskUnits,
  installUserTaskUnits,
  previewSystemdCalendar,
  removeUserTaskUnits,
  runSystemctl,
  systemInstallCommands,
  systemRemoveCommands,
  type SystemdCommandRunner,
  writeGeneratedTaskUnits,
} from "./systemd-adapter";

/**
 * The task editor deliberately uses the same document store as CLI execution.
 * Saving validates the document and atomically writes it, while references are
 * reported by the overview afterwards so an operator can save an unfinished
 * draft as "Needs attention" instead of losing it.
 */
export async function loadTaskDocument(input: {
  workspaceRoot: string;
  path: string;
}): Promise<NataliaTaskDocument> {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  return documents.loadTaskDocument(input.path);
}

export async function saveTaskDocument(input: {
  workspaceRoot: string;
  path?: string;
  document: NataliaTaskDocumentInput;
}) {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  return documents.saveTask(input.document, input.path);
}

export async function deleteTaskDocument(input: {
  workspaceRoot: string;
  path: string;
}) {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  const task = await documents.loadTaskDocument(input.path);
  if (task.systemd?.timerUnit)
    throw new Error(
      `remove timer ${task.systemd.timerUnit} before deleting task ${task.taskID}`,
    );
  await documents.deleteTask(input.path);
}

export function newScheduledTaskID() {
  return `task_${crypto.randomUUID().replace(/-/gu, "")}`;
}

export async function configureTaskSystemd(input: {
  workspaceRoot: string;
  path: string;
  calendar: string;
  scope: "user" | "system";
  executable: string;
  cliEntry?: string;
  userUnitDirectory?: string;
  generatedDirectory?: string;
  run?: SystemdCommandRunner;
  validateCalendar?: typeof previewSystemdCalendar;
}) {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  const task = await documents.loadTaskDocument(input.path);
  const preview = await (input.validateCalendar ?? previewSystemdCalendar)(
    input.calendar,
  );
  if (task.systemd?.timerUnit && task.systemd.scope !== input.scope)
    throw new Error("remove the existing timer before changing systemd scope");
  const configured = nataliaTaskDocumentSchema.parse({
    ...task,
    systemd: {
      ...task.systemd,
      calendar: input.calendar,
      scope: input.scope,
    },
  });
  const units = generateTaskUnits({
    task: configured,
    workspaceRoot: input.workspaceRoot,
    executable: input.executable,
    ...(input.cliEntry ? { cliEntry: input.cliEntry } : {}),
  });
  let commands: string[] = [];
  if (input.scope === "user")
    await installUserTaskUnits({
      units,
      unitDirectory:
        input.userUnitDirectory ??
        join(homedir(), ".config", "systemd", "user"),
      run: input.run,
      activate: !task.systemd?.timerUnit,
    });
  else {
    const generatedDirectory =
      input.generatedDirectory ??
      join(input.workspaceRoot, ".natalia", "systemd");
    await writeGeneratedTaskUnits({ units, directory: generatedDirectory });
    commands = systemInstallCommands({ units, generatedDirectory });
  }
  await documents.saveTask(
    {
      ...configured,
      systemd: {
        calendar: input.calendar,
        scope: input.scope,
        timerUnit: units.timerUnit,
        generatedCalendar: input.calendar,
      },
    },
    input.path,
  );
  return { units, commands, preview };
}

export async function removeTaskSystemd(input: {
  workspaceRoot: string;
  path: string;
  userUnitDirectory?: string;
  generatedDirectory?: string;
  run?: SystemdCommandRunner;
}) {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  const task = await documents.loadTaskDocument(input.path);
  const timerUnit = task.systemd?.timerUnit;
  if (!task.systemd || !timerUnit) return { commands: [] as string[] };
  if (task.systemd.scope === "user")
    await removeUserTaskUnits({
      taskID: task.taskID,
      timerUnit,
      unitDirectory:
        input.userUnitDirectory ??
        join(homedir(), ".config", "systemd", "user"),
      run: input.run,
    });
  else {
    const runner = input.run ?? runSystemctl;
    const status = await runner([
      "show",
      timerUnit,
      "--property=LoadState",
      "--value",
    ]);
    if (status.exitCode !== 0)
      throw new Error(
        `cannot inspect system timer ${timerUnit}: ${status.stderr.trim() || `exit ${status.exitCode}`}`,
      );
    if (status.stdout.trim() !== "not-found")
      return { commands: systemRemoveCommands(timerUnit) };
    const generatedDirectory =
      input.generatedDirectory ??
      join(input.workspaceRoot, ".natalia", "systemd");
    await rm(join(generatedDirectory, timerUnit), { force: true });
    await rm(
      join(generatedDirectory, timerUnit.replace(/\.timer$/u, ".service")),
      {
        force: true,
      },
    );
  }
  await documents.saveTask(
    {
      ...task,
      systemd: {
        calendar: task.systemd.calendar,
        scope: task.systemd.scope,
      },
    },
    input.path,
  );
  return { commands: [] as string[] };
}
import { homedir } from "node:os";
import { rm } from "node:fs/promises";
import { join } from "node:path";
