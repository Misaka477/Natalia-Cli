/**
 * State-changing slash command handlers — runtime/slash-action.ts.
 *
 * These answer the `/…` commands that mutate session or runtime state
 * (selection, pause/resume, skills). They receive a `SlashDeps` bundle from the
 * commands router and return true when they handled the input.
 */
import type { SlashDeps } from "./index";

export async function tryActionSlashCommand(deps: SlashDeps): Promise<boolean> {
  const trimmed = deps.text.trim();
  const commandExec = deps.commandExec;
  let activeSkill = deps.activeSkill;
  if (trimmed.startsWith("/model ")) {
    const [modelID, variant] = trimmed
      .slice("/model ".length)
      .trim()
      .split(/\s+/u);
    if (!modelID) throw new Error("model ID is required");
    await deps.selectRuntimeModel(modelID, variant, commandExec);
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: `selected model ${modelID}${variant ? ` (${variant})` : ""}`,
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    return true;
  }
  if (trimmed.startsWith("/attach ")) {
    const [path, ...rest] = trimmed
      .slice("/attach ".length)
      .trim()
      .split(/\s+/u);
    if (!path || !rest.length)
      throw new Error("usage: /attach <workspace-relative-image> <prompt>");
    await deps.submitInput(
      { text: rest.join(" "), attachments: [path] },
      commandExec.session.id,
    );
    return true;
  }
  if (trimmed === "/agents") {
    const agents = deps.agentRegistry?.selectable() ?? [];
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: agents.length
        ? agents
            .map((agent) => `${agent.name}: ${agent.description}`)
            .join("\n")
        : "no selectable agents configured",
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    return true;
  }
  if (trimmed.startsWith("/agent ")) {
    const name = trimmed.slice("/agent ".length).trim();
    if (!name) throw new Error("agent name is required");
    const agent = deps.agentRegistry?.select(name);
    if (!agent) throw new Error(`agent not found: ${name}`);
    commandExec.selectedAgent = agent;
    if (commandExec === deps.getActiveExec()) {
      deps.applyAgentPolicy();
    }
    deps.applyAgentProvider(commandExec);
    deps.publish({ type: "agent.selection", name: agent.name, pending: false });
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: `selected agent ${agent.name}`,
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    return true;
  }
  if (trimmed === "/pause") {
    commandExec.paused = true;
    if (commandExec === deps.getActiveExec()) deps.setPaused(true);
    deps.publish({ type: "turn.paused", id: deps.id, reason: "slash command" });
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: "runtime paused",
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    return true;
  }
  if (trimmed === "/resume") {
    commandExec.paused = false;
    if (commandExec === deps.getActiveExec()) deps.setPaused(false);
    const waiters = commandExec.pauseWaiters;
    commandExec.pauseWaiters = [];
    for (const resolveWaiter of waiters) resolveWaiter();
    deps.publish({ type: "turn.resumed", id: deps.id });
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: "runtime resumed",
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    return true;
  }
  if (trimmed.startsWith("/skill ")) {
    const skills = deps.skillService();
    if (!skills) throw new Error("skill registry is not initialized");
    activeSkill = skills.resolve(trimmed.slice("/skill ".length).trim());
    commandExec.activeSkill = activeSkill;
    deps.commandContext.add({
      id: `skill:${activeSkill.qualifiedName}:${deps.commandContext.journalStatus().journalOffset}`,
      role: "system",
      content: `Active skill ${activeSkill.name}: ${activeSkill.description}\n${activeSkill.body}`,
    });
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: `activated skill ${activeSkill.qualifiedName}`,
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    return true;
  }
  if (trimmed.startsWith("/skill-resource ")) {
    if (!activeSkill) throw new Error("no active skill");
    const resource = trimmed.slice("/skill-resource ".length).trim();
    const skills = deps.skillService();
    if (!skills) throw new Error("skill service is not initialized");
    const content = await skills.readResource(activeSkill, resource);
    deps.publish({ type: "content.delta", id: deps.id, text: content });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({ type: "turn.finished", id: deps.id, stopReason: "done" });
    return true;
  }
  if (trimmed.startsWith("/skill-script ")) {
    if (!activeSkill) throw new Error("no active skill");
    const script = trimmed.slice("/skill-script ".length).trim();
    // A slash command runs inside the session's drain, so its cancellation
    // signal is the drain's, not the (never-assigned) activity closure: a
    // cancelled command aborts the skill script's child process.
    const skills = deps.skillService();
    if (!skills) throw new Error("skill service is not initialized");
    const result = await skills.runScript(activeSkill, script, {
      signal: deps.signal ?? commandExec.activeAbort?.signal,
    });
    deps.publish({
      type: "content.delta",
      id: deps.id,
      text: JSON.stringify(result, null, 2),
    });
    deps.publish({ type: "content.done", id: deps.id });
    deps.publish({
      type: "turn.finished",
      id: deps.id,
      stopReason: result.exitCode === 0 ? "done" : "error",
    });
    return true;
  }
  return false;
}
