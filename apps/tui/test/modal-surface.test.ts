import { describe, expect, test } from "bun:test";
import { getOrCreateModeStack } from "../src/modal/mode-stack";
import { commands } from "../src/keymap";

/**
 * The mode stack only needs these two calls, so a stub keeps the test free of a
 * renderer while still observing the key-dispatch data the real keymap reads.
 */
function stubKeymap() {
  const data: Record<string, unknown> = {};
  return {
    keymap: {
      setData(key: string, value: unknown) {
        data[key] = value;
      },
      registerLayerFields() {
        return () => {};
      },
    } as never,
    mode: () => data["natalia.mode"],
  };
}

describe("surface stack", () => {
  test("the surface that owns the current mode is also the one painted on top", () => {
    const { keymap, mode } = stubKeymap();
    const modes = getOrCreateModeStack(keymap);

    const dialog = modes.pushSurface("modal");
    expect(mode()).toBe("modal");
    expect(dialog.isTop()).toBe(true);

    // An approval arriving later must take both the keys and the top of the
    // paint order. Splitting those two is what let Escape reach a hidden
    // prompt underneath a visible dialog.
    const approval = modes.pushSurface("approval");
    expect(mode()).toBe("approval");
    expect(approval.isTop()).toBe(true);
    expect(dialog.isTop()).toBe(false);
    expect(approval.zIndex()).toBeGreaterThan(dialog.zIndex());

    approval.release();
    expect(mode()).toBe("modal");
    expect(dialog.isTop()).toBe(true);
  });

  test("a dialog opened over a modal takes the keys and the top of the paint order", () => {
    const { keymap, mode } = stubKeymap();
    const modes = getOrCreateModeStack(keymap);

    const approval = modes.pushSurface("approval");
    const dialog = modes.pushSurface("modal");

    // This is the reported scenario: with an approval pending, opening a dialog
    // must let Escape close the dialog first.
    expect(mode()).toBe("modal");
    expect(dialog.zIndex()).toBeGreaterThan(approval.zIndex());
    expect(dialog.isTop()).toBe(true);

    dialog.release();
    expect(mode()).toBe("approval");
    expect(approval.isTop()).toBe(true);
  });

  test("releasing a buried surface keeps the remaining order consistent", () => {
    const { keymap, mode } = stubKeymap();
    const modes = getOrCreateModeStack(keymap);

    const first = modes.pushSurface("modal");
    const second = modes.pushSurface("approval");
    const third = modes.pushSurface("question");

    second.release();
    expect(mode()).toBe("question");
    expect(third.zIndex()).toBeGreaterThan(first.zIndex());
    expect(third.isTop()).toBe(true);

    third.release();
    expect(mode()).toBe("modal");
    expect(first.isTop()).toBe(true);
  });

  test("releasing twice is a no-op", () => {
    const { keymap, mode } = stubKeymap();
    const modes = getOrCreateModeStack(keymap);

    const surface = modes.pushSurface("modal");
    const other = modes.pushSurface("approval");
    surface.release();
    surface.release();

    expect(mode()).toBe("approval");
    expect(other.isTop()).toBe(true);
  });

  test("the base mode is restored once every surface is gone", () => {
    const { keymap, mode } = stubKeymap();
    const modes = getOrCreateModeStack(keymap);

    const surface = modes.pushSurface("approval");
    surface.release();
    expect(mode()).toBe("base");
    expect(modes.current()).toBe("base");
  });
});

describe("surface-opening commands", () => {
  test("stay reachable while a runtime modal is presented", () => {
    // These are the commands registered without a mode requirement. A modal
    // masks the base layer, so anything not marked here cannot be opened while
    // an approval or question is waiting.
    const overlay = Object.values(commands)
      .filter((command) => command.overlay)
      .map((command) => command.id)
      .sort();
    expect(overlay).toEqual(["palette.toggle", "terminal.manage"]);
  });
});
