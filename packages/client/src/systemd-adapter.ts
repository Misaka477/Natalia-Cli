import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { NataliaTaskDocument } from "@natalia/contracts";

const UNIT_SCHEMA = 1;
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;

export type SystemdCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type SystemdCommandRunner = (
  args: string[],
) => Promise<SystemdCommandResult>;

export type SystemdCalendarPreview = {
  normalized: string;
  next: string[];
};

export type GeneratedTaskUnits = {
  baseName: string;
  serviceUnit: string;
  timerUnit: string;
  service: string;
  timer: string;
};

export function generateTaskUnits(input: {
  task: NataliaTaskDocument;
  workspaceRoot: string;
  executable: string;
  cliEntry?: string;
}): GeneratedTaskUnits {
  const { task } = input;
  if (!TASK_ID_PATTERN.test(task.taskID))
    throw new Error(
      `taskID cannot be used in a systemd unit name: ${task.taskID}`,
    );
  if (!task.systemd?.calendar)
    throw new Error(
      `task ${task.taskID} has no explicit systemd calendar; edit its schedule before generating units`,
    );
  for (const [name, value] of [
    ["display name", task.displayName],
    ["calendar", task.systemd.calendar],
    ["workspace", input.workspaceRoot],
    ["executable", input.executable],
    ...(input.cliEntry ? (["CLI entry", input.cliEntry] as const) : []),
  ] as const)
    if (/\r|\n|\0/u.test(value))
      throw new Error(`systemd ${name} contains a forbidden control character`);

  const baseName = `natalia-task-${task.taskID}`;
  const serviceUnit = `${baseName}.service`;
  const timerUnit = `${baseName}.timer`;
  const command = [
    input.executable,
    ...(input.cliEntry ? [input.cliEntry] : []),
    "task",
    "run-id",
    task.taskID,
    "--workspace",
    input.workspaceRoot,
    "--json",
  ]
    .map(systemdQuote)
    .join(" ");
  const serviceBody = [
    "[Unit]",
    `Description=Run Natalia task ${systemdText(task.displayName)}`,
    "",
    "[Service]",
    "Type=oneshot",
    `WorkingDirectory=${systemdQuote(input.workspaceRoot)}`,
    `ExecStart=${command}`,
    "NoNewPrivileges=yes",
    "PrivateTmp=yes",
    "ProtectHome=yes",
    "ProtectSystem=strict",
    `ReadWritePaths=${systemdQuote(join(input.workspaceRoot, ".natalia"))}`,
    "",
  ].join("\n");
  const timerBody = [
    "[Unit]",
    `Description=Schedule Natalia task ${systemdText(task.displayName)}`,
    "",
    "[Timer]",
    `OnCalendar=${task.systemd.calendar}`,
    "Persistent=true",
    `Unit=${serviceUnit}`,
    "",
    "[Install]",
    "WantedBy=timers.target",
    "",
  ].join("\n");
  return {
    baseName,
    serviceUnit,
    timerUnit,
    service: withMarker(task.taskID, serviceBody),
    timer: withMarker(task.taskID, timerBody),
  };
}

export async function installUserTaskUnits(input: {
  units: GeneratedTaskUnits;
  unitDirectory: string;
  run?: SystemdCommandRunner;
  activate?: boolean;
}) {
  const run = input.run ?? runSystemctl;
  const servicePath = join(input.unitDirectory, input.units.serviceUnit);
  const timerPath = join(input.unitDirectory, input.units.timerUnit);
  await ownedUnit(servicePath, input.units.service);
  const timerExisted = await ownedUnit(timerPath, input.units.timer);
  const wasEnabled = timerExisted
    ? (
        await runSystemctlChecked(
          run,
          ["--user", "is-enabled", input.units.timerUnit],
          [0, 1, 3],
        )
      ).exitCode === 0
    : undefined;
  await writeUnit(servicePath, input.units.service);
  await writeUnit(timerPath, input.units.timer);
  await runSystemctlChecked(run, ["--user", "daemon-reload"]);
  if (input.activate || !timerExisted || wasEnabled)
    await runSystemctlChecked(run, [
      "--user",
      "enable",
      "--now",
      input.units.timerUnit,
    ]);
  return {
    servicePath,
    timerPath,
    enabled: Boolean(input.activate || !timerExisted || wasEnabled),
  };
}

export async function writeGeneratedTaskUnits(input: {
  units: GeneratedTaskUnits;
  directory: string;
}) {
  const servicePath = join(input.directory, input.units.serviceUnit);
  const timerPath = join(input.directory, input.units.timerUnit);
  await ownedUnit(servicePath, input.units.service);
  await ownedUnit(timerPath, input.units.timer);
  await writeUnit(servicePath, input.units.service);
  await writeUnit(timerPath, input.units.timer);
  return { servicePath, timerPath };
}

export function systemInstallCommands(input: {
  units: GeneratedTaskUnits;
  generatedDirectory: string;
}) {
  const source = (unit: string) =>
    systemdQuote(join(input.generatedDirectory, unit));
  return [
    `sudo install -m 0644 ${source(input.units.serviceUnit)} /etc/systemd/system/${input.units.serviceUnit}`,
    `sudo install -m 0644 ${source(input.units.timerUnit)} /etc/systemd/system/${input.units.timerUnit}`,
    "sudo systemctl daemon-reload",
    `sudo systemctl enable --now ${input.units.timerUnit}`,
  ];
}

export function systemRemoveCommands(timerUnit: string) {
  const serviceUnit = timerUnit.replace(/\.timer$/u, ".service");
  return [
    `sudo systemctl disable --now ${timerUnit}`,
    `sudo rm /etc/systemd/system/${timerUnit} /etc/systemd/system/${serviceUnit}`,
    "sudo systemctl daemon-reload",
  ];
}

export async function removeUserTaskUnits(input: {
  taskID: string;
  timerUnit: string;
  unitDirectory: string;
  run?: SystemdCommandRunner;
}) {
  const expected = `natalia-task-${input.taskID}.timer`;
  if (input.timerUnit !== expected)
    throw new Error(
      `task ${input.taskID} does not own timer ${input.timerUnit}`,
    );
  const serviceUnit = input.timerUnit.replace(/\.timer$/u, ".service");
  const timerPath = join(input.unitDirectory, input.timerUnit);
  const servicePath = join(input.unitDirectory, serviceUnit);
  await assertOwnedUnit(timerPath, input.taskID);
  await assertOwnedUnit(servicePath, input.taskID);
  const run = input.run ?? runSystemctl;
  await runSystemctlChecked(
    run,
    ["--user", "disable", "--now", input.timerUnit],
    [0, 1, 5],
  );
  await rm(timerPath);
  await rm(servicePath);
  await runSystemctlChecked(run, ["--user", "daemon-reload"]);
}

export async function nextSystemdRun(input: {
  timerUnit: string;
  scope: "user" | "system";
  run?: SystemdCommandRunner;
}) {
  const run = input.run ?? runSystemctl;
  const result = await run([
    ...(input.scope === "user" ? ["--user"] : []),
    "list-timers",
    input.timerUnit,
    "--all",
    "--no-pager",
    "--output=json",
  ]);
  if (result.exitCode !== 0) return undefined;
  try {
    const rows = JSON.parse(result.stdout) as Array<{
      unit?: string;
      next?: number | string | null;
    }>;
    const row = rows.find((entry) => entry.unit === input.timerUnit);
    if (!row?.next) return undefined;
    if (typeof row.next === "number")
      return new Date(row.next / 1000).toISOString();
    const parsed = Date.parse(row.next);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

export async function previewSystemdCalendar(
  calendar: string,
  run: SystemdCommandRunner = runSystemdAnalyze,
): Promise<SystemdCalendarPreview> {
  if (!calendar.trim() || /\r|\n|\0/u.test(calendar))
    throw new Error("a one-line systemd calendar is required");
  const result = await run(["calendar", "--iterations=3", calendar]);
  if (result.exitCode !== 0)
    throw new Error(
      `invalid systemd calendar: ${result.stderr.trim() || `exit ${result.exitCode}`}`,
    );
  const normalized = result.stdout.match(/^Normalized form:\s*(.+)$/mu)?.[1];
  const next = [
    ...result.stdout.matchAll(
      /^(?:\s*Next elapse|\s*Iteration #\d+):\s*(.+)$/gmu,
    ),
  ].map((match) => match[1]!.trim());
  if (!normalized || next.length !== 3)
    throw new Error("systemd-analyze returned an incomplete calendar preview");
  return { normalized, next };
}

export async function runSystemctl(
  args: string[],
): Promise<SystemdCommandResult> {
  if (process.platform !== "linux")
    return { exitCode: 127, stdout: "", stderr: "systemd is unavailable" };
  try {
    const child = Bun.spawn(["systemctl", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error) {
    return {
      exitCode: 127,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runSystemdAnalyze(
  args: string[],
): Promise<SystemdCommandResult> {
  if (process.platform !== "linux")
    return { exitCode: 127, stdout: "", stderr: "systemd is unavailable" };
  try {
    const child = Bun.spawn(["systemd-analyze", ...args], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, LANG: "C", LC_ALL: "C" },
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error) {
    return {
      exitCode: 127,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

function withMarker(taskID: string, body: string) {
  const hash = createHash("sha256").update(body).digest("hex");
  return [
    "# Generated by Natalia; do not edit in place.",
    `# X-Natalia-Task=${taskID}`,
    `# X-Natalia-Schema=${UNIT_SCHEMA}`,
    `# X-Natalia-Content-SHA256=${hash}`,
    body,
  ].join("\n");
}

async function ownedUnit(path: string, expected: string) {
  let current: string;
  try {
    current = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  const expectedTask = marker(expected, "X-Natalia-Task")!;
  assertOwnedContent(path, current, expectedTask);
  return true;
}

async function assertOwnedUnit(path: string, taskID: string) {
  let current: string;
  try {
    current = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new Error(`Natalia unit not found: ${path}`);
    throw error;
  }
  assertOwnedContent(path, current, taskID);
}

function assertOwnedContent(path: string, current: string, taskID: string) {
  if (
    marker(current, "X-Natalia-Task") !== taskID ||
    marker(current, "X-Natalia-Schema") !== String(UNIT_SCHEMA) ||
    marker(current, "X-Natalia-Content-SHA256") !== contentHash(current)
  )
    throw new Error(
      `refusing to overwrite a unit not owned by this task: ${path}`,
    );
}

function contentHash(unit: string) {
  const body = unit.split("\n").slice(4).join("\n");
  return createHash("sha256").update(body).digest("hex");
}

function marker(unit: string, name: string) {
  return unit.match(new RegExp(`^# ${name}=(.+)$`, "mu"))?.[1];
}

async function writeUnit(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

async function runSystemctlChecked(
  run: SystemdCommandRunner,
  args: string[],
  accepted = [0],
) {
  const result = await run(args);
  if (!accepted.includes(result.exitCode))
    throw new Error(
      `systemctl ${args.join(" ")} failed: ${result.stderr.trim() || `exit ${result.exitCode}`}`,
    );
  return result;
}

function systemdQuote(value: string) {
  return `"${value
    .replaceAll("%", "%%")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')}"`;
}

function systemdText(value: string) {
  return value.replaceAll("%", "%%");
}
