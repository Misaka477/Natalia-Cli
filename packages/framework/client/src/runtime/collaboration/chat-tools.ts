/**
 * Live Work Chat tools — runtime/collaboration/chat-tools.ts.
 *
 * Builds the tool surface the Chat runtime exposes: read-only main-agent tools
 * plus the collaboration/mailbox/plan drafting tools. Reads live state through
 * `RuntimeContext` at call time.
 */
import { projectedMailboxMessages, projectedPlans } from "@natalia/session";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import type { RuntimeTool } from "@natalia/tools";
import type { SessionID } from "@natalia/contracts";
import {
  COLLABORATION_SERVICE,
  type CollaborationService,
} from "@natalia/collaboration";
import { chatToolSummary } from "./chat-summary";
import { createPlansRuntime } from "./plans";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";

const CHAT_READ_ONLY_TOOLS = new Set([
  "read_file",
  "glob",
  "grep",
  "web_fetch",
  "web_search",
]);

export function createChatTools(ctx: RuntimeContext) {
  return {
    chatTools,
    chatToolSummary,
  };

  function chatTools(
    exec: SessionExecutionState | undefined = ctx.ports.getActiveExec(),
  ): RuntimeTool[] {
    const {
      getExecutionBySession,
      publishForSession,
      redactToolOutput,
      currentSessionSnapshot,
      wakeMainForCollaboration,
      createCollabChatTool,
      enqueueMailboxMessage,
      cancelMailboxMessage,
      createPlanDraft,
    } = ctx.ports;
    const { tools } = ctx.state;
    const visible: RuntimeTool[] = [];
    for (const tool of tools.values())
      if (CHAT_READ_ONLY_TOOLS.has(tool.name)) visible.push(tool);
    visible.push(
      {
        name: "session_snapshot",
        description:
          "Read the main agent's current live status: agent status, current step, active tool, changed/unvalidated file counts, PTY and sandbox state. Call it when the user asks what the main agent is doing now or whether it finished something — the injected context can be a moment stale.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          if (!exec) return JSON.stringify({ agentStatus: "unknown" });
          return JSON.stringify(
            currentSessionSnapshot(exec, `snapshot:live:${exec.session.id}`),
          );
        },
      },
      {
        name: "mailbox_status",
        description:
          "Read the Live Work Chat mailbox: every intent with its priority, delivery policy and current status (queued/delivered/acknowledged). Call it when the user asks whether an intent reached the main agent.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          if (!exec) return "[]";
          return JSON.stringify(
            projectedMailboxMessages(exec.session.events).map((message) => ({
              messageID: message.messageID,
              priority: message.priority,
              intent: message.intent,
              safeSummary: message.safeSummary,
              deliveryPolicy: message.deliveryPolicy,
              status: message.status,
            })),
          );
        },
      },
      {
        name: "collab_suggest",
        description:
          "Send a suggestion to the main agent (Natalia) — a collaborator's view the user has not necessarily decided on. Natalia sees it in her next turn's context and may adopt, reject or defer it. Use sparingly, only when the suggestion is genuinely useful and grounded in the shared context.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            suggestion: { type: "string" },
            rationale: { type: "string" },
            priority: { type: "string", enum: ["normal", "high"] },
          },
          required: ["suggestion"],
          additionalProperties: false,
        },
        async execute(parsed, context) {
          const args = parsed as {
            suggestion?: string;
            rationale?: string;
            priority?: string;
          };
          if (typeof args.suggestion !== "string" || !args.suggestion.trim())
            return "collab_suggest requires suggestion";
          if (!exec) return "no session";
          const service = ctx.ports.resolveService<CollaborationService>(
            COLLABORATION_SERVICE,
          );
          if (!service) return "collaboration service unavailable";
          const { message } = await service.send({
            sessionID: exec.session.id as SessionID,
            kind: "suggestion",
            from: "live_chat",
            text: redactToolOutput(args.suggestion, true),
            ...(args.rationale
              ? { rationale: redactToolOutput(args.rationale, true) }
              : {}),
            priority: args.priority === "high" ? "high" : "normal",
          });
          // Symmetric round-robin: if the main agent is idle, wake it to see
          // the suggestion; if it is working, the suggestion reaches its next
          // turn through <navi_collaborations>.
          wakeMainForCollaboration(exec, message.id, "suggestion");
          return JSON.stringify({ sent: true });
        },
      },
      {
        name: "collab_answer",
        description:
          "Answer a question the main agent (Natalia) asked you through the collaboration channel. Include the question's exact message ID from the context's natalia_collaborations block, and answer based on the shared context.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            questionID: { type: "string" },
            answer: { type: "string" },
          },
          required: ["questionID", "answer"],
          additionalProperties: false,
        },
        async execute(parsed, context) {
          const args = parsed as { questionID?: string; answer?: string };
          if (
            typeof args.questionID !== "string" ||
            typeof args.answer !== "string"
          )
            return "collab_answer requires questionID and answer";
          const owner = context.sessionID
            ? getExecutionBySession().get(context.sessionID as SessionID)
            : undefined;
          if (!owner) return "no session";
          const service = ctx.ports.resolveService<CollaborationService>(
            COLLABORATION_SERVICE,
          );
          if (!service) return "collaboration service unavailable";
          let message;
          try {
            ({ message } = await service.send({
              sessionID: owner.session.id as SessionID,
              kind: "answer",
              from: "live_chat",
              replyToID: args.questionID,
              text: redactToolOutput(args.answer, true),
            }));
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
          wakeMainForCollaboration(owner, message.id, "answer");
          return JSON.stringify({ answered: true });
        },
      },
      createCollabChatTool("live_chat", exec),
      {
        name: "mailbox_send",
        description:
          "Send a durable intent to the main agent as a tagged ordinary message before the next model step. Ordinary intents (constraint, pause, request_report, …) send immediately. next_plan_handoff requires relatedPlanID of a user-accepted plan — propose the draft first and wait for Accept. intent is one of clarification, constraint, reprioritize, pause, cancel, request_report, proposed_change, next_plan_handoff.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            intent: { type: "string" },
            text: { type: "string" },
            priority: { type: "string", enum: ["normal", "high", "urgent"] },
            deliveryPolicy: {
              type: "string",
              enum: [
                "next_safe_boundary",
                "before_next_tool",
                "before_next_side_effect",
                "immediate_control",
              ],
            },
            relatedPlanID: { type: "string" },
          },
          required: ["intent", "text"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as {
            intent?: string;
            text?: string;
            priority?: string;
            deliveryPolicy?: string;
            relatedPlanID?: string;
          };
          if (typeof args.intent !== "string" || typeof args.text !== "string")
            return "mailbox_send requires intent and text";
          return JSON.stringify(
            await enqueueMailboxMessage(
              {
                intent: args.intent,
                text: args.text,
                ...(args.priority ? { priority: args.priority as never } : {}),
                ...(args.deliveryPolicy
                  ? { deliveryPolicy: args.deliveryPolicy as never }
                  : {}),
                ...(args.relatedPlanID
                  ? { relatedPlanID: args.relatedPlanID }
                  : {}),
              },
              exec,
            ),
          );
        },
      },
      {
        name: "mailbox_cancel",
        description:
          "Cancel a queued or delivered mailbox message that should not reach or remain with the main agent. Use the exact messageID from mailbox_send or the pending mailbox list.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            messageID: { type: "string" },
            reason: { type: "string" },
          },
          required: ["messageID"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { messageID?: string; reason?: string };
          if (typeof args.messageID !== "string")
            return "mailbox_cancel requires messageID";
          return JSON.stringify(
            await cancelMailboxMessage(args.messageID, args.reason, exec),
          );
        },
      },
      {
        name: "plan_create",
        description:
          "Create a new plan draft (author: live_chat). It does not touch the active plan. After drafting, call plan_propose so the user can Accept in Chat; only an accepted plan may be handed off.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            objective: { type: "string" },
            context: { type: "string" },
            nonGoals: { type: "array", items: { type: "string" } },
            assumptions: { type: "array", items: { type: "string" } },
            dependencies: { type: "array", items: { type: "string" } },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  detail: { type: "string" },
                  verification: { type: "string" },
                  goal: { type: "string" },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        content: { type: "string" },
                        acceptance: { type: "string" },
                      },
                      required: ["id", "content"],
                    },
                  },
                  evidenceRequirements: { type: "array", items: { type: "string" } },
                  risks: { type: "array", items: { type: "string" } },
                  doneCriteria: { type: "string" },
                },
                required: ["id", "title"],
              },
            },
            constraints: { type: "array", items: { type: "string" } },
            verification: { type: "array", items: { type: "string" } },
            riskNotes: { type: "array", items: { type: "string" } },
            overallVerification: { type: "array", items: { type: "string" } },
            rollbackCriteria: { type: "array", items: { type: "string" } },
            communicationRules: { type: "array", items: { type: "string" } },
          },
          required: ["title", "objective", "steps"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as {
            title?: string;
            objective?: string;
            context?: string;
            nonGoals?: string[];
            assumptions?: string[];
            dependencies?: string[];
            steps?: Array<{
              id: string;
              title: string;
              detail?: string;
              verification?: string;
              goal?: string;
              tasks?: Array<{
                id: string;
                content: string;
                acceptance?: string;
              }>;
              evidenceRequirements?: string[];
              risks?: string[];
              doneCriteria?: string;
            }>;
            constraints?: string[];
            verification?: string[];
            riskNotes?: string[];
            overallVerification?: string[];
            rollbackCriteria?: string[];
            communicationRules?: string[];
          };
          if (
            typeof args.title !== "string" ||
            typeof args.objective !== "string" ||
            !Array.isArray(args.steps)
          )
            return "plan_create requires title, objective and steps";
          return JSON.stringify(
            await createPlanDraft(
              {
                title: args.title,
                objective: args.objective,
                ...(args.context ? { context: args.context } : {}),
                ...(args.nonGoals ? { nonGoals: args.nonGoals } : {}),
                ...(args.assumptions ? { assumptions: args.assumptions } : {}),
                ...(args.dependencies ? { dependencies: args.dependencies } : {}),
                steps: args.steps,
                ...(args.constraints ? { constraints: args.constraints } : {}),
                ...(args.verification
                  ? { verification: args.verification }
                  : {}),
                ...(args.riskNotes ? { riskNotes: args.riskNotes } : {}),
                ...(args.overallVerification
                  ? { overallVerification: args.overallVerification }
                  : {}),
                ...(args.rollbackCriteria
                  ? { rollbackCriteria: args.rollbackCriteria }
                  : {}),
                ...(args.communicationRules
                  ? { communicationRules: args.communicationRules }
                  : {}),
              },
              exec,
            ),
          );
        },
      },
      {
        name: "plan_update",
        description:
          "Update a plan draft that live_chat authored (bump version). Use it to revise a draft before the user accepts it.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            planID: { type: "string" },
            objective: { type: "string" },
            steps: { type: "array" },
            constraints: { type: "array", items: { type: "string" } },
            verification: { type: "array", items: { type: "string" } },
            riskNotes: { type: "array", items: { type: "string" } },
            reason: { type: "string" },
          },
          required: ["planID"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { planID?: string; reason?: string };
          if (typeof args.planID !== "string")
            return "plan_update requires planID";
          const plan = projectedPlans(exec?.session.events ?? []).find(
            (candidate) =>
              candidate.planID === args.planID &&
              candidate.author === "live_chat" &&
              candidate.status === "draft",
          );
          if (!plan) return `no live_chat draft ${args.planID}`;
          const workLedgerController =
            ctx.ports.resolveService<WorkLedgerController>(
              WORK_LEDGER_CONTROLLER_SERVICE,
            );
          if (!workLedgerController)
            throw new Error("work ledger unavailable (natalia-work-ledger)");
          publishForSession(
            exec,
            workLedgerController.buildPlanTransition({
              id: `${plan.planID}:draft:${plan.version + 1}`,
              planID: plan.planID,
              version: plan.version + 1,
              transition: "draft_updated",
              at: new Date().toISOString(),
              reason: args.reason ?? "chat revision",
            }),
          );
          return JSON.stringify({ updated: true, planID: plan.planID });
        },
      },
      {
        name: "plan_propose",
        description:
          "Move a live_chat plan draft to proposed and wait for the user's Allow once / Allow session / Reject decision. Do not mailbox_send next_plan_handoff until this tool returns accepted.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            planID: { type: "string" },
          },
          required: ["planID"],
          additionalProperties: false,
        },
        async execute(parsed, context) {
          const args = parsed as { planID?: string };
          if (typeof args.planID !== "string")
            return "plan_propose requires planID";
          const known = projectedPlans(exec?.session.events ?? []);
          const plan = known.find(
            (candidate) =>
              candidate.planID === args.planID &&
              candidate.author === "live_chat",
          );
          if (!plan || plan.status !== "draft")
            return JSON.stringify({
              proposed: false,
              planID: args.planID,
              reason: `no draftable live_chat plan ${args.planID}`,
              knownPlans: known.map((candidate) => ({
                planID: candidate.planID,
                status: candidate.status,
                title: candidate.title,
              })),
            });
          const outcome = await createPlansRuntime(ctx).proposeAndWait(
            plan.planID,
            { signal: context.signal, blockingCaller: true },
          );
          if (!outcome.proposed)
            return JSON.stringify({ ...outcome, planID: plan.planID });
          if (outcome.decision === "reject") {
            const feedback = outcome.feedback?.trim();
            return JSON.stringify({
              proposed: true,
              planID: plan.planID,
              accepted: false,
              decision: "reject",
              ...(feedback ? { feedback } : {}),
              instruction: feedback
                ? `The user rejected this plan: ${feedback}. Do not hand it off. Continue helping without that plan.`
                : "The user rejected this plan. Do not hand it off. Continue helping without that plan.",
            });
          }
          if (outcome.decision === "cancelled")
            return JSON.stringify({
              proposed: true,
              planID: plan.planID,
              accepted: false,
              decision: "cancelled",
              instruction:
                "Plan approval was cancelled before the user decided. Do not hand it off.",
            });
          return JSON.stringify({
            proposed: true,
            planID: plan.planID,
            accepted: true,
            decision: outcome.decision ?? "once",
            instruction:
              "The user accepted this plan. Immediately mailbox_send next_plan_handoff with this relatedPlanID so Natalia can start.",
          });
        },
      },
    );
    return visible;
  }
}
