/**
 * The workspace write lock (D2: "same workspace, writes serialised").
 *
 * Parallel sessions may run turns concurrently; two of them writing the same
 * workspace at once would interleave file edits and corrupt both. The lock is
 * a promise chain — the next writer waits for the previous one to release —
 * so writers serialise in acquisition order while readers and everything else
 * stay parallel.
 */
export function createWorkspaceWriteLock() {
  let chain: Promise<void> = Promise.resolve();

  /** Acquires the lock; resolves with the release function. */
  function acquire(): Promise<() => void> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = chain;
    chain = previous.then(() => gate);
    return previous.then(() => release);
  }

  return { acquire };
}

export type WorkspaceWriteLock = ReturnType<typeof createWorkspaceWriteLock>;
