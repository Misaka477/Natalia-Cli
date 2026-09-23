import type { RuntimeEvent } from "@anthelia/contracts";
import type { SkillService, SkillMetadata } from "@anthelia/runtime-services";
import type {
  ProviderStreamRequest,
  StreamingProvider,
} from "@anthelia/runtime";

/**
 * Discovery D4 — the side-channel self-review loop (hermes'
 * agent/background_review.py paradigm, its four disciplines held):
 *
 *  1. AFTER each turn, replay a BOUNDED digest of the session snapshot
 *     and ask "should any skill be sedimented?" — the review is a
 *     separate completion, never a turn of the main conversation;
 *  2. the main conversation and its prompt cache are NEVER touched
 *     (this module only reads events and calls the provider directly);
 *  3. it inherits the session's live runtime — the SAME provider the
 *     turn used (captured FIRST, before any await — the title-loop
 *     race this repo already paid for once);
 *  4. the write surface is a WHITELIST: candidates may only
 *     create/update skills, enforced at the validated write boundary
 *     (SkillService.upsertSkill), never at prompt-time alone.
 *
 * Output contract: JSON only. Failures are honest edges
 * (self_review.skipped with a reason), never silent.
 */

/** Coarse input budget: a full turn-history digest is capped here. */
export const SELF_REVIEW_DIGEST_CHARS = 24_000;
/** Output budget: enough for a skill body, not an essay. */
export const SELF_REVIEW_OUTPUT_LIMIT = 12_000;
export const SELF_REVIEW_TIMEOUT_MS = 30_000;
/** How long after the turn the review fires (late enough to be after persistence). */
export const SELF_REVIEW_DELAY_MS = 400;

const TASK_PROMPT = `You are a background curator for this workspace. You receive a skills catalog and a transcript digest. Decide whether a skill should be created or updated to capture something worth reusing.

Reply with ONLY a JSON object, no markdown fences, no commentary:
{"candidates":[{"kind":"create","name":"kebab-lowercase-name","description":"one line","content":"# markdown skill body"},{"kind":"update","name":"existing-skill","description":"one line","content":"# full replacement body"}]}

Rules: name = lowercase letters/digits/hyphens starting alphanumeric; content = complete markdown skill body; if nothing is worth sedimenting reply {"candidates":[]}. Never propose deleting, executing, or writing anything other than a skill.`;

/** The honest digest: human turns, assistant replies, tool names — bounded. */
export function buildSelfReviewDigest(events: readonly RuntimeEvent[]): string {
  const lines: string[] = [];
  let assistant = "";
  const flushAssistant = () => {
    const text = assistant.trim();
    if (text) lines.push(`assistant: ${text.slice(0, 1_500)}`);
    assistant = "";
  };
  for (const event of events) {
    if (event.type === "turn.submitted") {
      if (event.internal) continue; // runtime choreography, not the work
      flushAssistant();
      lines.push(`user: ${event.text.trim().slice(0, 2_000)}`);
      continue;
    }
    if (event.type === "content.delta") {
      assistant += event.text;
      continue;
    }
    const toolName = (event as { toolName?: string }).toolName;
    if (toolName) {
      flushAssistant();
      lines.push(`tool: ${toolName}`);
      continue;
    }
    if (event.type === "turn.finished") flushAssistant();
  }
  flushAssistant();
  const digest = lines.join("\n");
  return digest.length > SELF_REVIEW_DIGEST_CHARS
    ? `…(truncated)…\n${digest.slice(-SELF_REVIEW_DIGEST_CHARS)}`
    : digest;
}

export function buildSelfReviewPrompt(
  digest: string,
  skills: readonly SkillMetadata[],
): { messages: ProviderStreamRequest["messages"] } {
  const catalog = skills
    .map((skill) => `- ${skill.name}: ${skill.description ?? ""}`.trim())
    .join("\n");
  return {
    messages: [
      { role: "system", content: TASK_PROMPT },
      {
        role: "user",
        content: `skills catalog:\n${catalog || "(none)"}\n\ntranscript digest:\n${digest}`,
      },
    ],
  };
}

/** Tolerant extraction: fences, chatter, garbage all resolve honestly. */
export function parseSelfReviewCandidates(text: string): unknown[] {
  try {
    const stripped = text.replace(/```(?:json)?/giu, "");
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start < 0 || end <= start) return [];
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as unknown;
    if (Array.isArray((parsed as { candidates?: unknown }).candidates))
      return (parsed as { candidates: unknown[] }).candidates;
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export type SelfReviewEvent =
  | Extract<RuntimeEvent, { type: "self_review.completed" }>
  | Extract<RuntimeEvent, { type: "self_review.skipped" }>;

export type SelfReviewDeps = {
  /** Config read — a THROWING read fails open to enabled + one warning (hermes). */
  enabled(): boolean;
  /** Captured before any await: the review must ride the turn's own runtime. */
  provider(sessionID: string): StreamingProvider | undefined;
  /**
   * The concurrency adapter (the wiring injects the live limiter —
   * title's options.stream pattern, one hop up so this module stays
   * limiter-free). Defaults to the provider's own stream.
   */
  runStream?: (
    provider: StreamingProvider,
    request: ProviderStreamRequest,
  ) => AsyncIterable<{ type: string; text?: string }>;
  events(sessionID: string): readonly RuntimeEvent[];
  /**
   * The write surface, ASYNC: plugin fibers activate lazily (a tool
   * dispatch spawns them; a text-only turn never touches them), so the
   * wiring's accessor ENSURES the skills fiber is mounted before the
   * review looks for it — a review about sedimenting skills must reach
   * its own write surface.
   */
  skills(): Promise<SkillService | undefined> | SkillService | undefined;
  publish(event: SelfReviewEvent): void;
  /** True once the runtime is disposing — a late timer must vanish silently. */
  disposed?(): boolean;
};

export function createSelfReview(deps: SelfReviewDeps) {
  const tasks = new Map<
    string,
    { controller: AbortController; timer: ReturnType<typeof setTimeout> }
  >();

  async function completeOne(
    sessionID: string,
    controller: AbortController,
  ): Promise<void> {
    if (deps.disposed?.()) return; // a late fire after dispose: vanish, publish nothing
    const skip = (
      reason: Extract<
        SelfReviewEvent,
        { type: "self_review.skipped" }
      >["reason"],
    ) =>
      deps.publish({
        type: "self_review.skipped",
        at: new Date().toISOString(),
        sessionID: sessionID as never,
        reason,
      });
    // Discipline 3: provider FIRST — before the digest, before any await.
    const provider = deps.provider(sessionID);
    if (!provider) return skip("no_provider");
    const skillService = await deps.skills();
    if (!skillService) return skip("no_skills");
    const digest = buildSelfReviewDigest(deps.events(sessionID));
    if (!digest) return skip("no_input");
    const { messages } = buildSelfReviewPrompt(digest, skillService.list());

    let output = "";
    try {
      const request: ProviderStreamRequest = {
        signal: controller.signal,
        messages,
      };
      const stream = deps.runStream
        ? deps.runStream(provider, request)
        : provider.stream(request);
      const iterator = stream[Symbol.asyncIterator]();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("self review timed out")),
          SELF_REVIEW_TIMEOUT_MS,
        );
      });
      try {
        const collect = async () => {
          while (true) {
            const next = await iterator.next();
            if (next.done) break;
            if (next.value.type === "content") output += next.value.text;
            if (output.length >= SELF_REVIEW_OUTPUT_LIMIT) break;
          }
        };
        await Promise.race([collect(), timedOut]);
      } finally {
        if (timer) clearTimeout(timer);
        void iterator.return?.().catch(() => undefined);
      }
    } catch (error) {
      if (controller.signal.aborted) return skip("superseded");
      void error;
      return skip("error");
    }
    if (controller.signal.aborted) return skip("superseded");

    const candidates = parseSelfReviewCandidates(output);
    const skillsCreated: string[] = [];
    const skillsUpdated: string[] = [];
    let rejected = 0;
    for (const candidate of candidates) {
      try {
        const result = await skillService.upsertSkill(candidate);
        (result.created ? skillsCreated : skillsUpdated).push(result.name);
      } catch {
        // The boundary rejected it (whitelist/validation) — counted, never fatal.
        rejected += 1;
      }
    }
    deps.publish({
      type: "self_review.completed",
      at: new Date().toISOString(),
      sessionID: sessionID as never,
      skillsCreated,
      skillsUpdated,
      rejected,
    });
  }

  function isEnabled(): boolean {
    try {
      return deps.enabled();
    } catch {
      console.warn(
        "[self-review] config read failed — leaving the review enabled (fail-open)",
      );
      return true;
    }
  }

  return {
    /** Fire after a turn; a second fire supersedes the first (live-turn wins). */
    schedule(sessionID: string) {
      // Disabled is SILENT: config is the documentation of that state,
      // and a per-turn "disabled" edge would flood the journal (the
      // "disabled" reason stays in the union for explicit calls.
      if (!isEnabled()) return;
      this.cancel(sessionID, "superseded");
      const controller = new AbortController();
      const timer = setTimeout(() => {
        tasks.delete(sessionID);
        void completeOne(sessionID, controller);
      }, SELF_REVIEW_DELAY_MS);
      tasks.set(sessionID, { controller, timer });
    },
    /** Live turns supersede an in-flight or pending review (hermes' fence). */
    cancel(_sessionID: string, _reason?: string) {
      const task = tasks.get(_sessionID);
      if (!task) return;
      clearTimeout(task.timer);
      task.controller.abort(
        new Error(`self review ${_reason ?? "superseded"}`),
      );
      tasks.delete(_sessionID);
    },
    /** The direct entry (tests + wiring that wants no timer). */
    review: completeOne,
    pendingCount: () => tasks.size,
  };
}
