import { chmod, mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InteractivePTYRegistry } from "../packages/pty/src";

const results: Array<Record<string, unknown>> = [];
const tmux = Bun.which("tmux");
if (tmux) results.push(await smokeTmux(tmux));

const localVim = "/tmp/kilo/vim-user/usr/bin/vim";
const vim =
  process.env.NATALIA_VIM ??
  Bun.which("vim") ??
  ((await Bun.file(localVim).exists()) ? localVim : Bun.which("vi"));
if (vim) results.push(await smokeVim(vim));

const kimiReference = join(process.cwd(), "devref", "kimi-cli");
const uv = Bun.which("uv");
if (uv && (await Bun.file(join(kimiReference, "pyproject.toml")).exists()))
  results.push(await smokeKimi(uv, kimiReference));

const ssh = Bun.which("ssh");
const sshd = Bun.which("sshd") ?? "/usr/sbin/sshd";
if (ssh && (await Bun.file(sshd).exists()))
  results.push(await smokeSSH(ssh, sshd));

if (results.length === 0) {
  console.log("terminal compatibility smoke skipped: no targets available");
  process.exit(0);
}
console.log(JSON.stringify({ result: "passed", targets: results }));

async function smokeTmux(executable: string) {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-tmux-"));
  const socket = `natalia_${process.pid}`;
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const session = await registry.start({
    id: "tty_tmux_smoke",
    command: `${executable} -L ${socket} -f /dev/null new-session`,
    cwd: root,
    rows: 30,
    cols: 100,
  });
  try {
    await registry.write(session.id, "printf 'NATALIA_TMUX_OK\\n'");
    await waitFor(
      () => registry.get(session.id).screen.text,
      "NATALIA_TMUX_OK",
    );
    const before = registry.get(session.id);
    await registry.resize(session.id, 36, 120);
    const after = registry.get(session.id);
    if (after.rows !== 36 || after.cols !== 120)
      throw new Error("tmux terminal resize was not reflected in framebuffer");
    if (after.revision <= before.revision)
      throw new Error("tmux terminal resize did not advance revision");
    if (!after.screen.text.includes("NATALIA_TMUX_OK"))
      throw new Error("tmux terminal framebuffer lost visible command output");
    return {
      program: "tmux",
      version: (await commandOutput([executable, "-V"])).trim(),
      buffer: after.screen.buffer,
      rows: after.rows,
      cols: after.cols,
      revision: after.revision,
    };
  } finally {
    await registry.stop(session.id).catch(() => undefined);
    await commandOutput([executable, "-L", socket, "kill-server"]).catch(
      () => undefined,
    );
  }
}

async function smokeVim(executable: string) {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-vim-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const file = join(root, "compat.txt");
  const local = executable === "/tmp/kilo/vim-user/usr/bin/vim";
  const environment = local
    ? "env LD_LIBRARY_PATH=/tmp/kilo/vim-user/usr/lib64 VIMRUNTIME=/tmp/kilo/vim-user/usr/share/vim/vim92 "
    : "";
  const session = await registry.start({
    id: "tty_vim_smoke",
    command: `${environment}${executable} -Nu NONE -n ${file}`,
    cwd: root,
    rows: 30,
    cols: 100,
  });
  try {
    await waitForValue(
      () => registry.get(session.id).screen.buffer,
      "alternate",
    );
    const before = registry.get(session.id);
    await registry.resize(session.id, 36, 120);
    await registry.write(session.id, "iNATALIA_VIM_OK", { submit: false });
    await waitFor(() => registry.get(session.id).screen.text, "NATALIA_VIM_OK");
    await registry.specialKey(session.id, "esc");
    await registry.write(session.id, ":wq");
    await waitForValue(() => registry.get(session.id).status, "exited");
    const content = await readFile(file, "utf8");
    if (content !== "NATALIA_VIM_OK\n")
      throw new Error(
        `Vim persisted unexpected content: ${JSON.stringify(content)}`,
      );
    const after = registry.get(session.id);
    return {
      program: "vim",
      executable,
      version: (
        await commandOutput([
          ...(local
            ? [
                "env",
                "LD_LIBRARY_PATH=/tmp/kilo/vim-user/usr/lib64",
                "VIMRUNTIME=/tmp/kilo/vim-user/usr/share/vim/vim92",
              ]
            : []),
          executable,
          "--version",
        ])
      )
        .split("\n")[0]
        ?.trim(),
      bufferDuringEdit: before.screen.buffer,
      rows: after.rows,
      cols: after.cols,
      revision: after.revision,
      saved: true,
    };
  } finally {
    await registry.stop(session.id).catch(() => undefined);
  }
}

async function smokeKimi(uv: string, reference: string) {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-kimi-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const session = await registry.start({
    id: "tty_kimi_smoke",
    command: `env HOME=${root}/home XDG_CONFIG_HOME=${root}/config XDG_DATA_HOME=${root}/data ${uv} run --project ${reference} kimi --work-dir ${root}`,
    cwd: root,
    rows: 36,
    cols: 120,
  });
  try {
    await waitFor(
      () => registry.get(session.id).screen.text,
      "Welcome to Kimi Code CLI!",
      30_000,
    );
    const before = registry.get(session.id);
    if (!before.screen.text.includes("Model: not set"))
      throw new Error("Kimi unconfigured model state was not visible");
    await registry.resize(session.id, 40, 132);
    const after = registry.get(session.id);
    if (after.rows !== 40 || after.cols !== 132)
      throw new Error("Kimi terminal resize was not reflected in framebuffer");
    return {
      program: "kimi-cli",
      version: (
        await commandOutput([
          uv,
          "run",
          "--project",
          reference,
          "kimi",
          "--version",
        ])
      ).trim(),
      configured: false,
      configurationPromptVisible: true,
      buffer: after.screen.buffer,
      rows: after.rows,
      cols: after.cols,
      revision: after.revision,
    };
  } finally {
    await registry.specialKey(session.id, "ctrl-c").catch(() => undefined);
    await Bun.sleep(200);
    await registry.stop(session.id).catch(() => undefined);
  }
}

async function smokeSSH(ssh: string, sshd: string) {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-ssh-"));
  const port = await availablePort();
  const hostKey = join(root, "host_key");
  const clientKey = join(root, "client_key");
  const authorizedKeys = join(root, "authorized_keys");
  await commandOutput([
    "ssh-keygen",
    "-q",
    "-t",
    "ed25519",
    "-N",
    "",
    "-f",
    hostKey,
  ]);
  await commandOutput([
    "ssh-keygen",
    "-q",
    "-t",
    "ed25519",
    "-N",
    "",
    "-f",
    clientKey,
  ]);
  await Bun.write(authorizedKeys, await readFile(`${clientKey}.pub`, "utf8"));
  await chmod(authorizedKeys, 0o600);
  const config = join(root, "sshd_config");
  await Bun.write(
    config,
    [
      `Port ${port}`,
      "ListenAddress 127.0.0.1",
      `HostKey ${hostKey}`,
      `PidFile ${join(root, "sshd.pid")}`,
      `AuthorizedKeysFile ${authorizedKeys}`,
      "PasswordAuthentication no",
      "KbdInteractiveAuthentication no",
      "UsePAM no",
      "PermitRootLogin no",
      "StrictModes no",
      "PrintMotd no",
      "LogLevel ERROR",
      `AllowUsers ${process.env.USER ?? "aquama"}`,
    ].join("\n"),
  );
  const server = Bun.spawn([sshd, "-D", "-e", "-f", config], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  try {
    await Bun.sleep(200);
    if (server.exitCode !== null)
      throw new Error(
        `local sshd failed: ${await new Response(server.stderr).text()}`,
      );
    const session = await registry.start({
      id: "tty_ssh_smoke",
      command: `${ssh} -tt -F /dev/null -i ${clientKey} -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${port} ${process.env.USER ?? "aquama"}@127.0.0.1 'exec bash --noprofile --norc'`,
      cwd: root,
      rows: 30,
      cols: 100,
    });
    try {
      await registry.write(session.id, "printf 'NATALIA_SSH_OK\\n'");
      await waitFor(
        () => registry.get(session.id).screen.text,
        "NATALIA_SSH_OK",
      );
      await registry.resize(session.id, 36, 120);
      const after = registry.get(session.id);
      await registry.write(session.id, "exit");
      await waitForValue(() => registry.get(session.id).status, "exited");
      return {
        program: "ssh",
        version: (
          await commandOutput([ssh, "-V"]).catch((error) => String(error))
        )
          .split("\n")[0]
          ?.trim(),
        host: "127.0.0.1",
        authentication: "ephemeral-ed25519",
        rows: after.rows,
        cols: after.cols,
        revision: after.revision,
      };
    } finally {
      await registry.stop(session.id).catch(() => undefined);
    }
  } finally {
    server.kill("SIGTERM");
    await server.exited;
  }
}

async function waitFor(
  read: () => string,
  expected: string,
  timeoutMs = 10_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (read().includes(expected)) return;
    await Bun.sleep(50);
  }
  throw new Error(`terminal compatibility output missing: ${expected}`);
}

async function waitForValue<T>(read: () => T, expected: T) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (read() === expected) return;
    await Bun.sleep(50);
  }
  throw new Error(`terminal compatibility state missing: ${String(expected)}`);
}

async function commandOutput(command: string[]) {
  const process = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(process.stdout).text();
  const error = await new Response(process.stderr).text();
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(error || `command exited ${exitCode}`);
  return output || error;
}

async function availablePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}
