import { expect, test } from "bun:test";
import { reloadTuiPreferencesOnSettingsUpdate } from "../src/settings";

test("only settings.updated reloads TUI preferences", async () => {
  let reloads = 0;
  const reload = async () => {
    reloads++;
  };

  await reloadTuiPreferencesOnSettingsUpdate(
    { type: "status.update", status: "ready" },
    reload,
  );
  expect(reloads).toBe(0);

  await reloadTuiPreferencesOnSettingsUpdate(
    { type: "settings.updated", scope: "project" },
    reload,
  );
  expect(reloads).toBe(1);
});
