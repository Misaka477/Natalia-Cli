import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  attachmentDataURL,
  attachmentText,
  cleanupUnreferencedAttachments,
  storeLocalAttachments,
} from "../src/attachments";

test("local attachment store rejects workspace escapes and extension spoofing", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-attachment-store-"));
  const outside = await mkdtemp(join(tmpdir(), "natalia-attachment-outside-"));
  await writeFile(join(root, "spoof.png"), "not an image");
  await writeFile(
    join(outside, "image.png"),
    Buffer.from("89504e470d0a1a0a", "hex"),
  );
  await expect(
    storeLocalAttachments({ workspaceRoot: root, paths: ["spoof.png"] }),
  ).rejects.toThrow("attachment type is unsupported");
  await expect(
    storeLocalAttachments({
      workspaceRoot: root,
      paths: [join(outside, "image.png")],
    }),
  ).rejects.toThrow("attachment path escapes workspace");
});

test("attachment cleanup removes only unreferenced Natalia attachment files", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-attachment-cleanup-"));
  await writeFile(
    join(root, "image.png"),
    Buffer.from("89504e470d0a1a0a", "hex"),
  );
  const [attachment] = await storeLocalAttachments({
    workspaceRoot: root,
    paths: ["image.png"],
  });
  const store = join(root, ".natalia", "attachments");
  await writeFile(join(store, "att_orphan.png"), "orphan");
  await writeFile(join(store, "user-note.txt"), "do not delete");
  expect(
    await cleanupUnreferencedAttachments({
      workspaceRoot: root,
      attachments: [attachment!],
    }),
  ).toEqual(["att_orphan.png"]);
  expect(await Bun.file(join(store, "att_orphan.png")).exists()).toBe(false);
  expect(await Bun.file(join(store, "user-note.txt")).exists()).toBe(true);
});

test("local attachment store derives a private data URL from validated bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-attachment-data-url-"));
  await writeFile(
    join(root, "image.png"),
    Buffer.from("89504e470d0a1a0a", "hex"),
  );
  const [attachment] = await storeLocalAttachments({
    workspaceRoot: root,
    paths: ["image.png"],
  });
  expect(attachment).toBeDefined();
  expect(await attachmentDataURL(root, attachment!)).toMatch(
    /^data:image\/png;base64,/u,
  );
});

test("local attachment store recognizes PDF signatures", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-attachment-pdf-"));
  await writeFile(join(root, "report.pdf"), "%PDF-1.7\n");
  const [attachment] = await storeLocalAttachments({
    workspaceRoot: root,
    paths: ["report.pdf"],
  });
  expect(attachment?.mediaType).toBe("application/pdf");
});

test("local attachment store admits bounded UTF-8 text with a durable filename", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-attachment-text-"));
  await writeFile(join(root, "notes.md"), "# Notes\r\nhello\r\n");
  const [attachment] = await storeLocalAttachments({
    workspaceRoot: root,
    paths: ["notes.md"],
  });
  expect(attachment).toMatchObject({
    filename: "notes.md",
    mediaType: "text/plain",
  });
  expect(await attachmentText(root, attachment!)).toBe("# Notes\nhello\n");
});
