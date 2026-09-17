import { expect, test } from "bun:test";
import { parseConstitutionDocument } from "../src/runtime/constitution-doc";

test("prose sections without annotations are warn-level soft rules", () => {
  const rules = parseConstitutionDocument(
    [
      "# Team conventions",
      "",
      "Prefer small, reviewable pull requests.",
      "",
      "## Testing",
      "",
      "Every source change ships with a test.",
    ].join("\n"),
    "agents",
  );
  expect(rules).toHaveLength(2);
  expect(rules[0]).toMatchObject({
    source: "agents",
    section: "Team conventions",
    statement: "Prefer small, reviewable pull requests.",
    enforcement: "warn",
    annotated: false,
  });
  expect(rules[0]!.appliesTo).toBeUndefined();
  expect(rules[1]).toMatchObject({
    section: "Testing",
    statement: "Every source change ships with a test.",
    enforcement: "warn",
    annotated: false,
  });
});

test("an enforcement annotation promotes a section to a hard rule", () => {
  const rules = parseConstitutionDocument(
    [
      "## Never force-push",
      "",
      "Force-pushing rewrites shared history.",
      "",
      "<!-- enforcement: deny -->",
      '<!-- appliesTo: { commandPattern: "git push --force" } -->',
    ].join("\n"),
    "constitution",
  );
  expect(rules).toHaveLength(1);
  expect(rules[0]).toMatchObject({
    source: "constitution",
    section: "Never force-push",
    enforcement: "deny",
    annotated: true,
    appliesTo: { commandPattern: "git push --force" },
  });
  // The annotation comments are stripped from the statement.
  expect(rules[0]!.statement).toBe("Force-pushing rewrites shared history.");
});

test("appliesTo tools and paths lists are parsed leniently", () => {
  const rules = parseConstitutionDocument(
    [
      "## Guard destructive commands",
      "",
      "<!-- enforcement: approval -->",
      '<!-- appliesTo: { tools: ["shell", "fs-write"], paths: [".github/"] } -->',
    ].join("\n"),
    "constitution",
  );
  expect(rules[0]).toMatchObject({
    enforcement: "approval",
    annotated: true,
    appliesTo: { tools: ["shell", "fs-write"], paths: [".github/"] },
  });
});

test("an empty appliesTo anchor is dropped, keeping the rule warn-anchored", () => {
  const rules = parseConstitutionDocument(
    [
      "## Advisory",
      "",
      "<!-- enforcement: warn -->",
      "<!-- appliesTo: {} -->",
    ].join("\n"),
    "constitution",
  );
  expect(rules[0]).toMatchObject({ enforcement: "warn", annotated: true });
  expect(rules[0]!.appliesTo).toBeUndefined();
});

test("an annotation-only section (no prose) still yields a rule", () => {
  const rules = parseConstitutionDocument(
    ["## Blocked", "<!-- enforcement: deny -->", '<!-- appliesTo: { tools: ["shell"] } -->'].join(
      "\n",
    ),
    "constitution",
  );
  expect(rules).toHaveLength(1);
  expect(rules[0]).toMatchObject({
    enforcement: "deny",
    annotated: true,
    appliesTo: { tools: ["shell"] },
  });
  // With no prose the heading text stands in as the statement.
  expect(rules[0]!.statement).toBe("Blocked");
});

test("empty sections are skipped and ids are stable per heading+ordinal", () => {
  const doc = ["# Title", "", "## Real", "", "A rule.", "", "##   ", ""].join(
    "\n",
  );
  const rules = parseConstitutionDocument(doc, "constitution");
  // The prose-less "# Title" and the empty "##" heading are skipped; only the
  // section with prose survives.
  expect(rules.map((rule) => rule.section)).toEqual(["Real"]);
  // Re-parsing the same document yields the same ids.
  const again = parseConstitutionDocument(doc, "constitution");
  expect(again.map((rule) => rule.id)).toEqual(rules.map((rule) => rule.id));
});

test("CRLF line endings and inline annotations are handled", () => {
  const rules = parseConstitutionDocument(
    "## Rule\r\nprose line\r\n<!-- enforcement: approval -->\r\n",
    "agents",
  );
  expect(rules).toHaveLength(1);
  expect(rules[0]).toMatchObject({
    enforcement: "approval",
    annotated: true,
    statement: "prose line",
  });
});
