import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const home = await mkdtemp(join(tmpdir(), "natalia-cli-smoke-home-"));
const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-cli-smoke-root-"));
const repoRoot = join(import.meta.dir, "..");
const env = {
  ...process.env,
  HOME: home,
  XDG_CONFIG_HOME: join(home, ".config"),
  XDG_STATE_HOME: join(home, ".state"),
};

const once = run(["--once", "--json", "/doctor"]);
assertDoctor("--once --json", once);

const stdio = run(["--stdio"], `${JSON.stringify({ prompt: "/doctor" })}\n`);
assertDoctor("--stdio", stdio);

console.log(
  JSON.stringify({
    onceEvents: once.length,
    stdioEvents: stdio.length,
    workspaceRoot,
    status: "passed",
  }),
);

function run(args: string[], stdin?: string) {
  const child = Bun.spawnSync(
    [process.execPath, join(repoRoot, "apps/cli/src/main.ts"), ...args],
    {
      cwd: workspaceRoot,
      env,
      stdin: stdin ? new TextEncoder().encode(stdin) : undefined,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (child.exitCode !== 0) {
    throw new Error(
      `CLI ${args.join(" ")} failed: ${new TextDecoder().decode(child.stderr)}`,
    );
  }
  return new TextDecoder()
    .decode(child.stdout)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as {
          type?: string;
          text?: string;
          stopReason?: string;
        },
    );
}

function assertDoctor(label: string, events: ReturnType<typeof run>) {
  if (
    !events.some(
      (event) =>
        event.type === "content.delta" &&
        event.text?.includes("Natalia TS7 runtime doctor"),
    )
  ) {
    throw new Error(`${label} did not emit the runtime doctor response`);
  }
  if (
    !events.some(
      (event) => event.type === "turn.finished" && event.stopReason === "done",
    )
  ) {
    throw new Error(`${label} did not finish the turn`);
  }
}
