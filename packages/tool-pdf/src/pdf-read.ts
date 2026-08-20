import {
  optionalInteger,
  optionalString,
  requireObject,
  requireString,
  workspacePath,
  type RuntimeTool,
} from "@natalia/tools";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

const DEFAULT_MAX_CHARS = 60_000;
const TEXT_THRESHOLD = 50;
const MAX_PIXEL_DIMENSION = 4096;
const VISION_SCALE = 200 / 72;

let pdfRuntimePromise:
  | Promise<{
      canvas: typeof import("@napi-rs/canvas");
      pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
    }>
  | undefined;

type PdfMode = "auto" | "text" | "vision";
type PageResult = { page: number; mode: "text" | "vision"; text: string };

function loadPdfRuntime() {
  return (pdfRuntimePromise ??= (async () => {
    const canvas = await import("@napi-rs/canvas");
    const globals = globalThis as Record<string, unknown>;
    globals.DOMMatrix ??= canvas.DOMMatrix;
    globals.Path2D ??= canvas.Path2D;
    globals.ImageData ??= canvas.ImageData;
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    return { canvas, pdfjs };
  })());
}

function parseMode(value: unknown): PdfMode {
  const mode = optionalString(value) ?? "auto";
  if (mode !== "auto" && mode !== "text" && mode !== "vision")
    throw new Error("mode must be one of: auto, text, vision");
  return mode;
}

export function parsePageSelection(value: unknown, pageCount: number) {
  let pages: number[];
  if (value === undefined)
    pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  else if (Array.isArray(value)) {
    if (!value.every((page) => Number.isInteger(page)))
      throw new Error("pages must contain integers");
    pages = value as number[];
  } else if (typeof value === "string") {
    pages = [];
    for (const part of value.split(",")) {
      const item = part.trim();
      const range = /^(\d+)-(\d+)$/u.exec(item);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        if (start > end) throw new Error(`invalid page range: ${item}`);
        for (let page = start; page <= end; page += 1) pages.push(page);
      } else if (/^\d+$/u.test(item)) pages.push(Number(item));
      else throw new Error(`invalid page selection: ${item}`);
    }
  } else
    throw new Error("pages must be a range string or an array of integers");

  pages = [...new Set(pages)];
  if (!pages.length) throw new Error("pages must select at least one page");
  for (const page of pages)
    if (page < 1 || page > pageCount)
      throw new Error(
        `PDF page is out of range: ${page} (document has ${pageCount})`,
      );
  return pages;
}

function textFromPage(items: Array<unknown>) {
  let output = "";
  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const text = String(item.str);
    if (!text) continue;
    output += text;
    output += "hasEOL" in item && item.hasEOL ? "\n" : " ";
  }
  return output
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

async function renderPage(
  page: PDFPageProxy,
  canvasModule: typeof import("@napi-rs/canvas"),
) {
  const base = page.getViewport({ scale: VISION_SCALE });
  const scale = Math.min(
    VISION_SCALE,
    VISION_SCALE * (MAX_PIXEL_DIMENSION / Math.max(base.width, base.height)),
  );
  const viewport = page.getViewport({ scale });
  const canvas = canvasModule.createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    viewport,
  }).promise;
  return canvas.toBuffer("image/png");
}

function formatOutput(
  results: PageResult[],
  maxChars: number,
  options: {
    requestedMode: PdfMode;
    visualDelivery: "none" | "original_pdf" | "page_images";
  },
) {
  const modes = results
    .map((result) => `${result.page}:${result.mode}`)
    .join(",");
  const contentChars = results.reduce(
    (sum, result) => sum + result.text.length,
    0,
  );
  const visionNote =
    options.requestedMode === "auto" &&
    results.some((result) => result.mode === "vision")
      ? `\nvision_note=auto selected vision when extracted text was under ${TEXT_THRESHOLD} characters; this alone does not prove the page is scanned`
      : "";
  const header =
    `pages=${results.length}, modes=${modes || "none"}, total_chars=${contentChars}, ` +
    `requested_mode=${options.requestedMode}, visual_delivery=${options.visualDelivery}, local_ocr=false` +
    visionNote;
  let output = header;
  let included = 0;
  for (const result of results) {
    const block = `\n--- Page ${result.page} ---\n${result.text}`;
    if (output.length + block.length > maxChars) break;
    output += block;
    included += 1;
  }
  if (included < results.length)
    output += `\n\n... truncated at page boundary; ${results.length - included} page(s) omitted ...`;
  return output;
}

export function createPdfReadTool(): RuntimeTool {
  return {
    name: "pdf_read",
    description:
      "Read every selected page of a PDF inside the workspace without local OCR. Embedded text is extracted locally; pages with little extractable text are delivered to the current multimodal model as page images, or as the original PDF when the complete document is selected and native PDF input is available. All pages are selected by default.",
    requiresApproval: false,
    timeoutSec: 900,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        pages: {
          anyOf: [
            { type: "string" },
            { type: "array", items: { type: "integer", minimum: 1 } },
          ],
        },
        mode: { type: "string", enum: ["auto", "text", "vision"] },
        maxChars: { type: "integer", minimum: 1 },
      },
      required: ["path"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: { content: { type: "string" } },
        required: ["content"],
        additionalProperties: false,
      },
      presentCall(args) {
        const path = requireObject(args).path;
        return {
          kind: "read",
          title: typeof path === "string" ? path : "PDF",
          summary: "read PDF",
        };
      },
      presentResult(args, value) {
        const path = requireObject(args).path;
        const pages = /^pages=(\d+)/u.exec(value)?.[1];
        return {
          kind: "read",
          title: typeof path === "string" ? path : "PDF",
          summary: `${pages ?? "?"} pages, ${value.length.toLocaleString()} chars`,
          body: value,
        };
      },
    },
    async execute(raw, context) {
      const args = requireObject(raw);
      const suppliedPath = requireString(args.path, "path");
      const path = workspacePath(context.workspaceRoot, suppliedPath);
      await context.workspaceReadAuthorize?.({
        toolName: "pdf_read",
        paths: [relative(context.workspaceRoot, path)],
      });
      const mode = parseMode(args.mode);
      const maxChars =
        optionalInteger(args.maxChars, "maxChars") ?? DEFAULT_MAX_CHARS;
      if (maxChars < 1) throw new Error("maxChars must be a positive integer");
      context.signal?.throwIfAborted();

      const bytes = await readFile(path);
      const { canvas, pdfjs } = await loadPdfRuntime();
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(bytes),
        useWorkerFetch: false,
      });
      let document;
      try {
        document = await loadingTask.promise;
      } catch (error) {
        throw new Error(`unable to open PDF: ${suppliedPath}`, {
          cause: error,
        });
      }
      try {
        const pages = parsePageSelection(args.pages, document.numPages);
        const results: PageResult[] = [];
        const visionPages: Array<{ page: number; image: Buffer }> = [];
        let hasVisionPages = false;
        const attachPdf = context.attachPdf;
        const attachWholePdf =
          attachPdf &&
          pages.length === document.numPages &&
          pages.every((page, index) => page === index + 1);
        for (const pageNumber of pages) {
          context.signal?.throwIfAborted();
          const page = await document.getPage(pageNumber);
          try {
            const content = await page.getTextContent();
            const embedded = textFromPage(content.items);
            const useVision =
              mode === "vision" ||
              (mode === "auto" && embedded.length < TEXT_THRESHOLD);
            if (!useVision) {
              results.push({
                page: pageNumber,
                mode: "text",
                text: embedded,
              });
              continue;
            }
            results.push({
              page: pageNumber,
              mode: "vision",
              text: attachWholePdf
                ? "[Page available in the attached original PDF for multimodal reading]"
                : "[Page image attached for multimodal reading]",
            });
            hasVisionPages = true;
            if (!attachWholePdf) {
              if (!context.attachImage)
                throw new Error(
                  "visual PDF pages require a model with PDF or image input capability",
                );
              visionPages.push({
                page: pageNumber,
                image: await renderPage(page, canvas),
              });
            }
          } finally {
            page.cleanup();
          }
        }
        if (hasVisionPages) {
          if (attachWholePdf) {
            await attachPdf(path);
          } else {
            const attachImage = context.attachImage!;
            const directory = await mkdtemp(join(tmpdir(), "natalia-pdf-"));
            try {
              for (const item of visionPages) {
                const imagePath = join(directory, `page-${item.page}.png`);
                await writeFile(imagePath, item.image);
                await attachImage(imagePath);
              }
            } finally {
              await rm(directory, { recursive: true, force: true });
            }
          }
        }
        return formatOutput(results, maxChars, {
          requestedMode: mode,
          visualDelivery: hasVisionPages
            ? attachWholePdf
              ? "original_pdf"
              : "page_images"
            : "none",
        });
      } finally {
        await document.cleanup();
        await loadingTask.destroy();
      }
    },
  };
}
