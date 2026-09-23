import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/**
 * `natalia update` — the D3a core (install plan §4: 检查版本 → 校验 →
 * 原子替换 bin/（旧版留后间）→ 新二进制自检 → 不过则自动回退）。
 *
 * The disciplines mirror hermes' update_* modules where they proved
 * themselves, and install.sh where ours already did:
 *  - LOCK: an exclusive-create marker with a staleness ceiling
 *    (create with `wx` — no check-then-write race). Concurrent is a
 *    CONTRACT, not an error: EXIT_CONCURRENT = 2, so every entrypoint
 *    can match it (hermes' update_lock pattern);
 *  - VERIFY BEFORE TOUCHING: every byte is checked against
 *    SHA256SUMS at the SOURCE, and `natalia` must be covered, before
 *    a single file reaches versions/ (install.sh's own rule);
 *  - PROVE, do not assume: the switch only counts when the NEW binary
 *    answers `--version` with the staged version exactly (the installer's
 *    exact-match gate) — otherwise the previous symlink is restored and
 *    the failed version directory removed. The receipt records every
 *    step; a receipt failure can never break the update (hermes'
 *    receipt rule), and receipts prune to the last KEEP.
 *
 * Windows: the atomic swap relies on POSIX symlink semantics; the
 * Windows update entry lands with install.ps1's parity (the plan
 * already defers Windows confinement, decisions 25).
 */

export const UPDATE_EXIT_CONCURRENT = 2;
/** Longer than any legitimate local staging (seconds), short enough that
 * a crashed updater's lock heals itself (hermes ties its ceiling to the
 * longest operation; ours is a directory copy). */
export const UPDATE_LOCK_MAX_AGE_MS = 10 * 60_000;
export const UPDATE_RECEIPT_KEEP = 20;
const LOCK_NAME = ".natalia-update-in-progress";

export type UpdateOutcome =
  | "switched"
  | "rolled_back"
  | "refused"
  | "concurrent"
  | "not-installed";

export type UpdateStep = { name: string; ok: boolean; detail?: string };

export type UpdateReceipt = {
  kind: "natalia.update";
  at: string;
  pid: number;
  home: string;
  source: string;
  fromVersion?: string;
  toVersion?: string;
  probe?: { version?: string; detail?: string };
  steps: UpdateStep[];
  outcome: UpdateOutcome;
  reason?: string;
};

export type UpdateResult = {
  outcome: UpdateOutcome;
  exitCode: number;
  reason?: string;
  receiptPath?: string;
  steps: UpdateStep[];
};

/** install.sh's rule, verbatim: NATALIA_HOME wins, else $HOME/.natalia. */
export function resolveUpdateHome(
  env: Record<string, string | undefined>,
  override?: string,
): string {
  const home = override ?? env.NATALIA_HOME;
  if (home) return home;
  if (env.HOME) return join(env.HOME, ".natalia");
  throw new Error(
    "cannot locate the install home: set NATALIA_HOME or pass --home",
  );
}

/**
 * A SHA256SUMS entry may carry tree paths (the release is a tree) but
 * must never leave the staging root — the same anti-escape rule the
 * plugin loader enforces on manifest entries (validatePluginPath).
 */
export function stagedPath(root: string, name: string): string {
  const dest = resolve(root, name);
  const inside = relative(root, dest);
  if (!inside || inside.startsWith("..") || isAbsolute(inside))
    throw new Error(`SHA256SUMS path escapes the release: ${name}`);
  return dest;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Parses a `sha256sum -c` file: `<hex>  <path>` (or `<hex> *<path>`). */
export function parseSha256Sums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = /^([0-9a-fA-F]{64})[ \t]+\*?(.+)$/.exec(trimmed);
    if (!match) throw new Error(`SHA256SUMS: unparseable line: ${trimmed}`);
    // The HEX is case-insensitive; the NAME is not — lowercasing it made
    // every release with a caseful file (VERSION) refuse as "missing".
    sums.set(match[2], match[1].toLowerCase());
  }
  if (!sums.size) throw new Error("SHA256SUMS: no entries");
  return sums;
}

type SourceFiles = { files: Map<string, Uint8Array> };

async function loadSource(from: string): Promise<SourceFiles> {
  const files = new Map<string, Uint8Array>();
  const isUrl = /^https?:\/\//u.test(from);
  if (isUrl) {
    const base = from.endsWith("/") ? from : `${from}/`;
    const sumsRes = await fetch(`${base}SHA256SUMS`);
    if (!sumsRes.ok)
      throw new Error(`source: cannot read SHA256SUMS (${sumsRes.status})`);
    const sumsText = await sumsRes.text();
    files.set("SHA256SUMS", new TextEncoder().encode(sumsText));
    for (const name of parseSha256Sums(sumsText).keys()) {
      const res = await fetch(`${base}${name}`);
      if (!res.ok)
        throw new Error(`source: cannot read ${name} (${res.status})`);
      files.set(name, new Uint8Array(await res.arrayBuffer()));
    }
    // The sums list itself is not self-listed; the binary must be there.
    if (![...files.keys()].includes("natalia"))
      throw new Error("source: SHA256SUMS does not cover natalia");
    return { files };
  }
  if (!existsSync(join(from, "SHA256SUMS")))
    throw new Error(`${from}: not a release directory (no SHA256SUMS)`);
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const name = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) walk(full, name);
      else files.set(name, new Uint8Array(readFileSync(full)));
    }
  };
  walk(from, "");
  return { files };
}

function verifySource(source: SourceFiles): UpdateStep {
  const sumsText = new TextDecoder().decode(source.files.get("SHA256SUMS"));
  const sums = parseSha256Sums(sumsText);
  if (!sums.has("natalia"))
    throw new Error("source: SHA256SUMS does not cover natalia");
  for (const [name, expected] of sums) {
    const bytes = source.files.get(name);
    if (!bytes) throw new Error(`source: SHA256SUMS lists ${name}, missing`);
    const actual = sha256Hex(bytes);
    if (actual !== expected)
      throw new Error(`source: checksum mismatch for ${name}`);
  }
  return { name: "verify", ok: true, detail: `${sums.size} files` };
}

function readVersionText(source: SourceFiles): string {
  const version = source.files.get("VERSION");
  if (!version) throw new Error("source: missing VERSION");
  const text = new TextDecoder().decode(version).trim();
  if (!text) throw new Error("source: empty VERSION");
  return text;
}

function acquireLock(home: string): "held" | "concurrent" {
  const lock = join(home, LOCK_NAME);
  if (existsSync(lock)) {
    const age = Date.now() - statSync(lock).mtimeMs;
    if (age < UPDATE_LOCK_MAX_AGE_MS) return "concurrent";
    rmSync(lock, { force: true }); // stale: its owner cannot still be copying
  }
  try {
    writeFileSync(lock, `${process.pid}\n${new Date().toISOString()}\n`, {
      flag: "wx",
    });
    return "held";
  } catch {
    return "concurrent"; // lost the create race — the other writer owns it
  }
}

function probeVersion(binPath: string): {
  code: number;
  version?: string;
  detail: string;
} {
  try {
    const proc = Bun.spawnSync([binPath, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30_000,
    });
    const out = new TextDecoder().decode(proc.stdout).trim();
    const err = new TextDecoder().decode(proc.stderr).trim();
    return {
      code: proc.exitCode ?? -1,
      version: out || undefined,
      detail: err || out,
    };
  } catch (error) {
    return {
      code: -1,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Atomically points linkPath at targetPath (temp link + rename). */
function swapSymlink(linkPath: string, targetPath: string): void {
  const tmp = `${linkPath}.new-${process.pid}`;
  rmSync(tmp, { force: true });
  symlinkSync(targetPath, tmp);
  renameSync(tmp, linkPath); // atomic replace on POSIX
}

function pruneReceipts(dir: string): void {
  const entries = readdirSync(dir)
    .filter((name) => /^update-.*\.json$/u.test(name))
    .sort(); // update-<iso>-... sorts chronologically
  for (const stale of entries.slice(
    0,
    Math.max(0, entries.length - UPDATE_RECEIPT_KEEP),
  ))
    rmSync(join(dir, stale), { force: true });
}

/** The receipt is the proof — and its own failure must never break the update. */
function writeReceipt(
  home: string,
  receipt: UpdateReceipt,
): string | undefined {
  try {
    const dir = join(home, "receipts");
    mkdirSync(dir, { recursive: true });
    const stamp = receipt.at.replaceAll(":", "-");
    const path = join(dir, `update-${stamp}-${process.pid}.json`);
    writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
    pruneReceipts(dir);
    return path;
  } catch {
    return undefined;
  }
}

export type UpdateProgramInput = {
  home: string;
  from: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
};

export async function updateProgram(
  input: UpdateProgramInput,
): Promise<UpdateResult> {
  const { home, from } = input;
  const now = input.now ?? (() => new Date());
  const steps: UpdateStep[] = [];
  const binLink = join(home, "bin", "natalia");

  if (acquireLock(home) === "concurrent") {
    return {
      outcome: "concurrent",
      exitCode: UPDATE_EXIT_CONCURRENT,
      reason: "another update holds the lock (re-run when it finishes)",
      steps,
    };
  }
  try {
    const receipt = (
      outcome: UpdateOutcome,
      extra: Partial<UpdateReceipt> = {},
    ): UpdateReceipt => ({
      kind: "natalia.update",
      at: now().toISOString(),
      pid: process.pid,
      home,
      source: from,
      steps: [...steps],
      outcome,
      ...extra,
    });
    const finish = (
      outcome: UpdateOutcome,
      exitCode: number,
      reason?: string,
      extra: Partial<UpdateReceipt> = {},
    ): UpdateResult => {
      const receiptPath = writeReceipt(
        home,
        receipt(outcome, { reason, ...extra }),
      );
      return { outcome, exitCode, reason, receiptPath, steps };
    };

    // The current install, by the installer's exact-match discipline.
    if (!existsSync(binLink)) {
      steps.push({ name: "locate", ok: false, detail: "no bin/natalia" });
      return finish(
        "not-installed",
        1,
        `not installed at ${home} — run install.sh first (update swaps an existing install; it is not an installer)`,
      );
    }
    const current = probeVersion(binLink);
    const fromVersion = current.version;
    steps.push({
      name: "locate",
      ok: current.code === 0,
      detail:
        current.code === 0 ? `current ${fromVersion ?? "?"}` : current.detail,
    });

    // Load + verify AT THE SOURCE before anything is written (the
    // destination must never see an unverified byte).
    let source: SourceFiles;
    let targetVersion: string;
    try {
      source = await loadSource(from);
      steps.push(verifySource(source));
      targetVersion = readVersionText(source);
      steps.push({ name: "version", ok: true, detail: targetVersion });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      steps.push({ name: "verify", ok: false, detail: reason });
      return finish("refused", 1, reason, { fromVersion });
    }
    if (fromVersion === targetVersion) {
      // Idempotent: already there — prove it again rather than touch anything.
      if (current.code === 0)
        return finish("switched", 0, undefined, {
          toVersion: targetVersion,
          fromVersion,
          probe: { version: current.version },
        });
    }

    // Stage the new version directory, then flip the symlink.
    const versionDir = join(home, "versions", targetVersion);
    const previousLink = existsSync(binLink)
      ? readlinkSync(binLink)
      : undefined;
    try {
      rmSync(versionDir, { recursive: true, force: true });
      mkdirSync(versionDir, { recursive: true });
      const stageFile = (name: string, bytes: Uint8Array): string => {
        const dest = stagedPath(versionDir, name);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, bytes);
        return dest;
      };
      for (const [name, bytes] of source.files) stageFile(name, bytes);
      chmodSync(join(versionDir, "natalia"), 0o755);
      steps.push({ name: "stage", ok: true, detail: versionDir });
      mkdirSync(join(home, "bin"), { recursive: true });
      // A symlink resolves against ITS OWN directory: install.sh writes
      // ../versions/... for exactly this reason (bin/versions would be wrong).
      swapSymlink(binLink, join("..", "versions", targetVersion, "natalia"));
      steps.push({ name: "swap", ok: true, detail: previousLink ?? "(none)" });
    } catch (error) {
      const reason = `stage/swap failed: ${error instanceof Error ? error.message : String(error)}`;
      steps.push({ name: "stage", ok: false, detail: reason });
      rmSync(versionDir, { recursive: true, force: true });
      return finish("refused", 1, reason, {
        fromVersion,
        toVersion: targetVersion,
      });
    }

    // The gate: the new binary must answer --version with EXACTLY the
    // staged version. Anything else = automatic rollback.
    const probe = probeVersion(binLink);
    if (probe.code === 0 && probe.version === targetVersion) {
      steps.push({ name: "probe", ok: true, detail: probe.version });
      return finish("switched", 0, undefined, {
        fromVersion,
        toVersion: targetVersion,
        probe: { version: probe.version },
      });
    }
    const detail = `code=${probe.code} version=${probe.version ?? "?"} expected=${targetVersion} ${probe.detail}`;
    steps.push({ name: "probe", ok: false, detail });
    // Rollback: restore the previous link exactly (relative as the
    // installer wrote it), drop the failed version directory.
    if (previousLink !== undefined) {
      rmSync(binLink, { force: true });
      symlinkSync(previousLink, binLink);
      steps.push({ name: "rollback-link", ok: true, detail: previousLink });
    } else {
      rmSync(binLink, { force: true });
      steps.push({ name: "rollback-link", ok: true, detail: "(removed)" });
    }
    rmSync(versionDir, { recursive: true, force: true });
    steps.push({ name: "rollback-stage", ok: true });
    return finish(
      "rolled_back",
      1,
      `the new binary failed its self-check: ${detail}`,
      {
        fromVersion,
        toVersion: targetVersion,
        probe: { version: probe.version, detail: probe.detail },
      },
    );
  } finally {
    rmSync(join(home, LOCK_NAME), { force: true });
  }
}

/** Test/ops helper: the lock's age gate, exported so the ceiling is testable. */
export function markLockStale(home: string, ageMs: number): void {
  const lock = join(home, LOCK_NAME);
  const when = new Date(Date.now() - ageMs);
  utimesSync(lock, when, when);
}
