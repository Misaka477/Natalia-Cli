"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var constitution_doc_1 = require("../src/runtime/constitution-doc");
(0, bun_test_1.test)("prose sections without annotations are warn-level soft rules", function () {
    var rules = (0, constitution_doc_1.parseConstitutionDocument)([
        "# Team conventions",
        "",
        "Prefer small, reviewable pull requests.",
        "",
        "## Testing",
        "",
        "Every source change ships with a test.",
    ].join("\n"), "agents");
    (0, bun_test_1.expect)(rules).toHaveLength(2);
    (0, bun_test_1.expect)(rules[0]).toMatchObject({
        source: "agents",
        section: "Team conventions",
        statement: "Prefer small, reviewable pull requests.",
        enforcement: "warn",
        annotated: false,
    });
    (0, bun_test_1.expect)(rules[0].appliesTo).toBeUndefined();
    (0, bun_test_1.expect)(rules[1]).toMatchObject({
        section: "Testing",
        statement: "Every source change ships with a test.",
        enforcement: "warn",
        annotated: false,
    });
});
(0, bun_test_1.test)("an enforcement annotation promotes a section to a hard rule", function () {
    var rules = (0, constitution_doc_1.parseConstitutionDocument)([
        "## Never force-push",
        "",
        "Force-pushing rewrites shared history.",
        "",
        "<!-- enforcement: deny -->",
        '<!-- appliesTo: { commandPattern: "git push --force" } -->',
    ].join("\n"), "constitution");
    (0, bun_test_1.expect)(rules).toHaveLength(1);
    (0, bun_test_1.expect)(rules[0]).toMatchObject({
        source: "constitution",
        section: "Never force-push",
        enforcement: "deny",
        annotated: true,
        appliesTo: { commandPattern: "git push --force" },
    });
    // The annotation comments are stripped from the statement.
    (0, bun_test_1.expect)(rules[0].statement).toBe("Force-pushing rewrites shared history.");
});
(0, bun_test_1.test)("appliesTo tools and paths lists are parsed leniently", function () {
    var rules = (0, constitution_doc_1.parseConstitutionDocument)([
        "## Guard destructive commands",
        "",
        "<!-- enforcement: approval -->",
        '<!-- appliesTo: { tools: ["shell", "fs-write"], paths: [".github/"] } -->',
    ].join("\n"), "constitution");
    (0, bun_test_1.expect)(rules[0]).toMatchObject({
        enforcement: "approval",
        annotated: true,
        appliesTo: { tools: ["shell", "fs-write"], paths: [".github/"] },
    });
});
(0, bun_test_1.test)("an empty appliesTo anchor is dropped, keeping the rule warn-anchored", function () {
    var rules = (0, constitution_doc_1.parseConstitutionDocument)([
        "## Advisory",
        "",
        "<!-- enforcement: warn -->",
        "<!-- appliesTo: {} -->",
    ].join("\n"), "constitution");
    (0, bun_test_1.expect)(rules[0]).toMatchObject({ enforcement: "warn", annotated: true });
    (0, bun_test_1.expect)(rules[0].appliesTo).toBeUndefined();
});
(0, bun_test_1.test)("an annotation-only section (no prose) still yields a rule", function () {
    var rules = (0, constitution_doc_1.parseConstitutionDocument)([
        "## Blocked",
        "<!-- enforcement: deny -->",
        '<!-- appliesTo: { tools: ["shell"] } -->',
    ].join("\n"), "constitution");
    (0, bun_test_1.expect)(rules).toHaveLength(1);
    (0, bun_test_1.expect)(rules[0]).toMatchObject({
        enforcement: "deny",
        annotated: true,
        appliesTo: { tools: ["shell"] },
    });
    // With no prose the heading text stands in as the statement.
    (0, bun_test_1.expect)(rules[0].statement).toBe("Blocked");
});
(0, bun_test_1.test)("empty sections are skipped and ids are stable per heading+ordinal", function () {
    var doc = ["# Title", "", "## Real", "", "A rule.", "", "##   ", ""].join("\n");
    var rules = (0, constitution_doc_1.parseConstitutionDocument)(doc, "constitution");
    // The prose-less "# Title" and the empty "##" heading are skipped; only the
    // section with prose survives.
    (0, bun_test_1.expect)(rules.map(function (rule) { return rule.section; })).toEqual(["Real"]);
    // Re-parsing the same document yields the same ids.
    var again = (0, constitution_doc_1.parseConstitutionDocument)(doc, "constitution");
    (0, bun_test_1.expect)(again.map(function (rule) { return rule.id; })).toEqual(rules.map(function (rule) { return rule.id; }));
});
(0, bun_test_1.test)("CRLF line endings and inline annotations are handled", function () {
    var rules = (0, constitution_doc_1.parseConstitutionDocument)("## Rule\r\nprose line\r\n<!-- enforcement: approval -->\r\n", "agents");
    (0, bun_test_1.expect)(rules).toHaveLength(1);
    (0, bun_test_1.expect)(rules[0]).toMatchObject({
        enforcement: "approval",
        annotated: true,
        statement: "prose line",
    });
});
(0, bun_test_1.test)("splitConstitutionSections tracks each section's heading and line range", function () {
    var doc = ["# Title", "", "intro prose", "## Rule A", "", "body a"].join("\n");
    var sections = (0, constitution_doc_1.splitConstitutionSections)(doc);
    // The pre-heading content is its own (headingless) section.
    (0, bun_test_1.expect)(sections.map(function (s) { return s.heading; })).toEqual(["", "Title", "Rule A"]);
    var ruleA = sections.find(function (s) { return s.heading === "Rule A"; });
    (0, bun_test_1.expect)(ruleA.startLine).toBe(3);
    // "body a" is the last line; the section ends there.
    (0, bun_test_1.expect)(doc.split("\n")[ruleA.endLine]).toBe("body a");
});
(0, bun_test_1.test)("editing a prose rule rewrites its statement and keeps other rules stable", function () {
    var doc = [
        "# Conventions",
        "",
        "Prefer small PRs.",
        "",
        "## Testing",
        "",
        "Every change ships a test.",
    ].join("\n");
    var before = (0, constitution_doc_1.parseConstitutionDocument)(doc, "agents");
    var testing = before.find(function (r) { return r.section === "Testing"; });
    var result = (0, constitution_doc_1.applyConstitutionDocEdit)(doc, "agents", testing.id, {
        statement: "Every source change ships a unit test and an E2E where it touches a boundary.",
        enforcement: "warn",
    });
    (0, bun_test_1.expect)(result.ok).toBe(true);
    if (!result.ok)
        return;
    var after = (0, constitution_doc_1.parseConstitutionDocument)(result.content, "agents");
    // The edited section reflects the new prose...
    (0, bun_test_1.expect)(after.find(function (r) { return r.section === "Testing"; }).statement).toBe("Every source change ships a unit test and an E2E where it touches a boundary.");
    // ...the untouched section is unchanged, and ids stay stable.
    (0, bun_test_1.expect)(after.find(function (r) { return r.section === "Conventions"; }).statement).toBe("Prefer small PRs.");
    (0, bun_test_1.expect)(after.map(function (r) { return r.id; })).toEqual(before.map(function (r) { return r.id; }));
});
(0, bun_test_1.test)("editing can annotate a prose section into a hard deny rule with an anchor", function () {
    var doc = [
        "## Never force-push",
        "",
        "Force-pushing rewrites shared history.",
    ].join("\n");
    var rule = (0, constitution_doc_1.parseConstitutionDocument)(doc, "constitution")[0];
    (0, bun_test_1.expect)(rule.enforcement).toBe("warn");
    var result = (0, constitution_doc_1.applyConstitutionDocEdit)(doc, "constitution", rule.id, {
        statement: "Force-pushing rewrites shared history.",
        enforcement: "deny",
        appliesTo: { commandPattern: "git push --force" },
    });
    (0, bun_test_1.expect)(result.ok).toBe(true);
    if (!result.ok)
        return;
    // The document now carries the annotations the parser reads back as hard.
    (0, bun_test_1.expect)(result.content).toContain("<!-- enforcement: deny -->");
    (0, bun_test_1.expect)(result.content).toContain('commandPattern: "git push --force"');
    var after = (0, constitution_doc_1.parseConstitutionDocument)(result.content, "constitution")[0];
    (0, bun_test_1.expect)(after).toMatchObject({
        enforcement: "deny",
        annotated: true,
        appliesTo: { commandPattern: "git push --force" },
        statement: "Force-pushing rewrites shared history.",
    });
});
(0, bun_test_1.test)("editing a hard rule syncs its appliesTo anchor and can downgrade it back to prose", function () {
    var doc = [
        "## Guard shell",
        "",
        "Destructive shell needs approval.",
        "",
        "<!-- enforcement: approval -->",
        '<!-- appliesTo: { tools: ["shell"] } -->',
    ].join("\n");
    var rule = (0, constitution_doc_1.parseConstitutionDocument)(doc, "constitution")[0];
    // Tighten the anchor: add a path.
    var tightened = (0, constitution_doc_1.applyConstitutionDocEdit)(doc, "constitution", rule.id, {
        statement: "Destructive shell needs approval.",
        enforcement: "approval",
        appliesTo: { tools: ["shell"], paths: [".github/"] },
    });
    (0, bun_test_1.expect)(tightened.ok).toBe(true);
    if (!tightened.ok)
        return;
    (0, bun_test_1.expect)((0, constitution_doc_1.parseConstitutionDocument)(tightened.content, "constitution")[0].appliesTo).toEqual({ tools: ["shell"], paths: [".github/"] });
    // Downgrade to a warn prose rule: the annotations are removed entirely.
    var downgraded = (0, constitution_doc_1.applyConstitutionDocEdit)(tightened.content, "constitution", rule.id, { statement: "Destructive shell needs approval.", enforcement: "warn" });
    (0, bun_test_1.expect)(downgraded.ok).toBe(true);
    if (!downgraded.ok)
        return;
    (0, bun_test_1.expect)(downgraded.content).not.toContain("<!--");
    var after = (0, constitution_doc_1.parseConstitutionDocument)(downgraded.content, "constitution")[0];
    (0, bun_test_1.expect)(after).toMatchObject({ enforcement: "warn", annotated: false });
    (0, bun_test_1.expect)(after.appliesTo).toBeUndefined();
});
(0, bun_test_1.test)("a deny/approval edit without an anchor is refused, not written", function () {
    var doc = ["## Blocked", "", "Do not do this."].join("\n");
    var rule = (0, constitution_doc_1.parseConstitutionDocument)(doc, "constitution")[0];
    var result = (0, constitution_doc_1.applyConstitutionDocEdit)(doc, "constitution", rule.id, {
        statement: "Do not do this.",
        enforcement: "deny",
    });
    (0, bun_test_1.expect)(result).toEqual({
        ok: false,
        reason: "a deny/approval rule requires a non-empty appliesTo anchor",
    });
});
(0, bun_test_1.test)("editing an unknown rule id is reported, and the document is untouched", function () {
    var doc = ["## Real", "", "A rule."].join("\n");
    var result = (0, constitution_doc_1.applyConstitutionDocEdit)(doc, "constitution", "constitution:nope:9", {
        statement: "x",
        enforcement: "warn",
    });
    (0, bun_test_1.expect)(result).toEqual({ ok: false, reason: "unknown document rule id" });
});
