import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TerminalRegistry } from "../packages/terminal/src";

const uv = Bun.which("uv");
if (!uv) throw new Error("uv is required for configured Kimi smoke");
const reference = join(process.cwd(), "devref", "kimi-cli");
const root = await mkdtemp(join(tmpdir(), "natalia-kimi-live-"));
const registry = new TerminalRegistry(join(root, ".natalia", "terminal"));
const session = await registry.start({
  command: `${uv} run --project ${reference} kimi --work-dir ${root}`,
  cwd: root,
  rows: 40,
  cols: 132,
});

try {
  await waitFor("Welcome to Kimi Code CLI!", 30_000);
  if (registry.get(session.id).screen.text.includes("Model: not set"))
    throw new Error("Kimi is not configured");
  await registry.write(
    session.id,
    "Reply with exactly NATALIA_KIMI_TURN_ONE and nothing else.",
  );
  await waitFor("NATALIA_KIMI_TURN_ONE", 120_000);
  await registry.write(
    session.id,
    "Reply with exactly NATALIA_KIMI_TURN_TWO and nothing else.",
  );
  const result = await waitFor("NATALIA_KIMI_TURN_TWO", 120_000);
  console.log(
    JSON.stringify({
      program: "kimi-cli",
      configured: true,
      turns: 2,
      status: result.status,
      rows: result.rows,
      cols: result.cols,
      revision: result.revision,
      result: "passed",
    }),
  );
} finally {
  await registry.specialKey(session.id, "ctrl-c").catch(() => undefined);
  await Bun.sleep(200);
  await registry.stop(session.id).catch(() => undefined);
  registry.dispose();
}

async function waitFor(marker: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = registry.get(session.id);
    if (
      current.screen.text.includes(marker) ||
      current.transcript.includes(marker)
    )
      return current;
    await Bun.sleep(100);
  }
  throw new Error(`configured Kimi marker missing: ${marker}`);
}
