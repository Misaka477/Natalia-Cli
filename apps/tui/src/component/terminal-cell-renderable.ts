import { RGBA, Renderable } from "@opentui/core";
import type { OptimizedBuffer } from "@opentui/core";
import type { TerminalCell, TerminalScreenSnapshot } from "@natalia/contracts";
import { darkTheme } from "../theme/theme";

/**
 * Isolated TERM-1 feasibility spike. It renders the existing authoritative
 * cell snapshot directly into OpenTUI's framebuffer; it is not wired into the
 * production TerminalScreen route until real-renderer evidence is sufficient.
 */
export class TerminalCellRenderable extends Renderable {
  private screen: TerminalScreenSnapshot;

  constructor(
    ctx: ConstructorParameters<typeof Renderable>[0],
    screen: TerminalScreenSnapshot,
  ) {
    super(ctx, { width: screen.cols, height: screen.rows });
    this.screen = screen;
  }

  setScreen(screen: TerminalScreenSnapshot) {
    this.screen = screen;
    this.width = screen.cols;
    this.height = screen.rows;
    this.requestRender();
  }

  protected override renderSelf(buffer: OptimizedBuffer) {
    const rows = Math.min(this.height, this.screen.rows);
    const cols = Math.min(this.width, this.screen.cols);
    for (let row = 0; row < rows; row++) {
      const line = this.screen.lines[row] ?? [];
      for (let col = 0; col < cols; col++) {
        const cell = line[col] ?? [" ", 1];
        if (cell[1] === 0) continue;
        const cursor =
          this.screen.cursor.visible &&
          this.screen.cursor.row === row &&
          this.screen.cursor.col === col;
        const style = cellStyle(cell, cursor);
        buffer.setCell(
          this.screenX + col,
          this.screenY + row,
          cell[0] || " ",
          style.fg,
          style.bg,
          style.attributes,
        );
      }
    }
  }
}

function cellStyle(cell: TerminalCell, cursor: boolean) {
  const flags = cell[4] ?? 0;
  const inverse = Boolean(flags & (1 << 5)) !== cursor;
  const foreground = terminalColor(cell[2], darkTheme.text);
  const background = terminalColor(cell[3], darkTheme.background);
  return {
    fg: inverse ? background : foreground,
    bg: inverse ? foreground : background,
    attributes: flags,
  };
}

function terminalColor(color: number | null | undefined, fallback: string) {
  if (color == null) return RGBA.fromHex(fallback);
  if (color >= 0x1000000)
    return RGBA.fromInts(
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff,
    );
  return RGBA.fromInts(...ansiPalette(color));
}

function ansiPalette(index: number): [number, number, number] {
  const base: Array<[number, number, number]> = [
    [0, 0, 0],
    [205, 0, 0],
    [0, 205, 0],
    [205, 205, 0],
    [0, 0, 238],
    [205, 0, 205],
    [0, 205, 205],
    [229, 229, 229],
    [127, 127, 127],
    [255, 0, 0],
    [0, 255, 0],
    [255, 255, 0],
    [92, 92, 255],
    [255, 0, 255],
    [0, 255, 255],
    [255, 255, 255],
  ];
  if (index < base.length) return base[index]!;
  if (index >= 232) {
    const level = 8 + (index - 232) * 10;
    return [level, level, level];
  }
  const value = index - 16;
  const levels = [0, 95, 135, 175, 215, 255];
  return [
    levels[Math.floor(value / 36)]!,
    levels[Math.floor(value / 6) % 6]!,
    levels[value % 6]!,
  ];
}
