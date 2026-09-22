import { expect, test } from "bun:test";
import {
  findCompositionKernelViolation,
  findPolicyHostDependencyViolation,
} from "../src/migrated-plugin-rules";

/**
 * The two P3 layer rules (decisions §1.1/§1.2, master plan P3 row) —
 * unit-tested here because the guard's own run only proves today's tree
 * is clean, not that the rules BITE.
 */

test("product policy never depends on the host layer — and only in shipped code", () => {
  const domainsFile = "packages/domains/work-ledger/src/controller.ts";
  expect(
    findPolicyHostDependencyViolation("@natalia/platform", domainsFile),
  ).toContain("host layer");
  expect(
    findPolicyHostDependencyViolation(
      "@natalia/object-store/extra",
      domainsFile,
    ),
  ).toContain("@natalia/object-store");
  // Public engine API and siblings stay legal (§1.2: only через API/token).
  expect(
    findPolicyHostDependencyViolation("@natalia/contracts", domainsFile),
  ).toBeUndefined();
  expect(
    findPolicyHostDependencyViolation("@natalia/runtime-services", domainsFile),
  ).toBeUndefined();
  expect(
    findPolicyHostDependencyViolation(
      "@natalia/platform",
      "packages/framework/client/src/x.ts",
    ),
  ).toBeUndefined(); // scoped to domains
  expect(
    findPolicyHostDependencyViolation(
      "@natalia/platform",
      domainsFile.replace("/src/", "/test/"),
    ),
  ).toBeUndefined(); // tests may reach anywhere
});

test("composition lives in the kernel layer — checked where it is declared", () => {
  expect(
    findCompositionKernelViolation(["packages/core/composition/src/index.ts"]),
  ).toBeUndefined();
  expect(
    findCompositionKernelViolation([
      "packages/framework/composition/src/index.ts",
    ]),
  ).toContain("kernel layer");
  expect(findCompositionKernelViolation(undefined)).toContain("missing");
});
