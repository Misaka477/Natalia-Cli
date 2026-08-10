import { expect, test } from "bun:test";
import type { RuntimeClient } from "../src/events";
import {
  describeRuntimeCapabilities,
  REQUIRED_RUNTIME_MEMBERS,
  RUNTIME_CAPABILITY_GROUPS,
  UNIMPLEMENTED_QUERIES,
} from "../src/capabilities";

/**
 * The point of this surface is that a consumer can tell three states apart that
 * `optional` cannot: "this runtime does not do that", "nobody implemented that
 * yet", and "there is genuinely nothing to report". These tests pin exactly that.
 */

function stub(members: string[]): RuntimeClient {
  return Object.fromEntries(
    members.map((member) => [member, () => undefined]),
  ) as unknown as RuntimeClient;
}

test("a runtime with only the required members is usable and reports no capabilities", () => {
  const report = describeRuntimeCapabilities(
    stub([...REQUIRED_RUNTIME_MEMBERS]),
  );
  expect(report.usable).toBe(true);
  expect(report.missingRequired).toEqual([]);
  expect(report.groups.filter((group) => group.available)).toEqual([]);
  // Nothing is claimed to be present, so nothing is reported as empty-for-now.
  expect(report.unimplemented).toEqual([]);
});

test("a runtime missing a required member is reported unusable, not degraded", () => {
  // Feature-detecting your way around a missing `submit` is not a degraded mode:
  // there is no runtime without it, and saying so is the point of the tier.
  const report = describeRuntimeCapabilities(
    stub(REQUIRED_RUNTIME_MEMBERS.filter((member) => member !== "submit")),
  );
  expect(report.usable).toBe(false);
  expect(report.missingRequired).toEqual(["submit"]);
});

test("a capability is available only when all of its members are", () => {
  const checkpoint = [...RUNTIME_CAPABILITY_GROUPS.checkpoint];
  const whole = describeRuntimeCapabilities(
    stub([...REQUIRED_RUNTIME_MEMBERS, ...checkpoint]),
  ).groups.find((group) => group.name === "checkpoint");
  expect(whole).toMatchObject({ available: true, partial: false, missing: [] });

  // Half a capability is worth reporting: it is usually an oversight, and a
  // consumer that checked one method would be surprised by the next.
  const half = describeRuntimeCapabilities(
    stub([...REQUIRED_RUNTIME_MEMBERS, checkpoint[0]!]),
  ).groups.find((group) => group.name === "checkpoint");
  expect(half).toMatchObject({ available: false, partial: true });
  expect(half?.missing).toEqual(checkpoint.slice(1));
});

test("a query that answers with nothing says why, instead of looking like no data", () => {
  const members = Object.keys(UNIMPLEMENTED_QUERIES) as Array<
    keyof typeof UNIMPLEMENTED_QUERIES
  >;
  const report = describeRuntimeCapabilities(
    stub([...REQUIRED_RUNTIME_MEMBERS, ...members]),
  );
  expect(report.unimplemented.map((entry) => entry.member).sort()).toEqual(
    [...members].sort(),
  );
  for (const entry of report.unimplemented)
    expect(entry.reason.length).toBeGreaterThan(0);
  // And it is still reported as present, because it is: it answers, with nothing.
  expect(
    report.groups.find((group) => group.name === "intelligence")?.available,
  ).toBe(true);
});

test("every member of the contract is either required or in exactly one capability", () => {
  // The compile-time check in `capabilities.ts` proves nothing is unclassified.
  // This proves the other half: nothing is classified twice, which would make a
  // report contradict itself.
  const seen = new Map<string, string[]>();
  for (const [name, members] of Object.entries(RUNTIME_CAPABILITY_GROUPS))
    for (const member of members)
      seen.set(member, [...(seen.get(member) ?? []), name]);
  expect([...seen].filter(([, groups]) => groups.length > 1)).toEqual([]);
  for (const member of REQUIRED_RUNTIME_MEMBERS)
    expect(seen.has(member)).toBe(false);
});
