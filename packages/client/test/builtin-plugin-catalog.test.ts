import { expect, test } from "bun:test";
import {
  ASK_PLUGIN_ID,
  builtinPluginCatalog,
  PDF_PLUGIN_ID,
  SEARCH_PLUGIN_ID,
  SKILLS_PLUGIN_ID,
  TODO_PLUGIN_ID,
} from "../src/builtin-plugins/catalog";

test("built-in plugin catalog is lazy and has unique matching ids", () => {
  const catalog = builtinPluginCatalog({
    askEnabled: true,
    pdfEnabled: true,
    searchEnabled: true,
    todoEnabled: true,
  });
  expect(catalog.map((entry) => entry.id)).toEqual([
    ASK_PLUGIN_ID,
    TODO_PLUGIN_ID,
    SEARCH_PLUGIN_ID,
    SKILLS_PLUGIN_ID,
    PDF_PLUGIN_ID,
  ]);
  expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
  expect(catalog.find((entry) => entry.id === SKILLS_PLUGIN_ID)?.enabled).toBe(
    false,
  );
  for (const entry of catalog.filter((candidate) => candidate.enabled))
    expect(entry.create().manifest.id).toBe(entry.id);
});
