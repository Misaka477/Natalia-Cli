export type ToolStatus =
  | "receiving_arguments"
  | "queued"
  | "awaiting_approval"
  | "running"
  | "succeeded"
  | "failed"
  | "rejected"
  | "cancelled";

export type ToolKind =
  | "generic"
  | "diff"
  | "todo"
  | "workflow"
  | "background"
  | "subagent"
  | "pty"
  | "sandbox"
  | "skill";

export type ToolResultView = {
  summary: string;
  preview: string;
  detail: string;
  truncated: boolean;
  totalChars: number;
  totalLines: number;
};

export type ParsedToolArguments = {
  complete: boolean;
  keyArguments: string[];
  redactedJson?: string;
};

const sensitiveKey =
  /(?:api[_-]?key|token|secret|password|passphrase|credential|authorization|cookie)/iu;

export function classifyTool(
  name: string,
  metadata: Record<string, unknown> = {},
): ToolKind {
  const lower = name.toLowerCase();
  const kind =
    typeof metadata.kind === "string" ? metadata.kind.toLowerCase() : "";
  if (
    kind === "diff" ||
    lower.includes("diff") ||
    lower === "apply_patch" ||
    lower === "edit"
  )
    return "diff";
  if (kind === "todo" || lower === "todowrite" || lower.includes("todo"))
    return "todo";
  if (kind === "workflow" || lower.includes("workflow")) return "workflow";
  if (kind === "background" || lower.includes("background"))
    return "background";
  if (kind === "subagent" || lower === "task" || lower.includes("subagent"))
    return "subagent";
  if (kind === "pty" || lower.includes("pty") || lower.includes("terminal"))
    return "pty";
  if (kind === "sandbox" || lower.includes("sandbox")) return "sandbox";
  if (kind === "skill" || lower.includes("skill")) return "skill";
  return "generic";
}

export function parseToolArguments(raw: string): ParsedToolArguments {
  const trimmed = raw.trim();
  if (!trimmed) return { complete: false, keyArguments: [] };
  try {
    const value = JSON.parse(trimmed) as unknown;
    const redacted = redactValue(value);
    return {
      complete: true,
      keyArguments: keyArguments(redacted),
      redactedJson: JSON.stringify(redacted, undefined, 2),
    };
  } catch {
    return { complete: false, keyArguments: [] };
  }
}

export function resultView(
  result: string,
  maxLines = 8,
  maxChars = 1200,
): ToolResultView {
  const lines = result.split("\n");
  const chars = Array.from(result);
  const lineLimited = lines.length > maxLines;
  const charLimited = chars.length > maxChars;
  const previewByLine = lines.slice(0, maxLines).join("\n");
  const previewChars = Array.from(previewByLine).slice(0, maxChars).join("");
  const truncated =
    lineLimited || charLimited || previewChars.length < previewByLine.length;
  const preview = truncated ? `${previewChars}\n...` : result;
  return {
    summary: `${lines.length} lines, ${chars.length} chars`,
    preview,
    detail: result,
    truncated,
    totalChars: chars.length,
    totalLines: lines.length,
  };
}

export function elapsedLabel(
  startedAt?: number,
  endedAt?: number,
  now = Date.now(),
) {
  if (!startedAt) return "";
  const elapsed = Math.max(0, (endedAt ?? now) - startedAt);
  if (elapsed < 1000) return `${elapsed}ms`;
  return `${(elapsed / 1000).toFixed(elapsed < 10_000 ? 1 : 0)}s`;
}

export function providerSafeThinkingSummary(
  reasoningVisible: boolean,
  text: string,
) {
  if (reasoningVisible) return text;
  if (!text.trim())
    return "Thinking received; details hidden by provider policy.";
  return "Thinking details hidden by provider policy.";
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redactValue(item),
    ]),
  );
}

function keyArguments(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter(
      ([_, item]) =>
        item !== undefined && item !== null && typeof item !== "object",
    )
    .slice(0, 4)
    .map(([key, item]) => `${key}=${String(item).slice(0, 80)}`);
}
