import { YamlParseError } from "./types";
import type { YamlError, WorkflowDocument, WorkflowStep } from "./types";

export function parseWorkflowJSON(input: string): WorkflowDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    throw new Error(`invalid JSON: ${(err as Error).message}`);
  }
  return validateWorkflowDocument(parsed);
}

export function parseWorkflowYAML(input: string): WorkflowDocument {
  const parsed = parseYAML(input);
  return validateWorkflowDocument(parsed);
}

function assertValue(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`expected object at ${path}`);
}

export function validateWorkflowDocument(input: unknown): WorkflowDocument {
  assertValue(input, "root");
  if (input["version"] !== 1)
    throw new Error(
      `expected version 1, got ${JSON.stringify(input["version"])}`,
    );
  if (typeof input["name"] !== "string" || !input["name"])
    throw new Error("workflow name must be a non-empty string");
  if (!Array.isArray(input["steps"])) throw new Error("steps must be an array");
  const steps = input["steps"].map((s: unknown, i: number) =>
    validateStep(s, `steps[${i}]`),
  );
  const doc: WorkflowDocument = {
    version: 1,
    name: input["name"] as string,
    description:
      typeof input["description"] === "string"
        ? input["description"]
        : undefined,
    steps,
  };
  checkUniqueIDs(doc.steps);
  return doc;
}

function validateStep(input: unknown, path: string): WorkflowStep {
  assertValue(input, path);
  const kind = input["kind"];
  if (typeof kind !== "string")
    throw new Error(`expected string kind at ${path}`);
  const id = input["id"];
  if (typeof id !== "string" || !id)
    throw new Error(`expected non-empty id at ${path}`);

  switch (kind) {
    case "set": {
      if (typeof input["key"] !== "string")
        throw new Error(`expected string key at ${path}`);
      if (typeof input["value"] !== "string")
        throw new Error(`expected string value at ${path}`);
      return {
        id,
        kind: "set",
        key: input["key"] as string,
        value: input["value"] as string,
      };
    }
    case "tool": {
      if (typeof input["tool"] !== "string" || !input["tool"])
        throw new Error(`expected non-empty tool name at ${path}`);
      if (
        !input["arguments"] ||
        typeof input["arguments"] !== "object" ||
        Array.isArray(input["arguments"])
      )
        throw new Error(`expected object arguments at ${path}`);
      return {
        id,
        kind: "tool",
        tool: input["tool"] as string,
        arguments: input["arguments"] as Record<string, unknown>,
      };
    }
    case "wait": {
      if (typeof input["ms"] !== "number" || !Number.isFinite(input["ms"]))
        throw new Error(`expected finite number ms at ${path}`);
      return { id, kind: "wait", ms: input["ms"] as number };
    }
    case "script": {
      if (typeof input["command"] !== "string" || !input["command"])
        throw new Error(`expected non-empty command at ${path}`);
      if (
        input["timeoutMs"] !== undefined &&
        (typeof input["timeoutMs"] !== "number" ||
          !Number.isFinite(input["timeoutMs"]))
      )
        throw new Error(`expected finite number timeoutMs at ${path}`);
      return {
        id,
        kind: "script",
        command: input["command"] as string,
        timeoutMs: input["timeoutMs"] as number | undefined,
      };
    }
    case "branch": {
      if (!Array.isArray(input["branches"]))
        throw new Error(`expected array branches at ${path}`);
      const branches = input["branches"].map((b: unknown, i: number) => {
        assertValue(b, `${path}.branches[${i}]`);
        if (b["condition"] !== undefined && typeof b["condition"] !== "string")
          throw new Error(
            `expected string or absent condition at ${path}.branches[${i}]`,
          );
        if (!Array.isArray(b["steps"]))
          throw new Error(`expected array steps at ${path}.branches[${i}]`);
        return {
          condition: b["condition"] as string | undefined,
          steps: b["steps"].map((s: unknown, j: number) =>
            validateStep(s, `${path}.branches[${i}].steps[${j}]`),
          ),
        };
      });
      // First branch without condition acts as default
      return { id, kind: "branch", branches };
    }
    case "retry": {
      if (
        typeof input["maxAttempts"] !== "number" ||
        input["maxAttempts"] < 1 ||
        !Number.isInteger(input["maxAttempts"])
      )
        throw new Error(`expected positive integer maxAttempts at ${path}`);
      if (!input["step"]) throw new Error(`expected step at ${path}`);
      return {
        id,
        kind: "retry",
        maxAttempts: input["maxAttempts"] as number,
        step: validateStep(input["step"], `${path}.step`),
      };
    }
    case "timeout": {
      if (typeof input["ms"] !== "number" || !Number.isFinite(input["ms"]))
        throw new Error(`expected finite number ms at ${path}`);
      if (!input["step"]) throw new Error(`expected step at ${path}`);
      return {
        id,
        kind: "timeout",
        ms: input["ms"] as number,
        step: validateStep(input["step"], `${path}.step`),
      };
    }
    case "parallel": {
      if (!Array.isArray(input["branches"]))
        throw new Error(`expected array branches at ${path}`);
      const branches = input["branches"].map((b: unknown, i: number) => {
        assertValue(b, `${path}.branches[${i}]`);
        if (typeof b["id"] !== "string" || !b["id"])
          throw new Error(
            `expected non-empty branch id at ${path}.branches[${i}]`,
          );
        if (!Array.isArray(b["steps"]))
          throw new Error(`expected array steps at ${path}.branches[${i}]`);
        return {
          id: b["id"] as string,
          steps: b["steps"].map((s: unknown, j: number) =>
            validateStep(s, `${path}.branches[${i}].steps[${j}]`),
          ),
        };
      });
      return { id, kind: "parallel", branches };
    }
    case "each": {
      if (typeof input["over"] !== "string" || !input["over"])
        throw new Error(`expected non-empty over at ${path}`);
      if (typeof input["as"] !== "string" || !input["as"])
        throw new Error(`expected non-empty as at ${path}`);
      if (!Array.isArray(input["steps"]))
        throw new Error(`expected array steps at ${path}`);
      return {
        id,
        kind: "each",
        over: input["over"] as string,
        as: input["as"] as string,
        steps: (input["steps"] as unknown[]).map((s: unknown, j: number) =>
          validateStep(s, `${path}.steps[${j}]`),
        ),
      };
    }
    default:
      throw new Error(`unknown step kind "${kind}" at ${path}`);
  }
}

// ── Minimal YAML Parser ──────────────────────────────────────────────────────

type YToken = {
  indent: number;
  raw: string;
  line: number;
  col: number;
};

function parseYAML(input: string): unknown {
  const lines = input.split("\n");
  const tokens: (YToken & { text: string })[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trimEnd();
    const stripped = trimmed.trimStart();
    const indent = trimmed.length - stripped.length;

    if (stripped === "" || stripped.startsWith("#")) continue;

    const clean = stripComment(stripped);
    if (clean === "") continue;

    tokens.push({
      indent,
      raw: stripped,
      text: clean,
      line: i + 1,
      col: indent + 1,
    });
  }

  if (tokens.length === 0) return null;

  let pos = 0;
  const [result] = parseNode(tokens, pos, -1);
  return result;
}

function stripComment(s: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (c === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (c === "#" && !inSingle && !inDouble) {
      const before = s.slice(0, i).trimEnd();
      return before;
    }
  }
  return s;
}

function peek(
  tokens: (YToken & { text: string })[],
  pos: number,
  baseIndent: number,
): boolean {
  return pos < tokens.length && tokens[pos]!.indent >= baseIndent;
}

function parseNode(
  tokens: (YToken & { text: string })[],
  pos: number,
  baseIndent: number,
): [unknown, number] {
  if (pos >= tokens.length) return [null, pos];
  const tok = tokens[pos]!;
  if (tok.indent < baseIndent) return [null, pos];

  const t = tok.text;

  if (t.startsWith("- ") || t === "-") {
    return parseSequence(tokens, pos, tok.indent);
  }

  const colonIdx = mappingColonIndex(t);
  if (colonIdx >= 0) {
    return parseMapping(tokens, pos, tok.indent);
  }

  return [parseYAMLScalar(t), pos + 1];
}

function mappingColonIndex(s: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (c === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (c === ":" && !inSingle && !inDouble) return i;
  }
  return -1;
}

function parseMapping(
  tokens: (YToken & { text: string })[],
  pos: number,
  baseIndent: number,
): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};

  while (pos < tokens.length && tokens[pos]!.indent >= baseIndent) {
    const tok = tokens[pos]!;
    if (tok.indent > baseIndent) break;

    const t = tok.text;
    const colonIdx = mappingColonIndex(t);
    if (colonIdx < 0) {
      if (t.startsWith("- ")) break;
      throw err(tok, "expected mapping key: value");
    }

    const key = t.slice(0, colonIdx).trimEnd();
    const rest = t.slice(colonIdx + 1).trimStart();

    if (!key) throw err(tok, "empty mapping key");

    if (rest === "") {
      const [value, next] = parseNode(tokens, pos + 1, baseIndent + 1);
      result[key] = value;
      pos = next;
    } else {
      result[key] = parseYAMLScalar(rest);
      pos++;
    }
  }

  return [result, pos];
}

function parseSequence(
  tokens: (YToken & { text: string })[],
  pos: number,
  baseIndent: number,
): [unknown[], number] {
  const result: unknown[] = [];

  while (pos < tokens.length && tokens[pos]!.indent >= baseIndent) {
    const tok = tokens[pos]!;
    if (tok.indent > baseIndent) break;

    const t = tok.text;
    if (!t.startsWith("- ") && t !== "-") break;

    const content = t === "-" ? "" : t.slice(2).trimStart();

    if (content === "") {
      const [value, next] = parseNode(tokens, pos + 1, baseIndent + 1);
      result.push(value);
      pos = next;
    } else {
      const colonIdx = mappingColonIndex(content);
      if (colonIdx >= 0) {
        const subTok = {
          ...tok,
          text: content,
          col: tok.col + 2,
        };
        const [value, next] = parseInlineMapping(
          tokens,
          pos,
          subTok,
          baseIndent,
        );
        result.push(value);
        pos = next;
      } else {
        result.push(parseYAMLScalar(content));
        pos++;
      }
    }
  }

  return [result, pos];
}

function parseInlineMapping(
  tokens: (YToken & { text: string })[],
  pos: number,
  firstTok: YToken & { text: string },
  baseIndent: number,
): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};

  // First key:value from the "- content" part
  const colonIdx = mappingColonIndex(firstTok.text);
  const key = firstTok.text.slice(0, colonIdx).trimEnd();
  const rest = firstTok.text.slice(colonIdx + 1).trimStart();

  if (rest === "") {
    firstTok = { ...firstTok, text: key };
  }

  if (rest === "") {
    const [value, next] = parseNode(tokens, pos + 1, firstTok.indent + 1);
    result[key] = value;
    pos = next;
  } else {
    result[key] = parseYAMLScalar(rest);
    pos++;
  }

  // Subsequent keys are at indent == firstTok.indent (same as the key)
  // For a sequence item "- key: value" at indent 6, subsequent keys are at indent 8 (=6+2)
  const subIndent =
    firstTok.indent === baseIndent ? baseIndent + 2 : firstTok.indent;
  if (subIndent < 0) return [result, pos];

  while (pos < tokens.length) {
    const tok = tokens[pos]!;
    if (tok.indent < subIndent) break;
    if (tok.indent > subIndent) {
      // Nested content (e.g. a sequence inside a mapping value) - skip it
      // The preceding parseNode call should have consumed all nested content
      break;
    }

    const t = tok.text;
    const ci = mappingColonIndex(t);
    if (ci < 0) {
      // Might be a sequence item if content is nested value of previous key
      if (t.startsWith("- ")) break;
      throw err(tok, "expected key: value in mapping");
    }

    const k = t.slice(0, ci).trimEnd();
    const v = t.slice(ci + 1).trimStart();

    if (v === "") {
      const [value, next] = parseNode(tokens, pos + 1, tok.indent + 1);
      result[k] = value;
      pos = next;
    } else {
      result[k] = parseYAMLScalar(v);
      pos++;
    }
  }

  return [result, pos];
}

function parseYAMLScalar(text: string): unknown {
  if (text === "null" || text === "~") return null;
  if (text === "true") return true;
  if (text === "false") return false;

  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u.test(text)) {
    const num = Number(text);
    if (Number.isFinite(num)) return num;
  }

  // Strip surrounding quotes but preserve content
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    return unescapeDouble(text.slice(1, -1));
  }
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) {
    return text.slice(1, -1).replace(/''/gu, "'");
  }

  return text;
}

function unescapeDouble(s: string): string {
  return s
    .replace(/\\n/gu, "\n")
    .replace(/\\t/gu, "\t")
    .replace(/\\r/gu, "\r")
    .replace(/\\"/gu, '"')
    .replace(/\\\\/gu, "\\");
}

function err(tok: YToken & { text?: string }, message: string): YamlParseError {
  return new YamlParseError([{ message, line: tok.line, column: tok.col }]);
}

// Check duplicate step IDs
export function checkUniqueIDs(steps: WorkflowStep[]): void {
  const seen = new Set<string>();
  const visit = (s: WorkflowStep) => {
    if (seen.has(s.id)) throw new Error(`duplicate step ID "${s.id}"`);
    seen.add(s.id);
    if (s.kind === "branch")
      for (const b of s.branches) for (const ss of b.steps) visit(ss);
    if (s.kind === "retry" || s.kind === "timeout") visit(s.step);
    if (s.kind === "parallel")
      for (const b of s.branches) for (const ss of b.steps) visit(ss);
    if (s.kind === "each") for (const ss of s.steps) visit(ss);
  };
  for (const s of steps) visit(s);
}
