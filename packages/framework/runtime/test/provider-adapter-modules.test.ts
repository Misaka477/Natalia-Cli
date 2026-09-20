import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearProviderAdapters,
  getProviderAdapter,
  loadProviderAdapterModules,
  providerAdapterModuleRequests,
  validateProviderAdapterPath,
  type ProviderAdapterOptions,
} from "../src";

afterEach(() => {
  clearProviderAdapters();
});

async function workspace(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "natalia-adapter-mod-"));
}

/** A minimal valid adapter module, written into a workspace. */
async function writeAdapter(
  root: string,
  relativePath: string,
  body: string,
): Promise<void> {
  const target = join(root, relativePath);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, body);
}

const ADAPTER_SRC = (format: string) => `
export default {
  format: "${format}",
  create: (options) => ({
    provider: options.provider ?? "${format}",
    model: options.model,
    async *stream() { yield { type: "done" }; },
  }),
};
`;

test("loads a local module and registers it under its declared format", async () => {
  const root = await workspace();
  await writeAdapter(root, "adapters/mine.ts", ADAPTER_SRC("my-format"));

  const results = await loadProviderAdapterModules({
    workspaceRoot: root,
    requests: [
      { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
    ],
  });

  expect(results).toEqual([
    { providerID: "mine", module: join(root, "adapters/mine.ts"), ok: true },
  ]);
  const adapter = getProviderAdapter("my-format");
  expect(adapter).toBeDefined();
  const built = adapter!.create({
    apiKey: "k",
    model: "m",
  } as ProviderAdapterOptions);
  expect(built.model).toBe("m");
});

test("the registered adapter is usable through providerFromKind", async () => {
  // The whole point: a custom format becomes a real dispatch target, not just
  // something that loads.
  const root = await workspace();
  await writeAdapter(root, "adapters/mine.ts", ADAPTER_SRC("my-format"));
  await loadProviderAdapterModules({
    workspaceRoot: root,
    requests: [
      { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
    ],
  });

  const { providerFromKind } = await import("../src");
  const built = providerFromKind({
    apiKey: "k",
    model: "m",
    providerName: "mine",
    provider: "mine",
    format: "my-format",
  });

  expect(built.model).toBe("m");
});

test("rejects a module path that escapes the workspace root", async () => {
  const root = await workspace();

  expect(() =>
    validateProviderAdapterPath(root, "../../etc/passwd.ts"),
  ).toThrow(/escapes the workspace root/);
  expect(() => validateProviderAdapterPath(root, "/abs/elsewhere.ts")).toThrow(
    /escapes the workspace root/,
  );
});

test("rejects a module that is not a local JS or TS file", async () => {
  const root = await workspace();

  expect(() => validateProviderAdapterPath(root, "adapters/x.json")).toThrow(
    /must be a local \.js, \.mjs or \.ts file/,
  );
});

test("a missing module is reported, not thrown", async () => {
  // One broken adapter must not stop the session from starting; the caller
  // publishes the diagnostic and dispatch repeats the failure with context.
  const root = await workspace();

  const results = await loadProviderAdapterModules({
    workspaceRoot: root,
    requests: [
      { providerID: "gone", format: "gone-format", module: "./nope.ts" },
    ],
  });

  expect(results[0].ok).toBe(false);
  expect(results[0].error).toBeTruthy();
  expect(getProviderAdapter("gone-format")).toBeUndefined();
});

test("a module without a default export is reported with the reason", async () => {
  const root = await workspace();
  await writeAdapter(root, "adapters/empty.ts", "export const nothing = 1;\n");

  const results = await loadProviderAdapterModules({
    workspaceRoot: root,
    requests: [{ providerID: "e", format: "e", module: "./adapters/empty.ts" }],
  });

  expect(results[0].ok).toBe(false);
  expect(results[0].error).toMatch(/default-export an adapter object/);
});

test("an adapter missing its format or factory is rejected by shape", async () => {
  const root = await workspace();
  await writeAdapter(
    root,
    "adapters/nofmt.ts",
    "export default { create: () => ({}) };\n",
  );
  await writeAdapter(
    root,
    "adapters/nocreate.ts",
    'export default { format: "x" };\n',
  );

  const noFormat = await loadProviderAdapterModules({
    workspaceRoot: root,
    requests: [{ providerID: "a", format: "x", module: "./adapters/nofmt.ts" }],
  });
  const noCreate = await loadProviderAdapterModules({
    workspaceRoot: root,
    requests: [
      { providerID: "b", format: "x", module: "./adapters/nocreate.ts" },
    ],
  });

  expect(noFormat[0].error).toMatch(/non-empty `format` string/);
  expect(noCreate[0].error).toMatch(/`create\(options\)` factory/);
});

test("an adapter whose format disagrees with the endpoint is rejected", async () => {
  // A silent mismatch would register the adapter under one key while the
  // endpoint asks for another, and dispatch would fail with no cause.
  const root = await workspace();
  await writeAdapter(
    root,
    "adapters/mismatch.ts",
    ADAPTER_SRC("actual-format"),
  );

  const results = await loadProviderAdapterModules({
    workspaceRoot: root,
    requests: [
      {
        providerID: "m",
        format: "declared-format",
        module: "./adapters/mismatch.ts",
      },
    ],
  });

  expect(results[0].ok).toBe(false);
  expect(results[0].error).toMatch(/they must match/);
  expect(getProviderAdapter("actual-format")).toBeUndefined();
});

test("collects requests only from endpoints declaring both a format and a module", () => {
  const requests = providerAdapterModuleRequests({
    builtin: { protocol: { format: "openai-chat" } },
    custom: { protocol: { format: "mine", module: "./a.ts" } },
    half: { protocol: { format: "half", module: undefined } },
    none: { protocol: { format: "openai-chat" } },
  });

  // The built-in families need no module, so only a format-plus-module pair is
  // a load request.
  expect(requests).toEqual([
    { providerID: "custom", format: "mine", module: "./a.ts" },
  ]);
});

test("re-registering the same module is a conflict, not a silent replace", async () => {
  const root = await workspace();
  await writeAdapter(root, "adapters/mine.ts", ADAPTER_SRC("my-format"));

  await loadProviderAdapterModules({
    workspaceRoot: root,
    requests: [
      { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
    ],
  });
  const again = await loadProviderAdapterModules({
    workspaceRoot: root,
    requests: [
      { providerID: "mine", format: "my-format", module: "./adapters/mine.ts" },
    ],
  });

  expect(again[0].ok).toBe(false);
  expect(again[0].error).toMatch(/already registered/);
});
