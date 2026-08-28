import { createNataliaNeuLightPlugin } from "@natalia/example-ui-web-plugin";
import {
  createConsoleLogger,
  createUiPluginHost,
  createWebTransport,
} from "@natalia/ui-host";
import { createWebRuntimeClient } from "./runtime-rpc";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root mount point");

const runtimeURL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_NATALIA_RUNTIME_URL ??
  "http://127.0.0.1:8790";

const runtime = createWebRuntimeClient({
  url: runtimeURL,
});

const host = await createUiPluginHost({
  root,
  runtime,
  transport: createWebTransport(),
  logger: createConsoleLogger("ui-web-shell"),
});

// Load the Neumorphism light UI plugin
await host.load(createNataliaNeuLightPlugin());
