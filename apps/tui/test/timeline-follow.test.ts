import { expect, test } from "bun:test";

test("streaming layout changes do not cancel bottom following", () => {
  // The auto-scroll contract treats scroll position changes as ambiguous:
  // layout/sticky anchoring can move it without any user action. Only explicit
  // user navigation may disable follow mode.
  let follow = true;
  const onScrollPositionChanged = (atBottom: boolean) => {
    if (atBottom) follow = true;
  };

  onScrollPositionChanged(false);
  expect(follow).toBe(true);

  follow = false; // PageUp/Home or a user wheel-up action.
  onScrollPositionChanged(false);
  expect(follow).toBe(false);

  onScrollPositionChanged(true);
  expect(follow).toBe(true);
});
