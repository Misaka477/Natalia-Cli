"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_MODES = void 0;
exports.eventMode = eventMode;
exports.EVENT_MODES = {
    agent: "emit",
    approval: "emit",
    audit: "emit",
    capability: "emit",
    checkpoint: "emit",
    composition: "emit",
    // Discovery D2: findings are observation — emit, never flow-stopping.
    invariant: "emit",
    collab: "emit",
    compaction: "emit",
    completion: "emit",
    constitution: "emit",
    content: "emit",
    context: "emit",
    decision: "emit",
    detour: "emit",
    diagnostic: "emit",
    dialog: "emit",
    drift: "emit",
    evidence: "emit",
    goal: "emit",
    input: "emit",
    interactive: "emit",
    mailbox: "emit",
    mcp: "emit",
    model: "emit",
    navi: "emit",
    nia: "emit",
    chat: "emit",
    natalia: "emit",
    plan: "emit",
    plugin: "emit",
    policy: "emit",
    projections: "emit",
    question: "emit",
    resource: "emit",
    rollback: "emit",
    runtime: "emit",
    sandbox: "emit",
    session: "emit",
    settings: "emit",
    snapshot: "emit",
    status: "emit",
    step: "emit",
    subagent: "emit",
    terminal: "emit",
    thinking: "emit",
    tool: "emit",
    turn: "emit",
    work_contract: "emit",
    workgraph: "emit",
    workspace: "emit",
};
/** The declared mode of an event type. */
function eventMode(type) {
    var family = type.split(".")[0];
    return exports.EVENT_MODES[family];
}
