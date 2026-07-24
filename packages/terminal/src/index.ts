import { Terminal } from "@xterm/headless";
import { spawn } from "node:child_process";
import type {
  TerminalCell,
  TerminalColor,
  TerminalScreenPatch,
  TerminalScrollbackPage,
  TerminalScreenSnapshot,
  TerminalScreenUpdate,
} from "@natalia/contracts";

export class XtermTerminalEmulator {
  private readonly terminal: Terminal;
  private cursorVisible = true;

  constructor(
    rows = 24,
    cols = 80,
    options: { onData?: (data: string) => void } = {},
  ) {
    this.terminal = new Terminal({
      rows,
      cols,
      allowProposedApi: true,
      scrollback: 500,
    });
    if (options.onData) this.terminal.onData(options.onData);
    this.terminal.parser.registerCsiHandler(
      { prefix: "?", final: "h" },
      (params) => {
        if (params.includes(25)) this.cursorVisible = true;
        return false;
      },
    );
    this.terminal.parser.registerCsiHandler(
      { prefix: "?", final: "l" },
      (params) => {
        if (params.includes(25)) this.cursorVisible = false;
        return false;
      },
    );
  }

  write(data: string | Uint8Array) {
    return new Promise<void>((resolve) => this.terminal.write(data, resolve));
  }

  resize(rows: number, cols: number) {
    this.terminal.resize(cols, rows);
  }

  snapshot(): TerminalScreenSnapshot {
    const buffer = this.terminal.buffer.active;
    const lines: TerminalCell[][] = [];
    for (let row = 0; row < this.terminal.rows; row++) {
      const line = buffer.getLine(buffer.viewportY + row);
      const cells: TerminalCell[] = [];
      for (let col = 0; col < this.terminal.cols; col++) {
        const cell = line?.getCell(col);
        cells.push(cell ? terminalCell(cell) : emptyCell());
      }
      lines.push(cells);
    }
    return {
      rows: this.terminal.rows,
      cols: this.terminal.cols,
      buffer: buffer.type,
      cursor: {
        row: buffer.cursorY,
        col: buffer.cursorX,
        visible: this.cursorVisible,
      },
      lines,
      text: lines
        .map((line) =>
          line
            .filter((cell) => cell[1] !== 0)
            .map((cell) => cell[0])
            .join("")
            .trimEnd(),
        )
        .join("\n")
        .replace(/\n+$/u, ""),
      modes: { bracketedPaste: this.terminal.modes.bracketedPasteMode },
    };
  }

  scrollback(
    offsetFromBottom = 0,
    maxRows = this.terminal.rows,
  ): TerminalScrollbackPage {
    const buffer = this.terminal.buffer.active;
    const end = Math.max(0, buffer.length - Math.max(0, offsetFromBottom));
    const start = Math.max(0, end - Math.max(1, maxRows));
    const lines: TerminalCell[][] = [];
    for (let row = start; row < end; row++) {
      const line = buffer.getLine(row);
      const cells: TerminalCell[] = [];
      for (let col = 0; col < this.terminal.cols; col++) {
        const cell = line?.getCell(col);
        cells.push(cell ? terminalCell(cell) : emptyCell());
      }
      lines.push(cells);
    }
    return {
      offsetFromBottom,
      start,
      end,
      totalLines: buffer.length,
      lines,
      text: screenText(lines),
    };
  }

  dispose() {
    this.terminal.dispose();
  }
}

export function renderTerminalSnapshotANSI(
  screen: TerminalScreenSnapshot,
  options: { clear?: boolean } = {},
) {
  const output = [options.clear === false ? "\x1b[H" : "\x1b[2J\x1b[H"];
  for (let row = 0; row < screen.lines.length; row++) {
    if (row > 0) output.push("\r\n");
    let previousStyle = "";
    for (const cell of screen.lines[row]!) {
      if (cell[1] === 0) continue;
      const style = ansiCellStyle(cell);
      if (style !== previousStyle) {
        output.push(`\x1b[0m${style}`);
        previousStyle = style;
      }
      output.push(cell[0] || " ");
    }
    output.push("\x1b[0m");
  }
  output.push(
    `\x1b[${screen.cursor.row + 1};${screen.cursor.col + 1}H`,
    screen.modes?.bracketedPaste ? "\x1b[?2004h" : "\x1b[?2004l",
    screen.cursor.visible ? "\x1b[?25h" : "\x1b[?25l",
  );
  return output.join("");
}

export function diffTerminalScreens(input: {
  base: TerminalScreenSnapshot;
  next: TerminalScreenSnapshot;
  baseRevision: number;
  revision: number;
}): TerminalScreenUpdate {
  const { base, next, baseRevision, revision } = input;
  if (
    base.rows !== next.rows ||
    base.cols !== next.cols ||
    base.buffer !== next.buffer
  )
    return { kind: "full", revision, screen: next };
  const changes: TerminalScreenPatch["changes"] = [];
  for (let row = 0; row < next.rows; row++) {
    const before = base.lines[row] ?? [];
    const after = next.lines[row] ?? [];
    let start = -1;
    for (let col = 0; col < next.cols; col++) {
      const changed = !sameCell(before[col], after[col]);
      if (changed && start < 0) start = col;
      if ((!changed || col === next.cols - 1) && start >= 0) {
        const end = changed && col === next.cols - 1 ? col + 1 : col;
        changes.push([row, start, after.slice(start, end)]);
        start = -1;
      }
    }
  }
  const patch: TerminalScreenPatch = {
    baseRevision,
    revision,
    rows: next.rows,
    cols: next.cols,
    buffer: next.buffer,
    cursor: next.cursor,
    modes: next.modes,
    changes,
  };
  return JSON.stringify(patch).length < JSON.stringify(next).length
    ? { kind: "patch", patch }
    : { kind: "full", revision, screen: next };
}

export function applyTerminalScreenUpdate(
  current: TerminalScreenSnapshot | undefined,
  update: TerminalScreenUpdate | undefined,
  currentRevision?: number,
) {
  if (!update) return current;
  if (update.kind === "full") return update.screen;
  if (
    !current ||
    (currentRevision !== undefined &&
      currentRevision !== update.patch.baseRevision) ||
    current.rows !== update.patch.rows ||
    current.cols !== update.patch.cols ||
    current.buffer !== update.patch.buffer
  )
    throw new Error("terminal screen patch does not match current framebuffer");
  const lines = current.lines.map((line) => [...line]);
  for (const [row, start, cells] of update.patch.changes)
    lines[row]!.splice(start, cells.length, ...cells);
  return {
    ...current,
    cursor: update.patch.cursor,
    modes: update.patch.modes,
    lines,
    text: screenText(lines),
  };
}

export function externalTerminalLaunchCommand(input: {
  id: string;
  executable: string[];
  preferred?: string;
  takeControl?: boolean;
  secureInput?: boolean;
  which?: (name: string) => string | null;
}) {
  const which = input.which ?? ((name: string) => Bun.which(name));
  const launchers = input.preferred
    ? [input.preferred]
    : [
        "kitty",
        "wezterm",
        "foot",
        "alacritty",
        "gnome-terminal",
        "konsole",
        "xterm",
      ];
  const launcher = launchers.find((candidate) => which(candidate));
  if (!launcher) return undefined;
  const attach = [
    ...input.executable,
    "terminal",
    "attach",
    input.id,
    ...(input.takeControl ? ["--take-control"] : []),
    ...(input.secureInput ? ["--secure-input"] : []),
  ];
  if (launcher === "wezterm") return [launcher, "start", "--", ...attach];
  if (
    launcher === "alacritty" ||
    launcher === "konsole" ||
    launcher === "xterm"
  )
    return [launcher, "-e", ...attach];
  return [launcher, "--", ...attach];
}

export function launchExternalTerminal(input: {
  command: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}) {
  const child = spawn(input.command[0]!, input.command.slice(1), {
    cwd: input.cwd,
    env: input.env ?? process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  if (!child.pid) throw new Error("external terminal launcher did not start");
  return child.pid;
}

type XtermCell = NonNullable<
  ReturnType<
    NonNullable<ReturnType<Terminal["buffer"]["active"]["getLine"]>>["getCell"]
  >
>;

function terminalCell(cell: XtermCell): TerminalCell {
  let attributes = 0;
  if (cell.isBold()) attributes |= 1 << 0;
  if (cell.isDim()) attributes |= 1 << 1;
  if (cell.isItalic()) attributes |= 1 << 2;
  if (cell.isUnderline()) attributes |= 1 << 3;
  if (cell.isBlink()) attributes |= 1 << 4;
  if (cell.isInverse()) attributes |= 1 << 5;
  if (cell.isInvisible()) attributes |= 1 << 6;
  if (cell.isStrikethrough()) attributes |= 1 << 7;
  const value: TerminalCell = [
    cell.isInvisible() ? " " : cell.getChars() || " ",
    cell.getWidth(),
  ];
  const fg = color(cell, "fg");
  const bg = color(cell, "bg");
  if (fg !== undefined || bg !== undefined || attributes) value[2] = fg;
  if (bg !== undefined || attributes) value[3] = bg;
  if (attributes) value[4] = attributes;
  return value;
}

function color(cell: XtermCell, side: "fg" | "bg"): TerminalColor {
  const rgb = side === "fg" ? cell.isFgRGB() : cell.isBgRGB();
  const palette = side === "fg" ? cell.isFgPalette() : cell.isBgPalette();
  const value = side === "fg" ? cell.getFgColor() : cell.getBgColor();
  if (rgb) return 0x1000000 + value;
  if (palette) return value;
  return undefined;
}

function emptyCell(): TerminalCell {
  return [" ", 1];
}

function sameCell(left?: TerminalCell, right?: TerminalCell) {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function screenText(lines: TerminalCell[][]) {
  return lines
    .map((line) =>
      line
        .filter((cell) => cell[1] !== 0)
        .map((cell) => cell[0])
        .join("")
        .trimEnd(),
    )
    .join("\n")
    .replace(/\n+$/u, "");
}

function ansiCellStyle(cell: TerminalCell) {
  const flags = cell[4] ?? 0;
  const values: number[] = [];
  if (flags & (1 << 0)) values.push(1);
  if (flags & (1 << 1)) values.push(2);
  if (flags & (1 << 2)) values.push(3);
  if (flags & (1 << 3)) values.push(4);
  if (flags & (1 << 4)) values.push(5);
  if (flags & (1 << 5)) values.push(7);
  if (flags & (1 << 6)) values.push(8);
  if (flags & (1 << 7)) values.push(9);
  values.push(...ansiColor(cell[2], false), ...ansiColor(cell[3], true));
  return values.length ? `\x1b[${values.join(";")}m` : "";
}

function ansiColor(color: TerminalColor, background: boolean) {
  if (color == null) return [];
  if (color >= 0x1000000) {
    const value = color - 0x1000000;
    return [
      background ? 48 : 38,
      2,
      (value >> 16) & 0xff,
      (value >> 8) & 0xff,
      value & 0xff,
    ];
  }
  return [background ? 48 : 38, 5, color];
}
