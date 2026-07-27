import { writeFile } from "node:fs/promises";
import {
  createWezTermHost,
  NativeTerminalRegistry,
} from "../../packages/native-terminal/src/index";

const durationMs = positiveInteger(process.argv[2], 30 * 60_000);
const outputPath = process.argv[3] ?? "/tmp/natalia-kimi-soak.json";
const cadenceMs = positiveInteger(
  process.env.NATALIA_KIMI_SOAK_CADENCE_MS,
  60_000,
);
const responseTimeoutMs = positiveInteger(
  process.env.NATALIA_KIMI_SOAK_RESPONSE_TIMEOUT_MS,
  120_000,
);
const command = process.env.NATALIA_KIMI_COMMAND ?? "kimi-cli";
const registry = new NativeTerminalRegistry(createWezTermHost());
const session = await registry.start({
  id: `native_kimi_soak_${Date.now()}`,
  cwd: process.cwd(),
  command,
});

type Sample = {
  round: number;
  atMs: number;
  marker: string;
  writeMs: number;
  responseMs: number;
  readAttempts: number;
  rss: number;
  heapUsed: number;
  cpuUserMicros: number;
  cpuSystemMicros: number;
  revision: number;
  paneProcesses?: {
    count: number;
    rssBytes: number;
    cpuPercent: number;
  };
};

const beforeMemory = process.memoryUsage();
const beforeCPU = process.cpuUsage();
const samples: Sample[] = [];
let startedAt = 0;
let stopped = false;

try {
  await waitForText("Welcome to Kimi Code CLI", 30_000);
  const initial = await registry.read(session.id);
  if (initial.includes("Model: not set"))
    throw new Error("Kimi is not configured");
  startedAt = performance.now();

  for (let round = 1; performance.now() - startedAt < durationMs; round++) {
    const marker = `NATALIA_NATIVE_SOAK_${Date.now()}_${round}`;
    const prompt = `Reply with exactly ${marker} and nothing else.`;
    const before = await registry.read(session.id, { maxLines: 200 });
    const writeStartedAt = performance.now();
    await registry.write(session.id, `${prompt}\r`, {
      idempotencyKey: `kimi-soak-${round}`,
    });
    const writeMs = performance.now() - writeStartedAt;
    const response = await waitForMarker(marker, before, responseTimeoutMs);
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage(beforeCPU);
    const pane = await findPane(session.paneID);
    samples.push({
      round,
      atMs: performance.now() - startedAt,
      marker,
      writeMs,
      responseMs: response.elapsedMs,
      readAttempts: response.attempts,
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      cpuUserMicros: cpu.user,
      cpuSystemMicros: cpu.system,
      revision:
        registry.list().find((item) => item.id === session.id)?.revision ?? -1,
      paneProcesses: pane?.tty_name
        ? await paneProcessUsage(pane.tty_name)
        : undefined,
    });
    const remaining = durationMs - (performance.now() - startedAt);
    if (remaining > 0) await Bun.sleep(Math.min(cadenceMs, remaining));
  }
} finally {
  await registry.stop(session.id).catch(() => undefined);
  stopped =
    registry.list().find((item) => item.id === session.id)?.status === "exited";
  const afterMemory = process.memoryUsage();
  const afterCPU = process.cpuUsage(beforeCPU);
  const result = {
    host: session.host,
    command,
    configured: samples.length > 0,
    durationMs: startedAt ? performance.now() - startedAt : 0,
    cadenceMs,
    responseTimeoutMs,
    rounds: samples.length,
    samples,
    runtime: {
      rssDeltaBytes: afterMemory.rss - beforeMemory.rss,
      heapUsedDeltaBytes: afterMemory.heapUsed - beforeMemory.heapUsed,
      cpuUserMicros: afterCPU.user,
      cpuSystemMicros: afterCPU.system,
    },
    cleanup: { paneStopped: stopped },
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
  if (!stopped) process.exitCode = 1;
}

async function waitForText(needle: string, timeoutMs: number) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if ((await registry.read(session.id, { maxLines: 200 })).includes(needle))
      return;
    await Bun.sleep(250);
  }
  throw new Error(`native Kimi pane did not produce '${needle}'`);
}

async function waitForMarker(
  marker: string,
  previous: string,
  timeoutMs: number,
) {
  const startedAt = performance.now();
  const deadline = startedAt + timeoutMs;
  let attempts = 0;
  while (performance.now() < deadline) {
    const text = await registry.read(session.id, { maxLines: 200 });
    attempts += 1;
    if (text !== previous && occurrences(text, marker) >= 2)
      return { elapsedMs: performance.now() - startedAt, attempts };
    await Bun.sleep(500);
  }
  throw new Error(`native Kimi response marker missing: ${marker}`);
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`expected a positive integer, got ${value}`);
  return parsed;
}

function occurrences(text: string, needle: string) {
  return text.split(needle).length - 1;
}

async function findPane(paneID: number) {
  return (await createWezTermHost().list()).find(
    (pane) => pane.pane_id === paneID,
  );
}

async function paneProcessUsage(ttyName: string) {
  if (process.platform !== "linux") return undefined;
  const child = Bun.spawn({
    cmd: ["ps", "-eo", "rss=,pcpu=,tty="],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, output] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
  ]);
  if (exitCode !== 0)
    throw new Error("could not sample native terminal pane processes");
  const tty = ttyName.replace("/dev/", "");
  let count = 0;
  let rssBytes = 0;
  let cpuPercent = 0;
  for (const line of output.trim().split("\n")) {
    const [rss, cpu, processTTY] = line.trim().split(/\s+/u);
    if (processTTY !== tty) continue;
    count += 1;
    rssBytes += Number(rss) * 1024;
    cpuPercent += Number(cpu);
  }
  return { count, rssBytes, cpuPercent };
}
