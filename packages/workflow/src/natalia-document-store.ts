import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import type {
  NataliaFlowDocument,
  NataliaFlowDocumentInput,
  NataliaTaskDocument,
  NataliaTaskDocumentInput,
} from "@natalia/contracts";
import { stringify } from "yaml";
import {
  parseNataliaDocumentYAML,
  validateNataliaDocument,
} from "./natalia-documents";

export class NataliaDocumentStore {
  readonly workspaceRoot: string;
  readonly flowsDir: string;
  readonly tasksDir: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = resolve(workspaceRoot);
    this.flowsDir = resolve(this.workspaceRoot, ".natalia", "flows");
    this.tasksDir = resolve(this.workspaceRoot, ".natalia", "tasks");
  }

  async saveFlow(
    document: NataliaFlowDocumentInput,
    path = `${document.flowID}.yaml`,
  ) {
    const target = this.resolveDocumentPath(this.flowsDir, path);
    const validated = validateNataliaDocument(document);
    if (validated.kind !== "natalia-flow")
      throw new Error("expected natalia-flow document");
    await saveDocument(target, validated);
    return target;
  }

  async saveTask(
    document: NataliaTaskDocumentInput,
    path = `${document.taskID}.yaml`,
  ) {
    const target = this.resolveDocumentPath(this.tasksDir, path);
    const validated = validateNataliaDocument(document);
    if (validated.kind !== "natalia-task")
      throw new Error("expected natalia-task document");
    await saveDocument(target, validated);
    return target;
  }

  async loadFlow(path: string): Promise<NataliaFlowDocument> {
    const document = await this.loadDocument(this.resolveFlowReference(path));
    if (document.kind !== "natalia-flow")
      throw new Error(
        `flow reference does not point to a natalia-flow: ${path}`,
      );
    return document;
  }

  async loadTask(path: string): Promise<NataliaTaskDocument> {
    const document = await this.loadTaskDocument(path);
    await this.resolveTaskFlow(document);
    return document;
  }

  /**
   * Reads and schema-validates a task definition without resolving its flow.
   * Editors need this narrower read so a task with a temporarily broken
   * reference remains editable; execution still calls loadTask() and fails
   * closed on that reference.
   */
  async loadTaskDocument(path: string): Promise<NataliaTaskDocument> {
    const document = await this.loadDocument(
      this.resolveDocumentPath(this.tasksDir, path),
    );
    if (document.kind !== "natalia-task")
      throw new Error(`task path does not point to a natalia-task: ${path}`);
    return document;
  }

  async resolveTaskFlow(
    task: NataliaTaskDocument,
  ): Promise<NataliaFlowDocument> {
    const flow = task.flow.path
      ? await this.loadFlow(task.flow.path)
      : await this.loadFlowByID(task.flow.flowID!);
    if (task.flow.flowID && flow.flowID !== task.flow.flowID)
      throw new Error(
        `task ${task.taskID} flow reference mismatch: expected ${task.flow.flowID}, found ${flow.flowID}`,
      );
    return flow;
  }

  async loadFlowByID(flowID: string): Promise<NataliaFlowDocument> {
    let entries: string[];
    try {
      entries = await readdir(this.flowsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new Error(`natalia flow not found: ${flowID}`);
      throw error;
    }
    const matches: NataliaFlowDocument[] = [];
    for (const entry of entries) {
      if (!/\.ya?ml$/iu.test(entry)) continue;
      const flow = await this.loadFlow(`.natalia/flows/${entry}`);
      if (flow.flowID === flowID) matches.push(flow);
    }
    if (!matches.length) throw new Error(`natalia flow not found: ${flowID}`);
    if (matches.length > 1)
      throw new Error(`natalia flow ID is ambiguous: ${flowID}`);
    return matches[0]!;
  }

  private resolveFlowReference(path: string) {
    const target = resolve(this.workspaceRoot, path);
    if (isInside(target, this.flowsDir)) return target;
    throw new Error(`flow reference must stay under .natalia/flows: ${path}`);
  }

  private resolveDocumentPath(directory: string, path: string) {
    const target = resolve(directory, path);
    if (!isInside(target, directory))
      throw new Error(
        `document path must stay under ${relative(this.workspaceRoot, directory)}: ${path}`,
      );
    if (!/\.ya?ml$/iu.test(basename(target)))
      throw new Error(
        `document path must use a .yaml or .yml extension: ${path}`,
      );
    return target;
  }

  private async loadDocument(path: string) {
    let source: string;
    try {
      source = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new Error(`natalia document not found: ${path}`);
      throw error;
    }
    return parseNataliaDocumentYAML(source);
  }
}

async function saveDocument(
  path: string,
  document: NataliaFlowDocument | NataliaTaskDocument,
) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${stringify(document)}\n`, { mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

function isInside(path: string, directory: string) {
  const pathRelative = relative(directory, path);
  return (
    pathRelative !== "" &&
    !pathRelative.startsWith("..") &&
    !pathRelative.includes("../")
  );
}
