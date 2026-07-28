import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createWezTermHost,
  writeWezTermNativeDomainConfig,
  NativeTerminalRegistry,
  resolveNataliaWezTermForkExecutable,
  resolveWezTermExecutable,
} from "../src/index";

test("does not fall back to an arbitrary system WezTerm executable", () => {
  expect(
    resolveWezTermExecutable({
      os: "linux",
      forkBuildDir: "/does-not-exist",
      which: () => "/usr/bin/wezterm",
    }),
  ).toBeUndefined();
  expect(
    resolveWezTermExecutable({
      os: "win32",
      forkBuildDir: "/does-not-exist",
      which: () => "C:\\WezTerm\\wezterm.exe",
    }),
  ).toBeUndefined();
});

test("uses an explicit host executable without falling back to system WezTerm", () => {
  expect(
    resolveWezTermExecutable({
      configured: "/opt/natalia/wezterm",
      which: () => "/usr/bin/wezterm",
    }),
  ).toBe("/opt/natalia/wezterm");
});

test("requires the managed patched fork when no explicit override is set", () => {
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
      which: () => "/usr/bin/wezterm",
    }),
  ).toBeUndefined();
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
  expect(launches).toEqual([]);
  expect(calls).toEqual(
    expect.arrayContaining([
      [
        "--config-file",
        "/tmp/natalia.lua",
        "cli",
        "--no-auto-start",
        "--prefer-mux",
        "spawn",
        "--cwd",
        "/repo",
        "--new-window",
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
  let guiAttached = false;
  const host = createWezTermHost({
    executable: "/opt/natalia/wezterm",
    environment,
    muxRuntimeDir: "/run/user/1000/natalia/mux-runtime",
    run: async (executable, args, _stdin, commandEnvironment) => {
      calls.push({ executable, args, environment: commandEnvironment });
      if (args.includes("spawn"))
        return { stdout: "42\n", stderr: "", exitCode: 0 };
      if (args.includes("list-clients"))
        return {
          stdout: guiAttached
            ? JSON.stringify([{ focused_pane_id: 42 }])
            : "[]",
          stderr: "",
          exitCode: 0,
        };
      if (args.includes("ls-fonts"))
        return {
          stdout: '你 wezterm.font("Noto Sans Mono CJK SC")',
          stderr: "",
          exitCode: 0,
        };
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
      guiAttached = true;
    },
  });
  await host.spawn({ cwd: "/repo", command: ["bash"] });
  await host.open!(42, { environment: { NATALIA_TERMINAL_ID: "terminal_1" } });
  expect(calls).not.toContainEqual(
    expect.objectContaining({ executable: "/opt/natalia/wezterm-mux-server" }),
  );
  expect(launches).toEqual([
    {
      ...environment,
      XDG_RUNTIME_DIR: "/run/user/1000/natalia/mux-runtime",
      NATALIA_TERMINAL_ID: "terminal_1",
    },
  ]);
});

test("spawns later Terminal sessions directly in the existing Hub window", async () => {
  const calls: string[][] = [];
  const host = createWezTermHost({
    executable: "wezterm",
    run: async (_executable, args) => {
      calls.push(args);
      if (args.includes("spawn"))
        return { stdout: "88\n", stderr: "", exitCode: 0 };
      if (args.includes("list"))
        return {
          stdout: JSON.stringify([
            {
              pane_id: 88,
              window_id: 501,
              tab_id: 77,
              is_active: true,
            },
          ]),
          stderr: "",
          exitCode: 0,
        };
      return { stdout: "", stderr: "", exitCode: 0 };
    },
  });
  await host.spawn({
    cwd: "/repo",
    command: ["btop"],
    workspace: "natalia",
    muxWindowID: 501,
  });
  expect(calls).toContainEqual([
    "cli",
    "--no-auto-start",
    "--prefer-mux",
    "spawn",
    "--cwd",
    "/repo",
    "--window-id",
    "501",
    "--",
    "btop",
  ]);
  expect(calls.flat()).not.toContain("--new-window");
  expect(calls.flat()).not.toContain("move-pane-to-new-tab");
});

test("opens the Terminal Hub through one connect client", async () => {
  const launches: string[][] = [];
  const host = createWezTermHost({
    executable: "wezterm",
    nativeDomain: {
      name: "natalia",
      socketPath: "/run/user/1000/natalia/wezterm/sock",
      configFile: "/tmp/natalia.lua",
    },
    run: async (_executable, args) => {
      if (args.includes("list-clients"))
        return { stdout: "[]", stderr: "", exitCode: 0 };
      if (args.includes("ls-fonts"))
        return {
          stdout: '你 wezterm.font("Noto Sans Mono CJK SC")',
          stderr: "",
          exitCode: 0,
        };
      return { stdout: "", stderr: "", exitCode: 0 };
    },
    launch: async (_executable, args) => {
      launches.push(args);
    },
  });
  await host.openHub!();
  expect(launches).toEqual([
    [
      "--config-file",
      "/tmp/natalia.lua",
      "connect",
      "natalia",
      "--workspace",
      "natalia",
    ],
  ]);
});

test("refuses to open the Hub while CJK glyph fallback resolves to Last Resort", async () => {
  const host = createWezTermHost({
    executable: "wezterm",
    run: async (_executable, args) => {
      if (args.includes("list-clients"))
        return { stdout: "[]", stderr: "", exitCode: 0 };
      if (args.includes("ls-fonts"))
        return {
          stdout: '你 wezterm.font("Last Resort")',
          stderr: "",
          exitCode: 0,
        };
      return { stdout: "", stderr: "", exitCode: 0 };
    },
    launch: async () => {
      throw new Error("must not launch with tofu fallback");
    },
  });
  await expect(host.openHub!()).rejects.toThrow(
    "CJK glyph fallback is unavailable",
  );
});

test("first Hub attach removes only the private mux bootstrap pane", async () => {
  const calls: string[][] = [];
  const host = createWezTermHost({
    executable: "wezterm",
    run: async (_executable, args) => {
      calls.push(args);
      if (args.includes("list-clients"))
        return {
          stdout: JSON.stringify([{ focused_pane_id: 2 }]),
          stderr: "",
          exitCode: 0,
        };
      if (args.includes("list"))
        return {
          stdout: JSON.stringify([
            { pane_id: 1, window_id: 1, tab_id: 1, is_active: true },
            { pane_id: 2, window_id: 2, tab_id: 2, is_active: true },
          ]),
          stderr: "",
          exitCode: 0,
        };
      return { stdout: "", stderr: "", exitCode: 0 };
    },
    launch: async () => {},
  });
  await host.open!(2, { discardBootstrapPanes: true, launch: false });
  expect(calls).toContainEqual([
    "cli",
    "--no-auto-start",
    "--prefer-mux",
    "kill-pane",
    "--pane-id",
    "1",
  ]);
  expect(calls).not.toContainEqual(
    expect.arrayContaining(["kill-pane", "--pane-id", "2"]),
  );
});

test("does not launch a second GUI client for an existing Terminal Hub", async () => {
  const launches: string[][] = [];
  const host = createWezTermHost({
    executable: "wezterm",
    run: async (_executable, args) => {
      if (args.includes("list-clients"))
        return {
          stdout: JSON.stringify([{ focused_pane_id: 42 }]),
          stderr: "",
          exitCode: 0,
        };
      return { stdout: "", stderr: "", exitCode: 0 };
    },
    launch: async (_executable, args) => {
      launches.push(args);
    },
  });
  await host.openHub!();
  expect(launches).toEqual([]);
});

test("writes a named Unix domain config for the fork GUI client", async () => {
  const directory = await mkdtemp(join(tmpdir(), "natalia-wezterm-domain-"));
  const domain = await writeWezTermNativeDomainConfig({
    directory,
    socketPath: "/run/user/1000/natalia/wezterm/sock",
  });
  expect(domain.name).toBe("natalia");
  const config = await readFile(domain.configFile, "utf8");
  expect(config).toContain(
    "socket_path = [[/run/user/1000/natalia/wezterm/sock]]",
  );
  expect(config).toContain("wezterm.font_with_fallback");
  expect(config).toContain("Noto Sans Mono CJK SC");
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
      return { pane_id: 19, window_id: 2, tab_id: 3, rows: 24, cols: 80 };
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
  await registry.write(session.id, "model keeps control after open");
  await registry.claimHumanInput(session.id);
  await expect(registry.write(session.id, "blocked")).rejects.toThrow(
    "controlled by a human",
  );
  registry.releaseHumanControl(session.id);
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
  await expect(registry.read(session.id)).resolves.toMatchObject({
    text: "pane 19 output",
    cursorX: 0,
    cursorY: 0,
    rows: 24,
    cols: 80,
  });
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

test("native registry observe returns typed exit info with cursor", async () => {
  const registry = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 73, window_id: 3, tab_id: 5 };
    },
    async list() {
      return [
        {
          pane_id: 73,
          window_id: 3,
          tab_id: 5,
          rows: 24,
          cols: 80,
          cursor_x: 12,
          cursor_y: 8,
        },
      ];
    },
    async read() {
      return "exit output";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const session = await registry.start({ command: "cat", cwd: "/repo" });
  await registry.stop(session.id);
  const obs = await registry.observe(session.id, 0);
  expect(obs).toMatchObject({
    reason: "exited",
    exited: true,
    cursorX: 12,
    cursorY: 8,
    rows: 24,
    cols: 80,
    changed: true,
  });
  expect(obs.text).toBe("");
});

test("native registry dispose stops only its running panes and host", async () => {
  const stopped: number[] = [];
  let disposed = 0;
  let nextPane = 301;
  const registry = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      const paneID = nextPane++;
      return { pane_id: paneID, window_id: 1, tab_id: paneID };
    },
    async list() {
      return [301, 302].map((paneID) => ({
        pane_id: paneID,
        window_id: 1,
        tab_id: paneID,
        rows: 24,
        cols: 80,
      }));
    },
    async read() {
      return "";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop(paneID) {
      stopped.push(paneID);
    },
    async dispose() {
      disposed += 1;
    },
  });
  await registry.start({ id: "terminal_a", cwd: "/repo", command: "cat" });
  await registry.start({ id: "terminal_b", cwd: "/repo", command: "cat" });
  await registry.dispose();
  expect(stopped.sort()).toEqual([301, 302]);
  expect(disposed).toBe(1);
  expect(registry.list()).toEqual([]);
});

test("native starts automatically place sessions in one Terminal Hub", async () => {
  let nextPaneID = 101;
  const openCalls: Array<{
    paneID: number;
    muxWindowID?: number;
    launch?: boolean;
  }> = [];
  const spawnCalls: Array<number | undefined> = [];
  const registry = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn(input) {
      spawnCalls.push(input.muxWindowID);
      const paneID = nextPaneID++;
      return { pane_id: paneID, window_id: paneID, tab_id: paneID + 100 };
    },
    async list() {
      return [101, 102].map((paneID) => ({
        pane_id: paneID,
        window_id: paneID,
        tab_id: paneID + 100,
        rows: 24,
        cols: 80,
      }));
    },
    async read() {
      return "";
    },
    async write() {},
    async open(paneID, options) {
      openCalls.push({
        paneID,
        muxWindowID: options?.muxWindowID,
        launch: options?.launch,
      });
      return {
        pane_id: paneID,
        window_id: 501,
        tab_id: paneID + 1_000,
        rows: 24,
        cols: 80,
      };
    },
    async openHub() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });

  const first = await registry.start({
    id: "terminal_first",
    cwd: "/repo",
    command: "first",
  });
  const second = await registry.start({
    id: "terminal_second",
    cwd: "/repo",
    command: "second",
  });

  expect(openCalls).toEqual([
    { paneID: 101, launch: true, muxWindowID: undefined },
  ]);
  expect(spawnCalls).toEqual([undefined, 501]);
  expect(first).toMatchObject({ paneID: 101, tabID: 1101, muxWindowID: 501 });
  expect(second).toMatchObject({ paneID: 102, tabID: 202, muxWindowID: 501 });
  expect(await registry.openHub()).toEqual({
    workspace: "natalia",
    muxWindowID: 501,
  });
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
    async open() {
      return { pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 };
    },
    async openHub() {},
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

test("native observe wakes immediately for registry session activity", async () => {
  const registry = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 82, window_id: 2, tab_id: 3 };
    },
    async list() {
      return [{ pane_id: 82, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
    },
    async read() {
      return "unchanged";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const session = await registry.start({ cwd: "/repo", command: "cat" });
  await registry.read(session.id);
  const revision = registry.list()[0]!.revision;
  const startedAt = performance.now();
  const observation = registry.observe(session.id, revision, {
    timeoutMs: 1_000,
  });
  await Bun.sleep(20);
  await registry.write(session.id, "wake");
  await expect(observation).resolves.toMatchObject({
    changed: true,
    reason: "session_activity",
  });
  expect(performance.now() - startedAt).toBeLessThan(450);
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
  await expect(registry.attach(session.id)).rejects.toThrow("exited");
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

test("native snapshot text matches read text and includes cursor", async () => {
  const registry = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 };
    },
    async list() {
      return [
        {
          pane_id: 37,
          window_id: 2,
          tab_id: 3,
          rows: 24,
          cols: 80,
          cursor_x: 5,
          cursor_y: 3,
        },
      ];
    },
    async read() {
      return "snapshot consistency check\n";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const session = await registry.start({ command: "cat", cwd: "/repo" });
  const read = await registry.read(session.id);
  const snapshot = await registry.snapshot(session.id);
  expect(snapshot.text).toBe(read.text);
  expect(snapshot.cursorX).toBe(5);
  expect(snapshot.cursorY).toBe(3);
  expect(snapshot.rows).toBe(24);
  expect(snapshot.cols).toBe(80);
  expect(snapshot.revision).toBe(session.revision);
  await registry.stop(session.id);
});

test("native model can continue to observe and write after human detach", async () => {
  const writes: string[] = [];
  const registry = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 };
    },
    async list() {
      return [{ pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
    },
    async read() {
      return writes.join("");
    },
    async write(_paneID, data) {
      writes.push(data);
    },
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const session = await registry.start({ command: "cat", cwd: "/repo" });
  await registry.write(session.id, "model before human\r");
  await registry.claimHumanInput(session.id);
  const beforeDetach = await registry.observe(session.id, 0);
  expect(beforeDetach.changed).toBe(true);
  registry.detach(session.id);
  await registry.write(session.id, "model after detach\r");
  expect(writes).toEqual(["model before human\r", "model after detach\r"]);
  const afterDetach = await registry.observe(
    session.id,
    beforeDetach.afterRevision,
  );
  expect(afterDetach.changed).toBe(true);
  expect(afterDetach.text).toContain("model before human");
  expect(afterDetach.text).toContain("model after detach");
  await registry.stop(session.id);
});
