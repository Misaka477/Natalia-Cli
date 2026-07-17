type CompactionInput = {
  instruction?: string;
  resources: string[];
};

type CompactionResult = {
  summary: string;
  tokens?: number;
};

export class FakeCompactor {
  attempts = 0;
  constructor(
    private readonly outcomes: Array<
      CompactionResult | "timeout" | "failure"
    > = [{ summary: "compact summary", tokens: 100 }],
  ) {}

  async compact(input: CompactionInput) {
    const outcome =
      this.outcomes[Math.min(this.attempts, this.outcomes.length - 1)];
    this.attempts += 1;
    if (outcome === "timeout") throw new Error("compaction timeout");
    if (outcome === "failure") throw new Error("compaction failed");
    return {
      summary: [
        outcome?.summary ?? "compact summary",
        input.instruction,
        input.resources.join("\n"),
      ]
        .filter(Boolean)
        .join("\n"),
      tokens: outcome?.tokens ?? 100,
    };
  }
}
