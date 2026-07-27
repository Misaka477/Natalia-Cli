/**
 * Batches same-tick terminal keystrokes while retaining one serialized write
 * chain. It contains no ownership or policy decisions; callers keep those
 * checks at the RuntimeClient boundary.
 */
export function createTerminalInputQueue(input: {
  write(data: string): Promise<void>;
  onError(cause: unknown): void;
}) {
  let queued = "";
  let scheduled = false;
  let writing = false;
  let writes = Promise.resolve();
  const flush = () => {
    scheduled = false;
    if (writing) return;
    const data = queued;
    queued = "";
    if (!data) return;
    writing = true;
    // Invoke write immediately. Native OpenTUI callbacks do not reliably
    // resume a Promise.then chain after accepting a physical key event.
    writes = Promise.resolve(input.write(data))
      .catch(input.onError)
      .finally(() => {
        writing = false;
        if (queued) flush();
      });
  };
  return {
    queue(data: string) {
      queued += data;
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(flush);
    },
    flushNow() {
      flush();
    },
    idle(): Promise<void> {
      return writes.then(() => (queued || writing ? this.idle() : undefined));
    },
  };
}
