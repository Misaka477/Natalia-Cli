import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";
import {
  API_STABLE_SURFACE,
  API_VERSION,
  DEPRECATED_RUNTIME_MEMBERS,
  REQUIRED_RUNTIME_MEMBERS,
  RUNTIME_CAPABILITY_GROUPS,
  RUNTIME_RPC_ERROR_CODES,
  UNIMPLEMENTED_QUERIES,
  capabilityGroupOf,
} from "@natalia/contracts";
import type { RuntimeClient } from "@natalia/contracts";
import {
  RPC_INTENTIONALLY_LOCAL,
  RPC_ROUTE_MEMBERS,
  RPC_WRITE_METHODS,
} from "../src/rpc";

/**
 * P0-Docs: `docs/api-reference.md` must not rot.
 *
 * Every number and table in the generated block of that document is derived
 * here from the same constants the transport and the contracts use — the route
 * table, the write surface, the intentionally-local whitelist, the capability
 * groups, the stable surface, the failure codes, the unimplemented queries and
 * the event/projection counts (the last two by a source scan of the union and
 * the projector, the same pattern the route-table guard uses).
 *
 * Two modes:
 *
 *   - `bun test packages/transport/test/api-reference.test.ts` — assert mode:
 *     the committed document must contain the generated block byte for byte.
 *     Any table change, or any hand edit inside the block, turns the gate red.
 *   - `npm run docs:api-reference` — write mode (`API_REFERENCE_WRITE=1 bun run
 *     packages/transport/test/api-reference.test.ts`): replaces the block
 *     between the markers in place and reports the path.
 */

const API_REFERENCE_PATH = join(process.cwd(), "docs", "api-reference.md");
const API_REFERENCE_ZH_PATH = join(
  process.cwd(),
  "docs",
  "api-reference.zh-CN.md",
);
const GEN_BEGIN = "<!-- api-reference:generated -->";
const GEN_END = "<!-- /api-reference:generated -->";
const MARKER =
  "All numbers and tables below are derived from the source tables the " +
  "transport and the contracts use. Regenerate with `npm run " +
  "docs:api-reference`. A hand edit inside this block, or any disagreement " +
  "with the code, turns `packages/transport/test/api-reference.test.ts` red.";

function eventTypeCount(): number {
  const text = readFileSync(
    join(process.cwd(), "packages", "contracts", "src", "events.ts"),
    "utf8",
  );
  const from = text.indexOf("type RuntimeEventData =");
  const to = text.indexOf("export type RuntimeEvent =");
  if (from === -1 || to === -1 || to < from)
    throw new Error(
      "events.ts: RuntimeEventData union not found for doc count",
    );
  return text
    .slice(from, to)
    .split("\n")
    .filter((line) => /^\s*\| \{/u.test(line)).length;
}

function projectedEventTypeCount(): number {
  const dir = join(process.cwd(), "packages", "view-store", "src");
  const cases = new Set<string>();
  for (const name of readdirSync(dir))
    if (name.endsWith(".ts"))
      for (const match of readFileSync(join(dir, name), "utf8").matchAll(
        /\bcase "([a-z_.]+)":/gu,
      ))
        cases.add(match[1] ?? "");
  return cases.size;
}

/**
 * The one-line meaning per failure kind, taken from the JSDoc on each member of
 * `RUNTIME_RPC_ERROR_CODES` in `packages/contracts/src/failures.ts`. The
 * comments are the source of truth for the reference; editing the constant's
 * prose without regenerating turns the guard red.
 */
function failureCodeMeanings(): Map<string, string> {
  const text = readFileSync(
    join(process.cwd(), "packages", "contracts", "src", "failures.ts"),
    "utf8",
  );
  const start = text.indexOf("export const RUNTIME_RPC_ERROR_CODES =");
  if (start === -1)
    throw new Error("failures.ts: RUNTIME_RPC_ERROR_CODES not found");
  const block = text.slice(start);
  const meanings = new Map<string, string>();
  for (const match of block.matchAll(
    /\/\*\*([\s\S]*?)\*\/\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/gu,
  )) {
    const comment = (match[1] ?? "")
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/u, "").trim())
      .filter(Boolean)
      .join(" ");
    meanings.set(match[2] ?? "", comment);
  }
  return meanings;
}

/**
 * SDK method → RPC method → params, scanned from the SDK's own `call(...)` sites
 * (`packages/sdk/src/index.ts`). The SDK object literal is the fact source: it
 * names the method, the RPC route it calls, the params object literal, and the
 * `call<T>` return type. A signature change in the SDK shows up here, so the
 * reference cannot describe a call the SDK does not make.
 */
/**
 * SDK method → RPC method → params, scanned from the SDK's own `call(...)` sites
 * and the `NataliaSDK` type (`packages/sdk/src/index.ts`). The SDK is the fact
 * source: it names the method, the RPC route it calls, and the signature. A
 * signature change in the SDK shows up here, so the reference cannot describe a
 * call the SDK does not make.
 */
function sdkMethodReference(): Array<{
  sdkMethod: string;
  rpcMethod: string;
  params: string;
  returnType: string;
}> {
  const text = readFileSync(
    join(process.cwd(), "packages", "sdk", "src", "index.ts"),
    "utf8",
  );
  const objectStart = text.indexOf("return {");
  if (objectStart === -1)
    throw new Error("sdk/src/index.ts: SDK object not found");
  let depth = 0;
  let objectEnd = -1;
  for (let i = objectStart; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        objectEnd = i;
        break;
      }
    }
  }
  if (objectEnd === -1)
    throw new Error("sdk/src/index.ts: SDK object never closes");
  const object = text.slice(objectStart, objectEnd);
  const starts: Array<{ name: string; index: number }> = [];
  for (const entry of object.matchAll(/([a-zA-Z][a-zA-Z0-9]*): async/gu))
    starts.push({ name: entry[1] ?? "", index: entry.index ?? 0 });
  const rpcByMethod = new Map<
    string,
    { rpcMethod: string; callParams: string }
  >();
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i]?.index ?? 0;
    const to =
      i + 1 < starts.length
        ? (starts[i + 1]?.index ?? object.length)
        : object.length;
    const body = object.slice(from, to);
    const callAt = body.indexOf("await call");
    if (callAt === -1) continue;
    const args = splitCallArgs(body, callAt);
    if (!args) continue;
    const rpcMethod = args[0]?.replace(/^"(.*)"$/u, "$1") ?? "";
    if (!rpcMethod) continue;
    const callParams = paramKeysOf(args[1] ?? "");
    rpcByMethod.set(starts[i]?.name ?? "", { rpcMethod, callParams });
  }

  /** Signature truth from the `NataliaSDK` type: params and return type. */
  const typeStart = text.indexOf("export type NataliaSDK = {");
  if (typeStart === -1)
    throw new Error("sdk/src/index.ts: NataliaSDK type not found");
  depth = 0;
  let typeEnd = -1;
  for (let i = typeStart; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        typeEnd = i;
        break;
      }
    }
  }
  if (typeEnd === -1)
    throw new Error("sdk/src/index.ts: NataliaSDK type never closes");
  const typeBlock = text.slice(typeStart, typeEnd);
  const rows: Array<{
    sdkMethod: string;
    rpcMethod: string;
    params: string;
    returnType: string;
  }> = [];
  for (const entry of typeBlock.matchAll(
    /([a-zA-Z][a-zA-Z0-9]*)\(([^)]*)\):\s*Promise</gu,
  )) {
    const [, sdkMethod, rawParams] = entry;
    if (!sdkMethod) continue;
    const returnMatch = balancedUntilAngle(
      text,
      typeStart +
        (entry.index ?? 0) +
        (entry[0] ?? "").indexOf("Promise<") +
        "Promise<".length,
    );
    const call = rpcByMethod.get(sdkMethod);
    const typeParams = paramSignatureOf(rawParams ?? "");
    rows.push({
      sdkMethod,
      rpcMethod: call?.rpcMethod ?? "—",
      params: typeParams || call?.callParams || "—",
      returnType: cleanType(returnMatch),
    });
  }
  return rows;
}

/** Reads a type expression until its angle and brace brackets balance. */
function balancedUntilAngle(text: string, start: number): string {
  let angleDepth = 0;
  let braceDepth = 0;
  let out = "";
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "<") angleDepth++;
    else if (ch === ">") {
      if (angleDepth === 0 && braceDepth === 0) break;
      angleDepth--;
    } else if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    else if (ch === ";" && angleDepth === 0 && braceDepth === 0) break;
    out += ch;
  }
  return cleanType(out);
}

/** Strips the contracts import prefix and collapses newlines in a type. */
function cleanType(type: string): string {
  return type
    .replace(/import\("@natalia\/contracts"\)\./gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Extracts parameter keys with their types from a TypeScript parameter list. */
function paramKeysOf(params: string): string {
  const keys: string[] = [];
  const seen = new Set<string>();
  const stop = new Set([
    "string",
    "number",
    "boolean",
    "void",
    "undefined",
    "null",
    "unknown",
    "any",
    "true",
    "false",
    "Array",
    "Record",
    "Promise",
    "Extract",
    "Exclude",
    "NonNullable",
    "Awaited",
    "ReturnType",
    "readonly",
    "Date",
    "Error",
    "Object",
    "import",
  ]);
  const add = (name: string) => {
    if (name && !seen.has(name) && !stop.has(name)) {
      seen.add(name);
      keys.push(name);
    }
  };
  for (const match of params.matchAll(/([a-zA-Z][a-zA-Z0-9]*)\s*\??:/gu))
    add(match[1] ?? "");
  for (const match of params.matchAll(
    /(?:^|[{,\s])([a-z][a-zA-Z0-9]*)\s*\??\s*(?=:|\?|,|\}|\))/gu,
  ))
    add(match[1] ?? "");
  return keys.join(", ");
}

/** Parameter names with their types, `name?: Type`, nested objects flattened. */
function paramSignatureOf(params: string): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const match of params.matchAll(
    /([a-zA-Z][a-zA-Z0-9]*)(\??):\s*([^,}]+)/gu,
  )) {
    const [, name, optional, rawType] = match;
    if (!name || name === "type" || seen.has(name)) continue;
    seen.add(name);
    let type = (rawType ?? "").replace(/\s+/gu, " ").trim();
    if (type.startsWith("{")) {
      const inner = [...type.matchAll(/([a-zA-Z][a-zA-Z0-9]*)(\??):/gu)]
        .map((entry) => `${entry[1]}${entry[2] === "?" ? "?" : ""}`)
        .join(", ");
      type = `{ ${inner || "…"} }`;
    } else {
      type = type.replace(/^import\("[^"]+"\)\./gu, "").trim();
      if (type.length > 60) type = `${type.slice(0, 60)}…`;
    }
    parts.push(`\`${name}${optional === "?" ? "?" : ""}\`: ${type}`);
  }
  return parts.join(", ") || "—";
}

/** Splits a `call(...)` invocation into its top-level comma-separated arguments. */
function splitCallArgs(text: string, callIndex: number): string[] | undefined {
  let i = callIndex + "await call".length;
  while (i < text.length && text[i] !== "(") i++;
  if (i >= text.length) return undefined;
  // The call's own opening paren counts as depth 1, so its closing paren
  // returns to 0 and ends the argument list.
  let depth = 1;
  const args: string[] = [];
  let current = "";
  for (i = i + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "{" || ch === "[") {
      depth++;
      current += ch;
    } else if (ch === ")" || ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        args.push(current.trim());
        return args;
      }
      current += ch;
    } else if (ch === "," && depth === 1) {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  return undefined;
}

/**
 * The event dictionary, scanned from the `RuntimeEventData` union in
 * `packages/contracts/src/events.ts`: every member's `type` literal and its
 * field names (with optionality). Field *types* are shown when they sit on the
 * field's own line; multi-line nested types are elided. The union is the fact
 * source, so adding an event or renaming a field updates the reference.
 */
function eventDictionary(): Array<{ type: string; fields: string }> {
  const text = readFileSync(
    join(process.cwd(), "packages", "contracts", "src", "events.ts"),
    "utf8",
  );
  const from = text.indexOf("type RuntimeEventData =");
  const to = text.indexOf("export type RuntimeEvent =");
  if (from === -1 || to === -1 || to < from)
    throw new Error(
      "events.ts: RuntimeEventData union not found for dictionary",
    );
  const union = text.slice(from, to);
  const rows: Array<{ type: string; fields: string }> = [];
  const lines = union.split("\n");
  let i = 0;
  while (i < lines.length) {
    const start = lines[i];
    if (!start || !/^\s*\| \{/u.test(start)) {
      i++;
      continue;
    }
    const memberLines: string[] = [];
    let braces = 0;
    while (i < lines.length) {
      const line = lines[i] ?? "";
      memberLines.push(line);
      for (const ch of line) {
        if (ch === "{") braces++;
        else if (ch === "}") braces--;
      }
      i++;
      if (braces <= 0) break;
    }
    const member = memberLines.join("\n");
    const type = member.match(/type: "([a-z_.]+)"/u)?.[1] ?? "";
    if (!type) continue;
    const fields: string[] = [];
    const body = member
      .replace(/^\s*\|\s*\{/u, "")
      .replace(/\}\s*$/u, "")
      .trim();
    for (const part of body.split(";")) {
      const field = part
        .trim()
        .match(/^([a-zA-Z][a-zA-Z0-9]*)(\??):\s*(.+?)\s*$/u);
      if (!field) continue;
      const [, name, optional, typeText] = field;
      if (!name || name === "type") continue;
      if (/[{}\n]/u.test(typeText ?? "")) continue;
      fields.push(
        `\`${name}${optional === "?" ? "?" : ""}\`: ${(typeText ?? "").trim()}`,
      );
    }
    rows.push({ type, fields: fields.join(", ") || "—" });
  }
  return rows;
}

/** Extracts `name?: Type` fields from a `{ ... }` type body. */
function extractTypeFields(body: string): string {
  const fields: string[] = [];
  for (const part of body.split(";")) {
    const field = part
      .trim()
      .match(/^([a-zA-Z][a-zA-Z0-9]*)(\??):\s*(.+?)\s*$/u);
    if (!field) continue;
    const [, name, optional, typeText] = field;
    if (!name) continue;
    if (/[{}\n]/u.test(typeText ?? "")) continue;
    fields.push(
      `\`${name}${optional === "?" ? "?" : ""}\`: ${(typeText ?? "")
        .replace(/import\("[^"]+"\)\./gu, "")
        .trim()}`,
    );
  }
  return fields.join(", ") || "—";
}

/**
 * The result type dictionary, scanned from the SDK's return types and the
 * `export type NAME = { ... }` definitions in `packages/contracts/src`. The
 * contracts are the fact source: a result shape changed in the contracts
 * shows up here, and a hand edit in the block turns the guard red. Inline
 * object returns and `RuntimeClient["x"]` indirections are left to the SDK
 * table; only plain named types are expanded, one level deep — a field type
 * that is itself a named type (`RuntimeProjectedMessage[]`, `FlowRow[]`) is
 * collected too, so the dictionary covers what the top-level returns hold.
 */
function resultTypeDictionary(): Array<{ name: string; fields: string }> {
  const names = new Set<string>();
  const collectFromReturn = (returnType: string) => {
    const match = returnType.trim().match(/^([A-Z][A-Za-z0-9_]*)(\[\])?$/u);
    if (match) names.add(match[1] ?? "");
  };
  for (const row of sdkMethodReference()) collectFromReturn(row.returnType);
  const dir = join(process.cwd(), "packages", "contracts", "src");
  const definitions = new Map<string, string>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts")) continue;
    const text = readFileSync(join(dir, file), "utf8");
    for (const match of text.matchAll(/export type ([A-Z][A-Za-z0-9_]*) = \{/gu)) {
      const name = match[1] ?? "";
      if (definitions.has(name)) continue;
      const start = match.index ?? 0;
      let braces = 0;
      let end = -1;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === "{") braces++;
        else if (ch === "}") {
          braces--;
          if (braces === 0) {
            end = i;
            break;
          }
        }
      }
      if (end !== -1)
        definitions.set(name, text.slice(start + match[0].length, end));
    }
  }
  const rows: Array<{ name: string; fields: string }> = [];
  const collected = new Set<string>();
  for (let pass = 0; pass < 2; pass++) {
    const pending = [...names].filter((name) => !collected.has(name)).sort();
    if (pending.length === 0) break;
    const references = new Set<string>();
    for (const name of pending) {
      collected.add(name);
      const body = definitions.get(name);
      if (!body) continue;
      rows.push({ name, fields: extractTypeFields(body) });
      for (const match of body.matchAll(/\b([A-Z][A-Za-z0-9_]*)\[\]/gu))
        references.add(match[1] ?? "");
      for (const match of body.matchAll(/:\s*([A-Z][A-Za-z0-9_]*);/gu))
        references.add(match[1] ?? "");
    }
    for (const reference of references)
      if (definitions.has(reference) && !names.has(reference))
        names.add(reference);
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function markdownTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => (row[i] ?? "").length)),
  );
  const rule = widths.map((width) => "-".repeat(width));
  const line = (cells: string[]) =>
    `| ${cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join(" | ")} |`;
  return [line(headers), line(rule), ...rows.map((row) => line(row))].join(
    "\n",
  );
}

export function renderGeneratedSections(): string {
  const groups = RUNTIME_CAPABILITY_GROUPS;
  const groupNames = Object.keys(groups) as Array<keyof typeof groups>;
  const optionalMembers = groupNames.flatMap((name) =>
    (groups[name] as readonly string[]).map(
      (member) => [name, member] as const,
    ),
  );
  const routes = Object.entries(RPC_ROUTE_MEMBERS) as Array<
    [string, keyof RuntimeClient | null]
  >;

  const deprecated = Object.entries(DEPRECATED_RUNTIME_MEMBERS);
  const lines = [
    `## Machine-derived reference`,
    ``,
    `> ${MARKER}`,
    ``,
    `### Protocol version`,
    ``,
    `- \`apiVersion\` = \`${API_VERSION}\` (\`API_VERSION\`).`,
    `- Stable required surface (\`API_STABLE_SURFACE.requiredMembers\`, ${REQUIRED_RUNTIME_MEMBERS.length} members):`,
    `  \`${REQUIRED_RUNTIME_MEMBERS.join("`, `")}\`.`,
    `- Deprecated members (\`DEPRECATED_RUNTIME_MEMBERS\`): ${
      deprecated.length === 0
        ? "none (mechanism in place, table empty)"
        : deprecated
            .map(
              ([name, meta]) =>
                `\`${name}\`${meta.replacement ? ` → \`${meta.replacement}\`` : ""}${meta.since !== undefined ? ` (since ${meta.since})` : ""}`,
            )
            .join("; ")
    }.`,
    ``,
    `### Capability groups (${groupNames.length} groups · ${optionalMembers.length} optional members)`,
    ``,
    markdownTable(
      ["Group", "Members (RuntimeClient names)"],
      groupNames.map((name) => [
        name,
        (groups[name] as readonly string[]).map((m) => `\`${m}\``).join(" · "),
      ]),
    ),
    ``,
    `### RPC route table (${routes.length} methods → members)`,
    ``,
    markdownTable(
      ["RPC method", "RuntimeClient member", "Capability group", "Write"],
      routes.map(([method, member]) => [
        `\`${method}\``,
        member === null ? "(availability route, no member)" : `\`${member}\``,
        member === null ? "—" : (capabilityGroupOf(member) ?? "required"),
        RPC_WRITE_METHODS.has(method) ? "write" : "read",
      ]),
    ),
    ``,
    `### Write surface (\`RPC_WRITE_METHODS\`, ${RPC_WRITE_METHODS.size} methods; read-only credentials get \`-32001 refused\`)`,
    ``,
    RPC_WRITE_METHODS.size === 0
      ? "(empty)"
      : [...RPC_WRITE_METHODS].map((method) => `- \`${method}\``).join("\n"),
    ``,
    `### Intentionally local members (\`RPC_INTENTIONALLY_LOCAL\`; reported as \`intentionally local\`)`,
    ``,
    markdownTable(
      ["Member", "Reason"],
      Object.entries(RPC_INTENTIONALLY_LOCAL).map(([member, reason]) => [
        `\`${member}\``,
        reason,
      ]),
    ),
    ``,
    `### Empty-until-writers queries (\`UNIMPLEMENTED_QUERIES\`: reachable, implemented, no production writer yet)`,
    ``,
    markdownTable(
      ["Member", "Why it answers empty"],
      Object.entries(UNIMPLEMENTED_QUERIES).map(([member, reason]) => [
        `\`${member}\``,
        reason,
      ]),
    ),
    ``,
    `### Failure codes (\`RUNTIME_RPC_ERROR_CODES\`)`,
    ``,
    markdownTable(
      ["Kind", "Code", "Meaning"],
      (
        Object.keys(RUNTIME_RPC_ERROR_CODES) as Array<
          keyof typeof RUNTIME_RPC_ERROR_CODES
        >
      ).map((kind) => [
        `\`${kind}\``,
        String(RUNTIME_RPC_ERROR_CODES[kind]),
        failureCodeMeanings().get(kind) ?? "",
      ]),
    ),
    ``,
    `### Events and projection (source scan)`,
    ``,
    `- Runtime event types (\`RuntimeEventData\` union): ${eventTypeCount()}.`,
    `- view-store projections (\`case\` labels in \`packages/view-store/src\`): ${projectedEventTypeCount()}.`,
    ``,
    `### SDK methods → RPC routes (source scan of \`packages/sdk/src/index.ts\`)`,
    ``,
    markdownTable(
      ["SDK method", "RPC method", "Params", "Return type"],
      sdkMethodReference().map((row) => [
        `\`${row.sdkMethod}\``,
        `\`${row.rpcMethod}\``,
        row.params || "—",
        row.returnType,
      ]),
    ),
    ``,
    `### Runtime event dictionary (source scan of \`packages/contracts/src/events.ts\`)`,
    ``,
    markdownTable(
      ["Event type", "Fields"],
      eventDictionary().map((row) => [`\`${row.type}\``, row.fields]),
    ),
    ``,
    `### Result type dictionary (source scan of \`packages/contracts/src\`)`,
    ``,
    markdownTable(
      ["Type", "Fields"],
      resultTypeDictionary().map((row) => [`\`${row.name}\``, row.fields]),
    ),
  ];
  return lines.join("\n") + "\n";
}

export function writeApiReference(): void {
  const block = `${GEN_BEGIN}\n${renderGeneratedSections()}${GEN_END}`;
  for (const path of [API_REFERENCE_PATH, API_REFERENCE_ZH_PATH]) {
    const full = readFileSync(path, "utf8");
    const start = full.indexOf(GEN_BEGIN);
    const end = full.indexOf(GEN_END);
    if (start === -1 || end === -1 || end < start)
      throw new Error(
        `${path} is missing the generated-block markers (${GEN_BEGIN} … ${GEN_END})`,
      );
    writeFileSync(
      path,
      `${full.slice(0, start)}${block}${full.slice(end + GEN_END.length)}`,
    );
  }
}

if (!process.env.API_REFERENCE_WRITE) {
  test("docs/api-reference.md generated block matches the source tables", () => {
    const full = readFileSync(API_REFERENCE_PATH, "utf8");
    const block = `${GEN_BEGIN}\n${renderGeneratedSections()}${GEN_END}`;
    expect(full).toContain(block);
  });
  test("docs/api-reference.zh-CN.md embeds the same generated block", () => {
    const en = readFileSync(API_REFERENCE_PATH, "utf8");
    const zh = readFileSync(API_REFERENCE_ZH_PATH, "utf8");
    const start = en.indexOf(GEN_BEGIN);
    const end = en.indexOf(GEN_END);
    if (start === -1 || end === -1 || end < start)
      throw new Error(
        `${API_REFERENCE_PATH} is missing the generated-block markers`,
      );
    const block = en.slice(start, end + GEN_END.length);
    expect(zh).toContain(block);
  });
}

if (process.env.API_REFERENCE_WRITE && import.meta.main) {
  writeApiReference();
  console.log(`updated ${API_REFERENCE_PATH}`);
}
