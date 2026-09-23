import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@anthelia/contracts";
import type { SkillService, SkillMetadata } from "@anthelia/runtime-services";
import type { StreamingProvider } from "@anthelia/runtime";
import {
  buildSelfReviewDigest,
  buildSelfReviewPrompt,
  createSelfReview,
  parseSelfReviewCandidates,
} from "../src/self-review";

/**
 * Discovery D4 — the side-channel self-review (hermes' four disciplines,
 * each testable one: bounded digest replay, main-conversation untouched,
 * live-runtime reuse, write-boundary whitelist). Deps are injected, so
 * the core runs pure.
 */

const events = [
  { type: "turn.submitted", id: "t1", text: "fix the parser" },
  { type: "content.delta", id: "d1", text: "parser patched" },
  { type: "turn.finished", id: "t1" },
  // Runtime choreography must NOT pollute the digest.
  { type: "turn.submitted", id: "t2", text: "wake", internal: true },
] as unknown as RuntimeEvent[];

test("the digest replays the work, skips runtime noise, and is bounded", () => {
  const digest = buildSelfReviewDigest(events);
  expect(digest).toContain("user: fix the parser");
  expect(digest).toContain("assistant: parser patched");
  expect(digest).not.toContain("wake");
  const huge = buildSelfReviewDigest(
    Array.from({ length: 5_000 }, (_, i) => ({
      type: "turn.submitted",
      id: `t${i}`,
      text: `x${i} `.repeat(400),
    })) as unknown as RuntimeEvent[],
  );
  expect(huge.length).toBeLessThanOrEqual(24_000 + 64);
  expect(huge).toContain("(truncated)"); // tail kept, head dropped
});

test("the prompt carries the task, the catalog, and an empty-catalog form", () => {
  const skills = [
    { name: "review", description: "Review code" },
    { name: "release" },
  ] as SkillMetadata[];
  const { messages } = buildSelfReviewPrompt("user: hi", skills);
  expect(messages).toHaveLength(2);
  expect(messages[0]!.role).toBe("system");
  expect(messages[0]!.content).toContain('"candidates"');
  expect(messages[0]!.content).toContain("Never propose deleting");
  expect(messages[1]!.content).toContain("- review: Review code");
  expect(messages[1]!.content).toContain("- release:");
  const none = buildSelfReviewPrompt("d", []);
  expect(none.messages[1]!.content).toContain("(none)");
});

test("parsing tolerates fences, chatter, arrays, and garbage", () => {
  const body = { candidates: [{ kind: "create", name: "x" }] };
  expect(parseSelfReviewCandidates(JSON.stringify(body))).toHaveLength(1);
  expect(
    parseSelfReviewCandidates(
      `Here you go:\n\`\`\`json\n${JSON.stringify(body)}\n\`\`\`\n`,
    ),
  ).toHaveLength(1);
  expect(parseSelfReviewCandidates("candidates: nope")).toEqual([]);
  expect(parseSelfReviewCandidates("")).toEqual([]);
});

function fakeProvider(text: string): StreamingProvider {
  return {
    stream: async function* () {
      for (let i = 0; i < text.length; i += 40)
        yield { type: "content" as const, text: text.slice(i, i + 40) };
    } as unknown as StreamingProvider["stream"],
  } as unknown as StreamingProvider;
}

function fakeSkills(upsert?: SkillService["upsertSkill"]) {
  const listed = [{ name: "existing", description: "d" }] as SkillMetadata[];
  return {
    resolve: () => listed[0]!,
    list: () => listed,
    authorizeTool: () => true,
    readResource: async () => "",
    runScript: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    upsertSkill:
      upsert ??
      (async (candidate) => {
        const c = candidate as { kind: string; name: string };
        return { created: c.kind === "create", name: c.name };
      }),
  } as unknown as SkillService;
}

const collectDeps = (
  over: Partial<Parameters<typeof createSelfReview>[0]> = {},
) => {
  const published: unknown[] = [];
  const deps = {
    enabled: () => true,
    provider: () => fakeProvider("{}"),
    events: () => events,
    skills: () => fakeSkills(),
    publish: (event: unknown) => published.push(event),
    ...over,
  };
  return { deps, published };
};

test("the loop completes with created/updated/rejected — boundary rejections counted, never fatal", async () => {
  const { deps, published } = collectDeps({
    provider: () =>
      fakeProvider(
        `{"candidates":[
          {"kind":"create","name":"parser-gotchas","description":"d","content":"# body"},
          {"kind":"update","name":"existing","description":"d","content":"# body2"},
          {"kind":"delete","name":"evil","description":"d","content":"x"}
        ]}`,
      ),
    skills: () =>
      fakeSkills(async (candidate) => {
        const c = candidate as { kind: string; name: string };
        if (c.kind === "delete")
          throw new Error("skill proposal rejected: action not whitelisted");
        return { created: c.kind === "create", name: c.name };
      }),
  });
  const handle = createSelfReview(deps);
  await handle.review("ses_d4", new AbortController());
  expect(published).toHaveLength(1);
  const completed = published[0] as Record<string, unknown>;
  expect(completed.type).toBe("self_review.completed");
  expect(completed.skillsCreated).toEqual(["parser-gotchas"]);
  expect(completed.skillsUpdated).toEqual(["existing"]);
  // The whitelist rejection at the boundary is counted, not fatal —
  // and the valid candidates still landed.
  expect(completed.rejected).toBe(1);
});

test("disabled is silent; missing provider surfaces an honest skip", async () => {
  const off = collectDeps({ enabled: () => false });
  const pending = createSelfReview(off.deps);
  pending.schedule("ses_d4");
  await new Promise((r) => setTimeout(r, 450));
  expect(off.published).toEqual([]); // disabled floods nothing
  expect(pending.pendingCount()).toBe(0);

  const noProvider = collectDeps({ provider: () => undefined });
  await createSelfReview(noProvider.deps).review(
    "ses_d4",
    new AbortController(),
  );
  expect(noProvider.published).toHaveLength(1);
  const skip = noProvider.published[0] as Record<string, unknown>;
  expect(skip.type).toBe("self_review.skipped");
  expect(skip.reason).toBe("no_provider");

  const noSkills = collectDeps({ skills: () => undefined });
  await createSelfReview(noSkills.deps).review("ses_d4", new AbortController());
  const skip2 = (noSkills.published as Record<string, unknown>[])[0]!;
  expect(skip2.reason).toBe("no_skills");
});

test("an admission supersedes a pending review — the hermes fence, deterministically", async () => {
  let called = 0;
  const { deps, published } = collectDeps({
    provider: () => {
      called += 1;
      return fakeProvider("{}");
    },
  });
  const handle = createSelfReview(deps);
  handle.schedule("ses_d4");
  expect(handle.pendingCount()).toBe(1);
  handle.cancel("ses_d4", "superseded"); // the live-turn admission fence
  expect(handle.pendingCount()).toBe(0);
  await new Promise((r) => setTimeout(r, 450));
  expect(called).toBe(0); // the timer never fired the review
  expect(published).toEqual([]); // a pending cancel never lies about finishing
});

test("a late fire after dispose vanishes silently (no publish, no provider call)", async () => {
  let called = 0;
  const { deps, published } = collectDeps({
    disposed: () => true,
    provider: () => {
      called += 1;
      return fakeProvider("{}");
    },
  });
  await createSelfReview(deps).review("ses_d4", new AbortController());
  expect(called).toBe(0);
  expect(published).toEqual([]);
});
