import { createNataliaNeuPlugin } from "@natalia/plugin-web-ui";
import { UI_PLUGIN_REGISTRY } from "./ui-plugin-registry";
import {
  createConsoleLogger,
  createUiPluginHost,
  createWebTransport,
} from "@natalia/ui-host";
import { createWebRuntimeClient } from "./runtime-rpc";
import { createLocalPreferenceStore } from "./local-preferences";
import { loadPluginUiBundles } from "./plugin-ui-loader";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root mount point");

const electron = (globalThis as {
  electron?: { runtimeInfo?: () => Promise<{ url?: string; token?: string }> };
}).electron;
const injected = electron?.runtimeInfo ? await electron.runtimeInfo() : undefined;
const runtimeURL =
  injected?.url ||
  (import.meta as { env?: Record<string, string> }).env?.VITE_NATALIA_RUNTIME_URL ||
  "http://127.0.0.1:8790";

const runtime = createWebRuntimeClient({
  url: runtimeURL,
});

const host = await createUiPluginHost({
  root,
  runtime,
  transport: createWebTransport(),
  logger: createConsoleLogger("ui-web-shell"),
  extra: { uiPluginRegistry: UI_PLUGIN_REGISTRY, runtimeURL },
  preferences: createLocalPreferenceStore(),
});

// Optional UI panel plugins are loaded first so the main UI can see them.
for (const entry of UI_PLUGIN_REGISTRY) {
  await host.load(entry.create());
}

// Load renderer-side UI bundles contributed by installed/enabled plugins.
// This is the unified path for official and third-party feature UI.
await loadPluginUiBundles(host, runtime, runtimeURL, injected?.token);

// Load the Neumorphism dark UI plugin
await host.load(createNataliaNeuPlugin());
