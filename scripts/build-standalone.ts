/**
 * D1 (install study): the standalone-binary spike.
 *
 * Produces the study's artifact layout — a versioned, per-target directory
 * holding the compiled `natalia` binary, its runtime assets beside it
 * ("native 附件随二进制同目录分发"), and a SHA256 manifest the D2 installer
 * will verify (the supply-chain list, verbatim hermes-style).
 *
 * The version is baked by the ts:build step's define (same mechanism the
 * release bundle already uses), so the compiled binary answers
 * `--version` without reading anything it does not carry.
 *
 * Targets: the host target always builds; `--all` additionally attempts
 * the study's other two platforms. A cross target whose bun runtime bundle
 * is unavailable (offline machines cannot fetch it) is REPORTED as a
 * per-target result — the spike's job is to show exactly what produces and
 * what does not, not to pretend.
 */
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { hashTreeFiles } from "../packages/hosts/platform/src/hash-tree";

type TargetResult = {
  target: string;
  ok: boolean;
  binary?: string;
  files?: number;
  bytes?: number;
  error?: string;
};

const root = resolve(import.meta.dir, "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
  version: string;
};
const version = pkg.version;
const hostTarget = `${process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : process.platform}-${process.arch}`;
const requested = process.argv.slice(2);
const wantAll = requested.includes("--all");
const explicit = requested.find((arg) => arg.startsWith("--target="));
const targets = explicit
  ? [explicit.slice("--target=".length)]
  : wantAll
    ? [
        `bun-${hostTarget}` as const,
        "bun-darwin-arm64" as const,
        "bun-windows-x64" as const,
      ]
    : [`bun-${hostTarget}` as const];

async function run(command: string, args: string[], cwd: string) {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NATALIA_TS_VERSION: version },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

// Step A: the release bundle at this version (its define bakes --version).
const built = await run("bun", ["scripts/ts-build.ts"], root);
if (built.code !== 0) {
  console.error(built.stderr);
  throw new Error("ts:build failed — no release bundle to compile");
}

const results: TargetResult[] = [];
for (const target of targets) {
  // bun's target triples for --compile: bun-linux-x64, bun-darwin-arm64, …
  const triple = target.startsWith("bun-") ? target : `bun-${target}`;
  const platformDir = triple.replace(/^bun-/, "");
  const outDir = join(root, "dist", "release", version, platformDir);
  const result: TargetResult = { target: triple, ok: false };
  try {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    const compile = await run(
      "bun",
      [
        "build",
        "--compile",
        join(root, "dist", "ts", "natalia-ts.js"),
        "--outfile",
        join(outDir, "natalia"),
        ...(triple === `bun-${hostTarget}` ? [] : [`--target=${triple}`]),
      ],
      root,
    );
    if (compile.code !== 0) {
      result.error = compile.stderr.trim().split("\n").slice(-3).join(" ");
      results.push(result);
      continue;
    }
    // Assets beside the binary (study layout: native attachments travel
    // with the binary, probed at startup). The prebuilt js stays too —
    // which path the compiled runtime resolves its assets against is the
    // spike's open question, answered by running the thing.
    for (const entry of await readdir(join(root, "dist", "ts"))) {
      await cp(join(root, "dist", "ts", entry), join(outDir, entry), {
        recursive: true,
      });
    }
    // The shared checksum walk (platform) — same inventory the store
    // export and the debug bundle produce.
    const { files, bytes: totalBytes } = await hashTreeFiles(outDir);
    const manifest = {
      name: "natalia",
      version,
      target: triple,
      files,
    };
    await Bun.write(
      join(outDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    // The installer's zero-JSON paths: VERSION reads as a plain file, and
    // SHA256SUMS is the standard two-column format `sha256sum -c` consumes
    // natively — file list AND verification in one, no JSON parser needed
    // in a shell installer.
    await Bun.write(join(outDir, "VERSION"), `${version}\n`);
    await Bun.write(
      join(outDir, "SHA256SUMS"),
      `${manifest.files.map((file) => `${file.sha256}  ${file.file}`).join("\n")}\n`,
    );
    result.ok = true;
    result.binary = join(outDir, "natalia");
    result.files = manifest.files.length;
    result.bytes = totalBytes;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  results.push(result);
}

for (const result of results) {
  if (result.ok)
    console.log(
      `ok ${result.target}: ${result.binary} (${result.files} files, ${Math.round((result.bytes ?? 0) / (1024 * 1024))} MiB incl. assets)`,
    );
  else console.log(`failed ${result.target}: ${result.error ?? "unknown"}`);
}
if (!results.some((result) => result.ok)) {
  throw new Error("no target produced a runnable binary");
}
