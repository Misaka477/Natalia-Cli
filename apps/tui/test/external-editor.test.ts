import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { editPromptExternally } from "../src/prompt/external-editor";
import { retainEditorMentions } from "../src/prompt/external-editor";

test("external editor writes and returns the edited prompt", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-external-editor-"));
  const editor = join(root, "editor.sh");
  await writeFile(editor, "#!/bin/sh\nprintf 'edited prompt\\n' > \"$1\"\n", {
    mode: 0o700,
  });
  expect(
    await editPromptExternally({ text: "draft", editor, tempRoot: root }),
  ).toBe("edited prompt\n");
  const entries = await Array.fromAsync(
    new Bun.Glob("natalia-edit-*").scan({
      cwd: root,
      onlyFiles: false,
    }),
  );
  expect(entries).toEqual([]);
  expect(await readFile(editor, "utf8")).toContain("edited prompt");
});

test("external editor requires a configured command", async () => {
  await expect(
    editPromptExternally({ text: "draft", env: {} }),
  ).rejects.toThrow("external editor is not configured");
});

test("external editor realignment drops deleted structured mentions", () => {
  expect(
    retainEditorMentions({
      text: "Keep @src/app.ts and @reviewer and @Keep",
      attachments: ["src/app.ts", "src/deleted.ts"],
      agents: ["reviewer", "deleted"],
      resources: [
        { server: "docs", uri: "docs://keep", name: "Keep" },
        { server: "docs", uri: "docs://deleted", name: "Deleted" },
      ],
    }),
  ).toEqual({
    attachments: ["src/app.ts"],
    agents: ["reviewer"],
    resources: [{ server: "docs", uri: "docs://keep", name: "Keep" }],
  });
});
