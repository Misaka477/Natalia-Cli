/**
 * The interactive question tool family, as a separately packaged family.
 *
 * Depends on the framework only for the tool-authoring surface (`RuntimeTool`,
 * `ToolFamily`, the argument helpers) and knows nothing about the runtime, the
 * capability kernel or the host that loads it. The actual question channel is
 * the host's: this tool calls the interactive channel the host provides on the
 * tool context, and fails cleanly when none exists.
 */
import {
  optionalString,
  requireObject,
  requireString,
  type RuntimeTool,
  type ToolFamily,
} from "@natalia/tools";

function askUserTool(): RuntimeTool {
  return {
    name: "ask_user",
    description:
      "Ask the user a structured question and wait for their answer.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        question: { type: "string" },
        options: { type: "array" },
        multiple: { type: "boolean" },
      },
      required: ["question", "options"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: { answers: { type: "array" } },
        required: ["answers"],
        additionalProperties: false,
      },
      presentCall(args) {
        return {
          kind: "generic",
          title: requireObject(args).question as string,
          summary: "ask",
        };
      },
      presentResult(args, value) {
        return {
          kind: "generic",
          title: requireObject(args).question as string,
          summary: "answered",
          body: value,
        };
      },
    },
    async execute(input, context) {
      if (!context.askQuestion)
        throw new Error("interactive question channel unavailable");
      const args = requireObject(input);
      if (!Array.isArray(args.options))
        throw new Error("options must be an array");
      const options = args.options.map((item) => ({ label: String(item) }));
      const answers = await context.askQuestion({
        title: optionalString(args.title) ?? "Question from Natalia",
        questions: [
          {
            id: "question_0",
            header: "Question",
            question: requireString(args.question, "question"),
            options,
            multiple: args.multiple === true,
            custom: true,
          },
        ],
      });
      return JSON.stringify({ answers }, null, 2);
    },
  };
}

export const askTools: RuntimeTool[] = [askUserTool()];

/**
 * Session scope: the question only makes sense for as long as the interactive
 * channel this session is attached to exists.
 */
export function askToolFamily(): ToolFamily {
  return {
    id: "ask",
    name: "Interactive Question Tools",
    version: "1.0.0",
    description: "Asking the user a structured question.",
    scope: "session",
    tools: askTools,
  };
}
