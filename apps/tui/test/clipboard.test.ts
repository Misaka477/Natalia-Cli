import { expect, test } from "bun:test";
import { copyCommand, imageReadCommand } from "../src/clipboard";

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

test("image clipboard command picks the platform tool for image bytes", () => {
  expect(
    imageReadCommand("linux", true, (name) => name === "wl-paste"),
  ).toEqual(["wl-paste", "-t", "image/png"]);
  expect(imageReadCommand("linux", false, (name) => name === "xclip")).toEqual([
    "xclip",
    "-selection",
    "clipboard",
    "-t",
    "image/png",
    "-o",
  ]);
  expect(
    imageReadCommand("darwin", false, (name) => name === "osascript"),
  ).toEqual(["osascript", "-e", "the clipboard as «class PNGf»"]);
  expect(imageReadCommand("linux", false, () => false)).toBeUndefined();
});
