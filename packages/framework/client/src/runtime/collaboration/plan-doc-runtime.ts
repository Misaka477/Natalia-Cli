/**
 * Lightweight Markdown plan document runtime — runtime/collaboration/
 * plan-doc-runtime.ts.
 *
 * Replaces the former C4 plan APIs. The workspace `.natalia/plans/` directory
 * owns the Markdown source files; `index.json` is the small registry that maps
 * planID → documentPath → lifecycle status. The runtime publishes plan.doc.*
 * events so session projections and the UI can stay in sync.
 *
 * Read-only: this module only writes `.natalia/plans/` plan documents and the
 * index. It never touches project source, shell, sandbox or checkpoints.
 */
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";

export type PlanDocRuntime = {
  planDocList(): Promise<
    Array<{
      planID: string;
      title: string;
      documentPath: string;
      status: string;
      createdBy: "user" | "live_chat" | "main_agent";
      createdAt: string;
      updatedAt: string;
      markedAt?: string;
    }>
  >;
  planDocRead(input: {
    planID?: string;
    path?: string;
  }): Promise<{
    planID?: string;
    title?: string;
    documentPath: string;
    content: string;
  }>;
  planDocWrite(input: {
    path: string;
    content: string;
    title?: string;
    planID?: string;
  }): Promise<{ written: boolean; planID?: string }>;
  planDocMark(input: {
    path: string;
    title?: string;
  }): Promise<{ marked: boolean; planID: string }>;
  planDocDelete(planID: string): Promise<{ deleted: boolean }>;
  planDocStatus(planID: string): Promise<{ status: string }>;
  planDocUpdateStatus(
    planID: string,
    status: string,
  ): Promise<{ updated: boolean }>;
};

type IndexEntry = Awaited<
  ReturnType<NonNullable<RuntimeServiceClient["planDocList"]>>
>[number];

const PLAN_DIR = ".natalia/plans";
const INDEX_FILE = join(PLAN_DIR, "index.json");

function planRoot(ctx: RuntimeContext) {
  return resolve(ctx.ports.getWorkspaceRoot(), PLAN_DIR);
}

async function readIndex(
  ctx: RuntimeContext,
): Promise<Record<string, IndexEntry>> {
  try {
    const raw = await readFile(join(planRoot(ctx), "index.json"), "utf8");
    const parsed = JSON.parse(raw) as Record<string, IndexEntry>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function writeIndex(
  ctx: RuntimeContext,
  entries: Record<string, IndexEntry>,
) {
  const root = planRoot(ctx);
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "index.json"),
    JSON.stringify(entries, null, 2),
    "utf8",
  );
}

function ensurePlanPath(ctx: RuntimeContext, inputPath: string) {
  if (!inputPath || typeof inputPath !== "string")
    throw new Error("plan document path is required");
  const root = planRoot(ctx) + "/";
  const resolved = resolve(root, inputPath);
  if (!resolved.startsWith(root) && resolved !== root)
    throw new Error(`plan document path is outside ${PLAN_DIR}: ${inputPath}`);
  if (isAbsolute(inputPath)) {
    const normalized = normalizeSlashes(relative(planRoot(ctx), resolved));
    if (normalized.startsWith("..")) throw new Error("plan path escapes .natalia/plans");
  }
  return resolved;
}

function normalizeSlashes(value: string) {
  return value.split(/[\\/]/u).join("/");
}

function relativePlanPath(ctx: RuntimeContext, absolute: string) {
  return normalizeSlashes(relative(planRoot(ctx), absolute));
}

function planIDForPath(path: string) {
  const basename = path.split(/[\\/]/u).pop() ?? "plan";
  const slug = basename
    .replace(/\.md$/iu, "")
    .replace(/[^a-z0-9_-]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
  return `plan_${slug || "doc"}`;
}

export function createPlanDocRuntime(ctx: RuntimeContext): PlanDocRuntime {
  function requireWorkLedger() {
    const ledger = ctx.ports.resolveService<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (!ledger)
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    return ledger;
  }

  function publish(event: import("@natalia/contracts").RuntimeEvent) {
    ctx.ports.publishForSession(ctx.ports.getActiveExec(), event);
  }

  return {
    async planDocList() {
      const entries = await readIndex(ctx);
      return Object.values(entries);
    },

    async planDocRead(input) {
      const entries = await readIndex(ctx);
      const record =
        (input.planID && entries[input.planID]) ||
        (input.path &&
          Object.values(entries).find(
            (entry) =>
              entry.documentPath === normalizeSlashes(input.path ?? ""),
          )) ||
        undefined;
      const targetPath = record
        ? ensurePlanPath(ctx, record.documentPath)
        : ensurePlanPath(ctx, input.path ?? "");
      const content = await readFile(targetPath, "utf8");
      return {
        ...(record ? { planID: record.planID } : {}),
        ...(record ? { title: record.title } : {}),
        documentPath: record ? record.documentPath : normalizeSlashes(input.path ?? ""),
        content,
      };
    },

    async planDocWrite(input) {
      const targetPath = ensurePlanPath(ctx, input.path);
      await mkdir(join(targetPath, ".."), { recursive: true });
      await writeFile(targetPath, input.content, "utf8");
      return { written: true, planID: input.planID };
    },

    async planDocMark(input) {
      const targetPath = ensurePlanPath(ctx, input.path);
      await stat(targetPath);
      const entries = await readIndex(ctx);
      const existing = Object.values(entries).find(
        (entry) => entry.documentPath === relativePlanPath(ctx, targetPath),
      );
      if (existing) return { marked: true, planID: existing.planID };
      const planID = `${planIDForPath(relativePlanPath(ctx, targetPath))}_${Date.now().toString(36)}`;
      const now = new Date().toISOString();
      const record: IndexEntry = {
        planID,
        title: input.title?.trim() || planID,
        documentPath: relativePlanPath(ctx, targetPath),
        status: "marked",
        createdBy: "user",
        createdAt: now,
        updatedAt: now,
        markedAt: now,
      };
      entries[planID] = record;
      await writeIndex(ctx, entries);
      publish(
        requireWorkLedger().buildPlanDocCreated({
          id: `${planID}:created:${ctx.ports.nextPlanSequence()}`,
          planID,
          title: record.title,
          documentPath: record.documentPath,
          createdBy: record.createdBy,
          status: record.status,
          createdAt: record.createdAt,
        }),
      );
      return { marked: true, planID };
    },

    async planDocDelete(planID) {
      const entries = await readIndex(ctx);
      if (!entries[planID]) return { deleted: false };
      delete entries[planID];
      await writeIndex(ctx, entries);
      publish({
        type: "plan.doc.deleted",
        id: `${planID}:deleted:${ctx.ports.nextPlanSequence()}`,
        planID,
        deletedAt: new Date().toISOString(),
      });
      return { deleted: true };
    },

    async planDocStatus(planID) {
      const entries = await readIndex(ctx);
      const record = entries[planID];
      return { status: record?.status ?? "unmarked" };
    },

    async planDocUpdateStatus(planID, status) {
      const entries = await readIndex(ctx);
      const record = entries[planID];
      if (!record) return { updated: false };
      const now = new Date().toISOString();
      record.status = status;
      record.updatedAt = now;
      entries[planID] = record;
      await writeIndex(ctx, entries);
      publish(
        requireWorkLedger().buildPlanDocStatus({
          id: `${planID}:status:${ctx.ports.nextPlanSequence()}`,
          planID,
          status,
          at: now,
        }),
      );
      return { updated: true };
    },
  };
}
