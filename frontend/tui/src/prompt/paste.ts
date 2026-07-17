import { lineCount, makeDigest } from "../testing/data";

export const SUPPORTED_PASTE_PREVIEW_BYTES = 100 * 1024;
export const FOLDED_PASTE_PREVIEW_BYTES = 1024 * 1024;
export const ABSOLUTE_INPUT_LIMIT_BYTES = 8 * 1024 * 1024;

export type PasteDecision =
  | {
      ok: true;
      text: string;
      byteLength: number;
      preview?: string;
    }
  | {
      ok: false;
      byteLength: number;
      message: string;
    };

export function normalizePastedText(bytes: Uint8Array) {
  return new TextDecoder()
    .decode(bytes)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function decidePaste(
  bytes: Uint8Array,
  existingText = "",
): PasteDecision {
  const text = normalizePastedText(bytes);
  const byteLength = new TextEncoder().encode(text).byteLength;
  const nextBytes =
    new TextEncoder().encode(existingText).byteLength + byteLength;
  if (nextBytes > ABSOLUTE_INPUT_LIMIT_BYTES) {
    return {
      ok: false,
      byteLength: nextBytes,
      message: `paste rejected atomically: bytes=${nextBytes} limit=${ABSOLUTE_INPUT_LIMIT_BYTES}`,
    };
  }
  return {
    ok: true,
    text,
    byteLength,
    preview:
      byteLength >= SUPPORTED_PASTE_PREVIEW_BYTES
        ? pastePreview(text, byteLength)
        : undefined,
  };
}

export function pastePreview(text: string, byteLength: number) {
  const mode = byteLength >= FOLDED_PASTE_PREVIEW_BYTES ? "folded" : "large";
  return `${mode} paste: bytes=${byteLength} lines=${lineCount(text)} sha256=${makeDigest(text)}`;
}
