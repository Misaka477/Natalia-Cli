import { expect, test } from "bun:test";
import {
  CapabilityHost,
  CapabilityLoadError,
  type CapabilityRegistration,
} from "../src";

function registration(
  id: string,
  overrides: Partial<CapabilityRegistration> = {},
): CapabilityRegistration {
  return {
    id,
    name: id,
    version: "1.0.0",
    scope: "workspace",
    grants: ["workflows"],
    ...overrides,
  };
}

test("workspace hosts canonicalize ownership roots", () => {
  const host = new CapabilityHost({ workspaceRoot: "/srv/work/../project" });
  expect(host.workspaceRoot).toBe("/srv/project");
});

test("unload hides contributions immediately and cleanup waits for the lease", () => {
  const host = new CapabilityHost();
  const cleaned: string[] = [];
  host.load(registration("cap.review"), (capability) => {
    capability.contribute("workflows", "review", { taskID: "task_review" });
    capability.onUnload(() => cleaned.push("review"));
  });
  const lease = host.acquireExecutionLease("cap.review");

  expect(host.unload("cap.review")).toBe(true);
  expect(host.has("cap.review")).toBe(false);
  expect(host.contributions("workflows")).toEqual([]);
  expect(host.pendingCleanup()).toEqual(["cap.review"]);
  expect(cleaned).toEqual([]);
  expect(() => host.acquireExecutionLease("cap.review")).toThrow(
    "is not visible for execution",
  );

  lease.release();
  lease.release();
  expect(cleaned).toEqual(["review"]);
  expect(host.pendingCleanup()).toEqual([]);
});

test("a dependent execution leases its transitive dependency resources", () => {
  const host = new CapabilityHost();
  const cleaned: string[] = [];
  host.load(registration("cap.base"), (capability) =>
    capability.onUnload(() => cleaned.push("base")),
  );
  host.load(
    registration("cap.review", { dependencies: ["cap.base"] }),
    (capability) => capability.onUnload(() => cleaned.push("review")),
  );
  const lease = host.acquireExecutionLease("cap.review");
  expect(lease.capabilityIDs).toEqual(["cap.base", "cap.review"]);

  host.unload("cap.base");
  expect(host.list()).toEqual([]);
  expect(host.pendingCleanup().sort()).toEqual(["cap.base", "cap.review"]);
  expect(cleaned).toEqual([]);

  lease.release();
  expect(cleaned).toEqual(["review", "base"]);
});

test("scope unload immediately hides only that scope while leases delay cleanup", () => {
  const host = new CapabilityHost();
  const cleaned: string[] = [];
  host.load(registration("cap.workspace"), (capability) =>
    capability.onUnload(() => cleaned.push("workspace")),
  );
  host.load(registration("cap.session", { scope: "session" }), (capability) =>
    capability.onUnload(() => cleaned.push("session")),
  );
  const lease = host.acquireExecutionLease("cap.session");

  expect(host.unloadScope("session")).toEqual(["cap.session"]);
  expect(host.has("cap.workspace")).toBe(true);
  expect(host.has("cap.session")).toBe(false);
  expect(cleaned).toEqual([]);
  lease.release();
  expect(cleaned).toEqual(["session"]);
});

test("dispose hides everything, waits for leases, and refuses new loads", () => {
  const host = new CapabilityHost();
  const cleaned: string[] = [];
  host.load(registration("cap.review"), (capability) =>
    capability.onUnload(() => cleaned.push("review")),
  );
  const lease = host.acquireExecutionLease("cap.review");

  host.dispose();
  host.dispose();
  expect(host.list()).toEqual([]);
  expect(cleaned).toEqual([]);
  expect(() => host.load(registration("cap.late"))).toThrow(
    "capability host is disposed",
  );
  lease.release();
  expect(cleaned).toEqual(["review"]);
});

test("failed and duplicate loads do not replace host bookkeeping", () => {
  const host = new CapabilityHost();
  const cleaned: string[] = [];
  let escapedOnUnload: ((fn: () => void) => void) | undefined;
  host.load(registration("cap.review"), (capability) => {
    escapedOnUnload = capability.onUnload;
    capability.onUnload(() => cleaned.push("original"));
  });

  expect(() => host.load(registration("cap.review"))).toThrow(
    CapabilityLoadError,
  );
  expect(
    host.tryLoad(registration("cap.missing", { dependencies: ["absent"] })).ok,
  ).toBe(false);
  expect(host.has("cap.review")).toBe(true);
  host.unload("cap.review");
  expect(cleaned).toEqual(["original"]);
  expect(() => escapedOnUnload?.(() => undefined)).toThrow(
    "cannot register cleanup after unload",
  );
});

test("one failing cleanup does not retain the remaining resources", () => {
  const host = new CapabilityHost();
  const cleaned: string[] = [];
  host.load(registration("cap.review"), (capability) => {
    capability.onUnload(() => {
      throw new Error("cleanup failed");
    });
    capability.onUnload(() => cleaned.push("second"));
  });
  expect(() => host.unload("cap.review")).not.toThrow();
  expect(cleaned).toEqual(["second"]);
  expect(host.pendingCleanup()).toEqual([]);
});
