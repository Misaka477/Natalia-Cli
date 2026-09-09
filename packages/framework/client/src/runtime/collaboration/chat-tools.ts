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
import { createWorkspaceRuntime } from "../workspace-runtime";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";
import { ensureSessionFullEvents } from "../session-full-events";

const CHAT_READ_ONLY_TOOLS = new Set([
  "read_file",
  "glob",
  "grep",
  "web_fetch",
  "web_search",
]);

export function createChatTools(ctx: RuntimeContext) {
  return {
    naviChatTools,
    niaChatTools,
    chatToolSummary,
  };

  function naviChatTools(
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
          await ensureSessionFullEvents(ctx, exec);
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
          await ensureSessionFullEvents(ctx, exec);
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
            return "collab_suggest requires a non-empty suggestion";
          if (!exec) return "no session";
          const service = ctx.ports.resolveService<CollaborationService>(
            COLLABORATION_SERVICE,
          );
          if (!service) return "collaboration service unavailable";
          let sent;
          try {
            ({ message: sent } = await service.send({
              sessionID: exec.session.id as SessionID,
              kind: "suggestion",
              from: "live_chat",
              text: redactToolOutput(args.suggestion, true),
              ...(args.rationale
                ? { rationale: redactToolOutput(args.rationale, true) }
                : {}),
              priority: args.priority === "high" ? "high" : "normal",
            }));
          } catch (error) {
            return `collab_suggest: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }
          const message = sent;
          // Symmetric round-robin: if the main agent is idle, wake it to see
          // the suggestion; if it is working, the suggestion reaches its next
          // turn through <navi_collaborations>.
          wakeMainForCollaboration(exec, message.id, "suggestion", "Navi");
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
            return "collab_answer requires questionID and answer; questionID comes from the <natalia_collaborations> context block";
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
            return `collab_answer: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }
          wakeMainForCollaboration(owner, message.id, "answer", "Navi");
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
            return "mailbox_send requires intent and text; intent must be one of clarification, constraint, reprioritize, pause, cancel, request_report, proposed_change, next_plan_handoff";
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
            return "mailbox_cancel requires messageID; use the exact messageID returned by mailbox_send or shown in the pending mailbox list";
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
          const args = parsed as {
            path?: string;
            offset?: number;
            limit?: number;
          };
          if (typeof args.path !== "string") return "read_file requires path";
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
          const args = parsed as {
            pattern?: string;
            path?: string;
            limit?: number;
          };
          if (typeof args.pattern !== "string") return "glob requires pattern";
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
          const args = parsed as {
            query?: string;
            include?: string;
            limit?: number;
          };
          if (typeof args.query !== "string") return "grep requires query";
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
            return "plan_doc_read requires planID or path; use plan_doc_list to find an available plan document";
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
          const args = parsed as {
            path?: string;
            content?: string;
            title?: string;
          };
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

  function niaChatTools(
    exec: SessionExecutionState | undefined = ctx.ports.getActiveExec(),
  ): RuntimeTool[] {
    const { currentSessionSnapshot } = ctx.ports;
    const visible = [...ctx.state.tools.values()].filter((tool) =>
      CHAT_READ_ONLY_TOOLS.has(tool.name),
    );
    visible.push(
      {
        name: "session_snapshot",
        description: "Read Natalia's current live session status.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          if (!exec) return JSON.stringify({ agentStatus: "unknown" });
          await ensureSessionFullEvents(ctx, exec);
          return JSON.stringify(
            currentSessionSnapshot(exec, `snapshot:nia:${exec.session.id}`),
          );
        },
      },
      {
        name: "mailbox_status",
        description: "Read Natalia's pending mailbox intents.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          if (!exec) return "[]";
          await ensureSessionFullEvents(ctx, exec);
          return JSON.stringify(projectedMailboxMessages(exec.session.events));
        },
      },
      {
        name: "plan_doc_list",
        description: "List this session's plan documents.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          return JSON.stringify(await ctx.ports.planDocRuntime.planDocList());
        },
      },
      {
        name: "plan_doc_read",
        description: "Read a plan document by planID or path.",
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
            return "plan_doc_read requires planID or path; use plan_doc_list to find an available plan document";
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
      },
    );
    visible.push(ctx.ports.createCollabChatTool("nia", exec));
    if (!visible.some((tool) => tool.name === "audit_report")) {
      visible.push({
        name: "audit_report",
        description:
          "Submit the audit outcome for an active plan. Use passed when every plan item is verified and no gaps remain; use gaps when the audit found missing evidence, incomplete implementation, or mismatches. The runtime will mark the plan completed or audit_gaps and route the result back to Natalia.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            planID: {
              type: "string",
              description: "The exact planID being audited.",
            },
            verdict: {
              type: "string",
              enum: ["passed", "gaps"],
              description:
                "passed when the plan is fully verified; gaps when there are open audit findings.",
            },
            gaps: {
              type: "array",
              items: { type: "string" },
              description:
                "Optional concrete gap descriptions when verdict is gaps.",
            },
          },
          required: ["planID", "verdict"],
          additionalProperties: false,
        },
        async execute(parsed, context) {
          const args = parsed as {
            planID?: string;
            verdict?: string;
            gaps?: string[];
          };
          if (
            typeof args.planID !== "string" ||
            (args.verdict !== "passed" && args.verdict !== "gaps")
          )
            return "audit_report requires planID and verdict passed|gaps";
          const status = args.verdict === "passed" ? "completed" : "audit_gaps";
          console.log("[nia-audit-report] submitting", {
            planID: args.planID,
            verdict: args.verdict,
            status,
            sessionID: (context as { sessionID?: string } | undefined)
              ?.sessionID,
          });
          let result;
          try {
            result = await ctx.ports.planDocRuntime.planDocUpdateStatus({
              planID: args.planID,
              status,
              ...((context as { sessionID?: string } | undefined)?.sessionID
                ? { sessionID: (context as { sessionID: string }).sessionID }
                : {}),
            });
          } catch (error) {
            return `audit_report: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }

          let round = 0;
          let roundCheckpointID: string | undefined;
          try {
            const sessionID = (context as { sessionID?: string } | undefined)
              ?.sessionID as import("@natalia/contracts").SessionID | undefined;
            const owner = sessionID
              ? ctx.ports.getExecutionBySession().get(sessionID)
              : exec;
            if (owner) {
              const checkpointController =
                await ctx.ports.initializeCheckpointController(owner);
              const rounds =
                (await checkpointController?.listAuditRounds?.(args.planID)) ??
                [];
              round = (rounds.at(-1)?.round ?? 0) + 1;
              const record =
                await checkpointController?.createAuditRoundCheckpoint?.({
                  planID: args.planID,
                  round,
                  verdict: args.verdict as "gaps" | "passed",
                  context: owner.context,
                  step: owner.context.journalStatus().messageCount,
                  sessionID: owner.session
                    .id as import("@natalia/contracts").SessionID,
                  turnID: (context as { turnID?: string } | undefined)?.turnID,
                });
              roundCheckpointID = record?.id;
            }
          } catch (error) {
            console.warn("[nia-audit-report] round checkpoint failed", {
              planID: args.planID,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          return JSON.stringify({
            reported: true,
            planID: args.planID,
            verdict: args.verdict,
            status,
            gaps: args.gaps ?? [],
            updated: result.updated,
            ...(round ? { round } : {}),
            ...(roundCheckpointID ? { roundCheckpointID } : {}),
            ...(args.verdict === "passed" ? { noWakeNatalia: true } : {}),
          });
        },
      });
    }
    visible.push({
      name: "diff_workspace",
      description:
        "Compare workspace state against audit round checkpoints without using Git. " +
        "Use target=last_audit to see changes since the previous audit, target=baseline for the full plan diff, " +
        "or target=rounds to compare two specific audit rounds. Restrict paths to avoid a huge diff.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["last_audit", "baseline", "rounds", "current"],
          },
          planID: { type: "string" },
          fromRound: { type: "number" },
          toRound: { type: "number" },
          paths: { type: "array", items: { type: "string" } },
          format: {
            type: "string",
            enum: ["unified", "summary", "files"],
          },
        },
        required: ["target"],
        additionalProperties: false,
      },
      async execute(parsed, context) {
        const args = parsed as {
          target?: string;
          planID?: string;
          fromRound?: number;
          toRound?: number;
          paths?: string[];
          format?: string;
        };
        if (!args.target) return "diff_workspace requires target";
        const sessionID = (context as { sessionID?: string } | undefined)
          ?.sessionID as import("@natalia/contracts").SessionID | undefined;
        const checkpoint = ctx.ports.getCheckpointRuntime();
        const paths = Array.isArray(args.paths)
          ? args.paths.filter(
              (value): value is string => typeof value === "string",
            )
          : undefined;
        const from =
          args.target === "last_audit"
            ? ({ kind: "last_audit", planID: args.planID } as const)
            : args.target === "baseline"
              ? ({ kind: "baseline" } as const)
              : args.target === "rounds"
                ? {
                    kind: "round",
                    planID: args.planID ?? "",
                    round: Number(args.fromRound ?? 0),
                  }
                : args.target === "current"
                  ? {
                      kind: "round",
                      planID: args.planID ?? "",
                      round: Number(args.toRound ?? 0),
                    }
                  : undefined;
        if (!from) return "diff_workspace: unsupported target";
        const to =
          args.target === "last_audit" || args.target === "baseline"
            ? ({ kind: "current" } as const)
            : args.target === "rounds"
              ? {
                  kind: "round",
                  planID: args.planID ?? "",
                  round: Number(args.toRound ?? 0),
                }
              : ({ kind: "current" } as const);
        try {
          if (!checkpoint.roundDiff)
            return "diff_workspace: round diff unavailable";
          const changes = await checkpoint.roundDiff({
            from: from as import("@natalia/contracts").CheckpointRef,
            to: to as import("@natalia/contracts").CheckpointRef,
            paths,
            includePatch: args.format !== "summary" && args.format !== "files",
            includeContent: false,
          });
          const additions = changes.reduce(
            (sum, change) => sum + change.additions,
            0,
          );
          const deletions = changes.reduce(
            (sum, change) => sum + change.deletions,
            0,
          );
          const rows =
            args.format === "files"
              ? changes.map((change) => ({
                  path: change.path,
                  operation: change.operation,
                  additions: change.additions,
                  deletions: change.deletions,
                }))
              : changes.map((change) => ({
                  path: change.path,
                  operation: change.operation,
                  additions: change.additions,
                  deletions: change.deletions,
                  ...(change.patch ? { patch: change.patch } : {}),
                }));
          return JSON.stringify({
            from,
            to,
            files: changes.length,
            additions,
            deletions,
            changes: rows,
          });
        } catch (error) {
          return `diff_workspace: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      },
    });
    return visible;
  }
}
