/**
 * Produces the two-line read-only terminal summary without scanning a full,
 * potentially high-volume terminal tail on every TUI update.
 */
export function terminalPreview(text: string) {
  const tail = text.slice(-4_096);
  const lines = tail
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-2)
    .map((line) => (line.length > 120 ? `${line.slice(0, 117)}...` : line));
  return lines.length ? lines : ["No visible terminal output yet."];
}
