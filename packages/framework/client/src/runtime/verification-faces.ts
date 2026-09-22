import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Generation, RuntimeEvent, SessionID } from "@natalia/contracts";
import type { VerificationCheck, VerificationFace } from "@natalia/composition";
import type { StreamingProvider } from "@natalia/runtime";
import { configV3Schema } from "@natalia/contracts";
import { resolveConfig } from "@natalia/config";
import { createRealRuntimeClient } from "./main";

/**
 * The sandbox smoke face of the verification gate (NGM study §4.3):
 * boot an isolated runtime with the CANDIDATE's config, run one trivial
 * turn, and report healthy only when the candidate actually loaded.
 *
 * The isolation is a throwaway workspace plus the candidate's own
 * confinement mode — the smoke is subject to the policy it is testing.
 * The health criterion includes the subtle half: the runtime swallows a
 * config-resolution failure by design (it falls back to defaults with a
 * warning), so a smoke that ignored that warning would happily "pass"
 * while having booted defaults — smoking nothing at all.
 */

/** A provider that answers any prompt with a fixed string and finishes. */
function smokeProvider(): StreamingProvider {
  return {
    provider: "composition-smoke",
    model: "composition-smoke-model",
    async *stream() {
      yield { type: "content", text: "ok" };
      yield { type: "done" };
    },
  };
}

async function waitForSignal(
  events: RuntimeEvent[],
  predicate: (event: RuntimeEvent) => boolean,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (events.some(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`${label} did not arrive within ${timeoutMs}ms`);
}

export function smokeFace(options: { timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const face: VerificationFace = async (generation: Generation) => {
    const base = await mkdtemp(join(tmpdir(), "composition-smoke-"));
    const workspaceRoot = join(base, "workspace");
    const configPath = join(base, "config.json");
    await mkdir(workspaceRoot, { recursive: true });
    await writeFile(configPath, JSON.stringify(generation.config, null, 2));
    const events: RuntimeEvent[] = [];
    let client: ReturnType<typeof createRealRuntimeClient> | undefined;
    try {
      // Strict schema validation first. Two real holes make this the
      // smoke's job rather than a formality: loadGeneration does not
      // deep-validate a stored generation's config (a corrupted or forged
      // object parses), and the runtime deliberately swallows config errors
      // (a config error must never kill a running session) — so neither the
      // store nor the boot would ever say the candidate's config is invalid.
      try {
        configV3Schema.parse(generation.config);
      } catch (error) {
        return {
          check: "smoke",
          ok: false,
          detail: `candidate config invalid: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      // Resolution failures are recorded per scope (`applied: false` +
      // diagnostic) rather than thrown, so the face checks the scope
      // directly: a candidate whose file did not load must not be smoked
      // against defaults.
      const resolved = await resolveConfig({
        workspaceRoot,
        globalPath: configPath,
      });
      const globalSource = resolved.sources.find(
        (source) => source.scope === "global",
      );
      if (!globalSource?.applied)
        return {
          check: "smoke",
          ok: false,
          detail: `candidate config did not load: ${globalSource?.diagnostic ?? "global scope not applied"}`,
        };
      client = createRealRuntimeClient({
        sessionID: `ses_smoke_${Date.now().toString(36)}` as SessionID,
        workspaceRoot,
        globalConfigPath: configPath,
        provider: smokeProvider(),
        // Hermetic store paths: the smoke owns a throwaway home.
        checkpointDir: join(base, "checkpoints"),
        sessionDir: join(base, "sessions"),
        // Approval prompts would park the gate on a human; the smoke proves
        // the candidate boots and answers, not that a human is willing to.
        permissionMode: "auto",
      });
      client.start((event) => events.push(event));
      await waitForSignal(
        events,
        (event) => event.type === "session.ready",
        timeoutMs,
        "session.ready",
      );
      if (typeof client.submitAndWait !== "function")
        return {
          check: "smoke",
          ok: false,
          detail: "runtime exposes no submitAndWait — cannot prove a turn",
        };
      await client.submitAndWait("smoke: reply with a short ok.");
      return { check: "smoke", ok: true };
    } catch (error) {
      return {
        check: "smoke",
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      } satisfies VerificationCheck;
    } finally {
      try {
        await client?.dispose?.();
      } catch {
        /* disposal failure must not mask the verdict */
      }
      await rm(base, { recursive: true, force: true });
    }
  };
  return face;
}
