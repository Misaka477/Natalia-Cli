import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
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

await mkdir(join(workspaceRoot, ".natalia"), { recursive: true });
await writeFile(
  join(workspaceRoot, ".natalia", "config.json"),
  JSON.stringify({
    version: 2,
    permissionProfiles: {
      unattended_read: {
        approval: "auto",
        description: "Automation smoke profile",
        permissions: { tools: { allow: ["read_file"] } },
      },
    },
  }),
);

const once = run(["--once", "--json", "/doctor"]);
assertDoctor("--once --json", once);

const profiled = run([
  "--once",
  "--permission",
  "unattended_read",
  "--json",
  "/doctor",
]);
assertDoctor("--once --permission unattended_read --json", profiled);
if (
  !profiled.some(
    (event) => event.type === "status.snapshot" && event.permissions === "auto",
  )
)
  throw new Error("--permission did not select the requested approval profile");

const stdio = run(["--stdio"], `${JSON.stringify({ prompt: "/doctor" })}\n`);
assertDoctor("--stdio", stdio);

console.log(
  JSON.stringify({
    onceEvents: once.length,
    profiledEvents: profiled.length,
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
          permissions?: string;
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
