import type { Plugin, PluginManifest } from "@natalia/plugin";
import { createPdfReadTool } from "./pdf-read";

export { createPdfReadTool, parsePageSelection } from "./pdf-read";

export const PDF_PLUGIN_ID = "natalia-tool-pdf";

export const PDF_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 1,
  id: PDF_PLUGIN_ID,
  version: "1.0.0",
  name: "PDF Tools",
  description: "PDF text extraction and multimodal document reading.",
  entry: "natalia:tool-pdf",
  capabilities: ["tools"],
  scope: "workspace",
  provides: [],
  requires: [],
};

export function createPdfPlugin(): Plugin {
  return {
    manifest: PDF_PLUGIN_MANIFEST,
    setup(api) {
      api.tools.register(createPdfReadTool());
    },
  };
}
