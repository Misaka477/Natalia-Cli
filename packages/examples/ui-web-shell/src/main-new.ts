import { createNataliaWebUiPlugin } from "@natalia/example-ui-web-plugin";
import {
  createConsoleLogger,
  createUiPluginHost,
  createWebTransport,
} from "@natalia/ui-host";
import { createWebWorkerRuntime } from "./runtime";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root mount point");

const host = await createUiPluginHost({
  root,
  runtime: createWebWorkerRuntime(),
  transport: createWebTransport(),
  logger: createConsoleLogger("ui-web-shell"),
});

// Load the new Phase 1 UI
await host.load(createNataliaWebUiPlugin());
