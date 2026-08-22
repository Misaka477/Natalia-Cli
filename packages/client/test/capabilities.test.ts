import { expect, test } from "bun:test";
import {
  builtinCapabilities,
  registerBuiltinCapabilities,
} from "../src/capabilities/builtin-capabilities";
import { CapabilityRegistry } from "@natalia/capability";

// The point of extracting these factories is that they can be exercised without
// standing up a runtime. If any of these tests needed a real client, the
// extraction would not have bought anything.

test("no built-in subsystem keeps a visibility-only record", () => {
  const records = builtinCapabilities();
  // Terminal, sandbox, checkpoint and MCP controllers are all real plugins now
  // and own their capability through the plugin lifecycle; there is nothing
  // left for the runtime to construct directly, so no record claims a grant.
  expect(records).toEqual([]);
});

test("no built-in subsystem record claims to provide tools", () => {
  const registry = new CapabilityRegistry();
  registerBuiltinCapabilities(registry);
  // The tool providers are the tool-family capabilities, not these records.
  expect(registry.withGrant("tools")).toEqual([]);
});

test("registration emits no events when there are no records", () => {
  const registry = new CapabilityRegistry();
  const outcome = registerBuiltinCapabilities(registry);
  expect(outcome.failed).toEqual([]);
  expect(outcome.loaded).toEqual([]);
  expect(registry.list()).toEqual([]);
});
