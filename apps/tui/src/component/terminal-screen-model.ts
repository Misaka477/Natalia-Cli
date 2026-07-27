import { TextAttributes } from "@opentui/core";
import type {
  TerminalCell,
  TerminalColor,
  TerminalScreenSnapshot,
} from "@natalia/contracts";
import { darkTheme } from "../theme/theme";

export type TerminalScreenRun = {
  text: string;
  style: ReturnType<typeof cellStyle>;
  key: string;
};

export type TerminalScreenRenderModel = {
  rows: Array<{ row: number; runs: TerminalScreenRun[] }>;
  visibleRows: number;
  visibleCells: number;
  styleRuns: number;
  // TerminalScreen creates one <text> per row and one <span> per style run.
  estimatedJsxNodes: number;
};

type CachedRow = {
  cursorSignature: string;
  visibleCells: number;
  view: { row: number; runs: TerminalScreenRun[] };
  runs: TerminalScreenRun[];
};

/**
 * Retains projections for immutable rows preserved by terminal patch apply.
 * Cursor movement invalidates only its old/new row rather than the full grid.
 */
export class TerminalScreenRenderCache {
  private readonly rows = new WeakMap<TerminalCell[], CachedRow>();

  model(screen: TerminalScreenSnapshot | undefined, maxRows?: number) {
    if (!screen)
      return {
        rows: [],
        visibleRows: 0,
        visibleCells: 0,
        styleRuns: 0,
        estimatedJsxNodes: 0,
      } satisfies TerminalScreenRenderModel;
    const lines = screen.lines.slice(-(maxRows ?? screen.rows));
    const rowOffset = screen.rows - lines.length;
    let visibleCells = 0;
    let styleRuns = 0;
    const rows = lines.map((line, offset) => {
      const row = offset + rowOffset;
      const cursorSignature = cursorKey(row, screen.cursor);
      const cached = this.rows.get(line);
      const projection =
        cached?.cursorSignature === cursorSignature
          ? cached
          : createCachedRow(line, row, screen.cursor, cursorSignature);
      if (projection.view.row !== row)
        projection.view = { row, runs: projection.runs };
      this.rows.set(line, projection);
      visibleCells += projection.visibleCells;
      styleRuns += projection.runs.length;
      return projection.view;
    });
    return {
      rows,
      visibleRows: rows.length,
      visibleCells,
      styleRuns,
      estimatedJsxNodes: rows.length + styleRuns,
    };
  }
}

/**
 * The exact data work set currently materialized by TerminalScreen. It is
 * presentation-local instrumentation, not a Runtime/transport metric.
 */
export function terminalScreenRenderModel(
  screen: TerminalScreenSnapshot | undefined,
  maxRows?: number,
): TerminalScreenRenderModel {
  return new TerminalScreenRenderCache().model(screen, maxRows);
}

export function terminalLineRuns(
  line: TerminalCell[],
  row: number,
  cursor: TerminalScreenSnapshot["cursor"],
) {
  const runs: TerminalScreenRun[] = [];
  for (let col = 0; col < line.length; col++) {
    const cell = line[col]!;
    if (cell[1] === 0) continue;
    const cursorCell =
      cursor.visible && cursor.row === row && cursor.col === col;
    const key = `${cell[2] ?? "d"}:${cell[3] ?? "d"}:${cell[4] ?? 0}:${cursorCell}`;
    const previous = runs.at(-1);
    if (previous?.key === key) previous.text += cell[0] || " ";
    else
      runs.push({
        text: cell[0] || " ",
        style: cellStyle(cell, cursorCell),
        key,
      });
  }
  return runs;
}

function cellStyle(cell: TerminalCell, cursor: boolean) {
  const flags = cell[4] ?? 0;
  const inverse = Boolean(flags & (1 << 5)) !== cursor;
  const foreground = terminalColor(cell[2], darkTheme.text);
  const background = terminalColor(cell[3], darkTheme.background);
  let attributes = TextAttributes.NONE;
  if (flags & (1 << 0)) attributes |= TextAttributes.BOLD;
  if (flags & (1 << 1)) attributes |= TextAttributes.DIM;
  if (flags & (1 << 2)) attributes |= TextAttributes.ITALIC;
  if (flags & (1 << 3)) attributes |= TextAttributes.UNDERLINE;
  if (flags & (1 << 4)) attributes |= TextAttributes.BLINK;
  if (flags & (1 << 7)) attributes |= TextAttributes.STRIKETHROUGH;
  if (flags & (1 << 6)) attributes |= TextAttributes.HIDDEN;
  return {
    fg: inverse ? background : foreground,
    bg: inverse ? foreground : background,
    attributes,
  };
}

function countVisibleCells(line: TerminalCell[]) {
  return line.reduce((total, cell) => total + (cell[1] === 0 ? 0 : 1), 0);
}

function createCachedRow(
  line: TerminalCell[],
  row: number,
  cursor: TerminalScreenSnapshot["cursor"],
  cursorSignature: string,
): CachedRow {
  const runs = terminalLineRuns(line, row, cursor);
  return {
    cursorSignature,
    visibleCells: countVisibleCells(line),
    runs,
    view: { row, runs },
  };
}

function cursorKey(row: number, cursor: TerminalScreenSnapshot["cursor"]) {
  return cursor.visible && cursor.row === row ? String(cursor.col) : "-";
}

function terminalColor(color: TerminalColor, fallback: string) {
  if (color == null) return fallback;
  if (color >= 0x1000000)
    return `#${(color - 0x1000000).toString(16).padStart(6, "0")}`;
  return ansiPalette(color);
}

function ansiPalette(index: number) {
  const base = [
    "#000000",
    "#cd0000",
    "#00cd00",
    "#cdcd00",
    "#0000ee",
    "#cd00cd",
    "#00cdcd",
    "#e5e5e5",
    "#7f7f7f",
    "#ff0000",
    "#00ff00",
    "#ffff00",
    "#5c5cff",
    "#ff00ff",
    "#00ffff",
    "#ffffff",
  ];
  if (index < base.length) return base[index]!;
  if (index >= 232) {
    const level = 8 + (index - 232) * 10;
    return rgb(level, level, level);
  }
  const value = index - 16;
  const levels = [0, 95, 135, 175, 215, 255];
  return rgb(
    levels[Math.floor(value / 36)]!,
    levels[Math.floor(value / 6) % 6]!,
    levels[value % 6]!,
  );
}

function rgb(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}
