import { expect, test } from "bun:test";
import { createSignal } from "solid-js";
import { createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { Dialog } from "../src/dialog/Dialog";

test("dialog overlay preserves underlying wide Unicode cells", async () => {
  const setup = await createTestRenderer({ width: 80, height: 24 });
  const [open, setOpen] = createSignal(false);
  await render(
    () => (
      <>
        <text>Before dialog: 你好 🙂 e\u0301</text>
        {open() ? (
          <Dialog onClose={() => setOpen(false)}>
            <text>Terminal Sessions</text>
          </Dialog>
        ) : null}
      </>
    ),
    setup.renderer,
  );

  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("你");
  expect(setup.captureCharFrame()).toContain("好");
  expect(setup.captureCharFrame()).toContain("🙂");

  setOpen(true);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("你");
  expect(setup.captureCharFrame()).toContain("好");
  expect(setup.captureCharFrame()).toContain("🙂");

  setOpen(false);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("你好");
  expect(setup.captureCharFrame()).toContain("🙂");
  setup.renderer.destroy();
});
