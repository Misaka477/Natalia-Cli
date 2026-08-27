import { createExampleWebUiPlugin } from "@natalia/example-ui-web-plugin";
import {
  createConsoleLogger,
  createUiPluginHost,
  createWebTransport,
  type UiPluginHost,
} from "@natalia/ui-host";
import { createWebWorkerRuntime } from "./runtime";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root mount point");

const runtime = createWebWorkerRuntime();
const host: UiPluginHost = await createUiPluginHost({
  root,
  runtime,
  transport: createWebTransport(),
  logger: createConsoleLogger("ui-web-shell"),
});

let loaded = false;

async function load() {
  if (loaded) return;
  await host.load(createExampleWebUiPlugin());
  loaded = true;
}

async function unload() {
  if (!loaded) return;
  await host.unload("natalia.ui.web.example");
  loaded = false;
}

document.getElementById("load")?.addEventListener("click", () => {
  void load();
});
document.getElementById("unload")?.addEventListener("click", () => {
  void unload();
});

await load();
