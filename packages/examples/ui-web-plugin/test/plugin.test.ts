import { expect, test } from "bun:test";
import {
  EXAMPLE_WEB_UI_PANELS,
  EXAMPLE_WEB_UI_PLUGIN_ID,
} from "../src/identity";

test("the example web UI plugin contributes Main and Chat panels", () => {
  expect(EXAMPLE_WEB_UI_PLUGIN_ID).toBe("natalia.ui.web.example");
  expect(EXAMPLE_WEB_UI_PANELS.map((panel) => panel.id)).toEqual([
    "main",
    "chat",
  ]);
  expect(EXAMPLE_WEB_UI_PANELS.map((panel) => panel.title)).toEqual([
    "Main",
    "Chat",
  ]);
});
