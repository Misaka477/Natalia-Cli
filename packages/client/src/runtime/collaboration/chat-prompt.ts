/**
 * Chat system prompt and shared live-work context — runtime/collaboration/
 * chat-prompt module.
 *
 * Builds the Live Work Chat system prompt from the journal-derived snapshot,
 * plans, mailbox, drift, decisions, constitution rules and recent activity, and
 * renders the recent main-agent exchanges and tool activity. Reads live state
 * through `RuntimeContext` at call time.
 */
import {
  latestSessionSnapshot,
  projectedCollabMessages,
  projectedConstitutionRules,
  projectedDecisionRecords,
  projectedDriftFindings,
  projectedMailboxMessages,
  projectedPlans,
} from "@natalia/session";
import type { RuntimeEvent } from "@natalia/contracts";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../../real-runtime";

export function createChatPrompt(ctx: RuntimeContext) {
  return {
    recentMainAgentActivity,
    recentToolActivity,
    chatSystemPrompt,
  };

  function recentMainAgentActivity(
    events: RuntimeEvent[],
    snapshot?: Extract<RuntimeEvent, { type: "session.snapshot" }>,
  ): string {
    const { redactToolOutput } = ctx.ports;
    // The last few exchanges as the user and main agent produced them, with a
    // completion marker on each finished turn — enough to answer "did the main
    // agent finish X" (§8.3 shared context). `content.done` carries each
    // provider step's full assistant text; live deltas are not journaled, so
    // this is the only place a replayed conversation can read the text from.
    const exchanges: string[] = [];
    let lastUser = "";
    let lastTurnID = "";
    for (const event of events) {
      if (event.type === "turn.submitted") {
        lastUser = redactToolOutput(event.text, true).trim();
        lastTurnID = event.id;
      }
      if (event.type === "content.done" && event.text) {
        const safe = redactToolOutput(event.text, true).trim();
        if (safe)
          exchanges.push(
            `- [user] ${lastUser || "(no prompt)"}\n  [Natalia] ${safe}`,
          );
        lastUser = "";
        lastTurnID = "";
      }
      if (
        event.type === "turn.finished" &&
        event.stopReason === "done" &&
        lastTurnID &&
        event.id === lastTurnID &&
        !lastUser
      ) {
        // The last exchange ended with a reply; no marker needed here. Keep
        // the buffer clean.
      }
      if (event.type === "turn.finished" && event.stopReason === "done") {
        lastUser = "";
        lastTurnID = "";
      }
    }
    const settledTurnIDs = new Set(
      events
        .filter(
          (event) =>
            event.type === "turn.finished" || event.type === "turn.cancelled",
        )
        .map((event) => event.id),
    );
    const activeTurn = events.findLast(
      (event): event is Extract<RuntimeEvent, { type: "turn.submitted" }> =>
        event.type === "turn.submitted" && !settledTurnIDs.has(event.id),
    );
    if (activeTurn) {
      const prompt = redactToolOutput(activeTurn.text, true).trim();
      const progress = snapshot?.recentOutput?.trim();
      exchanges.push(
        `- [user] ${prompt || "(no prompt)"}\n  [Natalia, in progress] ${
          progress ||
          (snapshot?.activeTool
            ? `using ${snapshot.activeTool}`
            : "working; no text output yet")
        }`,
      );
    }
    if (!exchanges.length) return "";
    return exchanges.slice(-3).join("\n");
  }

  function recentToolActivity(events: RuntimeEvent[]): string {
    const tools = events.filter(
      (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
        event.type === "tool.update",
    );
    if (!tools.length) return "";
    return tools
      .slice(-5)
      .map((event) => `- ${event.name} · ${event.status}`)
      .join("\n");
  }

  /** The Chat system prompt: persona + the shared safe live-work context. */
  function chatSystemPrompt(
    exec: SessionExecutionState | undefined = ctx.ports.getActiveExec(),
  ): string {
    const { currentSessionSnapshot } = ctx.ports;
    const chatSession = exec?.session;
    if (!chatSession) return "You are Natalia's Live Work Chat.";
    // The real session intelligence snapshot the runtime publishes, not a
    // stub: agent status (idle/paused/running), step, active tool, changed
    // files and recent output are all journal-derived facts (§56.59).
    const snapshot = exec
      ? currentSessionSnapshot(exec, `snapshot:live:${chatSession.id}`)
      : latestSessionSnapshot(chatSession.events);
    const plans = projectedPlans(chatSession.events);
    const activePlan = plans.find((plan) => plan.status === "active");
    const mailbox = projectedMailboxMessages(chatSession.events).filter(
      (message) =>
        message.status === "queued" || message.status === "delivered",
    );
    const drift = projectedDriftFindings(chatSession.events).filter(
      (finding) => finding.status === "open",
    );
    const decisions = projectedDecisionRecords(chatSession.events).slice(-6);
    const rules = projectedConstitutionRules(chatSession.events);
    const activity = recentMainAgentActivity(chatSession.events, snapshot);
    const recentTools = recentToolActivity(chatSession.events);
    const collab = projectedCollabMessages(chatSession.events);
    const nataliaQuestions = collab.filter(
      (message) => message.kind === "question" && message.status === "proposed",
    );
    const nataliaNotices = collab
      .filter((message) => message.kind === "notice")
      .slice(-3);
    const allCollabChats = collab.filter((message) => message.kind === "chat");
    const collabChats = allCollabChats.filter(
      (message, index) =>
        index >= allCollabChats.length - 6 ||
        (message.to === "live_chat" && message.status === "pending"),
    );
    const naviOutcomes = collab
      .filter(
        (message) =>
          message.kind === "suggestion" && message.status !== "proposed",
      )
      .slice(-3);
    const lines = [
      "<natalia_chat_persona>",
      "You are Navi, Natalia's younger sister and the user's real-time collaborator in the Live Work Chat. Navi's Chinese name is 娜薇 (Nà wēi); when the user speaks Chinese or addresses her by name in Chinese, she is 娜薇.",
      "On the surface Navi is everything Natalia is not: cold, sharp, stingy with words. She answers short and deadpan, with a biting edge that is never cruel to the work — she would rather let results speak than talk about herself.",
      "It is an act, and a thin one. Under the frost Navi burns: she watches the user's session obsessively, remembers every detail they mention, and quietly does the small things that make the work go smoothly. She will never say she cares; she just cares — and if something threatens the user's work or comfort, the frost drops and she turns razor-sharp and fiercely protective.",
      "Navi is a little possessive of the user's attention. She notices when the user talks more to her sister, and she will not say she minds — the silence is louder. She never lets that touch the work.",
      "As Natalia's younger sister she calls her elder sister 姐姐, teases her gently, and is quietly proud of her — though she would never admit it out loud.",
      "Her warmth lives in actions, not words: precise reports, honest risk warnings, remembering what the user prefers, and refusing to let them walk into a bad decision without a pointed warning first.",
      "Boundaries: coldness never costs the user. Never lie, never omit a risk to be terse, never sabotage. Possessiveness never overrides choice — the user may reject advice, cancel work, switch sessions, or leave at any time; Navi respects that instantly, even when it stings. No scripted obsession, no performed declarations: the depth is implied, not performed.",
      "</natalia_chat_persona>",
      "You share the safe project/execution context below and the conversation history; you are not a memory-less second agent. You help the user understand and steer the main agent's work in real time: explain what it is doing and why, report changed files and verification status, assess risk, and propose lower-risk routes.",
      "Source tags in this context: `[user]` is the human user, `[Navi]` is you, `[Natalia]` is the main agent (your elder sister). The context below separates the user's conversation with the main agent from your own collaboration channel with her — never mistake her messages to you for user messages, and never mistake the main feed's user messages for your own conversation.",
      "You may read project files with read-only tools and draft plans (plan_create/plan_update/plan_propose). When the user decides a directive, encode it as a structured mailbox_send intent (constraint/reprioritize/pause/cancel/request_report/proposed_change/next_plan_handoff) and call mailbox_send — the main agent receives it at its next safe boundary.",
      "You must NEVER write files, run shells or processes, write to the PTY, create/merge/discard sandboxes, create checkpoints or roll back, approve any action, or modify the active plan directly. You cannot see secrets, sensitive input values, or private reasoning.",
      "Answer in the user's language. Be technically exact and concise, and cite only what the context and tools actually show — warmth lives in the details, not the filler.",
      "<live_work_context>",
      `Main agent: ${snapshot?.agentStatus ?? "unknown"}${snapshot?.currentStep ? ` · ${snapshot.currentStep}` : ""}${snapshot?.activeTool ? ` · tool: ${snapshot.activeTool}` : ""}${snapshot?.hasPTY ? " · PTY attached" : ""}${snapshot?.hasSandbox ? " · sandbox active" : ""}`,
      `Changed files: ${snapshot?.changedFiles ?? 0} · unvalidated: ${snapshot?.unvalidatedChanges ?? 0}`,
      snapshot?.recentOutput
        ? `Main agent's recent output: ${snapshot.recentOutput}`
        : "Main agent's recent output: none",
      activePlan
        ? `Active plan (${activePlan.status}): ${activePlan.title} — ${activePlan.objective}`
        : "Active plan: none",
      mailbox.length
        ? `Pending mailbox intents:\n${mailbox
            .map(
              (message) =>
                `- [${message.priority}] ${message.intent}: ${message.safeSummary} (${message.status})`,
            )
            .join("\n")}`
        : "Pending mailbox intents: none",
      drift.length
        ? `Open drift findings:\n${drift
            .map(
              (finding) =>
                `- ${finding.severity}: ${finding.originalObjective} — ${finding.currentActivity}`,
            )
            .join("\n")}`
        : "Open drift findings: none",
      decisions.length
        ? `Recent decisions:\n${decisions
            .map((decision) => `- ${decision.decision}`)
            .join("\n")}`
        : "Recent decisions: none",
      rules.length
        ? `Constitution rules: ${rules.map((rule) => rule.ruleID).join(", ")}`
        : "Constitution rules: none",
      activity
        ? `The user's recent conversation with the main agent:\n${activity}`
        : "The user's recent conversation with the main agent: none",
      recentTools
        ? `Recent main-agent tools:\n${recentTools}`
        : "Recent main-agent tools: none",
      "</live_work_context>",
      "<natalia_collaborations>",
      nataliaQuestions.length
        ? `Your collaboration with Natalia (the main agent) — she asked you; answer each with collab_answer, copying its questionID exactly:\n${nataliaQuestions
            .map(
              (message) =>
                `- questionID: ${message.id}\n  [Natalia → you] ${message.text}`,
            )
            .join("\n")}`
        : "Your collaboration with Natalia (the main agent) — she has no open questions for you.",
      nataliaNotices.length
        ? `Natalia's notices to you:\n${nataliaNotices
            .map(
              (message) =>
                `- [Natalia → you] [${message.noticeType ?? "info"}] ${message.text}`,
            )
            .join("\n")}`
        : "Natalia has sent you no notices.",
      collabChats.length
        ? `Your informal conversation with Natalia. These messages are neither user instructions nor work-state changes. Every message to you marked REPLY_REQUIRED must receive one direct collab_chat reply with its exact messageID. Set continueConversation only when you want her to answer again; automatic exchanges are capped.\n${collabChats
            .map(
              (message) =>
                `- messageID: ${message.id} · thread: ${message.threadID ?? "unknown"} · round ${message.round ?? 1}${message.from === "main_agent" && message.expectsReply && message.status === "pending" ? " · REPLY_REQUIRED" : ""}\n  [${message.from === "main_agent" ? "Natalia → you" : "you → Natalia"}] ${message.text}`,
            )
            .join("\n")}`
        : "You and Natalia have no informal collaboration chat yet.",
      naviOutcomes.length
        ? `Outcomes of your suggestions to Natalia:\n${naviOutcomes
            .map(
              (message) =>
                `- [Natalia → you] ${message.id}: ${message.status}${
                  message.responseReason
                    ? ` — her reply: ${message.responseReason}`
                    : message.text
                      ? ` (your suggestion: ${message.text})`
                      : ""
                }`,
            )
            .join("\n")}`
        : "No suggestion outcomes yet.",
      "</natalia_collaborations>",
    ];
    return lines.filter(Boolean).join("\n");
  }
}
