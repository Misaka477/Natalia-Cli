import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TerminalRegistry } from "../src";

test("tri-verification: screen, transcript and scrollback agree on the same output", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-tri-"));
  const registry = new TerminalRegistry(join(root, ".natalia", "terminal"));
  const started = await registry.start({
    id: "tty_tri",
    command: "cat",
    cwd: root,
    rows: 24,
    cols: 80,
  });

  const marker = "TRI-VERIFY-MARKER-123";
  const initialRevision = registry.get(started.id).revision;
  await registry.write(started.id, marker);
  await registry.write(started.id, "\n");

  const observation = await registry.observe(started.id, {
    afterRevision: initialRevision,
    timeoutMs: 2000,
  });
  expect(observation.changed).toBe(true);
  expect(observation.session.screen?.text).toContain(marker);

  const sessionInfo = registry.get(started.id);
  const screenText = observation.session.screen?.text ?? "";
  const readResult = registry.read(started.id, { maxChars: 4000 });
  const scrollbackPage = registry.scrollback(started.id, {
    offsetFromBottom: 0,
    maxRows: sessionInfo.rows,
  });

  expect(screenText).toContain(marker);
  expect(readResult.transcript).toContain(marker);
  expect(scrollbackPage.text).toContain(marker);

  const screenLine = screenText.split("\n").find((line: string) =>
    line.includes(marker),
  );
  const scrollbackLine = scrollbackPage.text.split("\n").find((line: string) =>
    line.includes(marker),
  );
  const transcriptSlice = readResult.transcript.slice(
    Math.max(0, readResult.transcript.lastIndexOf(marker) - 20),
    readResult.transcript.lastIndexOf(marker) + marker.length + 20,
  );

  expect(screenLine).toBeDefined();
  expect(scrollbackLine).toBeDefined();
  expect(transcriptSlice).toContain(marker);
  expect(screenLine!.trim()).toBe(scrollbackLine!.trim());

  if (observation.session.screen?.cursor) {
    expect(observation.session.screen.cursor.row).toBeTypeOf("number");
    expect(observation.session.screen.cursor.col).toBeTypeOf("number");
    expect(typeof observation.session.screen.cursor.visible).toBe("boolean");
  }

  if (observation.cursorX !== undefined) {
    expect(observation.cursorX).toBe(
      observation.session.screen?.cursor?.col ?? 0,
    );
  }
  if (observation.cursorY !== undefined) {
    expect(observation.cursorY).toBe(
      observation.session.screen?.cursor?.row ?? 0,
    );
  }
  if (observation.rows !== undefined) {
    expect(observation.rows).toBe(sessionInfo.rows);
  }
  if (observation.cols !== undefined) {
    expect(observation.cols).toBe(sessionInfo.cols);
  }

  await registry.stop(started.id);
});
