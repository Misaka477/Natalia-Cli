import { expect, test } from "bun:test";
import { createToastController } from "../src/context/toast";

test("toast replaces the current message and supports dismissal", () => {
  const toast = createToastController();
  toast.show({ variant: "info", message: "first", duration: 10_000 });
  toast.show({ variant: "success", message: "second", duration: 10_000 });
  expect(toast.currentToast()?.message).toBe("second");
  toast.dismiss();
  expect(toast.currentToast()).toBeUndefined();
});

test("toast error extracts safe messages", () => {
  const toast = createToastController();
  toast.error(new Error("save failed"));
  expect(toast.currentToast()).toMatchObject({
    variant: "error",
    message: "save failed",
  });
  toast.dismiss();
});
