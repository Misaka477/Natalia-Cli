import { expect, test } from "bun:test";
import {
  applyTerminalScreenUpdate,
  diffTerminalScreens,
  renderTerminalSnapshotANSI,
  XtermTerminalEmulator,
} from "../src";

test("xterm emulator exposes styled cells and cursor state", async () => {
  const terminal = new XtermTerminalEmulator(3, 12);
  await terminal.write("\x1b[38;2;12;34;56m\x1b[1mHello\x1b[0m");
  const screen = terminal.snapshot();
  expect(screen.text).toBe("Hello");
  expect(screen.cursor).toMatchObject({ row: 0, col: 5, visible: true });
  expect(screen.lines[0]?.[0]).toEqual([
    "H",
    1,
    0x1000000 + 0x0c2238,
    undefined,
    1,
  ]);
  terminal.dispose();
});

test("xterm emulator tracks alternate screen and restores normal screen", async () => {
  const terminal = new XtermTerminalEmulator(2, 12);
  await terminal.write("shell");
  await terminal.write("\x1b[?1049h\x1b[Hfull screen");
  expect(terminal.snapshot()).toMatchObject({
    buffer: "alternate",
    text: "full screen",
  });
  await terminal.write("\x1b[?1049l");
  expect(terminal.snapshot()).toMatchObject({
    buffer: "normal",
    text: "shell",
  });
  terminal.dispose();
});

test("xterm emulator preserves CJK cell widths and cursor visibility", async () => {
  const terminal = new XtermTerminalEmulator(2, 12);
  await terminal.write("你好\x1b[?25l");
  const screen = terminal.snapshot();
  expect(screen.text).toBe("你好");
  expect(screen.cursor).toMatchObject({ col: 4, visible: false });
  expect(screen.lines[0]?.slice(0, 4).map((cell) => cell[1])).toEqual([
    2, 0, 2, 0,
  ]);
  terminal.dispose();
});

test("terminal snapshot uses a compact wire representation for blank cells", () => {
  const terminal = new XtermTerminalEmulator(24, 80);
  expect(JSON.stringify(terminal.snapshot()).length).toBeLessThan(20_000);
  terminal.dispose();
});

test("xterm emulator decodes UTF-8 split across raw PTY chunks", async () => {
  const terminal = new XtermTerminalEmulator(2, 12);
  const bytes = new TextEncoder().encode("界");
  await terminal.write(bytes.slice(0, 2));
  await terminal.write(bytes.slice(2));
  expect(terminal.snapshot().text).toBe("界");
  terminal.dispose();
});

test("terminal snapshot renders as a standalone ANSI terminal frame", async () => {
  const terminal = new XtermTerminalEmulator(2, 12);
  await terminal.write("\x1b[38;2;12;34;56m\x1b[1mHi");
  const frame = renderTerminalSnapshotANSI(terminal.snapshot());
  expect(frame).toStartWith("\x1b[2J\x1b[H");
  expect(frame).toContain("\x1b[1;38;2;12;34;56mHi");
  expect(frame).toContain("\x1b[1;3H\x1b[?2004l\x1b[?25h");
  terminal.dispose();
});

test("terminal screen diff patches a small redraw without sending a full frame", async () => {
  const terminal = new XtermTerminalEmulator(24, 80);
  await terminal.write("initial");
  const base = terminal.snapshot();
  await terminal.write("\x1b[1;1Hchanged");
  const next = terminal.snapshot();
  const update = diffTerminalScreens({
    base,
    next,
    baseRevision: 4,
    revision: 5,
  });
  expect(update.kind).toBe("patch");
  expect(JSON.stringify(update).length).toBeLessThan(
    JSON.stringify({ kind: "full", revision: 5, screen: next }).length / 5,
  );
  expect(applyTerminalScreenUpdate(base, update, 4)).toEqual(next);
  expect(() => applyTerminalScreenUpdate(base, update, 3)).toThrow(
    "does not match current framebuffer",
  );
  terminal.dispose();
});

test("xterm emulator returns terminal capability responses to the PTY", async () => {
  const responses: string[] = [];
  const terminal = new XtermTerminalEmulator(24, 80, {
    onData: (data) => responses.push(data),
  });
  await terminal.write("\x1b[c\x1b[6n");
  expect(responses.join("")).toContain("\x1b[?1;2c");
  expect(responses.join("")).toContain("\x1b[1;1R");
  terminal.dispose();
});

test("xterm emulator projects bracketed paste mode through screen updates", async () => {
  const terminal = new XtermTerminalEmulator(2, 12);
  const before = terminal.snapshot();
  await terminal.write("\x1b[?2004h");
  const after = terminal.snapshot();
  expect(after.modes).toEqual({ bracketedPaste: true });
  const update = diffTerminalScreens({
    base: before,
    next: after,
    baseRevision: 1,
    revision: 2,
  });
  expect(applyTerminalScreenUpdate(before, update, 1)?.modes).toEqual({
    bracketedPaste: true,
  });
  terminal.dispose();
});

test("xterm emulator exposes bounded scrollback pages", async () => {
  const terminal = new XtermTerminalEmulator(3, 12);
  await terminal.write("one\r\ntwo\r\nthree\r\nfour\r\nfive");
  const page = terminal.scrollback(2, 3);
  expect(page).toMatchObject({
    offsetFromBottom: 2,
    totalLines: 5,
    text: "one\ntwo\nthree",
  });
  terminal.dispose();
});

test("xterm emulator caps retained scrollback", async () => {
  const terminal = new XtermTerminalEmulator(2, 12);
  await terminal.write(
    Array.from({ length: 2_100 }, (_, index) => `line-${index}\r\n`).join(""),
  );
  expect(terminal.scrollback(0, 1).totalLines).toBeLessThanOrEqual(502);
  terminal.dispose();
});
