import { randomUUID } from "node:crypto";
import type { EpisodeID, SandboxDiffKind } from "@natalia/contracts";
import {
  GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
  SANDBOX_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  WORKSPACE_MUTATIONS_SERVICE,
  type GovernanceLedgerController,
  type MutationRegistry,
  type RuntimeServiceClient,
  type SandboxService,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";

type SandboxRuntime = Pick<
  RuntimeServiceClient,
  | "sandboxList"
  | "sandboxDiff"
  | "sandboxResources"
  | "sandboxResourceOutput"
  | "sandboxMerge"
  | "sandboxDelete"
  | "sandboxResourceStop"
>;

export function createSandboxRuntime(
  ctx: RuntimeContext,
  episodeID?: EpisodeID,
): SandboxRuntime {
  function requireSandboxes() {
    const sandboxes = ctx.ports.resolveService<SandboxService>(SANDBOX_SERVICE);
    if (!sandboxes) throw new Error("sandbox controller unavailable");
    return sandboxes;
  }

  function requireWorkLedger() {
    const ledger = ctx.ports.resolveService<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (!ledger)
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    return ledger;
  }

  function mutationRegistry() {
    return ctx.ports.resolveService<MutationRegistry>(
      WORKSPACE_MUTATIONS_SERVICE,
    );
  }

  function requireGovernanceLedger() {
    const ledger = ctx.ports.resolveService<GovernanceLedgerController>(
      GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
    );
    if (!ledger)
      throw new Error(
        "governance ledger unavailable (natalia-governance-ledger)",
      );
    return ledger;
  }

  function promoteCommand() {
    const configured = ctx.ports.getTsRuntimeConfig()?.sandbox.promoteCommand;
    const command = configured?.trim() || "npm run typecheck";
    if (!command) throw new Error("sandbox promote command must not be empty");
    return command;
  }

  return {
    async sandboxList() {
      await ctx.ports.getReady();
      return (await requireSandboxes().list()).map((sandbox) => ({
        id: sandbox.id,
        root: sandbox.root,
        isolationLevel: sandbox.isolationLevel,
        changedFiles: sandbox.changedFiles.length,
        runningResources: sandbox.runningResources.length,
        envAllowlist: sandbox.envAllowlist,
      }));
    },
    async sandboxDiff(id) {
      await ctx.ports.getReady();
      return await requireSandboxes().previewMerge(id);
    },
    async sandboxResources(id) {
      await ctx.ports.getReady();
      return requireSandboxes().resourcesFor(id);
    },
    async sandboxResourceOutput(input) {
      await ctx.ports.getReady();
      return await requireSandboxes().resourceOutput(
        input.id,
        input.resourceID,
        input.maxBytes,
      );
    },
    async sandboxMerge(id) {
      await ctx.ports.getReady();
      const owner = ctx.ports.getActiveExec();
      if (!owner) throw new Error("session is not initialized");
      const sandboxes = requireSandboxes();
      await ctx.ports.authorizeSandboxManagement(
        "sandbox_merge",
        { id },
        owner,
      );
      const command = promoteCommand();
      const ledger = requireGovernanceLedger();
      const startedAt = performance.now();
      const taskID = `sandbox:${id}`;
      const objective = `promote sandbox ${id}`;
      const redact = (text: string) => ctx.ports.redactToolOutput(text, true);
      const publishPromotionEvidence = (input: {
        status: "promoted" | "failed";
        result: "passed" | "failed";
        output: string;
        durationMs: number;
        changes?: Array<{ path: string; kind: SandboxDiffKind }>;
        knownGaps?: string[];
      }) => {
        const outcome = ledger.boundValidationOutcome({
          command: redact(command),
          result: input.result,
          safeSummary: redact(input.output),
          durationMs: input.durationMs,
        });
        const evidence = ledger.buildEvidenceRecorded({
          id: `evidence:${Date.now().toString(36)}:${ctx.ports.nextEvidenceSequence()}`,
          taskID,
          objective,
          status: input.status,
          changes: (input.changes ?? []).map((change) => ({
            path: change.path,
            changeType: evidenceChangeType(change.kind),
            summary: change.path,
          })),
          validations: [outcome],
          knownGaps: input.knownGaps,
        });
        ctx.ports.publishForSession(owner, evidence);
        return { evidence, outcome };
      };
      let validation: { ok: boolean; exitCode: number; output: string };
      try {
        validation = await sandboxes.validate(id, command);
      } catch (error) {
        publishPromotionEvidence({
          status: "failed",
          result: "failed",
          output: error instanceof Error ? error.message : String(error),
          durationMs: performance.now() - startedAt,
          knownGaps: ["candidate failed validation; host unchanged"],
        });
        throw error;
      }
      const durationMs = performance.now() - startedAt;
      if (!validation.ok) {
        publishPromotionEvidence({
          status: "failed",
          result: "failed",
          output: validation.output,
          durationMs,
          knownGaps: ["candidate failed validation; host unchanged"],
        });
        throw new Error(
          `candidate ${id} failed validation (exit ${validation.exitCode}):\n${validation.output.slice(0, 2000)}`,
        );
      }
      try {
        const promotion = await sandboxes.promoteWithValidation(id, {
          command,
          hostRoot: ctx.ports.getWorkspaceRoot(),
          authorize: async (paths) =>
            await ctx.ports.authorizeSandboxMerge({ id, paths }, owner),
        });
        const changes = promotion.changedFiles;
        const operationID = `sandbox_merge:${id}:${randomUUID()}`;
        mutationRegistry()?.register({
          sessionID: owner.session.id,
          episodeID,
          operationID,
          toolName: "sandbox_merge",
          authorizedPaths: ["."],
          expectedOperations: ["added", "modified", "deleted"],
        });
        for (const change of changes) {
          ctx.ports.publishForSession(
            owner,
            requireWorkLedger().workspaceChangeNode({
              operationID,
              path: change.path,
              toolName: "sandbox_merge",
              sessionID: owner.session.id,
            }),
          );
        }
        mutationRegistry()?.settle(operationID);
        ctx.ports.publishForSession(owner, sandboxes.updateEvent(id));
        ctx.ports.publishForSession(owner, sandboxes.auditEvent(id, "merge"));
        const { evidence, outcome } = publishPromotionEvidence({
          status: "promoted",
          result: "passed",
          output: validation.output,
          durationMs,
          changes,
        });
        ctx.ports.publishForSession(
          owner,
          ledger.buildCompletionRecorded({
            id: `completion:${Date.now().toString(36)}:${ctx.ports.nextCompletionSequence()}`,
            taskID,
            objective,
            changeSummary: `${changes.length} files promoted from sandbox ${id}`,
            validations: [outcome],
            rollbackState: "available",
            evidenceIDs: [evidence.id],
            recordedAt: new Date().toISOString(),
          }),
        );
        await announcePromotionFollowUp(
          ctx,
          changes.map((change) => change.path),
        );
        return changes;
      } catch (error) {
        publishPromotionEvidence({
          status: "failed",
          result: "failed",
          output: error instanceof Error ? error.message : String(error),
          durationMs: performance.now() - startedAt,
          knownGaps: ["promotion did not land; host unchanged"],
        });
        throw error;
      }
    },
    async sandboxDelete(id) {
      await ctx.ports.getReady();
      const owner = ctx.ports.getActiveExec();
      if (!owner) throw new Error("session is not initialized");
      const sandboxes = requireSandboxes();
      await ctx.ports.authorizeSandboxManagement(
        "sandbox_delete",
        { id },
        owner,
      );
      const result = await sandboxes.delete(id);
      ctx.ports.publishForSession(owner, {
        type: "sandbox.update",
        id,
        status: "deleted",
        root: "",
        isolationLevel: "workspace",
        changedFiles: result.pendingChanges.length,
        runningResources: result.runningResources.length,
        target: { kind: "host", cwd: ctx.ports.getWorkspaceRoot() },
        resourcePolicy: "sandbox deleted after resource cleanup",
      });
      return result;
    },
    async sandboxResourceStop(input) {
      await ctx.ports.getReady();
      const owner = ctx.ports.getActiveExec();
      if (!owner) throw new Error("session is not initialized");
      const sandboxes = requireSandboxes();
      await ctx.ports.authorizeSandboxManagement(
        "sandbox_resource_stop",
        input,
        owner,
      );
      const resource = await sandboxes.stopResource(input.id, input.resourceID);
      ctx.ports.publishForSession(owner, sandboxes.updateEvent(input.id));
      ctx.ports.publishForSession(
        owner,
        sandboxes.auditEvent(input.id, "resource_stop"),
      );
      return resource;
    },
  };
}

function evidenceChangeType(
  kind: SandboxDiffKind,
): "added" | "modified" | "deleted" {
  if (kind === "add") return "added";
  if (kind === "delete") return "deleted";
  return "modified";
}

async function announcePromotionFollowUp(ctx: RuntimeContext, paths: string[]) {
  const frameworkTouched = paths.some(
    (path) =>
      path.startsWith("packages/framework/") || path.startsWith("apps/cli/"),
  );
  if (frameworkTouched) {
    ctx.ports.publish({
      type: "diagnostic",
      level: "warning",
      message: "restart_required",
    });
    return;
  }
  const families = new Set(
    paths
      .map((path) => {
        const match = /^packages\/plugins\/tools\/([^/]+)\//u.exec(path);
        return match?.[1];
      })
      .filter((family): family is string => Boolean(family)),
  );
  for (const family of families) {
    try {
      await ctx.ports.hotReloadToolFamily(family);
    } catch {
      ctx.ports.publish({
        type: "diagnostic",
        level: "warning",
        message: `tool family reload failed: ${family}`,
      });
    }
  }
}
