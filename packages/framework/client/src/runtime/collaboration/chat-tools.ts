/**
 * Live Work Chat tools — runtime/collaboration/chat-tools.ts.
 *
 * Builds the tool surface the Chat runtime exposes: read-only main-agent tools
 * plus the collaboration/mailbox/plan drafting tools. Reads live state through
 * `RuntimeContext` at call time.
 */
import {
  globWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
} from "@natalia/platform";
import { projectedMailboxMessages } from "@natalia/session";
import type { RuntimeTool } from "@natalia/tools";
import type { SessionID } from "@natalia/contracts";
import {
  COLLABORATION_SERVICE,
  type CollaborationService,
} from "@natalia/collaboration";
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
    channel: "navi" | "nia" = "navi",
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
    );
    if (!visible.some((tool) => tool.name === "read_file")) {
      visible.push({
        name: "read_file",
        description:
          "Read a text file inside the workspace. Use it when the user asks about project files or asks you to read a local document.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            offset: { type: "number" },
            limit: { type: "number" },
          },
          required: ["path"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { path?: string; offset?: number; limit?: number };
          if (typeof args.path !== "string")
            return "read_file requires path";
          try {
            const result = await readWorkspaceFile({
              workspaceRoot: ctx.ports.getWorkspaceRoot(),
              path: args.path,
              ...(args.offset ? { offset: args.offset } : {}),
              ...(args.limit ? { limit: args.limit } : {}),
            });
            return result.content;
          } catch (cause) {
            return cause instanceof Error ? cause.message : String(cause);
          }
        },
      });
    }
    if (!visible.some((tool) => tool.name === "glob")) {
      visible.push({
        name: "glob",
        description:
          "List files under a workspace directory matching a glob pattern. Use it to find md, source, config or test files.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            pattern: { type: "string" },
            path: { type: "string" },
            limit: { type: "number" },
          },
          required: ["pattern"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { pattern?: string; path?: string; limit?: number };
          if (typeof args.pattern !== "string")
            return "glob requires pattern";
          try {
            const result = await globWorkspaceFiles({
              workspaceRoot: ctx.ports.getWorkspaceRoot(),
              pattern: args.pattern,
              ...(args.path ? { path: args.path } : {}),
              ...(args.limit ? { limit: args.limit } : {}),
            });
            return JSON.stringify(result);
          } catch (cause) {
            return cause instanceof Error ? cause.message : String(cause);
          }
        },
      });
    }
    if (!visible.some((tool) => tool.name === "grep")) {
      visible.push({
        name: "grep",
        description:
          "Search file contents in the workspace with a regular expression. Use it to search code, docs or configuration.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            include: { type: "string" },
            limit: { type: "number" },
          },
          required: ["query"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { query?: string; include?: string; limit?: number };
          if (typeof args.query !== "string")
            return "grep requires query";
          try {
            const result = await searchWorkspaceFiles({
              workspaceRoot: ctx.ports.getWorkspaceRoot(),
              query: args.query,
              ...(args.include ? { include: args.include } : {}),
              ...(args.limit ? { limit: args.limit } : {}),
            });
            return JSON.stringify(result);
          } catch (cause) {
            return cause instanceof Error ? cause.message : String(cause);
          }
        },
      });
    }
    if (!visible.some((tool) => tool.name === "plan_doc_list")) {
      visible.push({
        name: "plan_doc_list",
        description:
          "List the current session's plan documents. Marked plan documents carry a stable planID and documentPath.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          return JSON.stringify(await ctx.ports.planDocRuntime.planDocList());
        },
      });
    }
    if (!visible.some((tool) => tool.name === "plan_doc_read")) {
      visible.push({
        name: "plan_doc_read",
        description:
          "Read a Markdown plan document by planID or path. Plan documents live under .natalia/plans/.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            planID: { type: "string" },
            path: { type: "string" },
          },
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { planID?: string; path?: string };
          if (!args.planID && !args.path)
            return "plan_doc_read requires planID or path";
          try {
            return JSON.stringify(
              await ctx.ports.planDocRuntime.planDocRead({
                ...(args.planID ? { planID: args.planID } : {}),
                ...(args.path ? { path: args.path } : {}),
              }),
            );
          } catch (cause) {
            return cause instanceof Error ? cause.message : String(cause);
          }
        },
      });
    }
    if (!visible.some((tool) => tool.name === "plan_doc_write")) {
      visible.push({
        name: "plan_doc_write",
        description:
          "Write or update a Markdown plan document under .natalia/plans/. Use it when the user asks to draft or revise a plan document. Never write project source with this tool.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
            title: { type: "string" },
          },
          required: ["path", "content"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { path?: string; content?: string; title?: string };
          if (typeof args.path !== "string" || typeof args.content !== "string")
            return "plan_doc_write requires path and content";
          try {
            return JSON.stringify(
              await ctx.ports.planDocRuntime.planDocWrite({
                path: args.path,
                content: args.content,
                ...(args.title ? { title: args.title } : {}),
              }),
            );
          } catch (cause) {
            return cause instanceof Error ? cause.message : String(cause);
          }
        },
      });
    }
    if (!visible.some((tool) => tool.name === "plan_doc_mark")) {
      visible.push({
        name: "plan_doc_mark",
        description:
          "Mark a Markdown plan document as a formal Plan. It returns a stable planID used for handoff and audit routing.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            title: { type: "string" },
          },
          required: ["path"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { path?: string; title?: string };
          if (typeof args.path !== "string")
            return "plan_doc_mark requires path";
          try {
            return JSON.stringify(
              await ctx.ports.planDocRuntime.planDocMark({
                path: args.path,
                ...(args.title ? { title: args.title } : {}),
              }),
            );
          } catch (cause) {
            return cause instanceof Error ? cause.message : String(cause);
          }
        },
      });
    }
    return visible;
  }
}
