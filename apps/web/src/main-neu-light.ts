import { createNataliaNeuLightPlugin } from "@natalia/plugin-web-ui";
import { UI_PLUGIN_REGISTRY } from "./ui-plugin-registry";
import {
  createConsoleLogger,
  createUiPluginHost,
  createWebTransport,
} from "@natalia/ui-host";
import { createWebRuntimeClient } from "./runtime-rpc";
import { createLocalPreferenceStore } from "./local-preferences";
import { loadPluginUiBundles, syncPluginUiBundles } from "./plugin-ui-loader";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root mount point");
const startupStart = performance.now();

const electron = (
  globalThis as {
    electron?: {
      runtimeInfo?: () => Promise<{ url?: string; token?: string }>;
    };
  }
).electron;
const injected = electron?.runtimeInfo
  ? await electron.runtimeInfo()
  : undefined;
const runtimeURL =
  injected?.url ||
  (import.meta as { env?: Record<string, string> }).env
    ?.VITE_NATALIA_RUNTIME_URL ||
  "http://127.0.0.1:8790";

const runtime = createWebRuntimeClient({
  url: runtimeURL,
});
console.log(
  `[startup] runtime client +${(performance.now() - startupStart).toFixed(1)}ms`,
);

const host = await createUiPluginHost({
  root,
  runtime,
  transport: createWebTransport(),
  logger: createConsoleLogger("ui-web-shell"),
  extra: {
    uiPluginRegistry: UI_PLUGIN_REGISTRY,
    runtimeURL,
    token: injected?.token,
    syncPluginUiBundles: () =>
      syncPluginUiBundles(host, runtime, runtimeURL, injected?.token),
  },
  preferences: createLocalPreferenceStore(),
});
console.log(
  `[startup] ui host +${(performance.now() - startupStart).toFixed(1)}ms`,
);

// Optional UI panel plugins are loaded first so the main UI can see them.
for (const entry of UI_PLUGIN_REGISTRY) {
  await host.load(entry.create());
}

// Load renderer-side UI bundles contributed by installed/enabled plugins.
// This is the unified path for official and third-party feature UI.
await loadPluginUiBundles(host, runtime, runtimeURL, injected?.token);
console.log(
  `[startup] plugin ui bundles +${(performance.now() - startupStart).toFixed(1)}ms`,
);

// Load the Neumorphism light UI plugin
await host.load(createNataliaNeuLightPlugin());
console.log(
  `[startup] main ui loaded +${(performance.now() - startupStart).toFixed(1)}ms`,
);
