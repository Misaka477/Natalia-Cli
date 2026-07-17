export class PromptHistory {
  private entries: string[] = [];
  private index: number | undefined;
  private draft = "";

  add(value: string) {
    const text = value.trimEnd();
    if (!text) return;
    if (this.entries[this.entries.length - 1] !== text) this.entries.push(text);
    this.reset();
  }

  previous(current: string) {
    if (this.entries.length === 0) return current;
    if (this.index === undefined) {
      this.draft = current;
      this.index = this.entries.length - 1;
      return this.entries[this.index] ?? current;
    }
    this.index = Math.max(0, this.index - 1);
    return this.entries[this.index] ?? current;
  }

  next(current: string) {
    if (this.index === undefined) return current;
    this.index++;
    if (this.index >= this.entries.length) {
      const draft = this.draft;
      this.reset();
      return draft;
    }
    return this.entries[this.index] ?? current;
  }

  reset() {
    this.index = undefined;
    this.draft = "";
  }

  list() {
    return [...this.entries];
  }
}

export function shouldUseHistory(text: string, cursorOffset?: number) {
  return (
    text.length === 0 || cursorOffset === 0 || cursorOffset === text.length
  );
}
