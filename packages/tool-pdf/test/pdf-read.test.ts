import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createToolRegistry } from "@natalia/tools";
import { createPluginRegistry } from "@natalia/plugin";
import {
  createPdfPlugin,
  createPdfReadTool,
  parsePageSelection,
  PDF_PLUGIN_ID,
} from "../src";

function pagesPdf(texts: string[]) {
  const pageStart = 3;
  const contentStart = pageStart + texts.length;
  const font = contentStart + texts.length;
  const streams = texts.map((text) => {
    const escaped = text
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)");
    return `BT /F1 18 Tf 72 720 Td (${escaped}) Tj ET`;
  });
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${texts.map((_, index) => `${pageStart + index} 0 R`).join(" ")}] /Count ${texts.length} >>`,
    ...texts.map(
      (_, index) =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentStart + index} 0 R >>`,
    ),
    ...streams.map(
      (stream) =>
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return output;
}

function textPdf(text: string) {
  return pagesPdf([text]);
}

async function fixture(name: string, content: string) {
  const root = await mkdtemp(join(tmpdir(), "natalia-pdf-"));
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs", name), content);
  return root;
}

test("pdf_read extracts a digital PDF without attaching it", async () => {
  const digitalText =
    "Natalia PDF text layer contains enough embedded text to remain on the fast local extraction path.";
  const root = await fixture("digital.pdf", textPdf(digitalText));
  const tool = createPdfReadTool();
  let attached = false;
  const authorized: string[] = [];
  const result = await tool.execute(
    { path: "docs/digital.pdf", mode: "auto" },
    {
      workspaceRoot: root,
      async workspaceReadAuthorize(input) {
        authorized.push(...input.paths);
      },
      async attachPdf() {
        attached = true;
      },
    },
  );
  expect(result).toContain("pages=1, modes=1:text");
  expect(result).toContain("visual_delivery=none, local_ocr=false");
  expect(result).toContain(
    "Natalia PDF text layer contains enough embedded text",
  );
  expect(attached).toBe(false);
  expect(authorized).toEqual(["docs/digital.pdf"]);
});

test("pdf_read attaches the complete PDF for native model reading", async () => {
  const root = await fixture("scan.pdf", textPdf("tiny"));
  const attached: string[] = [];
  const result = await createPdfReadTool().execute(
    { path: "docs/scan.pdf", mode: "vision" },
    {
      workspaceRoot: root,
      async attachPdf(path) {
        attached.push(path);
      },
    },
  );
  expect(result).toContain("modes=1:vision");
  expect(result).toContain("visual_delivery=original_pdf, local_ocr=false");
  expect(result).toContain("Page available in the attached original PDF");
  expect(attached).toEqual([join(root, "docs", "scan.pdf")]);
});

test("pdf_read attaches every selected scan page when native PDF input is unavailable", async () => {
  const root = await fixture(
    "long-scan.pdf",
    pagesPdf(Array.from({ length: 10 }, (_, index) => `p${index + 1}`)),
  );
  const images: Array<{ path: string; size: number }> = [];
  const complete = await createPdfReadTool().execute(
    { path: "docs/long-scan.pdf", mode: "auto" },
    {
      workspaceRoot: root,
      async attachImage(path) {
        images.push({
          path,
          size: (await Bun.file(path).arrayBuffer()).byteLength,
        });
      },
    },
  );
  expect(images).toHaveLength(10);
  expect(images.every((image) => image.size > 100)).toBe(true);
  expect(complete).toContain("pages=10, modes=");
  expect(complete).toContain("visual_delivery=page_images, local_ocr=false");
  expect(complete).toContain(
    "auto selected vision when extracted text was under 50 characters",
  );
  expect(complete).toContain("does not prove the page is scanned");
  expect(complete).toContain("--- Page 10 ---");

  images.length = 0;
  const explicit = await createPdfReadTool().execute(
    { path: "docs/long-scan.pdf", pages: "2-4", mode: "auto" },
    {
      workspaceRoot: root,
      async attachImage(path) {
        images.push({
          path,
          size: (await Bun.file(path).arrayBuffer()).byteLength,
        });
      },
    },
  );
  expect(images).toHaveLength(3);
  expect(explicit).toContain("pages=3, modes=2:vision,3:vision,4:vision");
});

test("pdf_read enforces workspace and page boundaries", async () => {
  const root = await fixture("digital.pdf", textPdf("content"));
  const tool = createPdfReadTool();
  await expect(
    tool.execute({ path: "../outside.pdf" }, { workspaceRoot: root }),
  ).rejects.toThrow("path escapes workspace");
  await expect(
    tool.execute(
      { path: "docs/digital.pdf", pages: "2" },
      { workspaceRoot: root },
    ),
  ).rejects.toThrow("out of range");
  expect(parsePageSelection("1-100", 100)).toHaveLength(100);
});

test("pdf_read truncates only at page boundaries", async () => {
  const root = await fixture("digital.pdf", textPdf("boundary text"));
  const result = await createPdfReadTool().execute(
    { path: "docs/digital.pdf", mode: "text", maxChars: 20 },
    { workspaceRoot: root },
  );
  expect(result).not.toContain("--- Page 1 ---");
  expect(result).toContain("truncated at page boundary");
});

test("the PDF built-in plugin owns and releases its stable tool name", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools });
  await registry.loadBuiltin(createPdfPlugin());
  expect(registry.list().map((plugin) => plugin.id)).toEqual([PDF_PLUGIN_ID]);
  expect(tools.has("pdf_read")).toBe(true);
  expect(tools.has("plugin_natalia_tool_pdf_pdf_read")).toBe(false);
  await registry.unload(PDF_PLUGIN_ID);
  expect(tools.has("pdf_read")).toBe(false);
});
