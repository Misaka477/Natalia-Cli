import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const log = path.join("/tmp/kilo", `natalia-tui-pty-${Date.now()}.log`);
const marker = path.join("/tmp/kilo", `natalia-tui-pty-${Date.now()}.done`);
const script = existsSync("/usr/bin/script")
  ? "/usr/bin/script"
  : "/bin/script";
const command = `NATALIA_TUI_SMOKE=1 NATALIA_TUI_SMOKE_PROMPT=${JSON.stringify("short PTY smoke")} NATALIA_TUI_SMOKE_MARKER=${JSON.stringify(marker)} ${JSON.stringify(process.execPath)} run src/main.tsx; sleep 1`;
const code = existsSync(script)
  ? await runScript(command, log)
  : await runTmux(command, log);

if (code !== 0) throw new Error(`PTY smoke exited with ${code}`);

for (let index = 0; index < 100; index++) {
  if (existsSync(marker)) break;
  await Bun.sleep(50);
}

const transcript = await readFile(log, "utf8");
await writeFile(
  path.join("/tmp/kilo", "natalia-tui-pty-latest.log"),
  transcript,
);
await rm(marker, { force: true });

if (!transcript.includes("M6 Natalia TUI blocks"))
  throw new Error("PTY transcript missed app title");
if (
  !transcript.includes("Streaming final") &&
  !transcript.includes("apiToken=[REDACTED]")
)
  throw new Error("PTY transcript missed streamed content or tool block");
if (!transcript.includes("mode:") || !transcript.includes("fixture"))
  throw new Error("PTY transcript missed status snapshot");

console.log(`PTY smoke transcript: ${log}`);

async function runScript(command: string, output: string) {
  const child = spawn(script, ["-qfec", command, output], {
    cwd: process.cwd(),
    env: { ...process.env, TERM: "xterm-256color" },
    stdio: "ignore",
  });
  return await new Promise<number | null>((resolve) =>
    child.on("exit", resolve),
  );
}

async function runTmux(command: string, output: string) {
  const session = `natalia-tui-${Date.now()}`;
  const child = spawn("tmux", ["new-session", "-d", "-s", session, command], {
    cwd: process.cwd(),
    env: { ...process.env, TERM: "xterm-256color" },
    stdio: "ignore",
  });
  const started = await new Promise<number | null>((resolve) =>
    child.on("exit", resolve),
  );
  if (started !== 0) return started;
  for (let index = 0; index < 200; index++) {
    if (existsSync(marker)) {
      await captureTmux(session, output);
      spawn("tmux", ["kill-session", "-t", session], { stdio: "ignore" });
      return 0;
    }
    await Bun.sleep(50);
  }
  await captureTmux(session, output);
  spawn("tmux", ["kill-session", "-t", session], { stdio: "ignore" });
  return 124;
}

async function captureTmux(session: string, output: string) {
  const child = spawn("tmux", ["capture-pane", "-pt", session, "-S", "-"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  await new Promise<number | null>((resolve) => child.on("exit", resolve));
  await writeFile(output, Buffer.concat(chunks));
}
