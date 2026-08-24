import { randomUUID } from "node:crypto";
import type { EpisodeID } from "@natalia/contracts";
import {
  SANDBOX_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  WORKSPACE_MUTATIONS_SERVICE,
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
      const changes = await sandboxes.merge(
        id,
        ctx.ports.getWorkspaceRoot(),
        async (paths) =>
          await ctx.ports.authorizeSandboxMerge({ id, paths }, owner),
      );
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
      return changes;
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
