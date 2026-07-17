import { lineCount, makeDigest } from "../testing/data";
import { ABSOLUTE_INPUT_LIMIT_BYTES, pastePreview } from "./paste";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export type EditorSnapshot = {
  text: string;
  cursor: number;
  byteLength: number;
  lineCount: number;
  sha256: string;
  foldedPreview?: string;
};

export class EditorBuffer {
  private clusters: string[] = [];
  private cursor = 0;
  private foldedPreview: string | undefined;

  value() {
    return this.clusters.join("");
  }

  length() {
    return this.clusters.length;
  }

  position() {
    return this.cursor;
  }

  setValue(text: string) {
    ensureWithinLimit(text);
    this.clusters = splitGraphemes(text);
    this.cursor = this.clusters.length;
    this.foldedPreview =
      new TextEncoder().encode(text).byteLength >= 1024 * 1024
        ? pastePreview(text, new TextEncoder().encode(text).byteLength)
        : undefined;
  }

  insert(text: string) {
    ensureWithinLimit(this.value() + text);
    const next = splitGraphemes(text);
    this.clusters.splice(this.cursor, 0, ...next);
    this.cursor += next.length;
    if (new TextEncoder().encode(text).byteLength >= 1024 * 1024)
      this.foldedPreview = pastePreview(
        text,
        new TextEncoder().encode(text).byteLength,
      );
  }

  deleteBackward() {
    if (this.cursor === 0) return;
    this.clusters.splice(this.cursor - 1, 1);
    this.cursor--;
  }

  deleteForward() {
    if (this.cursor >= this.clusters.length) return;
    this.clusters.splice(this.cursor, 1);
  }

  left() {
    this.cursor = Math.max(0, this.cursor - 1);
  }

  right() {
    this.cursor = Math.min(this.clusters.length, this.cursor + 1);
  }

  home() {
    while (this.cursor > 0 && this.clusters[this.cursor - 1] !== "\n")
      this.cursor--;
  }

  end() {
    while (
      this.cursor < this.clusters.length &&
      this.clusters[this.cursor] !== "\n"
    )
      this.cursor++;
  }

  bufferHome() {
    this.cursor = 0;
  }

  bufferEnd() {
    this.cursor = this.clusters.length;
  }

  wordBackward() {
    while (this.cursor > 0 && isWordBoundary(this.clusters[this.cursor - 1]!))
      this.cursor--;
    while (this.cursor > 0 && !isWordBoundary(this.clusters[this.cursor - 1]!))
      this.cursor--;
  }

  wordForward() {
    while (
      this.cursor < this.clusters.length &&
      isWordBoundary(this.clusters[this.cursor]!)
    )
      this.cursor++;
    while (
      this.cursor < this.clusters.length &&
      !isWordBoundary(this.clusters[this.cursor]!)
    )
      this.cursor++;
  }

  deleteWordBackward() {
    const end = this.cursor;
    this.wordBackward();
    this.clusters.splice(this.cursor, end - this.cursor);
  }

  deleteWordForward() {
    const start = this.cursor;
    this.wordForward();
    this.clusters.splice(start, this.cursor - start);
    this.cursor = start;
  }

  moveVisual(delta: -1 | 1, width: number) {
    const lines = this.visualLines(width);
    const current =
      lines.find(
        (line) => this.cursor >= line.start && this.cursor <= line.end,
      ) ?? lines[0];
    const index = lines.indexOf(current);
    const target =
      lines[Math.max(0, Math.min(lines.length - 1, index + delta))];
    const offset = Math.min(
      this.cursor - current.start,
      target.end - target.start,
    );
    this.cursor = target.start + Math.max(0, offset);
  }

  visualLines(width: number) {
    const limit = Math.max(1, width);
    const lines: Array<{ start: number; end: number }> = [];
    let start = 0;
    let cells = 0;
    this.clusters.forEach((cluster, index) => {
      if (cluster === "\n") {
        lines.push({ start, end: index });
        start = index + 1;
        cells = 0;
        return;
      }
      const next = cells + cellWidth(cluster);
      if (next > limit && start < index) {
        lines.push({ start, end: index });
        start = index;
        cells = cellWidth(cluster);
        return;
      }
      cells = next;
    });
    lines.push({ start, end: this.clusters.length });
    return lines;
  }

  snapshot(): EditorSnapshot {
    const text = this.value();
    return {
      text,
      cursor: this.cursor,
      byteLength: new TextEncoder().encode(text).byteLength,
      lineCount: lineCount(text),
      sha256: makeDigest(text),
      foldedPreview: this.foldedPreview,
    };
  }
}

export function splitGraphemes(text: string) {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

export function cellWidth(cluster: string) {
  if (cluster === "\n" || cluster === "") return 0;
  if (/\p{Extended_Pictographic}/u.test(cluster)) return 2;
  if (
    /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/u.test(
      cluster,
    )
  )
    return 2;
  return 1;
}

function isWordBoundary(cluster: string) {
  return /\s|[，。！？；：、,.!?;:()[\]{}<>]/u.test(cluster);
}

function ensureWithinLimit(text: string) {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > ABSOLUTE_INPUT_LIMIT_BYTES)
    throw new Error(
      `editor input exceeds ${ABSOLUTE_INPUT_LIMIT_BYTES} bytes: ${bytes}`,
    );
}
