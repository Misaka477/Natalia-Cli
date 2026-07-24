import { For, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type {
  TerminalCell,
  TerminalColor,
  TerminalScreenSnapshot,
} from "@natalia/contracts";
import { darkTheme } from "../theme/theme";

export function TerminalScreen(props: {
  screen?: TerminalScreenSnapshot;
  fallback?: string;
  maxRows?: number;
}) {
  const visibleLines = () =>
    props.screen?.lines.slice(-(props.maxRows ?? props.screen.rows)) ?? [];
  const rowOffset = () => (props.screen?.rows ?? 0) - visibleLines().length;
  return (
    <box flexDirection="column" backgroundColor={darkTheme.background}>
      <Show
        when={props.screen}
        fallback={
          <text fg={darkTheme.muted} wrapMode="word">
            {props.fallback || "(waiting for terminal output)"}
          </text>
        }
      >
        {(screen) => (
          <For each={visibleLines()}>
            {(line, row) => (
              <text wrapMode="none">
                <For
                  each={lineRuns(line, row() + rowOffset(), screen().cursor)}
                >
                  {(run) => <span style={run.style}>{run.text}</span>}
                </For>
              </text>
            )}
          </For>
        )}
      </Show>
    </box>
  );
}

function lineRuns(
  line: TerminalCell[],
  row: number,
  cursor: TerminalScreenSnapshot["cursor"],
) {
  const runs: Array<{
    text: string;
    style: ReturnType<typeof cellStyle>;
    key: string;
  }> = [];
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
