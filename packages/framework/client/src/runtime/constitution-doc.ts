/**
 * Constitution / AGENTS document parser — runtime/constitution-doc.ts.
 *
 * The 文档 authoring face (EI §3.8 P-1.c / §8.3): the workspace `AGENTS.md`
 * and `.natalia/constitution.md` are the highest user-tier input, and they are
 * also the seed of the executable constitution. A section is either:
 *
 * - **prose (soft)** — no annotation. It is a warn-level runtime-context rule:
 *   the model is told to respect it, but nothing intercepts a tool call for it.
 * - **annotated (hard)** — carries `<!-- enforcement: deny|approval|warn -->`
 *   and optionally `<!-- appliesTo: { tools: [], paths: [], commandPattern } -->`.
 *   It can be promoted to a journal `constitution.rule_added` (a user action,
 *   no gate) and then executed by the runtime matcher.
 *
 * The parser is a pure function of the document text so it can be unit-tested
 * and re-run on every document edit (hash change) without a restart. It never
 * writes: promotion is a separate, user-initiated step.
 */

import type {
  ConstitutionDocAppliesTo,
  ConstitutionDocEnforcement,
  ConstitutionDocRule,
} from "@natalia/runtime-services";

export type {
  ConstitutionDocAppliesTo,
  ConstitutionDocEnforcement,
  ConstitutionDocRule,
};

const HEADING = /^(#{1,6})\s+(.*\S)\s*$/u;
const ENFORCEMENT_ANNOTATION =
  /<!--\s*enforcement\s*:\s*(deny|approval|warn)\s*-->/iu;
const APPLIESTO_ANNOTATION = /<!--\s*appliesTo\s*:\s*(\{[\s\S]*?\})\s*-->/iu;
const ANY_HTML_COMMENT = /<!--[\s\S]*?-->/gu;

/** A stable, filesystem-ish slug for a section heading. */
function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48);
  return slug || "section";
}

/** Parses a bracket list body (`"a", "b"`) into trimmed, unquoted entries. */
function parseListBody(body: string): string[] {
  return body
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/gu, "").trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Lenient parse of an `appliesTo` annotation body. The plan's form
 * (`{ tools: [], paths: [], commandPattern: "" }`) is not valid JSON (unquoted
 * keys), so try JSON first and fall back to field extraction. Only non-empty
 * anchors are kept so an empty `{}` reads as "no structured anchor".
 */
function parseAppliesTo(raw: string): ConstitutionDocAppliesTo | undefined {
  const body = raw.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = undefined;
  }
  const anchor: ConstitutionDocAppliesTo = {};
  const readList = (value: unknown): string[] | undefined =>
    Array.isArray(value)
      ? value
          .map((entry) => String(entry).trim())
          .filter((entry) => entry.length > 0)
      : undefined;
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    const tools = readList(record.tools);
    const paths = readList(record.paths);
    const commandPattern =
      typeof record.commandPattern === "string" &&
      record.commandPattern.trim()
        ? record.commandPattern.trim()
        : undefined;
    if (tools?.length) anchor.tools = tools;
    if (paths?.length) anchor.paths = paths;
    if (commandPattern) anchor.commandPattern = commandPattern;
  } else {
    const tools = body.match(/tools\s*:\s*\[([^\]]*)\]/iu);
    const paths = body.match(/paths\s*:\s*\[([^\]]*)\]/iu);
    const commandPattern = body.match(/commandPattern\s*:\s*["']([^"']*)["']/iu);
    const toolList = tools ? parseListBody(tools[1]!) : [];
    const pathList = paths ? parseListBody(paths[1]!) : [];
    if (toolList.length) anchor.tools = toolList;
    if (pathList.length) anchor.paths = pathList;
    if (commandPattern?.[1]?.trim())
      anchor.commandPattern = commandPattern[1].trim();
  }
  return anchor.tools?.length || anchor.paths?.length || anchor.commandPattern
    ? anchor
    : undefined;
}

/**
 * Parses a constitution / AGENTS markdown document into its rules (EI §3.8
 * P-1.c). Sections are delimited by ATX headings; a section's prose is its
 * statement, its HTML-comment annotations set enforcement / appliesTo. A
 * section with neither prose nor an annotation is skipped.
 */
export function parseConstitutionDocument(
  content: string,
  source: "constitution" | "agents",
): ConstitutionDocRule[] {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const rules: ConstitutionDocRule[] = [];
  let section = "";
  let body: string[] = [];
  let ordinal = 0;

  const flush = () => {
    const raw = body.join("\n");
    const enforcementMatch = raw.match(ENFORCEMENT_ANNOTATION);
    const appliesToMatch = raw.match(APPLIESTO_ANNOTATION);
    // The statement is the prose with every HTML comment stripped.
    const statement = raw
      .replace(ANY_HTML_COMMENT, "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .trim();
    if (!statement && !enforcementMatch) {
      body = [];
      return;
    }
    ordinal += 1;
    const enforcement: ConstitutionDocEnforcement =
      (enforcementMatch?.[1]?.toLowerCase() as ConstitutionDocEnforcement) ??
      "warn";
    const appliesTo = appliesToMatch
      ? parseAppliesTo(appliesToMatch[1]!)
      : undefined;
    const heading = section || `rule ${ordinal}`;
    rules.push({
      id: `${source}:${slugify(heading)}:${ordinal}`,
      source,
      section: heading,
      statement: statement || heading,
      enforcement,
      annotated: Boolean(enforcementMatch),
      ...(appliesTo ? { appliesTo } : {}),
    });
    body = [];
  };

  for (const line of lines) {
    const heading = line.match(HEADING);
    if (heading) {
      flush();
      section = heading[2]!.trim();
      continue;
    }
    body.push(line);
  }
  flush();
  return rules;
}
