import { expect, test } from "bun:test";
import {
  ASK_PLUGIN_ID,
  builtinPluginCatalog,
  FS_READ_PLUGIN_ID,
  FS_WRITE_PLUGIN_ID,
  PDF_PLUGIN_ID,
  SEARCH_PLUGIN_ID,
  SHELL_PLUGIN_ID,
  SKILLS_PLUGIN_ID,
  TODO_PLUGIN_ID,
  WEB_PLUGIN_ID,
} from "../src/builtin-plugins/catalog";

test("built-in plugin catalog is lazy and has unique matching ids", () => {
  const catalog = builtinPluginCatalog({
    askEnabled: true,
    fsReadEnabled: true,
    fsWriteEnabled: true,
    pdfEnabled: true,
    searchEnabled: true,
    shellEnabled: true,
    todoEnabled: true,
    webEnabled: true,
  });
  expect(catalog.map((entry) => entry.id)).toEqual([
    ASK_PLUGIN_ID,
    TODO_PLUGIN_ID,
    SEARCH_PLUGIN_ID,
    FS_READ_PLUGIN_ID,
    FS_WRITE_PLUGIN_ID,
    WEB_PLUGIN_ID,
    SHELL_PLUGIN_ID,
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
