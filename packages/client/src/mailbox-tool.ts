/**
 * The `mailbox_acknowledge` tool — how the main agent acknowledges the Live
 * Work Chat mailbox messages it has acted on.
 *
 * §56.20 injects delivered intents into the next turn's system prompt as
 * `<pending_user_intents>`. Without an acknowledgement, a message stays
 * `delivered` forever and keeps being re-injected every turn. The tool lets the
 * agent explicitly confirm which messages it processed; the runtime marks them
 * `acknowledged` and they stop being re-injected. This is the agent's own
 * confirmation, not a runtime guess, so the acknowledgement is honest.
 *
 * The tool is a pure shell: it validates the message ids and hands them to the
 * runtime through `onAcknowledge` (which publishes the durable
 * `mailbox.acknowledged` events). No mailbox content, tool results or secrets
 * pass through here.
 */
import type { RuntimeTool } from "@natalia/tools";

export function createMailboxAcknowledgeTool(input: {
  /** The runtime callback: mark each delivered message id acknowledged. */
  onAcknowledge: (messageIDs: string[]) => Promise<void>;
}): RuntimeTool {
  return {
    name: "mailbox_acknowledge",
    description:
      "Acknowledge Live Work Chat mailbox messages you have read and acted on. Call this after acting on the <pending_user_intents> block; acknowledged messages stop being re-injected.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        messageIDs: {
          type: "array",
          items: { type: "string" },
          description:
            "The messageIDs from the pending user intents to acknowledge",
        },
      },
      required: ["messageIDs"],
      additionalProperties: false,
    },
    async execute(raw) {
      const args =
        raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const messageIDs = Array.isArray(args.messageIDs)
        ? args.messageIDs.map(String).filter((id) => id.length > 0)
        : [];
      if (!messageIDs.length)
        return "No message ids supplied; nothing to acknowledge.";
      await input.onAcknowledge(messageIDs);
      return `Acknowledged ${messageIDs.length} mailbox message(s).`;
    },
  };
}
