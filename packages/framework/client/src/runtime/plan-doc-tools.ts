/**
 * Model-facing plan read tools — runtime/plan-doc-tools.ts.
 *
 * ADR D4/B3: the plan正文 is never injected into any system prompt. The main
 * agent (and subagents, via a plan_ptr pointer) read the plan file itself with
 * `read_file`, and these tools give the main agent the same plan-document
 * access Navi and Nia have: list the workspace plan documents and read one by
 * planID or path. A low-churn pointer (planID + path + version) can travel in
 * the runtime context; the正文 never does.
 */
import type { RuntimeTool } from "@natalia/tools";
import type { RuntimeContext } from "./context";

/** Lists the workspace plan documents with their stable planIDs and paths. */
export function createPlanDocListTool(ctx: RuntimeContext): RuntimeTool {
  return {
    name: "plan_doc_list",
    description:
      "List the workspace plan documents under .natalia/plans/. Each entry carries a stable planID, title, status and documentPath. Use plan_doc_read to read one.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute() {
      return JSON.stringify(await ctx.ports.planDocRuntime.planDocList());
    },
  };
}

/** Reads one plan document by planID or path. */
export function createPlanDocReadTool(ctx: RuntimeContext): RuntimeTool {
  return {
    name: "plan_doc_read",
    description:
      "Read a Markdown plan document by planID or path. Plan documents live under .natalia/plans/. This is how you read the active plan's full text — the plan is never injected into your context, so read it before acting on it.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        planID: {
          type: "string",
          description: "The planID from plan_doc_list.",
        },
        path: {
          type: "string",
          description: "The document path (alternative to planID).",
        },
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
  };
}
