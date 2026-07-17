import { describe, expect, test } from "bun:test";
import { composerKeyAction } from "../src/keymap";

describe("composer key routing", () => {
  test("routes Enter to submit and modified Enter to newline", () => {
    expect(composerKeyAction({ name: "return" })).toBe("submit");
    expect(composerKeyAction({ name: "enter" })).toBe("submit");
    expect(composerKeyAction({ name: "return", option: true })).toBe("newline");
    expect(composerKeyAction({ name: "return", alt: true })).toBe("newline");
    expect(composerKeyAction({ name: "return", meta: true })).toBe("newline");
    expect(composerKeyAction({ name: "return", shift: true })).toBe("newline");
    expect(composerKeyAction({ name: "j", ctrl: true })).toBe("newline");
  });

  test("leaves plain Home and End for message scrolling", () => {
    expect(composerKeyAction({ name: "home" })).toBeUndefined();
    expect(composerKeyAction({ name: "end" })).toBeUndefined();
    expect(composerKeyAction({ name: "home", ctrl: true })).toBe("buffer-home");
    expect(composerKeyAction({ name: "end", ctrl: true })).toBe("buffer-end");
  });
});
