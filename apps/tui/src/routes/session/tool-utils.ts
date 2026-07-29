import { themeTokens as darkTheme } from "../../theme/theme";

export function toolInput(argumentsJson?: string) {
  if (!argumentsJson) return { command: "", workdir: "" };
  try {
    const value = JSON.parse(argumentsJson) as Record<string, unknown>;
    return {
      command: typeof value.command === "string" ? value.command : "",
      workdir: typeof value.workdir === "string" ? value.workdir : "",
    };
  } catch {
    return { command: "", workdir: "" };
  }
}

export function toolRecord(argumentsJson?: string) {
  if (!argumentsJson) return {} as Record<string, unknown>;
  try {
    const value = JSON.parse(argumentsJson) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
  return {} as Record<string, unknown>;
}

export function parseResultRecord(result?: string) {
  if (!result) return {} as Record<string, unknown>;
  try {
    const value = JSON.parse(result) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
  return {} as Record<string, unknown>;
}

export function parseQuestionAnswers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((answer) =>
    Array.isArray(answer) && answer.every((item) => typeof item === "string")
      ? [answer as string[]]
      : [],
  );
}

export function parseExecuteCalls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.tool !== "string" || typeof record.status !== "string")
      return [];
    if (!["running", "completed", "error"].includes(record.status)) return [];
    return [
      {
        tool: record.tool,
        status: record.status,
        input:
          record.input &&
          typeof record.input === "object" &&
          !Array.isArray(record.input)
            ? (record.input as Record<string, unknown>)
            : {},
      },
    ];
  });
}

export function formatPrimitiveArgs(input: Record<string, unknown>) {
  const values = Object.entries(input).flatMap(([key, value]) =>
    ["string", "number", "boolean"].includes(typeof value)
      ? [`${key}=${String(value)}`]
      : [],
  );
  return values.length ? ` [${values.join(", ")}]` : "";
}

export function stringField(
  input: Record<string, unknown>,
  ...keys: string[]
) {
  return (
    keys.flatMap((key) =>
      typeof input[key] === "string" ? [input[key] as string] : [],
    )[0] ?? ""
  );
}

export function formatToolPath(path: string) {
  if (!path) return "";
  const home = process.env.HOME;
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

export function toolPath(argumentsJson?: string) {
  if (!argumentsJson) return "";
  try {
    const input = JSON.parse(argumentsJson) as Record<string, unknown>;
    for (const key of ["filePath", "path", "target"]) {
      if (typeof input[key] === "string") return input[key];
    }
  } catch {
    return "";
  }
  return "";
}

export function filetype(filePath: string) {
  const extension = filePath.split(".").pop()?.toLowerCase();
  return (
    {
      ts: "typescript",
      tsx: "typescriptreact",
      js: "javascript",
      jsx: "javascriptreact",
      php: "php",
      py: "python",
      go: "go",
      rs: "rust",
      json: "json",
      css: "css",
      html: "html",
      md: "markdown",
    }[extension ?? ""] ?? "text"
  );
}

export function toolColor(status: string) {
  if (status === "succeeded") return darkTheme.success;
  if (status === "failed" || status === "rejected" || status === "cancelled")
    return darkTheme.danger;
  if (status === "awaiting_approval" || status === "running")
    return darkTheme.warning;
  if (status === "queued" || status === "receiving_arguments")
    return darkTheme.muted;
  return darkTheme.accent;
}

export function subagentColor(status: string) {
  if (status === "completed") return darkTheme.success;
  if (status === "failed") return darkTheme.danger;
  if (status === "running") return darkTheme.warning;
  return darkTheme.muted;
}

export function toolIcon(kind: string) {
  if (kind === "diff") return "diff";
  if (kind === "todo") return "todo";
  if (kind === "workflow") return "flow";
  if (kind === "background") return "bg";
  if (kind === "subagent") return "agent";
  if (kind === "shell") return "$";
  if (kind === "terminal") return "terminal";
  if (kind === "sandbox") return "box";
  if (kind === "skill") return "skill";
  return "tool";
}
