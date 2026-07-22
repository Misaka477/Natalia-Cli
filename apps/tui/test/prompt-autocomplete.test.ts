import { expect, test } from "bun:test";
import {
  mentionAutocompleteQuery,
  slashAutocompleteOptions,
  slashAutocompleteQuery,
} from "../src/component/PromptAutocomplete";

test("slash autocomplete only activates for a single leading command token", () => {
  expect(slashAutocompleteQuery("/mod")).toBe("mod");
  expect(slashAutocompleteQuery(" /mod")).toBeUndefined();
  expect(slashAutocompleteQuery("/mod alpha")).toBeUndefined();
});

test("file mention autocomplete only activates at an @ token boundary", () => {
  expect(mentionAutocompleteQuery("@src/mod")).toBe("src/mod");
  expect(mentionAutocompleteQuery("review @src/mod")).toBe("src/mod");
  expect(mentionAutocompleteQuery("mail@example.com")).toBeUndefined();
  expect(mentionAutocompleteQuery("@src/mod more")).toBeUndefined();
});

test("slash autocomplete filters the shared runtime command vocabulary", () => {
  expect(
    slashAutocompleteOptions("/mod").map((command) => command.name),
  ).toEqual(expect.arrayContaining(["model", "models"]));
  expect(slashAutocompleteOptions("/does-not-exist")).toEqual([]);
  expect(
    slashAutocompleteOptions("/skill-r").map((command) => command.name),
  ).toContain("skill-resource");
  expect(
    slashAutocompleteOptions("/edi").map((command) => command.name),
  ).toContain("editor");
});
