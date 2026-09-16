/**
 * Status projection: context budget, compaction, retries, selections, policy
 * outcomes and the session intelligence snapshot.
 *
 * Banners here are advisory strings a UI may show while something transient is
 * happening. They are derived, never durable truth — clearing one changes
 * nothing about the runtime.
 */
import type { RuntimeEvent } from "@natalia/contracts";
import { resetStreamsForRetry } from "./conversation";
import {
  appendBounded,
  completionLimit,
  constitutionConflictLimit,
  constitutionOverrideLimit,
  decisionLimit,
  evidenceLimit,
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
    case "runtime.step_usage": {
      // Per-session token/latency accumulation. Absent fields contribute
      // nothing (a step without provider usage still counts and carries
      // timing); each numeric field is a plain sum, matching the deepseek
      // session-stats fold the dashboard is modeled on.
      const usage = state.sessionUsage;
      usage.steps += 1;
      usage.inputTokens += event.inputTokens ?? 0;
      usage.outputTokens += event.outputTokens ?? 0;
      usage.cacheReadInputTokens += event.cacheReadInputTokens ?? 0;
      usage.cacheCreationInputTokens += event.cacheCreationInputTokens ?? 0;
      usage.llmMs += event.llmMs ?? 0;
      usage.toolMs += event.toolMs ?? 0;
      if (event.ttftMs !== undefined) {
        usage.ttftMs += event.ttftMs;
        usage.ttftSteps += 1;
      }
      usage.decodeMs += event.decodeMs ?? 0;
      return true;
    }
    case "work_contract.drafted":
      state.workContracts[event.planID] = {
        planID: event.planID,
        version: event.planVersion,
        ...(event.scope ? { scope: event.scope } : {}),
        ...(event.verification ? { verification: event.verification } : {}),
        ...(event.constraints ? { constraints: event.constraints } : {}),
        status: "draft",
      };
      return true;
    case "work_contract.accepted":
      state.workContracts[event.planID] = {
        planID: event.planID,
        version: event.planVersion,
        ...(event.scope ? { scope: event.scope } : {}),
        ...(event.verification ? { verification: event.verification } : {}),
        ...(event.constraints ? { constraints: event.constraints } : {}),
        status: "current",
        acceptedBy: event.acceptedBy,
        acceptedAt: event.acceptedAt,
        ...(event.unverifiable ? { unverifiable: true } : {}),
      };
      return true;
    case "plan.doc.updated": {
      // A plan document edit invalidates a draft extracted from the older
      // version (EI §8.2); an accepted contract is the user's commitment and
      // survives until a new one is approved.
      const contract = state.workContracts[event.planID];
      if (contract && contract.status === "draft") contract.stale = true;
      return true;
    }
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
    case "context.status": {
      const usage: import("./state").ContextUsageView = {
        used: event.used,
        max: event.max,
        source: event.source,
        thresholdPercent: event.thresholdPercent,
        reserved: event.reserved,
        ...(event.trigger === undefined ? {} : { trigger: event.trigger }),
      };
      if (event.channel === "navi") state.navi.context = usage;
      else if (event.channel === "nia") state.nia.context = usage;
      else state.context = usage;
      state.footer = `context ${event.used}/${event.max} source=${event.source}${
        event.trigger ? ` trigger=${event.trigger}` : ""
      }`;
      return true;
    }
    case "context.snapshot": {
      const usage: import("./state").ContextUsageView = {
        used: event.projectedTokens ?? event.pressureTokens ?? event.usedTokens,
        ...(event.contextWindow === undefined
          ? {}
          : { max: event.contextWindow }),
        source: event.source,
        contextWindow: event.contextWindow,
        pressureTokens: event.pressureTokens,
        projectedTokens: event.projectedTokens,
      };
      if (event.channel === "navi") state.navi.context = usage;
      else if (event.channel === "nia") state.nia.context = usage;
      else state.context = usage;
      return true;
    }
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
      resetStreamsForRetry(state, event.id, event.attempt);
      state.retryBanner = {
        kind: "turn_retry",
        text: `Retrying after ${event.reason} · attempt ${event.attempt}/${event.maxAttempts} · waiting ${event.retryAfterMs}ms`,
      };
      return true;
    case "step.retry":
      resetStreamsForRetry(state, event.id, event.attempt);
      // Stated from the event's own fields. Turning a retry into friendlier
      // prose is presentation, and belongs to whichever UI renders it.
      state.retryBanner = {
        kind: "step_retry",
        text: `Retrying ${event.operation} after ${event.reason} · attempt ${event.attempt}/${event.maxAttempts ?? "unlimited"} · waiting ${event.waitMs}ms`,
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
    case "context.instructions": {
      // ADR Phase C: a prompt-level instruction change arrives as a durable
      // event; the projection keeps the latest revision per kind (latest
      // wins), so a replay and a live stream converge on the same view.
      const existing = state.runtimeNotices.find(
        (notice) => notice.kind === event.kind,
      );
      if (existing && existing.revision >= event.revision) return true;
      const notice = {
        noticeID: event.id,
        kind: event.kind,
        revision: event.revision,
        at: event.at,
        summary: event.summary,
        ...(event.detail ? { detail: event.detail } : {}),
      };
      state.runtimeNotices = [
        ...state.runtimeNotices.filter((n) => n.kind !== event.kind),
        notice,
      ].sort((left, right) => left.at.localeCompare(right.at));
      return true;
    }
    case "model.selection":
      state.modelSelection = {
        modelID: event.modelID,
        variant: event.variant,
      };
      return true;
    case "task.selection":
      state.selectedTaskID = event.taskID;
      state.selectedEvidenceID = event.evidenceID;
      return true;
    case "evidence.recorded":
      state.evidence = appendBounded(state.evidence, event, evidenceLimit);
      upsertBlock(
        state,
        event.id,
        "system",
        `${event.status} · ${event.objective}`,
        event.status,
        { taskID: event.taskID },
      );
      return true;
    case "completion.recorded":
      state.completions = appendBounded(
        state.completions,
        event,
        completionLimit,
      );
      return true;
    case "constitution.rule_added":
      state.constitutionRules = {
        ...state.constitutionRules,
        [event.ruleID]: event,
      };
      return true;
    case "constitution.rule_updated": {
      const existing = state.constitutionRules[event.ruleID];
      if (!existing) return true;
      state.constitutionRules = {
        ...state.constitutionRules,
        [event.ruleID]: {
          ...existing,
          statement: event.statement ?? existing.statement,
          priority: event.priority ?? existing.priority,
        },
      };
      return true;
    }
    case "constitution.override_granted":
      state.constitutionOverrides = appendBounded(
        state.constitutionOverrides,
        event,
        constitutionOverrideLimit,
      );
      return true;
    case "decision.recorded":
      if (state.decisions.some((record) => record.id === event.id)) return true;
      state.decisions = appendBounded(state.decisions, event, decisionLimit);
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
      state.constitutionConflicts = appendBounded(
        state.constitutionConflicts,
        event,
        constitutionConflictLimit,
      );
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
