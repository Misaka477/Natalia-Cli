import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { startDetachedProcess } from "../src/index";

describe("startDetachedProcess", () => {
  test("reports a signalable PID and redirects output on POSIX", async () => {
    const root = await mkdtemp(join(tmpdir(), "natalia-detached-"));
    const outputPath = join(root, "out.log");
    const { pid } = await startDetachedProcess({
      command: "printf posix-branch",
      posixScript: `setsid bash -c 'printf posix-branch' > '${outputPath}' 2>&1 & echo $!`,
      cwd: root,
      outputPath,
      env: { PATH: process.env.PATH },
    });
    expect(Number.isInteger(pid)).toBe(true);
    expect(pid).toBeGreaterThan(0);
    expect(await waitForOutput(outputPath)).toContain("posix-branch");
  });

  test("surfaces a failing POSIX launcher instead of a bogus PID", async () => {
    const root = await mkdtemp(join(tmpdir(), "natalia-detached-fail-"));
    await expect(
      startDetachedProcess({
        command: "true",
        posixScript: "exit 7",
        cwd: root,
        outputPath: join(root, "out.log"),
        env: { PATH: process.env.PATH },
      }),
    ).rejects.toThrow();
  });

  test("locates the shell through the host environment, not the child env", async () => {
    // The child environment is an allowlist that excludes ProgramFiles and
    // LOCALAPPDATA, so shell discovery must not consult it.
    const root = await mkdtemp(join(tmpdir(), "natalia-detached-win-"));
    const outputPath = join(root, "out.log");
    const { pid } = await startDetachedProcess({
      command: "printf windows-branch",
      posixScript: "echo 999999999",
      cwd: root,
      outputPath,
      os: "win32",
      env: { PATH: process.env.PATH },
      hostEnv: { NATALIA_BASH_EXECUTABLE: "/bin/bash" },
    });
    expect(pid).not.toBe(999999999);
    expect(Number.isInteger(pid)).toBe(true);
    expect(pid).toBeGreaterThan(0);
    // Redirection is performed natively rather than by the shell script.
    expect(await waitForOutput(outputPath)).toContain("windows-branch");
  });

  test("requires a bash-compatible shell on Windows", async () => {
    const root = await mkdtemp(join(tmpdir(), "natalia-detached-nobash-"));
    await expect(
      startDetachedProcess({
        command: "printf hi",
        posixScript: "echo 1",
        cwd: root,
        outputPath: join(root, "out.log"),
        os: "win32",
        hostEnv: { ProgramFiles: win32.join("C:", "Program Files") },
        exists: () => false,
      }),
    ).rejects.toThrow(/bash-compatible shell is unavailable/u);
  });
});

/**
 * A profile-reading shell can take a second to start, so the log is polled
 * rather than sampled after a fixed delay.
 */
async function waitForOutput(path: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const content = await readFile(path, "utf8").catch(() => "");
    if (content.trim()) return content;
    await Bun.sleep(100);
  }
  return "";
}
