import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * D3a claims drill for `natalia update`: the usage gate rejects
 * positionals (flag VALUES are not positionals — the `runs` lesson),
 * a source is explicit until D5's channel, and the real CLI performs
 * the full switch against a fixture home.
 */

let scratch = "";
afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

function run(args: string[]) {
  return Bun.spawnSync(
    [process.execPath, join(import.meta.dir, "..", "src", "main.ts"), ...args],
    { stdout: "pipe", stderr: "pipe" },
  );
}
const out = (proc: { stdout: Uint8Array }) =>
  new TextDecoder().decode(proc.stdout);
const err = (proc: { stderr: Uint8Array }) =>
  new TextDecoder().decode(proc.stderr);
const sha = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

test("update refuses positionals with usage (flag values are not positionals)", () => {
  const bad = run(["update", "export"]);
  expect(bad.exitCode).toBe(1);
  expect(err(bad)).toContain("usage: natalia update");
  const trailing = run(["update", "--from", "/tmp", "--home", "/tmp", "extra"]);
  expect(trailing.exitCode).toBe(1);
  expect(err(trailing)).toContain("usage: natalia update");
});

test("update without a source names D5's staging honestly", () => {
  const none = run(["update"]);
  expect(none.exitCode).toBe(1);
  expect(err(none)).toContain("no source");
  expect(err(none)).toContain("D5");
});

test("the real CLI switches a fixture install (and its receipt lands)", () => {
  scratch = mkdtempSync(join(tmpdir(), "natalia-update-cli-"));
  const home = join(scratch, "home");
  const rel = join(scratch, "release");
  // install.sh layout: relative link under bin/
  mkdirSync(join(home, "versions", "1.0.0"), { recursive: true });
  mkdirSync(join(home, "bin"), { recursive: true });
  const oldBin = join(home, "versions", "1.0.0", "natalia");
  writeFileSync(oldBin, "#!/bin/sh\nprintf '%s\\n' \"1.0.0\"\n");
  chmodSync(oldBin, 0o755);
  symlinkSync("../versions/1.0.0/natalia", join(home, "bin", "natalia"));
  // release:build layout: VERSION + the binary + sums
  mkdirSync(rel, { recursive: true });
  const newBin = join(rel, "natalia");
  writeFileSync(newBin, "#!/bin/sh\nprintf '%s\\n' \"2.0.0\"\n");
  chmodSync(newBin, 0o755);
  writeFileSync(join(rel, "VERSION"), "2.0.0\n");
  const lines = ["natalia", "VERSION"].map((name) => {
    const hex = sha(new Uint8Array(readFileSync(join(rel, name))));
    return `${hex}  ${name}`;
  });
  writeFileSync(join(rel, "SHA256SUMS"), `${lines.join("\n")}\n`);

  const ok = run(["update", "--from", rel, "--home", home]);
  expect(ok.exitCode).toBe(0);
  expect(out(ok)).toContain("update: switched");
  expect(readlinkSync(join(home, "bin", "natalia"))).toBe(
    "../versions/2.0.0/natalia",
  );
  expect(out(ok)).toContain("receipt:");
  const receipts = readdirSync(join(home, "receipts"));
  expect(receipts.some((name) => name.startsWith("update-"))).toBe(true);
});
