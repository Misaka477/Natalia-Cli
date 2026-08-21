import { expect, test } from "bun:test";
import { derivePermissionSettings } from "../src/permission-settings";

function config(overrides: any = {}) {
  return {
    defaultPermission: "default",
    defaultMode: "default",
    permissionProfiles: {
      default: { approval: "ask" },
      strict: { approval: "auto" },
      read_only: { approval: "read_only" },
    },
    modes: {
      default: {},
      strictMode: { permission: "strict" },
    },
    ...overrides,
  } as any;
}

test("an explicitly requested profile wins and sets the mode", () => {
  const derived = derivePermissionSettings({
    config: config({ defaultMode: "strictMode" }),
    requestedProfile: "read_only",
    optionMode: undefined,
    permissionMode: "ask",
  });
  if (!derived.found) throw new Error("expected found");
  expect(derived.selectedProfile.approval).toBe("read_only");
  expect(derived.mode).toBe("read_only");
  expect(derived.defaultMode).toBe("read_only");
});

test("a missing requested profile returns found:false", () => {
  const derived = derivePermissionSettings({
    config: config(),
    requestedProfile: "does-not-exist",
    optionMode: undefined,
    permissionMode: "ask",
  });
  expect(derived.found).toBe(false);
});

test("without a requested profile the mode default or profile approval applies", () => {
  const derived = derivePermissionSettings({
    config: config({ defaultMode: "strictMode" }),
    requestedProfile: undefined,
    optionMode: undefined,
    permissionMode: "ask",
  });
  if (!derived.found) throw new Error("expected found");
  // strictMode pins permission -> "strict" profile -> approval "auto".
  expect(derived.selectedProfile.approval).toBe("auto");
  expect(derived.mode).toBe("auto");
});

test("an explicit option mode is preserved", () => {
  const derived = derivePermissionSettings({
    config: config({ defaultMode: "strictMode" }),
    requestedProfile: undefined,
    optionMode: "read_only",
    permissionMode: "read_only",
  });
  if (!derived.found) throw new Error("expected found");
  expect(derived.selectedProfile.approval).toBe("auto");
  expect(derived.mode).toBe("read_only");
});
