import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import solid from "vite-plugin-solid";

const root = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(root, "../../..");
const pluginSrc = resolve(workspace, "packages/examples/ui-web-plugin/src");
const solidJs = resolve(root, "node_modules/solid-js");

function solidJsxSource(): Plugin {
  const pragma = "/** @jsxImportSource solid-js */\n";
  return {
    name: "natalia-solid-jsx-source",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0] ?? id;
      if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) return;
      if (!file.startsWith(pluginSrc) && !file.startsWith(resolve(root, "src")))
        return;
      if (code.includes("@jsxImportSource")) return;
      return { code: pragma + code, map: null };
    },
  };
}

export default defineConfig({
  plugins: [
    solidJsxSource(),
    solid({
      include: [
        `${pluginSrc}/**/*.{js,ts,jsx,tsx}`,
        `${root}/src/**/*.{js,ts,jsx,tsx}`,
      ],
    }),
  ],
  resolve: {
    dedupe: ["solid-js", "solid-js/web"],
    alias: {
      "solid-js/web": resolve(solidJs, "web"),
      "solid-js": solidJs,
      "@natalia/transport": resolve(workspace, "packages/hosts/transport/src/rpc-client.ts"),
    },
  },
  esbuild: { jsx: "automatic", jsxImportSource: "solid-js" },
  optimizeDeps: {
    esbuildOptions: {
      jsx: "automatic",
      jsxImportSource: "solid-js",
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: { allow: [workspace] },
  },
});
