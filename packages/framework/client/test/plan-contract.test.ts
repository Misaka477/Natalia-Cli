import { expect, test } from "bun:test";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import type {
  ProviderStreamRequest,
  StreamingProvider,
} from "@natalia/runtime";
import { createRealRuntimeClient } from "../src";
import { officialPluginWorkspace } from "./plugin-test-helpers";
import {
  projectedRuntimeNotices,
  projectedWorkContracts,
} from "@natalia/session";

/** A provider whose first step proposes the contract, then settles. */
function proposeProvider(
  getProposal: () => {
    planID: string;
    scope?: string[];
    verification?: string[];
    constraints?: string[];
  } | null,
  settle: (result: string) => Array<
    | {
        type: "tool_call";
        calls: Array<{ id: string; name: string; arguments: string }>;
      }
    | { type: "content"; text: string }
    | { type: "done" }
  >,
): StreamingProvider {
  return {
    provider: "plan-propose",
    model: "plan-propose-model",
    async *stream(request: ProviderStreamRequest) {
      const proposal = getProposal();
      const toolResult = (
        request as {
          messages: Array<{
            role: string;
            content: string;
            toolCallID?: string;
          }>;
        }
      ).messages.find(
        (message) =>
          message.role === "tool" && message.toolCallID === "call_propose",
      );
      if (proposal && !toolResult) {
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_propose",
              name: "plan_propose",
              arguments: JSON.stringify(proposal),
            },
          ],
        };
        yield { type: "done" as const };
        return;
      }
      if (toolResult) {
        for (const chunk of settle(String(toolResult.content ?? "")))
          yield chunk;
        return;
      }
      yield { type: "content" as const, text: "ok" };
      yield { type: "done" as const };
    },
  };
}

test("plan_propose drafts, gates on the user, and lands the accepted contract", async () => {
  const root = await officialPluginWorkspace("plan-contract-accept");
  const events: RuntimeEvent[] = [];
  let planID = "";
  let settled = false;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract",
    permissionMode: "ask",
    provider: proposeProvider(
      () => ({
        planID,
        scope: ["packages/framework/runtime/src"],
        verification: ["bun test packages/framework/runtime"],
        constraints: ["no new runtime dependency"],
      }),
      (result) => {
        settled = true;
        expect(result).toContain('"accepted":true');
        return [{ type: "content" as const, text: "contract accepted" }];
      },
    ),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request" && event.scope === "work_contract")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.sessionAttach!("ses_plan_contract" as SessionID);
  await client.planDocWrite!({
    path: "plans/contract-plan.md",
    content: "# Contract plan\n\n- concrete steps\n",
    title: "Contract plan",
  });
  const marked = await client.planDocMark!({
    path: "plans/contract-plan.md",
    title: "Contract plan",
  });
  planID = marked.planID;
  await client.planDocActivate!(marked.planID);

  await client.submitAndWait!("propose the contract for the plan");
  expect(settled).toBe(true);
  const drafted = events.filter(
    (event) => event.type === "work_contract.drafted",
  );
  const accepted = events.filter(
    (event) => event.type === "work_contract.accepted",
  );
  expect(drafted).toHaveLength(1);
  expect(accepted).toHaveLength(1);
  expect(drafted[0]).toMatchObject({
    type: "work_contract.drafted",
    planID,
    scope: ["packages/framework/runtime/src"],
    source: "model",
  });
  expect(accepted[0]).toMatchObject({
    type: "work_contract.accepted",
    planID,
    acceptedBy: "user",
    constraints: ["no new runtime dependency"],
  });
  // The projection reports the contract as current.
  expect(projectedWorkContracts(events)).toEqual([
    {
      planID,
      version: 1,
      scope: ["packages/framework/runtime/src"],
      verification: ["bun test packages/framework/runtime"],
      constraints: ["no new runtime dependency"],
      status: "current",
      acceptedBy: "user",
      acceptedAt: expect.any(String) as unknown as string,
    },
  ]);
  await client.dispose?.();
}, 30_000);

test("plan_propose rejects placeholder fields and re-proposes after feedback", async () => {
  const root = await officialPluginWorkspace("plan-contract-placeholder");
  const events: RuntimeEvent[] = [];
  let planID = "";
  let proposed = 0;
  let settled = false;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract_ph",
    permissionMode: "ask",
    provider: {
      provider: "plan-propose-retry",
      model: "plan-propose-retry-model",
      async *stream(request: ProviderStreamRequest) {
        const proposeResult = (
          request as {
            messages: Array<{
              role: string;
              content: string;
              toolCallID?: string;
            }>;
          }
        ).messages
          .filter(
            (message) =>
              message.role === "tool" &&
              String(message.toolCallID ?? "").startsWith("call_propose"),
          )
          .at(-1);
        if (!proposeResult) {
          proposed += 1;
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_propose",
                name: "plan_propose",
                arguments: JSON.stringify(
                  proposed === 1
                    ? { planID, scope: ["all"] }
                    : { planID, scope: ["packages/framework/runtime/src"] },
                ),
              },
            ],
          };
          yield { type: "done" as const };
          return;
        }
        const result = String(proposeResult.content ?? "");
        if (proposed === 1) {
          // The placeholder draft was refused before the journal and before
          // the gate; the model re-proposes with concrete fields.
          expect(result).toContain('"accepted":false');
          expect(result).toContain("placeholder");
          proposed = 2;
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_propose",
                name: "plan_propose",
                arguments: JSON.stringify({
                  planID,
                  scope: ["packages/framework/runtime/src"],
                }),
              },
            ],
          };
          yield { type: "done" as const };
          return;
        }
        settled = true;
        expect(result).toContain('"accepted":true');
        yield { type: "content" as const, text: "second attempt accepted" };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request" && event.scope === "work_contract")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.sessionAttach!("ses_plan_contract_ph" as SessionID);
  await client.planDocWrite!({
    path: "plans/ph-plan.md",
    content: "# Placeholder plan\n",
    title: "Placeholder plan",
  });
  const marked = await client.planDocMark!({
    path: "plans/ph-plan.md",
    title: "Placeholder plan",
  });
  planID = marked.planID;
  await client.planDocActivate!(marked.planID);

  await client.submitAndWait!("propose the contract");
  expect(settled).toBe(true);
  // The placeholder draft never reached the journal; the re-proposal landed
  // and was accepted.
  expect(
    events.filter((event) => event.type === "work_contract.drafted"),
  ).toHaveLength(1);
  expect(
    events.filter((event) => event.type === "work_contract.accepted"),
  ).toHaveLength(1);
  await client.dispose?.();
}, 30_000);

test("plan_propose returns the rejection feedback without landing a contract", async () => {
  const root = await officialPluginWorkspace("plan-contract-reject");
  const events: RuntimeEvent[] = [];
  let planID = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract_reject",
    permissionMode: "ask",
    provider: proposeProvider(
      () => ({
        planID,
        scope: ["packages/framework/runtime/src"],
      }),
      (result) => {
        expect(result).toContain('"accepted":false');
        expect(result).toContain("rejected");
        return [{ type: "content" as const, text: "re-propose later" }];
      },
    ),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request" && event.scope === "work_contract")
      client.respondApproval({
        requestID: event.id,
        decision: "reject",
        feedback: "add the constraints",
      });
  });
  await client.sessionAttach!("ses_plan_contract_reject" as SessionID);
  await client.planDocWrite!({
    path: "plans/reject-plan.md",
    content: "# Reject plan\n",
    title: "Reject plan",
  });
  const marked = await client.planDocMark!({
    path: "plans/reject-plan.md",
    title: "Reject plan",
  });
  planID = marked.planID;
  await client.planDocActivate!(marked.planID);

  await client.submitAndWait!("propose the contract");
  // The draft stays for re-proposal; nothing is accepted.
  expect(
    events.filter((event) => event.type === "work_contract.drafted"),
  ).toHaveLength(1);
  expect(
    events.filter((event) => event.type === "work_contract.accepted"),
  ).toHaveLength(0);
  await client.dispose?.();
}, 30_000);

test("work_contract_read reports none before any proposal", async () => {
  const root = await officialPluginWorkspace("plan-contract-read");
  let readResult = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract_read",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        const toolResult = (
          request as {
            messages: Array<{
              role: string;
              content: string;
              toolCallID?: string;
            }>;
          }
        ).messages.find(
          (message) =>
            message.role === "tool" && message.toolCallID === "call_read",
        );
        if (toolResult) {
          readResult = String(toolResult.content ?? "");
          yield { type: "content" as const, text: "read done" };
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_read",
              name: "work_contract_read",
              arguments: JSON.stringify({ planID: "plan:missing" }),
            },
          ],
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.sessionAttach!("ses_plan_contract_read" as SessionID);
  await client.submitAndWait!("check the contract");
  expect(readResult).toContain('"status":"none"');
  await client.dispose?.();
}, 30_000);

test("the handoff refuses without an accepted contract (Navi mailbox_send path)", async () => {
  const root = await officialPluginWorkspace("plan-contract-handoff");
  const events: RuntimeEvent[] = [];
  let streamCalls = 0;
  let planID = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract_handoff",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        streamCalls += 1;
        if (streamCalls === 1) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_handoff",
                name: "mailbox_send",
                arguments: JSON.stringify({
                  intent: "next_plan_handoff",
                  text: "plan ready",
                  relatedPlanID: planID,
                }),
              },
            ],
          };
          return;
        }
        yield { type: "content" as const, text: "cannot hand off" };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.sessionAttach!("ses_plan_contract_handoff" as SessionID);
  await client.planDocWrite!({
    path: "plans/handoff-plan.md",
    content: "# Handoff plan\n",
    title: "Handoff plan",
  });
  const marked = await client.planDocMark!({
    path: "plans/handoff-plan.md",
    title: "Handoff plan",
  });
  planID = marked.planID;
  await client.planDocActivate!(marked.planID);

  // Navi tries to hand off the plan without any accepted contract.
  await client.chatSubmit!({ text: "hand off the plan" });
  const toolUses = events.filter(
    (event) =>
      event.type === "navi.chat.tool.used" && event.toolName === "mailbox_send",
  );
  expect(toolUses).toHaveLength(1);
  const handoffResult = String(
    (toolUses[0] as { result?: string }).result ?? "",
  );
  expect(handoffResult).toContain("no accepted work contract");
  expect(handoffResult).toContain("plan_propose");
  // Nothing was queued.
  expect(
    events.filter(
      (event) =>
        event.type === "mailbox.queued" && event.intent === "next_plan_handoff",
    ),
  ).toHaveLength(0);
  await client.dispose?.();
}, 30_000);

test("plan_doc_mark records createdBy by source", async () => {
  const root = await officialPluginWorkspace("plan-contract-createdby");
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract_createdby",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "content" as const, text: "ok" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.sessionAttach!("ses_plan_contract_createdby" as SessionID);
  await client.planDocWrite!({
    path: "plans/createdby.md",
    content: "# CreatedBy plan\n",
    title: "CreatedBy plan",
  });
  const marked = await client.planDocMark!({
    path: "plans/createdby.md",
    title: "CreatedBy plan",
    createdBy: "main_agent",
  });
  const list = await client.planDocList!();
  const record = list.find((plan) => plan.planID === marked.planID);
  expect(record?.createdBy).toBe("main_agent");
  await client.dispose?.();
}, 30_000);

test("work_graph_query resolves a plan path and paginates the graph", async () => {
  const root = await officialPluginWorkspace("plan-contract-graph");
  const results: string[] = [];
  let streamCalls = 0;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract_graph",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        streamCalls += 1;
        const graphToolResult = (
          request as {
            messages: Array<{
              role: string;
              content: string;
              toolCallID?: string;
            }>;
          }
        ).messages
          .filter(
            (message) =>
              message.role === "tool" &&
              String(message.toolCallID ?? "").startsWith("call_graph"),
          )
          .at(-1);
        if (graphToolResult) {
          results.push(String(graphToolResult.content ?? ""));
          if (streamCalls <= 2) {
            // Query by plan document path — resolves to the planID.
            yield {
              type: "tool_call" as const,
              calls: [
                {
                  id: "call_graph",
                  name: "work_graph_query",
                  arguments: JSON.stringify({
                    path: "plans/graph-plan.md",
                    limit: 1,
                  }),
                },
              ],
            };
            yield { type: "done" as const };
            return;
          }
          yield { type: "content" as const, text: "graph queried" };
          yield { type: "done" as const };
          return;
        }
        // First: query the whole graph (no filter) to establish the cursor.
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_graph",
              name: "work_graph_query",
              arguments: JSON.stringify({ limit: 1 }),
            },
          ],
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.sessionAttach!("ses_plan_contract_graph" as SessionID);
  await client.planDocWrite!({
    path: "plans/graph-plan.md",
    content: "# Graph plan\n",
    title: "Graph plan",
  });
  await client.planDocMark!({
    path: "plans/graph-plan.md",
    title: "Graph plan",
  });
  await client.submitAndWait!("query the graph");
  expect(results.length).toBeGreaterThanOrEqual(2);
  const first = JSON.parse(results[0]!) as {
    total: number;
    nodes: Array<{ kind: string }>;
    nextCursor?: string;
  };
  const second = JSON.parse(results[1]!) as {
    planID: string;
    total: number;
    nodes: Array<{ kind: string }>;
  };
  // The unfiltered query is well-formed and paginates.
  expect(Array.isArray(first.nodes)).toBe(true);
  // The path query resolves to the marked plan's planID. No node references
  // the planID yet (B7 adds plan-linked node provenance), so the filter
  // honestly returns zero matches with the planID echoed.
  expect(second.planID.startsWith("plan_graph-plan")).toBe(true);
  expect(second.total).toBe(0);
  await client.dispose?.();
}, 30_000);

test("record_validation runs a command and writes evidence", async () => {
  const root = await officialPluginWorkspace("plan-contract-validation");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract_validation",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        const toolResult = (
          request as {
            messages: Array<{
              role: string;
              content: string;
              toolCallID?: string;
            }>;
          }
        ).messages.find(
          (message) =>
            message.role === "tool" && message.toolCallID === "call_validate",
        );
        if (toolResult) {
          yield { type: "content" as const, text: "validated" };
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_validate",
              name: "record_validation",
              arguments: JSON.stringify({
                taskID: "plan:1:s1",
                objective: "the runtime package typechecks",
                command: "true",
              }),
            },
          ],
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.sessionAttach!("ses_plan_contract_validation" as SessionID);
  await client.submitAndWait!("validate");
  const evidence = events.filter((event) => event.type === "evidence.recorded");
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({
    type: "evidence.recorded",
    taskID: "plan:1:s1",
    objective: "the runtime package typechecks",
    status: "validated",
  });
  await client.dispose?.();
}, 30_000);

test("record_completion and record_decision write durable journal facts", async () => {
  const root = await officialPluginWorkspace("plan-contract-records");
  const events: RuntimeEvent[] = [];
  let toolResults = 0;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract_records",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request: ProviderStreamRequest) {
        const toolResult = (
          request as {
            messages: Array<{
              role: string;
              content: string;
              toolCallID?: string;
            }>;
          }
        ).messages
          .filter((message) => message.role === "tool")
          .at(-1);
        if (toolResult) toolResults += 1;
        if (toolResults < 2) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: `call_record_${toolResults + 1}`,
                name:
                  toolResults === 0 ? "record_completion" : "record_decision",
                arguments: JSON.stringify(
                  toolResults === 0
                    ? {
                        taskID: "plan:1:s1",
                        objective: "split the system prompt",
                        changeSummary:
                          "static persona and dynamic runtime context",
                      }
                    : {
                        decision: "runtime context is appended, not injected",
                        rationale: ["keeps the cacheable prefix stable"],
                      },
                ),
              },
            ],
          };
          yield { type: "done" as const };
          return;
        }
        yield { type: "content" as const, text: "recorded" };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.sessionAttach!("ses_plan_contract_records" as SessionID);
  await client.submitAndWait!("record it");
  expect(
    events.filter((event) => event.type === "completion.recorded"),
  ).toHaveLength(1);
  expect(
    events.filter((event) => event.type === "decision.recorded"),
  ).toHaveLength(1);
  const completion = events.find(
    (event) => event.type === "completion.recorded",
  );
  expect(completion).toMatchObject({
    type: "completion.recorded",
    taskID: "plan:1:s1",
    changeSummary: "static persona and dynamic runtime context",
  });
  await client.dispose?.();
}, 30_000);

test("audit_report writes an evidence record for every round (EI §8.1)", async () => {
  const root = await officialPluginWorkspace("plan-contract-audit-evidence");
  const events: RuntimeEvent[] = [];
  let planID = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract_audit",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        const toolResult =
          // The Nia turn's messages carry the audit_report tool result.
          (
            arguments[0] as {
              messages: Array<{
                role: string;
                content: string;
                toolCallID?: string;
              }>;
            }
          ).messages.find(
            (message) =>
              message.role === "tool" && message.toolCallID === "call_audit",
          );
        if (toolResult) {
          yield { type: "content" as const, text: "audit reported" };
          yield { type: "done" as const };
          return;
        }
        yield {
          type: "tool_call" as const,
          calls: [
            {
              id: "call_audit",
              name: "audit_report",
              arguments: JSON.stringify({ planID, verdict: "passed" }),
            },
          ],
        };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.sessionAttach!("ses_plan_contract_audit" as SessionID);
  await client.planDocWrite!({
    path: "plans/audit-plan.md",
    content: "# Audit plan\n",
    title: "Audit plan",
  });
  const marked = await client.planDocMark!({
    path: "plans/audit-plan.md",
    title: "Audit plan",
  });
  planID = marked.planID;
  await client.planDocActivate!(marked.planID);
  await client.chatSubmit!({ channel: "nia", text: "audit the plan" });
  const evidence = events.filter((event) => event.type === "evidence.recorded");
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({
    type: "evidence.recorded",
    taskID: planID,
    status: "validated",
  });
  const auditEvidence = evidence[0] as {
    objective: string;
    validations: Array<{ command: string; result: string }>;
  };
  expect(auditEvidence.objective).toContain("Nia audit round 1");
  expect(auditEvidence.validations[0]).toMatchObject({ result: "passed" });
  await client.dispose?.();
}, 30_000);

test("a config reload emits a context.instructions notice with a monotonic revision", async () => {
  const root = await officialPluginWorkspace("plan-contract-reload");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plan_contract_reload",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "content" as const, text: "ok" };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.sessionAttach!("ses_plan_contract_reload" as SessionID);
  await client.reloadConfig!();
  const notices = events.filter(
    (event) => event.type === "context.instructions",
  );
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    type: "context.instructions",
    kind: "config_reload",
    revision: 1,
  });
  // A second reload raises the revision; history is never mutated.
  await client.reloadConfig!();
  const second = events.filter(
    (event) => event.type === "context.instructions",
  );
  expect(second).toHaveLength(2);
  expect(second[1]).toMatchObject({ revision: 2 });
  // The projection reports the latest revision per kind.
  expect(
    projectedRuntimeNotices(second).map((notice) => ({
      kind: notice.kind,
      revision: notice.revision,
    })),
  ).toEqual([{ kind: "config_reload", revision: 2 }]);
  // The notices contract answers with the same projected view.
  const contractNotices = await client.notices!();
  expect(contractNotices).toEqual([
    {
      noticeID: second[1]!.id,
      kind: "config_reload",
      revision: 2,
      at: second[1]!.at,
      summary: second[1]!.summary,
    },
  ]);
  await client.dispose?.();
}, 30_000);
