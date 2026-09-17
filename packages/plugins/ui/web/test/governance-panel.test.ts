import { expect, test } from "bun:test";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { applyEvent, initialState, type AppState } from "@natalia/view-store";
import {
  acknowledgeDriftFindingViaRpc,
  loadGovernanceSlices,
  removeConstitutionRuleViaRpc,
  updateConstitutionRuleViaRpc,
} from "../src/governance-panel";

test("loadGovernanceSlices handles data and all-empty surfaces", async () => {
  const filled = {
    constitutionRules: async () => [{ ruleID: "C-1" }],
    decisionRecords: async () => [{ id: "decision:1" }],
    evidenceRecords: async () => [{ taskID: "task:1" }],
    completions: async () => [{ taskID: "task:1" }],
    driftFindings: async () => [{ findingID: "DF-1" }],
    notices: async () => [{ noticeID: "notice:1" }],
  } as unknown as RuntimeClient;
  const data = await loadGovernanceSlices(filled, "ses_panel");
  expect(data.constitution).toHaveLength(1);
  expect(data.decisions).toHaveLength(1);
  expect(data.evidence).toHaveLength(1);
  expect(data.completions).toHaveLength(1);
  expect(data.drift).toHaveLength(1);
  expect(data.notices).toHaveLength(1);
  expect(data.errors).toEqual([]);

  const empty = await loadGovernanceSlices({} as RuntimeClient, "ses_panel");
  expect(empty).toEqual({
    constitution: [],
    decisions: [],
    evidence: [],
    completions: [],
    drift: [],
    notices: [],
    errors: [],
  });
});

test("each governance tab reports its own load failure without blanking the rest", async () => {
  const factories: Array<{
    label: string;
    runtime: () => RuntimeClient;
  }> = [
    {
      label: "Constitution",
      runtime: () =>
        ({
          constitutionRules: async () => {
            throw new Error("constitution offline");
          },
        }) as unknown as RuntimeClient,
    },
    {
      label: "Decisions",
      runtime: () =>
        ({
          decisionRecords: async () => {
            throw new Error("decisions offline");
          },
        }) as unknown as RuntimeClient,
    },
    {
      label: "Evidence",
      runtime: () =>
        ({
          evidenceRecords: async () => {
            throw new Error("evidence offline");
          },
        }) as unknown as RuntimeClient,
    },
    {
      label: "Completions",
      runtime: () =>
        ({
          completions: async () => {
            throw new Error("completions offline");
          },
        }) as unknown as RuntimeClient,
    },
    {
      label: "Drift",
      runtime: () =>
        ({
          driftFindings: async () => {
            throw new Error("drift offline");
          },
        }) as unknown as RuntimeClient,
    },
    {
      label: "Notices",
      runtime: () =>
        ({
          notices: async () => {
            throw new Error("notices offline");
          },
        }) as unknown as RuntimeClient,
    },
  ];
  for (const { label, runtime } of factories) {
    const bundle = await loadGovernanceSlices(runtime(), "ses_panel");
    expect(bundle.errors).toHaveLength(1);
    expect(bundle.errors[0]).toContain(label);
    expect(bundle.errors[0]).toContain("offline");
    // A failed tab must not suppress the others.
    expect(
      bundle.constitution.length +
        bundle.decisions.length +
        bundle.evidence.length +
        bundle.completions.length +
        bundle.drift.length +
        bundle.notices.length,
    ).toBe(0);
  }
});

test("drift click action calls RPC, updates the journal, and reload observes the new status", async () => {
  const journal: any[] = [
    {
      findingID: "DF-ACTION",
      severity: "warning" as const,
      confidence: 0.7,
      originalObjective: "stay on scope",
      currentActivity: "testing another package",
      evidence: [],
      applicableConstraints: [],
      status: "open" as const,
      contractVersion: 1,
      ruleHits: [{ rule: "target_drift", confidence: 0.7 }],
    },
  ];
  const runtime = {
    driftFindings: async () => journal.map((finding) => ({ ...finding })),
    acknowledgeDriftFinding: async (input: {
      findingID: string;
      status: "explained" | "disputed";
      rationale?: string;
    }) => {
      const finding = journal.find(
        (candidate) => candidate.findingID === input.findingID,
      );
      if (!finding) return { acknowledged: false };
      finding.status = input.status;
      if (input.rationale) finding["rationale"] = input.rationale;
      return { acknowledged: true };
    },
  } as unknown as RuntimeClient;

  const before = await loadGovernanceSlices(runtime, "ses_action");
  expect(before.drift[0]).toMatchObject({ status: "open" });
  await acknowledgeDriftFindingViaRpc(
    runtime,
    "ses_action",
    "DF-ACTION",
    "explained",
    "the package was added to the accepted scope",
  );
  const after = await loadGovernanceSlices(runtime, "ses_action");
  expect(after.drift[0]).toMatchObject({
    status: "explained",
    rationale: "the package was added to the accepted scope",
  });
  expect(after.errors).toEqual([]);
});

test("constitution actions call their RPCs and reload reflects update and tombstone", async () => {
  const journal: any[] = [
    {
      ruleID: "C-ACTION",
      statement: "no force push",
      scope: "project",
      priority: "high",
      source: "user",
      enforcement: "deny",
      overridePolicy: "forbidden",
      enabled: true,
    },
  ];
  const runtime = {
    constitutionRules: async () =>
      journal
        .filter((rule) => rule.enabled)
        .map((rule) => ({ ...rule })),
    updateConstitutionRule: async (input: { ruleID: string; enabled?: boolean }) => {
      const rule = journal.find((candidate) => candidate.ruleID === input.ruleID);
      if (!rule) return { updated: false };
      rule.enabled = input.enabled ?? rule.enabled;
      return { updated: true };
    },
    removeConstitutionRule: async (input: { ruleID: string }) => {
      const index = journal.findIndex((rule) => rule.ruleID === input.ruleID);
      if (index < 0) return { removed: false };
      journal.splice(index, 1);
      return { removed: true };
    },
  } as unknown as RuntimeClient;

  expect((await loadGovernanceSlices(runtime, "ses_action")).constitution)
    .toHaveLength(1);
  await updateConstitutionRuleViaRpc(runtime, "ses_action", "C-ACTION", false);
  expect((await loadGovernanceSlices(runtime, "ses_action")).constitution)
    .toHaveLength(0);
  // Tombstone removal is a separate call/RPC, not a silent edit.
  await updateConstitutionRuleViaRpc(runtime, "ses_action", "C-ACTION", true);
  await removeConstitutionRuleViaRpc(runtime, "ses_action", "C-ACTION");
  expect((await loadGovernanceSlices(runtime, "ses_action")).constitution)
    .toHaveLength(0);
});

test("the Decisions read requests session scope by default and workspace scope on demand", async () => {
  const calls: Array<unknown> = [];
  const runtime = {
    decisionRecords: async (input: unknown) => {
      calls.push(input);
      return [];
    },
  } as unknown as RuntimeClient;

  await loadGovernanceSlices(runtime, "ses_scope", { decisionScope: "session" });
  expect(calls[0]).toEqual({ sessionID: "ses_scope", scope: "session" });
  await loadGovernanceSlices(runtime, "ses_scope", {
    decisionScope: "workspace",
  });
  expect(calls[1]).toEqual({ sessionID: "ses_scope", scope: "workspace" });
});
