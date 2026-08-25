/**
 * Framework subsystem composition — initialize/framework-turn-orchestration.ts.
 *
 * Durable turn admission, promotion and dispatch ordering is a framework-
 * internal subsystem, not a plugin: this module constructs the turn controller
 * directly and contributes it as the `turn.controller` service. It depends on
 * the session-store subsystem, which is wired before it.
 */
import { createTurnController } from "@natalia/turn-orchestration";
import type { SessionID } from "@natalia/contracts";
import {
  SESSION_STORE_CONTROLLER_SERVICE,
  TURN_CONTROLLER_SERVICE,
  type ProviderModelController,
  type SessionStoreController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";

export type TurnOrchestrationHandle = { close(): void };

export function wireTurnOrchestration(
  ctx: RuntimeContext,
): TurnOrchestrationHandle {
  const registry = ctx.state.capabilityRegistry;
  const deps = ctx.state.initialize;
  const owner = registry.registerOwner({
    id: "natalia-turn-orchestration",
    name: "Turn Orchestration",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  const controller = createTurnController({
    session: ctx.ports.getSession,
    activeAbort: () => ctx.ports.getActiveExec()?.activeAbort,
    sessionFor: (id) =>
      ctx.state.executionBySession.get(id as SessionID)?.session ??
      ctx.ports.getSession(),
    activeAbortFor: (id) =>
      ctx.state.executionBySession.get(id as SessionID)?.activeAbort,
    persist: (fn) => {
      const persistence = ctx.ports
        .getSessionPersistence()
        .then(fn)
        .catch((error) =>
          ctx.ports.publish({
            type: "diagnostic",
            level: "warning",
            message: `session persistence deferred/failed: ${error instanceof Error ? error.message : String(error)}`,
          }),
        );
      ctx.ports.setSessionPersistence(persistence);
      return persistence;
    },
    saveInbox: async (snapshot) => {
      const sessionStore = ctx.ports.resolveService<SessionStoreController>(
        deps.serviceNames.sessionStoreController,
      );
      if (!sessionStore)
        throw new Error("session store unavailable (natalia-session-store)");
      await sessionStore.saveInbox(snapshot);
    },
    flush: async () => {
      await ctx.ports.getSessionPersistence();
    },
    runCommand: async (id, text, signal, ownerID) => {
      const owner = await ctx.ports.ensureExecution(ownerID as SessionID);
      ctx.ports.publishForSession(owner, { type: "turn.started", id });
      try {
        return await deps.handleCommand(id, text, signal, owner);
      } catch (error) {
        ctx.ports.publishForSession(owner, {
          type: "turn.cancelled",
          id,
          reason: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        deps.scheduleTitleGeneration(ownerID as SessionID);
      }
    },
    runTurn: async (input) => {
      deps.deliverQueuedMailboxAtBoundary(
        ctx.state.executionBySession.get(input.sessionID as SessionID),
      );
      try {
        const controller = ctx.ports.resolveService<ProviderModelController>(
          deps.serviceNames.providerModelController,
        );
        if (controller)
          await controller.runTurn(input.sessionID as SessionID, input);
        else {
          const exec = ctx.state.executionBySession.get(
            input.sessionID as SessionID,
          );
          ctx.ports.publishForSession(exec, {
            type: "diagnostic",
            level: "error",
            message: "Provider/model subsystem is unavailable.",
          });
          ctx.ports.publishForSession(exec, {
            type: "turn.finished",
            id: input.id,
            stopReason: "error",
          });
        }
      } finally {
        deps.scheduleTitleGeneration(input.sessionID as SessionID);
      }
    },
  });
  owner.contribute("services", TURN_CONTROLLER_SERVICE, controller);
  return {
    close() {
      controller.dispose();
    },
  };
}
