/**
 * Live Work Chat tools — runtime/collaboration/chat-tools.ts.
 *
 * Builds the tool surface the Chat runtime exposes: read-only main-agent tools
 * plus the collaboration/mailbox/plan drafting tools. Reads live state through
 * `RuntimeContext` at call time.
 */
import {
  projectedCollabMessages,
  projectedMailboxMessages,
  projectedPlans,
} from "@natalia/session";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import type { RuntimeTool } from "@natalia/tools";
import type { SessionID } from "@natalia/contracts";
import { chatToolSummary } from "./chat-summary";
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
      nextCollabSequence,
      wakeMainForCollaboration,
      createCollabChatTool,
      enqueueMailboxMessage,
      createPlanDraft,
    } = ctx.ports;
    const { tools } = ctx.state;
    const collabSequence = nextCollabSequence;
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
          const id = `collab:suggestion:${Date.now().toString(36)}:${collabSequence()}`;
          publishForSession(exec, {
            type: "collab.suggestion",
            id,
            from: "live_chat",
            to: "main_agent",
            suggestion: redactToolOutput(args.suggestion, true),
            ...(args.rationale
              ? { rationale: redactToolOutput(args.rationale, true) }
              : {}),
            priority: args.priority === "high" ? "high" : "normal",
            status: "proposed",
            at: new Date().toISOString(),
          });
          // Symmetric round-robin: if the main agent is idle, wake it to see
          // the suggestion; if it is working, the suggestion reaches its next
          // turn through <navi_collaborations>.
          wakeMainForCollaboration(exec, id, "suggestion");
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
          const questionID = args.questionID;
          // Models routinely truncate the id to its tail; accept an exact id
          // or a unique suffix of it.
          const target = projectedCollabMessages(owner.session.events).find(
            (message) =>
              message.kind === "question" &&
              message.status === "proposed" &&
              (message.id === questionID ||
                message.id.endsWith(questionID) ||
                questionID.endsWith(message.id)),
          );
          if (!target) return `no open question ${questionID}`;
          publishForSession(owner, {
            type: "collab.answer",
            id: `collab:answer:${Date.now().toString(36)}:${collabSequence()}`,
            // The matched question's real id, so the projection marks it answered.
            questionID: target.id,
            from: "live_chat",
            to: "main_agent",
            answer: redactToolOutput(args.answer, true),
            at: new Date().toISOString(),
          });
          wakeMainForCollaboration(owner, target.id, "answer");
          return JSON.stringify({ answered: true });
        },
      },
      createCollabChatTool("live_chat", exec),
      {
        name: "mailbox_send",
        description:
          "Queue a durable intent for the main agent, delivered at its next safe boundary. Call this only after the user has confirmed the directive in the conversation. intent is one of clarification, constraint, reprioritize, pause, cancel, request_report, proposed_change, next_plan_handoff.",
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
        name: "plan_create",
        description:
          "Create a new plan draft (author: live_chat). It does not touch the active plan; the user must accept it before it can be queued and handed off.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            objective: { type: "string" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  detail: { type: "string" },
                  verification: { type: "string" },
                },
                required: ["id", "title"],
              },
            },
            constraints: { type: "array", items: { type: "string" } },
            verification: { type: "array", items: { type: "string" } },
            riskNotes: { type: "array", items: { type: "string" } },
          },
          required: ["title", "objective", "steps"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as {
            title?: string;
            objective?: string;
            steps?: Array<{
              id: string;
              title: string;
              detail?: string;
              verification?: string;
            }>;
            constraints?: string[];
            verification?: string[];
            riskNotes?: string[];
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
                steps: args.steps,
                ...(args.constraints ? { constraints: args.constraints } : {}),
                ...(args.verification
                  ? { verification: args.verification }
                  : {}),
                ...(args.riskNotes ? { riskNotes: args.riskNotes } : {}),
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
          "Move a live_chat plan draft to proposed so the user can review and accept it.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            planID: { type: "string" },
          },
          required: ["planID"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { planID?: string };
          if (typeof args.planID !== "string")
            return "plan_propose requires planID";
          const plan = projectedPlans(exec?.session.events ?? []).find(
            (candidate) =>
              candidate.planID === args.planID &&
              candidate.author === "live_chat",
          );
          if (!plan || plan.status !== "draft")
            return `no draftable live_chat plan ${args.planID}`;
          const workLedgerController =
            ctx.ports.resolveService<WorkLedgerController>(
              WORK_LEDGER_CONTROLLER_SERVICE,
            );
          if (!workLedgerController)
            throw new Error("work ledger unavailable (natalia-work-ledger)");
          publishForSession(
            exec,
            workLedgerController.buildPlanTransition({
              id: `${plan.planID}:proposed:${Date.now().toString(36)}`,
              planID: plan.planID,
              version: plan.version,
              transition: "proposed",
              at: new Date().toISOString(),
            }),
          );
          return JSON.stringify({ proposed: true, planID: plan.planID });
        },
      },
    );
    return visible;
  }
}
