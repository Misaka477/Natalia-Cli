import { readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { resolveConfig } from "@natalia/config";
import { valueAfter } from "./command-helpers";

type TaskDocument = {
  kind?: unknown;
  version?: unknown;
  taskID?: unknown;
  displayName?: unknown;
  prompt?: unknown;
  permissionProfile?: unknown;
  alerts?: unknown;
  dataSource?: unknown;
  issueTarget?: unknown;
  flow?: { flowID?: unknown };
  evaluator?: { provider?: unknown; model?: unknown };
};

type FlowModule = {
  id?: unknown;
  type?: unknown;
  displayName?: unknown;
  instructions?: unknown;
  commandRules?: {
    mode?: unknown;
    rules?: Array<{ command?: unknown }>;
  };
};

type FlowDocument = {
  kind?: unknown;
  version?: unknown;
  flowID?: unknown;
  displayName?: unknown;
  modules?: unknown;
};

type TaskConfig = Record<string, any>;

function fail(message: string): never {
  throw new Error(message);
}

function stringField(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim())
    fail(`${field} must be a non-empty string`);
  return value;
}

function optionalStringField(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined) return undefined;
  return stringField(value, field);
}

async function readYaml(path: string): Promise<Record<string, unknown>> {
  const parsed = Bun.YAML.parse(await Bun.file(path).text()) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    fail(`YAML document must be an object: ${path}`);
  return parsed as Record<string, unknown>;
}

async function findFlow(
  workspaceRoot: string,
  flowID: string,
): Promise<FlowDocument> {
  const directory = join(workspaceRoot, ".natalia", "flows");
  const entries = await readdir(directory).catch(() => [] as string[]);
  for (const entry of entries) {
    if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
    const document = (await readYaml(join(directory, entry))) as FlowDocument;
    if (document.flowID === flowID) return document;
  }
  fail(`flow not found: ${flowID}`);
}

async function loadTaskConfig(workspaceRoot: string): Promise<TaskConfig> {
  const resolved = (await resolveConfig({ workspaceRoot }))
    .config as TaskConfig;
  let project: TaskConfig = {};
  try {
    const raw = JSON.parse(
      await Bun.file(join(workspaceRoot, ".natalia", "config.json")).text(),
    ) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw))
      project = raw as TaskConfig;
  } catch {
    // Project config is optional for a global-only deployment.
  }
  return {
    ...resolved,
    ...project,
    permissionProfiles: {
      ...((resolved.agentModes as TaskConfig | undefined) ?? {}),
      ...((project.permissionProfiles as TaskConfig | undefined) ?? {}),
    },
    issueTargets: {
      ...((resolved.issueTargets as TaskConfig | undefined) ?? {}),
      ...((project.issueTargets as TaskConfig | undefined) ?? {}),
    },
    dataSources: {
      ...((resolved.dataSources as TaskConfig | undefined) ?? {}),
      ...((project.dataSources as TaskConfig | undefined) ?? {}),
    },
    alertChannels: {
      ...((resolved.alertChannels as TaskConfig | undefined) ?? {}),
      ...((project.alertChannels as TaskConfig | undefined) ?? {}),
    },
  };
}

function permissionApproval(config: TaskConfig, key: string): string {
  const profile = config.permissionProfiles?.[key] as
    | { approval?: unknown }
    | undefined;
  if (!profile) return "missing";
  return typeof profile.approval === "string"
    ? profile.approval
    : "unspecified";
}

function moduleAllowed(
  config: TaskConfig,
  profileKey: string,
  module: FlowModule,
  task: TaskDocument,
): string[] {
  const profile = config.permissionProfiles?.[profileKey] as
    | {
        permissions?: {
          tools?: { allow?: unknown };
          files?: { writePaths?: unknown };
        };
        commandRules?: {
          mode?: unknown;
          rules?: Array<{ command?: unknown }>;
        };
      }
    | undefined;
  if (!profile) return [`permissionProfile:${profileKey}`];
  const blocked: string[] = [];
  const type = typeof module.type === "string" ? module.type : "unknown";
  const allowedTools = new Set(
    Array.isArray(profile.permissions?.tools?.allow)
      ? profile.permissions.tools.allow.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
  );
  const requires = (tool: string) => {
    if (!allowedTools.has(tool))
      blocked.push(`module:${String(module.id)}:${tool}`);
  };
  if (type === "read_search") {
    if (task.dataSource) requires("read_data_source");
    else {
      requires("read_file");
      requires("glob");
      requires("grep");
    }
  } else if (type === "shell_command") {
    const allowedCommands = new Set(
      (profile.commandRules?.rules ?? [])
        .map((rule) => rule.command)
        .filter((command): command is string => typeof command === "string"),
    );
    for (const rule of module.commandRules?.rules ?? []) {
      if (
        typeof rule.command === "string" &&
        !allowedCommands.has(rule.command)
      )
        blocked.push(`module:${String(module.id)}:command:${rule.command}`);
    }
  } else if (type === "report_output") {
    requires("report_issue");
  } else if (type === "workspace_changes") {
    const writePaths = profile.permissions?.files?.writePaths;
    if (!Array.isArray(writePaths) || writePaths.length === 0)
      blocked.push(`module:${String(module.id)}:writePaths`);
  }
  return blocked;
}

function readTask(task: Record<string, unknown>, path: string): TaskDocument {
  if (task.kind !== "natalia-task")
    fail(`${path}: kind must be "natalia-task"`);
  if (task.version !== 1) fail(`${path}: version must be 1`);
  stringField(task.taskID, "taskID");
  stringField(task.displayName, "displayName");
  stringField(task.prompt, "prompt");
  stringField(task.permissionProfile, "permissionProfile");
  if (!Array.isArray(task.alerts)) fail(`${path}: alerts must be an array`);
  if (!task.flow || typeof task.flow !== "object")
    fail(`${path}: flow is required`);
  stringField((task.flow as { flowID?: unknown }).flowID, "flow.flowID");
  optionalStringField(task.dataSource, "dataSource");
  optionalStringField(task.issueTarget, "issueTarget");
  return task as TaskDocument;
}

function readFlow(flow: Record<string, unknown>, path: string): FlowDocument {
  if (flow.kind !== "natalia-flow")
    fail(`${path}: kind must be "natalia-flow"`);
  if (flow.version !== 1) fail(`${path}: version must be 1`);
  stringField(flow.flowID, "flowID");
  stringField(flow.displayName, "displayName");
  if (!Array.isArray(flow.modules) || flow.modules.length === 0)
    fail(`${path}: modules must be a non-empty array`);
  for (const [index, module] of flow.modules.entries()) {
    if (!module || typeof module !== "object")
      fail(`${path}: modules[${index}] must be an object`);
    const record = module as FlowModule;
    stringField(record.id, `modules[${index}].id`);
    stringField(record.type, `modules[${index}].type`);
    stringField(record.displayName, `modules[${index}].displayName`);
    stringField(record.instructions, `modules[${index}].instructions`);
  }
  return flow as FlowDocument;
}

async function loadTask(
  workspaceRoot: string,
  file: string,
): Promise<{ task: TaskDocument; flow: FlowDocument }> {
  const taskPath = isAbsolute(file)
    ? file
    : resolve(workspaceRoot, ".natalia", "tasks", file);
  const task = readTask(await readYaml(taskPath), taskPath);
  const flowID = stringField(task.flow?.flowID, "flow.flowID");
  const flow = readFlow(
    (await findFlow(workspaceRoot, flowID)) as Record<string, unknown>,
    join(workspaceRoot, ".natalia", "flows", `${flowID}.yaml`),
  );
  return { task, flow };
}

function referencesFor(
  config: TaskConfig,
  task: TaskDocument,
): Record<string, unknown> {
  const permissionProfile = stringField(
    task.permissionProfile,
    "permissionProfile",
  );
  const references: Record<string, unknown> = {
    permissionProfile: {
      key: permissionProfile,
      approval: permissionApproval(config, permissionProfile),
    },
  };
  const issueTarget = optionalStringField(task.issueTarget, "issueTarget");
  if (issueTarget) references.issueTarget = { key: issueTarget };
  const dataSource = optionalStringField(task.dataSource, "dataSource");
  if (dataSource) references.dataSource = { key: dataSource };
  references.alertChannels = (task.alerts as unknown[]).map((alert) => ({
    key: stringField(alert, "alerts[]"),
  }));
  return references;
}

async function validateReferences(
  config: TaskConfig,
  task: TaskDocument,
): Promise<string[]> {
  const invalid: string[] = [];
  const permissionProfile = stringField(
    task.permissionProfile,
    "permissionProfile",
  );
  if (!config.permissionProfiles?.[permissionProfile])
    invalid.push(`permissionProfile:${permissionProfile}`);
  const issueTarget = optionalStringField(task.issueTarget, "issueTarget");
  if (issueTarget && !config.issueTargets?.[issueTarget])
    invalid.push(`issueTarget:${issueTarget}`);
  const dataSource = optionalStringField(task.dataSource, "dataSource");
  if (dataSource && !config.dataSources?.[dataSource])
    invalid.push(`dataSource:${dataSource}`);
  for (const alert of task.alerts as unknown[]) {
    const key = stringField(alert, "alerts[]");
    if (!config.alertChannels?.[key]) invalid.push(`alertChannel:${key}`);
  }
  return invalid;
}

async function validateTask(
  workspaceRoot: string,
  file: string,
): Promise<Record<string, unknown>> {
  const { task, flow } = await loadTask(workspaceRoot, file);
  const config = await loadTaskConfig(workspaceRoot);
  const invalid = await validateReferences(config, task);
  if (invalid.length > 0)
    fail(`task references are not configured: ${invalid.join(", ")}`);
  return {
    status: "valid",
    taskID: stringField(task.taskID, "taskID"),
    flowID: stringField(flow.flowID, "flowID"),
    modules: (flow.modules as unknown[]).length,
    references: referencesFor(config, task),
  };
}

async function previewTask(
  workspaceRoot: string,
  file: string,
): Promise<Record<string, unknown>> {
  const { task, flow } = await loadTask(workspaceRoot, file);
  const config = await loadTaskConfig(workspaceRoot);
  const blocked = await validateReferences(config, task);
  const profileKey = stringField(task.permissionProfile, "permissionProfile");
  for (const module of flow.modules as FlowModule[]) {
    blocked.push(...moduleAllowed(config, profileKey, module, task));
  }
  return {
    taskID: stringField(task.taskID, "taskID"),
    flowID: stringField(flow.flowID, "flowID"),
    modules: (flow.modules as unknown[]).length,
    blocked,
  };
}

export async function handleTaskCommands(
  argv: readonly string[],
): Promise<boolean> {
  const command = argv[0];
  if (command !== "task" && command !== "flow") return false;
  const action = argv[1];
  const file = argv[2];
  if (!action || !file)
    fail(`${command} requires an action and a document path`);
  const workspaceRoot = valueAfter([...argv], "--workspace") ?? process.cwd();
  const json = argv.includes("--json");
  if (command === "flow") {
    if (action !== "validate") fail(`flow ${action} is not supported`);
    const flowIDFromFile = file.replace(/\.ya?ml$/u, "");
    const flow = await findFlow(workspaceRoot, flowIDFromFile).catch(
      async () =>
        await readYaml(resolve(workspaceRoot, ".natalia", "flows", file)),
    );
    const validated = readFlow(flow as Record<string, unknown>, file);
    const result = {
      status: "valid",
      flowID: stringField(validated.flowID, "flowID"),
      modules: (validated.modules as unknown[]).length,
    };
    console.log(
      json ? JSON.stringify(result, null, 2) : `valid ${result.flowID}`,
    );
    return true;
  }
  const result =
    action === "validate"
      ? await validateTask(workspaceRoot, file)
      : action === "preview"
        ? await previewTask(workspaceRoot, file)
        : fail(`task ${action} is not supported`);
  console.log(json ? JSON.stringify(result, null, 2) : JSON.stringify(result));
  return true;
}
