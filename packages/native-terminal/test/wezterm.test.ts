import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createWezTermHost,
  writeWezTermNativeDomainConfig,
  NativeTerminalRegistry,
  nativeTerminalArtifactKey,
  resolveNataliaWezTermForkExecutable,
  resolveWezTermExecutable,
  resolveBundledWezTermExecutable,
  verifyBundledWezTerm,
} from "../src/index";
import artifacts from "../wezterm-artifacts.json" with { type: "json" };

test("resolves WezTerm across Unix and Windows executable names", () => {
  expect(
    resolveWezTermExecutable({
      os: "linux",
      bundledDataDir: "/does-not-exist",
      forkBuildDir: "/does-not-exist",
      which: (name) => (name === "wezterm" ? "/usr/bin/wezterm" : null),
    }),
  ).toBe("/usr/bin/wezterm");
  expect(
    resolveWezTermExecutable({
      os: "win32",
      bundledDataDir: "/does-not-exist",
      forkBuildDir: "/does-not-exist",
      which: (name) =>
        name === "wezterm.exe" ? "C:\\WezTerm\\wezterm.exe" : null,
    }),
  ).toBe("C:\\WezTerm\\wezterm.exe");
});

test("uses an explicit host executable without falling back to system WezTerm", () => {
  expect(
    resolveWezTermExecutable({
      configured: "/opt/natalia/wezterm",
      which: () => "/usr/bin/wezterm",
    }),
  ).toBe("/opt/natalia/wezterm");
});

test("prefers the managed patched fork build before bundled or system hosts", () => {
  expect(
    resolveNataliaWezTermForkExecutable({
      os: "linux",
      buildDir: "/does-not-exist",
    }),
  ).toBeUndefined();
  expect(
    resolveWezTermExecutable({
      os: "linux",
      forkBuildDir: "/opt/natalia/wezterm/target/release",
      bundledDataDir: "/does-not-exist",
      which: () => "/usr/bin/wezterm",
    }),
  ).toBe("/usr/bin/wezterm");
});

test("prefers the project-bundled Native Terminal Host", () => {
  expect(nativeTerminalArtifactKey({ os: "linux", arch: "x64" })).toBe(
    "linux-x64",
  );
  expect(nativeTerminalArtifactKey({ os: "darwin", arch: "arm64" })).toBe(
    "darwin-aarch64",
  );
  expect(
    resolveBundledWezTermExecutable({
      os: "linux",
      dataDir: "/does-not-exist",
    }),
  ).toBeUndefined();
});

test("pins every vendored Native Host artifact to one tested release", () => {
  expect(artifacts.version).toBe("20240203-110809-5046fc22");
  for (const artifact of Object.values(artifacts.artifacts)) {
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(artifact).not.toHaveProperty("url");
    expect(artifact).not.toHaveProperty("checksumUrl");
  }
  expect(artifacts.artifacts["darwin-aarch64"]).toMatchObject({
    file: "WezTerm-macos.zip",
    sha256: "e77388cad55f2e9da95a220a89206a6c58f865874a629b7c3ea3c162f5692224",
  });
  expect(artifacts.artifacts["win32-x64"]).toMatchObject({
    file: "WezTerm-windows.zip",
    sha256: "57e5d03b585303d81e8b8e96d1230362852eb39aca92b3b29c7a42cfb82f9ac4",
  });
});

test("verifies a bundled Native Terminal Host checksum", async () => {
  const source = new TextEncoder().encode("wezterm fixture");
  const path = "/tmp/kilo/wezterm-fixture";
  await Bun.write(path, source);
  await expect(
    verifyBundledWezTerm({
      executable: path,
      expectedSHA256:
        "6809af9e6ac6b5d8c6c738efe6bf4f172d23f73de59030882473c390d0698da8",
    }),
  ).resolves.toBe(path);
});

test("maps native pane lifecycle to WezTerm CLI", async () => {
  const calls: string[][] = [];
  const launches: Array<{
    args: string[];
    environment?: Record<string, string | undefined>;
  }> = [];
  const inputs: Array<string | undefined> = [];
  let opened = false;
  const host = createWezTermHost({
    executable: "wezterm",
    configFile: "/tmp/natalia.lua",
    run: async (_executable, args, stdin) => {
      calls.push(args);
      inputs.push(stdin);
      if (args.includes("move-pane-to-new-tab")) opened = true;
      if (args.includes("spawn"))
        return { stdout: "42\n", stderr: "", exitCode: 0 };
      if (args.includes("list"))
        return {
          stdout: JSON.stringify([
            {
              pane_id: 42,
              window_id: opened ? 8 : 7,
              tab_id: opened ? 10 : 9,
              title: "Kimi",
              size: { rows: 24, cols: 80 },
            },
          ]),
          stderr: "",
          exitCode: 0,
        };
      return {
        stdout: args.includes("get-text") ? "Kimi screen\n" : "",
        stderr: "",
        exitCode: 0,
      };
    },
    launch: async (_executable, args, environment) => {
      launches.push({ args, environment });
    },
  });
  await expect(
    host.spawn({ cwd: "/repo", command: ["kimi-cli"], workspace: "natalia" }),
  ).resolves.toMatchObject({ pane_id: 42, window_id: 7 });
  await expect(host.read(42)).resolves.toBe("Kimi screen\n");
  await host.write(42, "hello\r");
  await host.focus(42);
  await host.resize(42, 26, 84);
  await host.stop(42);
  expect(launches).toEqual([
    {
      args: ["--config-file", "/tmp/natalia.lua", "connect", "local"],
      environment: undefined,
    },
  ]);
  expect(calls).toEqual(
    expect.arrayContaining([
      [
        "--config-file",
        "/tmp/natalia.lua",
        "cli",
        "--no-auto-start",
        "--prefer-mux",
        "spawn",
        "--new-window",
        "--cwd",
        "/repo",
        "--workspace",
        "natalia",
        "--",
        "kimi-cli",
      ],
      [
        "--config-file",
        "/tmp/natalia.lua",
        "cli",
        "--no-auto-start",
        "--prefer-mux",
        "list",
        "--format",
        "json",
      ],
      [
        "--config-file",
        "/tmp/natalia.lua",
        "cli",
        "--no-auto-start",
        "--prefer-mux",
        "get-text",
        "--pane-id",
        "42",
        "--start-line",
        "-200",
      ],
      [
        "--config-file",
        "/tmp/natalia.lua",
        "cli",
        "--no-auto-start",
        "--prefer-mux",
        "send-text",
        "--pane-id",
        "42",
        "--no-paste",
      ],
      [
        "--config-file",
        "/tmp/natalia.lua",
        "cli",
        "--no-auto-start",
        "--prefer-mux",
        "activate-pane",
        "--pane-id",
        "42",
      ],
      [
        "--config-file",
        "/tmp/natalia.lua",
        "cli",
        "--no-auto-start",
        "--prefer-mux",
        "list",
        "--format",
        "json",
      ],
      [
        "--config-file",
        "/tmp/natalia.lua",
        "cli",
        "--no-auto-start",
        "--prefer-mux",
        "adjust-pane-size",
        "--pane-id",
        "42",
        "--amount",
        "2",
        "Down",
      ],
      [
        "--config-file",
        "/tmp/natalia.lua",
        "cli",
        "--no-auto-start",
        "--prefer-mux",
        "adjust-pane-size",
        "--pane-id",
        "42",
        "--amount",
        "4",
        "Right",
      ],
      [
        "--config-file",
        "/tmp/natalia.lua",
        "cli",
        "--no-auto-start",
        "--prefer-mux",
        "kill-pane",
        "--pane-id",
        "42",
      ],
    ]),
  );
  expect(inputs).toContain("hello\r");
});

test("reuses a ready private mux socket for CLI and GUI attach", async () => {
  const calls: Array<{
    executable: string;
    args: string[];
    environment?: Record<string, string | undefined>;
  }> = [];
  const launches: Array<Record<string, string | undefined> | undefined> = [];
  const environment = {
    WEZTERM_UNIX_SOCKET: "/run/user/1000/natalia/mux.sock",
  };
  const host = createWezTermHost({
    executable: "/opt/natalia/wezterm",
    environment,
    muxRuntimeDir: "/run/user/1000/natalia/mux-runtime",
    run: async (executable, args, _stdin, commandEnvironment) => {
      calls.push({ executable, args, environment: commandEnvironment });
      if (args.includes("spawn"))
        return { stdout: "42\n", stderr: "", exitCode: 0 };
      if (args.includes("list"))
        return {
          stdout: JSON.stringify([
            {
              pane_id: 42,
              window_id: 8,
              tab_id: 9,
              is_active: true,
              size: { rows: 24, cols: 80 },
            },
          ]),
          stderr: "",
          exitCode: 0,
        };
      return { stdout: "", stderr: "", exitCode: 0 };
    },
    launch: async (_executable, _args, launchEnvironment) => {
      launches.push(launchEnvironment);
    },
  });
  await host.spawn({ cwd: "/repo", command: ["bash"] });
  await host.open!(42, { environment: { NATALIA_TERMINAL_ID: "terminal_1" } });
  expect(calls).not.toContainEqual(
    expect.objectContaining({ executable: "/opt/natalia/wezterm-mux-server" }),
  );
  expect(launches).toEqual([
    { ...environment, NATALIA_TERMINAL_ID: "terminal_1" },
  ]);
});

test("writes a named Unix domain config for the fork GUI client", async () => {
  const directory = await mkdtemp(join(tmpdir(), "natalia-wezterm-domain-"));
  const domain = await writeWezTermNativeDomainConfig({
    directory,
    socketPath: "/run/user/1000/natalia/wezterm/sock",
  });
  expect(domain.name).toBe("natalia");
  expect(await readFile(domain.configFile, "utf8")).toContain(
    "socket_path = [[/run/user/1000/natalia/wezterm/sock]]",
  );
});

test("fails a stalled WezTerm control command within its timeout", async () => {
  const host = createWezTermHost({
    executable: "wezterm",
    timeoutMs: 1,
    run: async () => await new Promise(() => {}),
    launch: async () => {},
  });
  await expect(host.focus(42)).rejects.toThrow(
    "WezTerm command timed out after 1ms: cli activate-pane --pane-id 42",
  );
});

test("passes an explicit scrollback line range to WezTerm", async () => {
  const calls: string[][] = [];
  const host = createWezTermHost({
    executable: "wezterm",
    run: async (_executable, args) => {
      calls.push(args);
      return { stdout: "selected lines", stderr: "", exitCode: 0 };
    },
    launch: async () => {},
  });
  await expect(
    host.read(7, { startLine: 120, endLine: 180, maxLines: 60 }),
  ).resolves.toBe("selected lines");
  expect(calls.at(-1)).toEqual([
    "cli",
    "--no-auto-start",
    "--prefer-mux",
    "get-text",
    "--pane-id",
    "7",
    "--start-line",
    "120",
    "--end-line",
    "180",
  ]);
});

test("native registry keeps model I/O on the host-rendered pane", async () => {
  const writes: Array<{ paneID: number; data: string }> = [];
  const audit: string[] = [];
  const host = {
    kind: "wezterm" as const,
    executable: "wezterm",
    async spawn() {
      return { pane_id: 19, window_id: 2, tab_id: 3 };
    },
    async list() {
      return [{ pane_id: 19, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
    },
    async read(paneID: number) {
      return `pane ${paneID} output`;
    },
    async write(paneID: number, data: string) {
      writes.push({ paneID, data });
    },
    async focus() {},
    async resize() {},
    async stop() {},
  };
  const registry = new NativeTerminalRegistry(host, {
    onAudit: (event) => audit.push(event.action),
  });
  const session = await registry.start({
    id: "native_1",
    cwd: "/repo",
    command: "kimi-cli",
  });
  await registry.write(session.id, "hello\r");
  await expect(
    registry.write(session.id, "deduplicated", { idempotencyKey: "write_1" }),
  ).resolves.toMatchObject({ delivery: "accepted" });
  await expect(
    registry.write(session.id, "deduplicated", { idempotencyKey: "write_1" }),
  ).resolves.toMatchObject({ delivery: "duplicate" });
  await expect(
    registry.write(session.id, "different input", {
      idempotencyKey: "write_1",
    }),
  ).rejects.toThrow("reused with different input");
  await registry.focus(session.id);
  await registry.write(session.id, "model keeps control after open");
  await registry.claimHumanInput(session.id);
  await expect(registry.write(session.id, "blocked")).rejects.toThrow(
    "controlled by a human",
  );
  registry.releaseHumanControl(session.id);
  await registry.focus(session.id);
  await registry.claimHumanInput(session.id);
  registry.beginSecureInput(session.id);
  await expect(registry.read(session.id)).rejects.toThrow(
    "hidden during secure",
  );
  await expect(registry.write(session.id, "blocked")).rejects.toThrow(
    "controlled by a human",
  );
  expect(() => registry.releaseHumanControl(session.id)).toThrow(
    "secure input",
  );
  registry.endSecureInput(session.id);
  registry.releaseHumanControl(session.id);
  await registry.write(session.id, "model again");
  await expect(registry.read(session.id)).resolves.toBe("pane 19 output");
  await expect(registry.observe(session.id, 0)).resolves.toMatchObject({
    changed: true,
  });
  await expect(registry.stop(session.id)).resolves.toMatchObject({
    paneID: 19,
  });
  expect(writes.map((item) => item.data).join("")).toBe(
    "hello\rdeduplicatedmodel keeps control after openmodel again",
  );
  expect(registry.list()).toMatchObject([{ id: "native_1", status: "exited" }]);
  expect(audit).toContain("secure_input");
  expect(audit.filter((action) => action === "detach").length).toBe(2);
});

test("native observe returns its own bounded timeout instead of tool timeout", async () => {
  let reads = 0;
  let lists = 0;
  const registry = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 81, window_id: 2, tab_id: 3 };
    },
    async list() {
      lists += 1;
      return [{ pane_id: 81, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
    },
    async read() {
      reads += 1;
      return "unchanged";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const session = await registry.start({ cwd: "/repo", command: "cat" });
  await registry.read(session.id, { maxLines: 60 });
  const revision = registry
    .list()
    .find((item) => item.id === session.id)!.revision;
  const startedAt = performance.now();
  await expect(
    registry.observe(session.id, revision, { maxLines: 60, timeoutMs: 25 }),
  ).resolves.toMatchObject({ changed: false, reason: "timeout" });
  expect(performance.now() - startedAt).toBeLessThan(150);
  expect(reads).toBeLessThanOrEqual(4);
  // One initial read plus one reconcile per bounded observe poll. There must
  // not be a second list caused by observe calling the public read method.
  expect(lists).toBeLessThanOrEqual(reads + 2);
});

test("human input cancels unsent visible model input chunks", async () => {
  const writes: string[] = [];
  const registry = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 41, window_id: 2, tab_id: 3 };
    },
    async list() {
      return [{ pane_id: 41, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
    },
    async read() {
      return "";
    },
    async write(_paneID, data) {
      writes.push(data);
      if (writes.length === 1) await Bun.sleep(20);
    },
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const session = await registry.start({ cwd: "/repo", command: "cat" });
  const modelWrite = registry.write(session.id, "1".repeat(2048));
  await Bun.sleep(5);
  await registry.claimHumanInput(session.id);
  await expect(modelWrite).resolves.toMatchObject({ delivery: "cancelled" });
  expect(writes).toEqual(["1".repeat(1024)]);
  expect(registry.list()).toMatchObject([{ inputOwner: "human" }]);
});

test("a cancelled idempotent model write may be retried after control returns", async () => {
  const writes: string[] = [];
  const registry = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 43, window_id: 2, tab_id: 3 };
    },
    async list() {
      return [{ pane_id: 43, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
    },
    async read() {
      return "";
    },
    async write(_paneID, data) {
      writes.push(data);
      if (writes.length === 1) await Bun.sleep(20);
    },
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const session = await registry.start({ cwd: "/repo", command: "cat" });
  const payload = "1".repeat(2048);
  const first = registry.write(session.id, payload, {
    idempotencyKey: "retry-after-human",
  });
  await Bun.sleep(5);
  await registry.claimHumanInput(session.id);
  await expect(first).resolves.toMatchObject({ delivery: "cancelled" });
  registry.releaseHumanControl(session.id);
  await expect(
    registry.write(session.id, payload, {
      idempotencyKey: "retry-after-human",
    }),
  ).resolves.toMatchObject({ delivery: "accepted" });
  expect(writes).toEqual([
    "1".repeat(1024),
    "1".repeat(1024),
    "1".repeat(1024),
  ]);
});

test("reconcile marks a closed native pane exited without polling", async () => {
  let visible = true;
  const registry = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 31, window_id: 2, tab_id: 3, rows: 24, cols: 80 };
    },
    async list() {
      return visible
        ? [{ pane_id: 31, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]
        : [];
    },
    async read() {
      return "";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const session = await registry.start({ cwd: "/repo", command: "cat" });
  visible = false;
  await registry.reconcile({ force: true });
  expect(registry.list()).toMatchObject([
    { id: session.id, status: "exited", geometryOwner: "human" },
  ]);
  await expect(registry.write(session.id, "late")).rejects.toThrow("exited");
  await expect(registry.focus(session.id)).rejects.toThrow("exited");
  await expect(registry.resize(session.id, 30, 100)).rejects.toThrow("exited");
});

test("native registry attaches, detaches, and resizes the same pane", async () => {
  const resized: Array<[number, number, number]> = [];
  const audit: Array<{ action: string; actor: string }> = [];
  const registry = new NativeTerminalRegistry(
    {
      kind: "wezterm",
      executable: "wezterm",
      async spawn() {
        return { pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 };
      },
      async list() {
        return [{ pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
      },
      async read() {
        return "";
      },
      async write() {},
      async focus() {},
      async resize(paneID, rows, cols) {
        resized.push([paneID, rows, cols]);
      },
      async stop() {},
    },
    {
      onAudit: (event) => audit.push(event),
    },
  );
  const session = await registry.start({ cwd: "/repo", command: "cat" });
  await registry.write(session.id, "model input");
  await registry.attach(session.id);
  expect(registry.list()).toMatchObject([{ inputOwner: "model" }]);
  await registry.claimHumanInput(session.id);
  expect(registry.list()).toMatchObject([{ inputOwner: "human" }]);
  expect(registry.detach(session.id)).toMatchObject({ inputOwner: "model" });
  await expect(registry.resize(session.id, 30, 100)).resolves.toMatchObject({
    rows: 30,
    cols: 100,
  });
  expect(resized).toEqual([[37, 30, 100]]);
  await registry.stop(session.id);
  expect(audit.map(({ action, actor }) => ({ action, actor }))).toEqual([
    { action: "write", actor: "model" },
    { action: "attach", actor: "human" },
    { action: "write", actor: "human" },
    { action: "detach", actor: "human" },
    { action: "resize", actor: "human" },
    { action: "exit", actor: "system" },
  ]);
});
