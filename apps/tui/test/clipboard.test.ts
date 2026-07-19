import { expect, test } from "bun:test";
import { copyCommand } from "../src/clipboard";

test("clipboard command prefers Wayland and native platform tools", () => {
  expect(copyCommand("linux", true, (name) => name === "wl-copy")).toEqual([
    "wl-copy",
  ]);
  expect(copyCommand("darwin", false, (name) => name === "pbcopy")).toEqual([
    "pbcopy",
  ]);
});

test("clipboard command falls through X11 tools safely", () => {
  expect(copyCommand("linux", false, (name) => name === "xclip")).toEqual([
    "xclip",
    "-selection",
    "clipboard",
  ]);
  expect(copyCommand("linux", false, () => false)).toBeUndefined();
});
