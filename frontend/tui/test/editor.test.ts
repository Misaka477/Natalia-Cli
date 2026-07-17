import { describe, expect, test } from "bun:test";
import { EditorBuffer, splitGraphemes } from "../src/prompt/editor";
import {
  chinese10000,
  chinese300,
  makeDigest,
  mixedGraphemes,
  paste100KiB,
  paste1MiB,
} from "../src/testing/data";

describe("EditorBuffer M0 regressions", () => {
  test("keeps 300 Chinese characters intact after cursor movement", () => {
    const buffer = new EditorBuffer();
    const input = chinese300();
    buffer.setValue(input);
    for (let index = 0; index < 300; index++) buffer.left();
    for (let index = 0; index < 300; index++) buffer.right();
    for (const width of [200, 160, 120, 80, 60, 40]) {
      buffer.moveVisual(-1, width);
      buffer.moveVisual(1, width);
    }
    expect(buffer.snapshot().text).toBe(input);
    expect(buffer.snapshot().sha256).toBe(makeDigest(input));
  });

  test("edits 10000 Chinese characters with Home End insert delete", () => {
    const buffer = new EditorBuffer();
    buffer.setValue(chinese10000());
    buffer.home();
    buffer.insert("始");
    buffer.end();
    buffer.insert("末");
    buffer.deleteBackward();
    expect(buffer.snapshot().text.startsWith("始")).toBe(true);
    expect(buffer.snapshot().byteLength).toBe(
      new TextEncoder().encode(buffer.snapshot().text).byteLength,
    );
  });

  test("handles at least 20000 mixed graphemes", () => {
    const input = mixedGraphemes();
    expect(splitGraphemes(input).length).toBeGreaterThanOrEqual(20_000);
    const buffer = new EditorBuffer();
    buffer.setValue(input);
    buffer.moveVisual(-1, 80);
    buffer.moveVisual(1, 80);
    expect(buffer.snapshot().sha256).toBe(makeDigest(input));
  });

  test("tracks 100 KiB and 1 MiB paste integrity with folded preview", () => {
    for (const input of [paste100KiB(), paste1MiB()]) {
      const buffer = new EditorBuffer();
      buffer.setValue(input);
      const snapshot = buffer.snapshot();
      expect(snapshot.byteLength).toBe(
        new TextEncoder().encode(input).byteLength,
      );
      expect(snapshot.sha256).toBe(makeDigest(input));
      if (snapshot.byteLength >= 1024 * 1024)
        expect(snapshot.foldedPreview).toContain("folded paste");
    }
  });
});
