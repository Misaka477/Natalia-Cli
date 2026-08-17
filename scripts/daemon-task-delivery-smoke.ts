/**
 * Real delivery smoke: a resident executor runs the same task controller a
 * one-shot run uses, and the submitting client mirrors its outcome.
 *
 * It runs as a script rather than a unit test because it needs a real daemon
 * process, real durable state and a real HTTP round trip.
 */
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NataliaTaskStateStore } from "../packages/workflow/src/index";

const cliEntry = join(import.meta.dir, "..", "apps", "cli", "src", "main.ts");

async function workspace(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 3,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
      },
      alertChannels: { journal: { kind: "journal" } },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the sources\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: /doctor\npermissionProfile: unattended\nalerts:\n  - journal\nflow:\n  flowID: flow_review\n",
  );
  return root;
}

async function run(args: string[], cwd: string, env: Record<string, string>) {
  const child = Bun.spawn([process.execPath, cliEntry, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
  const stdout = await new Response(child.stdout).text();
  const stderr = await new Response(child.stderr).text();
  await child.exited;
  return { exitCode: child.exitCode, stdout, stderr };
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function invocationSummary(root: string) {
  const state = await NataliaTaskStateStore.open(root);
  try {
    const invocations = state.invocations("task_nightly");
    return {
      count: invocations.length,
      status: invocations[0]?.status,
      attempts: invocations[0]
        ? state.attempts(invocations[0].invocationID).length
        : 0,
      waterline: state.getWaterline("task_nightly"),
    };
  } finally {
    state.close();
  }
}

const directRoot = await workspace("natalia-delivery-direct-");
const direct = await run(
  ["task", "run", "nightly.yaml", "--workspace", directRoot, "--json"],
  directRoot,
  {},
);
assert(direct.exitCode === 0, `one-shot run failed: ${direct.stderr}`);
const directState = await invocationSummary(directRoot);

const daemonHome = await mkdtemp(join(tmpdir(), "natalia-delivery-home-"));
const deliveredRoot = await workspace("natalia-delivery-daemon-");
const daemon = Bun.spawn([process.execPath, cliEntry, "daemon", "0"], {
  cwd: deliveredRoot,
  stdout: "ignore",
  stderr: "pipe",
  env: { ...process.env, XDG_STATE_HOME: daemonHome },
});
try {
  // Readiness is the registration file: a piped stdout is buffered, and every
  // other command already reads the registration.
  const registrationPath = join(
    daemonHome,
    "natalia-cli",
    "daemon",
    "daemon.json",
  );
  const deadline = Date.now() + 30_000;
  let url: string | undefined;
  while (Date.now() < deadline && !url) {
    url = await readFile(registrationPath, "utf8")
      .then((text) => (JSON.parse(text) as { url?: string }).url)
      .catch(() => undefined);
    if (!url) await Bun.sleep(100);
  }
  assert(url, "the daemon never registered");
  const delivered = await run(
    ["task", "submit", "nightly.yaml", "--workspace", deliveredRoot, "--json"],
    deliveredRoot,
    { XDG_STATE_HOME: daemonHome },
  );
  assert(
    delivered.exitCode === 0,
    `delivery failed: ${delivered.stderr || delivered.stdout}`,
  );
  const deliveredState = await invocationSummary(deliveredRoot);
  const events = delivered.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const invocation = events.find((event) => event.type === "task.invocation");
  assert(invocation !== undefined, "delivery emitted no task.invocation");
  // The two paths have to agree on the durable outcome, not just on the exit
  // code: same terminal status, same attempt count, same waterline decision.
  assert(
    deliveredState.status === directState.status,
    `status differs: ${deliveredState.status} vs ${directState.status}`,
  );
  assert(
    deliveredState.attempts === directState.attempts,
    `attempt count differs: ${deliveredState.attempts} vs ${directState.attempts}`,
  );
  assert(
    (deliveredState.waterline === undefined) ===
      (directState.waterline === undefined),
    "waterline decision differs between the two paths",
  );
  assert(
    events.some((event) => event.type === "task.alert"),
    "delivery emitted no alert",
  );
  // A second delivery is a second durable invocation, so the resident path does
  // not reuse or rewrite the first one.
  const again = await run(
    ["task", "submit", "nightly.yaml", "--workspace", deliveredRoot, "--json"],
    deliveredRoot,
    { XDG_STATE_HOME: daemonHome },
  );
  assert(again.exitCode === 0, `second delivery failed: ${again.stderr}`);
  const afterSecond = await invocationSummary(deliveredRoot);
  assert(
    afterSecond.count === 2,
    `expected two invocations, found ${afterSecond.count}`,
  );
  console.log(
    JSON.stringify({
      oneShot: directState,
      delivered: deliveredState,
      deliveries: afterSecond.count,
      status: "passed",
    }),
  );
} finally {
  daemon.kill();
  // SIGTERM must terminate the daemon now that serve/daemon dispose the
  // runtime they started (the zombie daemon that survived `server.stop` with
  // its broker socket was the teardown defect this smoke used to paper over
  // with SIGKILL). A surviving daemon is a regression: it holds its port
  // forever, so fail loudly instead of reaping silently.
  const exited = await Promise.race([
    daemon.exited.then(() => true),
    Bun.sleep(5_000).then(() => false),
  ]);
  if (!exited) {
    daemon.kill("SIGKILL");
    await daemon.exited;
    throw new Error("daemon did not exit on SIGTERM after server stop");
  }
}
