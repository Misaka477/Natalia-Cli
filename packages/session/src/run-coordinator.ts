/** Serializes work for one session while preserving work submitted after failures. */
export class SessionRunCoordinator {
  private tail = Promise.resolve();
  private pending = 0;

  get active() {
    return this.pending > 0;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending++;
    const next = this.tail.then(task, task);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    void next.then(
      () => this.pending--,
      () => this.pending--,
    );
    return next;
  }

  async idle() {
    await this.tail;
  }
}
