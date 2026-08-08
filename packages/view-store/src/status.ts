/**
 * Status projection: context budget, compaction, retries, selections, policy
 * outcomes and the session intelligence snapshot.
 *
 * Banners here are advisory strings a UI may show while something transient is
 * happening. They are derived, never durable truth — clearing one changes
 * nothing about the runtime.
 */
import type { RuntimeEvent } from "@natalia/contracts";
import {
  appendBounded,
  policyDecisionLimit,
  upsertBlock,
  type AppState,
} from "./state";

/** Returns true when the event belongs to this projection. */
export function applyStatusEvent(
  state: AppState,
  event: RuntimeEvent,
): boolean {
  switch (event.type) {
    case "status.update":
      state.status = event.status;
      state.footer = [event.status, event.detail].filter(Boolean).join(" - ");
      return true;
    case "status.snapshot":
      state.statusSegments = [
        "mode:runtime",
        `model:${event.model}`,
        `provider:${event.provider}`,
        `ctx:${event.context}`,
        `step:${event.step}`,
        event.permissions,
        `bg:${event.background}`,
      ];
      return true;
    case "context.status":
      state.context = event;
      state.footer = `context ${event.used}/${event.max} source=${event.source}${
        event.trigger ? ` trigger=${event.trigger}` : ""
      }`;
      return true;
    case "context.checkpoint":
      return true;
    case "compaction.begin":
      state.compactionBanner = {
        kind: "compacting",
        text: `Compacting after ${event.trigger} · before ${event.beforeTokens}/${event.maxTokens} · reserved ${event.reservedTokens}`,
      };
      state.footer = state.compactionBanner.text;
      return true;
    case "compaction.end":
      state.compactionBanner = undefined;
      // Compaction rewrites what the model can still see, so the outcome belongs
      // in the transcript rather than only in a banner that disappears.
      upsertBlock(
        state,
        event.id,
        "system",
        event.success
          ? `compaction complete: ${event.beforeTokens} -> ${event.afterTokens} tokens in ${event.durationMs}ms`
          : `compaction failed atomically: ${event.error ?? "unknown"}`,
        event.success ? "compacted" : "failed",
      );
      state.footer = event.success
        ? "compaction complete"
        : "compaction failed";
      return true;
    case "context.limit.recovery":
      upsertBlock(
        state,
        `${event.id}:context-limit`,
        "system",
        event.compacted
          ? "context-limit recovery compacted once; retrying original step"
          : "context-limit recovery requested",
        "context_limit",
      );
      return true;
    case "turn.retry":
      state.retryBanner = {
        kind: "turn_retry",
        text: `Retrying after ${event.reason} · attempt ${event.attempt}/${event.maxAttempts} · waiting ${event.retryAfterMs}ms`,
      };
      return true;
    case "step.retry":
      // Stated from the event's own fields. Turning a retry into friendlier
      // prose is presentation, and belongs to whichever UI renders it.
      state.retryBanner = {
        kind: "step_retry",
        text: `Retrying ${event.operation} after ${event.reason} · attempt ${event.attempt}/${event.maxAttempts} · waiting ${event.waitMs}ms`,
      };
      return true;
    case "step.retry.cleared":
      state.retryBanner = undefined;
      state.footer = `retry recovered after ${event.attempts} attempts`;
      return true;
    case "step.retry.exhausted":
      state.retryBanner = undefined;
      // Exhaustion is terminal for the step, so it is recorded, not just shown.
      upsertBlock(
        state,
        `${event.id}:retry:exhausted`,
        "system",
        event.message,
        "retry_exhausted",
      );
      state.footer =
        event.retryable === false
          ? `not retryable: ${event.reason}`
          : `retry exhausted: ${event.reason}`;
      return true;
    case "agent.selection":
      state.agentSelection = { name: event.name, pending: event.pending };
      return true;
    case "model.selection":
      state.modelSelection = {
        modelID: event.modelID,
        variant: event.variant,
      };
      return true;
    case "policy.decision":
      // Kept so a UI can explain why a tool did not run. Allows are recorded
      // too, because "nothing was denied" is also an answer.
      state.policyDecisions = appendBounded(
        state.policyDecisions,
        event,
        policyDecisionLimit,
      );
      return true;
    case "constitution.check":
      // Only a conflicting check is worth surfacing; a rule that passed is not
      // news. Note this projection is empty in practice today: no production
      // code emits constitution rules, so nothing can conflict with them.
      if (!event.conflict) return true;
      upsertBlock(
        state,
        `constitution:${event.id}`,
        "system",
        `${event.enforcement} · ${event.statement} (${event.action} on ${event.resource})`,
        event.enforcement,
      );
      return true;
    case "session.snapshot":
      state.intelligence = event;
      return true;
    case "diagnostic":
      state.footer = `${event.level}: ${event.message}`;
      return true;
    default:
      return false;
  }
}
