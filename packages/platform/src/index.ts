import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";

/**
 * Host platform abstraction.
 *
 * Every function accepts an explicit `os`/`env`/`exists` injection point and
 * defaults to the real host. This keeps POSIX behaviour byte-identical to the
 * pre-abstraction call sites while making both branches testable from either
 * platform, following the convention already established by
 * `nativeInputBrokerEndpoint`.
 */

export type HostEnvironment = Record<string, string | undefined>;

export type PlatformInput = {
  os?: NodeJS.Platform;
  env?: HostEnvironment;
};

export type ShellCommand = {
  executable: string;
  args: string[];
};

export function currentPlatform(): NodeJS.Platform {
  return process.platform;
}

export function isWindows(os?: NodeJS.Platform): boolean {
  return (os ?? currentPlatform()) === "win32";
}

/**
 * Joins path segments with the separator of the *target* platform rather than
 * the host. Windows paths therefore stay well-formed when they are constructed
 * or asserted from a POSIX host, which keeps both branches deterministic.
 */
export function platformJoin(
  os: NodeJS.Platform | undefined,
  ...segments: string[]
): string {
  return isWindows(os) ? win32.join(...segments) : posix.join(...segments);
}

/**
 * Appends the Windows executable suffix to a bare binary name. Sibling binaries
 * of a resolved executable are located by name, so the suffix must be applied
 * consistently rather than only at the entry point.
 */
export function executableName(base: string, os?: NodeJS.Platform): string {
  if (!isWindows(os)) return base;
  return base.toLowerCase().endsWith(".exe") ? base : `${base}.exe`;
}

const WINDOWS_BASH_RELATIVE_PATHS = [
  win32.join("Git", "bin", "bash.exe"),
  win32.join("Git", "usr", "bin", "bash.exe"),
];

/**
 * Locates a bash-compatible shell on Windows. Natalia's shell call sites pass
 * `bash -lc` with POSIX quoting, so the Git for Windows bash is used rather
 * than `cmd.exe`: it preserves argument, redirection, and quoting semantics
 * exactly, which keeps a single shell contract across platforms.
 */
export function resolveBashExecutable(
  input: PlatformInput & { exists?: (path: string) => boolean } = {},
): string | undefined {
  const env = input.env ?? process.env;
  const configured = env.NATALIA_BASH_EXECUTABLE;
  if (configured) return configured;
  if (!isWindows(input.os)) return undefined;
  const exists = input.exists ?? defaultExists;
  const roots = [
    env.ProgramFiles,
    env.ProgramW6432,
    env["ProgramFiles(x86)"],
    env.LOCALAPPDATA ? win32.join(env.LOCALAPPDATA, "Programs") : undefined,
  ];
  for (const root of roots) {
    if (!root) continue;
    for (const relative of WINDOWS_BASH_RELATIVE_PATHS) {
      const candidate = win32.join(root, relative);
      if (exists(candidate)) return candidate;
    }
  }
  return undefined;
}

/**
 * Builds the `-lc` profile-reading shell invocation used by every Natalia call
 * site. `posixShell` carries the resolution each call site already performed so
 * that POSIX behaviour is unchanged.
 */
export function profileShellCommand(
  script: string,
  input: PlatformInput & {
    posixShell?: string;
    exists?: (path: string) => boolean;
  } = {},
): ShellCommand {
  return {
    executable: shellExecutable(input),
    args: ["-lc", script],
  };
}

/**
 * Builds the `--noprofile --norc -c` invocation used where profile
 * side effects must not leak into a managed session.
 */
export function isolatedShellCommand(
  script: string,
  input: PlatformInput & {
    posixShell?: string;
    exists?: (path: string) => boolean;
  } = {},
): ShellCommand {
  return {
    executable: shellExecutable(input),
    args: ["--noprofile", "--norc", "-c", script],
  };
}

function shellExecutable(
  input: PlatformInput & {
    posixShell?: string;
    exists?: (path: string) => boolean;
  },
): string {
  if (!isWindows(input.os)) return input.posixShell ?? "bash";
  const resolved = resolveBashExecutable(input);
  if (resolved) return resolved;
  throw new Error(
    "A bash-compatible shell is unavailable on this Windows host. Install Git for Windows or set NATALIA_BASH_EXECUTABLE to a bash executable.",
  );
}

/**
 * Quotes a value for safe interpolation into a shell script.
 *
 * A single-quoted POSIX string is used, and an embedded quote is closed,
 * escaped, and reopened as `'\''`. This is valid on every platform Natalia
 * supports because a bash-compatible shell is always used, including on
 * Windows. A shorter-looking `'''` is *not* equivalent: it terminates the
 * string and silently drops or truncates the surrounding text.
 */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * Prefix that detaches a background command from the launching shell's job
 * control. `setsid` creates the owned process group that negative-PID signals
 * later address; Windows has no process-group equivalent, so the prefix is
 * empty there and process trees are terminated through `taskkill /T`.
 */
export function detachedShellPrefix(os?: NodeJS.Platform): string {
  return isWindows(os) ? "" : "setsid ";
}

/**
 * Starts a detached background process and reports a PID that the operating
 * system can later signal.
 *
 * POSIX keeps the caller's own script verbatim, so its quoting, redirection and
 * `setsid` process-group semantics are unchanged. Windows cannot reuse that
 * script: a bash-compatible shell there reports an MSYS process id from `$!`,
 * which lives in a separate namespace from the Windows process ids used by
 * `process.kill` and `taskkill`. Redirection and detachment are therefore
 * performed natively so that the returned PID is the real Windows one.
 */
export async function startDetachedProcess(input: {
  command: string;
  posixScript: string;
  cwd: string;
  outputPath: string;
  env?: Record<string, string | undefined>;
  hostEnv?: HostEnvironment;
  posixShell?: string;
  os?: NodeJS.Platform;
  exists?: (path: string) => boolean;
}): Promise<{ pid: number }> {
  // The child environment is deliberately allowlisted and secret-scrubbed, so
  // the shell itself must be located through the host environment instead.
  const resolution = {
    os: input.os,
    env: input.hostEnv,
    posixShell: input.posixShell,
    exists: input.exists,
  };
  if (isWindows(input.os)) {
    // The shell performs the redirection, exactly as the POSIX launcher script
    // does. A detached Windows child does not inherit a descriptor opened
    // here, so `stdio: [..., log.fd, log.fd]` left every background log empty
    // and made process output invisible. The command is grouped first because
    // a bare `cmd > log` would only redirect the final stage of a `;` or `&&`
    // sequence. The native spawn is still required so the returned PID is a
    // real Windows one rather than an MSYS id.
    const shell = profileShellCommand(
      `( ${input.command} ) > ${shellQuote(input.outputPath)} 2>&1`,
      resolution,
    );
    const child = spawn(shell.executable, shell.args, {
      cwd: input.cwd,
      env: input.env as NodeJS.ProcessEnv | undefined,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore"],
    });
    const pid = await new Promise<number | undefined>(
      (resolvePromise, reject) => {
        child.once("spawn", () => resolvePromise(child.pid));
        child.once("error", reject);
      },
    );
    if (pid === undefined)
      throw new Error("the detached process did not report a process id");
    child.unref();
    return { pid };
  }
  const launcherShell = profileShellCommand(input.posixScript, resolution);
  const launcher = spawn(launcherShell.executable, launcherShell.args, {
    cwd: input.cwd,
    env: input.env as NodeJS.ProcessEnv | undefined,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  launcher.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
  launcher.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
  const exitCode = await new Promise<number>((resolvePromise, reject) => {
    launcher.on("error", reject);
    launcher.on("close", (code) => resolvePromise(code ?? -1));
  });
  const pid = Number(Buffer.concat(stdout).toString("utf8").trim());
  if (exitCode !== 0 || !Number.isFinite(pid))
    throw new Error(
      Buffer.concat(stderr).toString("utf8") ||
        `the detached launcher exited with ${exitCode}`,
    );
  return { pid };
}

/**
 * Windows process-tree termination command. POSIX callers keep using a negative
 * PID signal, so `undefined` is returned there.
 */
export function processTreeKillCommand(
  pid: number,
  os?: NodeJS.Platform,
): ShellCommand | undefined {
  if (!isWindows(os)) return undefined;
  return {
    executable: "taskkill",
    args: ["/PID", String(Math.trunc(pid)), "/T", "/F"],
  };
}

/**
 * Root of the per-user global configuration tree. The POSIX branch reproduces
 * the previous `$HOME/.config` resolution exactly.
 */
export function globalConfigHome(input: PlatformInput = {}): string {
  const env = input.env ?? process.env;
  if (isWindows(input.os))
    return env.APPDATA ?? win32.join(userHome(input), "AppData", "Roaming");
  return posix.join(env.HOME ?? "", ".config");
}

/**
 * Root of the per-user durable state tree, preserving the previous
 * `XDG_STATE_HOME ?? $HOME/.local/state` resolution on POSIX.
 */
export function userStateHome(input: PlatformInput = {}): string {
  const env = input.env ?? process.env;
  if (isWindows(input.os))
    return env.LOCALAPPDATA ?? win32.join(userHome(input), "AppData", "Local");
  return env.XDG_STATE_HOME ?? posix.join(env.HOME ?? ".", ".local", "state");
}

/**
 * Root of the per-user ephemeral runtime tree. Windows has no XDG runtime
 * directory, so callers fall back to their existing workspace-local path.
 */
export function userRuntimeHome(input: PlatformInput = {}): string | undefined {
  const env = input.env ?? process.env;
  if (isWindows(input.os)) return env.LOCALAPPDATA ?? env.TEMP;
  return env.XDG_RUNTIME_DIR;
}

/**
 * The current user's home directory.
 *
 * Windows exposes it as `USERPROFILE` and normally leaves `HOME` unset, so
 * reading `HOME` alone resolves to nothing there. The POSIX branch stays
 * `HOME` first so its resolution order is unchanged.
 */
export function userHomeDirectory(input: PlatformInput = {}): string {
  const env = input.env ?? process.env;
  if (isWindows(input.os)) return env.USERPROFILE ?? env.HOME ?? safeHomedir();
  return env.HOME ?? safeHomedir();
}

function userHome(input: PlatformInput): string {
  const env = input.env ?? process.env;
  return env.USERPROFILE ?? env.HOME ?? safeHomedir();
}

/**
 * Strips the Windows extended-length (`\\?\`) prefix and normalises separators
 * so a link target can be resolved and containment-checked.
 *
 * `readlink` on a Windows directory junction returns an absolute
 * `\\?\C:\...` path. Resolving that verbatim produces a path no containment
 * check can match, which silently marks a workspace manifest incomplete. POSIX
 * targets are returned untouched.
 */
export function normalizeLinkTarget(
  target: string,
  os?: NodeJS.Platform,
): string {
  if (!isWindows(os)) return target;
  const unprefixed = target.startsWith("\\\\?\\") ? target.slice(4) : target;
  return unprefixed.replaceAll("\\", "/");
}

/**
 * Creates a symbolic link, choosing the Windows link type that does not
 * require elevation where possible.
 *
 * An unprivileged Windows process cannot create a symlink, but it *can* create
 * a directory junction. Node also defaults to a `file` link on Windows, which
 * would turn a restored directory link into a broken one. POSIX takes the
 * original single-argument call so its behaviour is unchanged.
 */
export async function createSymlink(
  target: string,
  path: string,
  input: PlatformInput & {
    targetIsDirectory?: boolean;
    symlink?: (
      target: string,
      path: string,
      type?: "dir" | "file" | "junction",
    ) => Promise<void>;
  } = {},
): Promise<void> {
  const link = input.symlink ?? nodeSymlink;
  if (!isWindows(input.os)) return await link(target, path);
  return await link(
    target,
    path,
    input.targetIsDirectory ? "junction" : "file",
  );
}

/**
 * Removes a path, clearing the Windows read-only attribute first.
 *
 * `fs.rm({ force: true })` does not clear `FILE_ATTRIBUTE_READONLY`, so a file
 * restored from a manifest that recorded a read-only POSIX mode cannot be
 * deleted afterwards. On POSIX this is exactly the previous `rm` call.
 */
export async function forceRemove(
  path: string,
  input: PlatformInput & {
    recursive?: boolean;
    rm?: (
      path: string,
      options: { force: boolean; recursive: boolean },
    ) => Promise<void>;
    chmod?: (path: string, mode: number) => Promise<void>;
  } = {},
): Promise<void> {
  const remove = input.rm ?? nodeRm;
  const options = { force: true, recursive: input.recursive ?? false };
  if (!isWindows(input.os)) return await remove(path, options);
  try {
    return await remove(path, options);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    // Read-only attribute: clear it and retry once rather than failing a
    // rollback that has already mutated part of the workspace.
    await (input.chmod ?? nodeChmod)(path, 0o666).catch(() => undefined);
    return await remove(path, options);
  }
}

async function nodeSymlink(
  target: string,
  path: string,
  type?: "dir" | "file" | "junction",
) {
  const { symlink } = await import("node:fs/promises");
  await symlink(target, path, type);
}

async function nodeRm(
  path: string,
  options: { force: boolean; recursive: boolean },
) {
  const { rm } = await import("node:fs/promises");
  await rm(path, options);
}

async function nodeChmod(path: string, mode: number) {
  const { chmod } = await import("node:fs/promises");
  await chmod(path, mode);
}

function safeHomedir(): string {
  try {
    return homedir();
  } catch {
    return "";
  }
}

function defaultExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}
