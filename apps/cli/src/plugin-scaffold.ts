import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { PLUGIN_API_VERSION } from "@natalia/plugin";
import cliPackage from "../package.json" with { type: "json" };

const pluginIDPattern = /^[a-z0-9][a-z0-9._-]*$/u;
const packageNamePattern =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;

export async function createPluginScaffold(input: {
  directory: string;
  pluginID: string;
  packageName?: string;
}) {
  if (!pluginIDPattern.test(input.pluginID))
    throw new Error("plugin id must match [a-z0-9][a-z0-9._-]*");
  const directory = resolve(input.directory);
  const packageName = input.packageName ?? basename(directory);
  if (!packageNamePattern.test(packageName))
    throw new Error(`invalid npm package name: ${packageName}`);
  if (await exists(directory))
    throw new Error(`plugin directory already exists: ${directory}`);

  const manifest = {
    apiVersion: PLUGIN_API_VERSION,
    id: input.pluginID,
    version: "1.0.0",
    name: title(input.pluginID),
    description: "A Natalia plugin.",
    entry: "src/index.js",
    scope: "workspace",
    provides: [],
    requires: [],
    optionalRequires: [],
    conflicts: [],
    dependencies: [],
    hooks: {},
    integrationPoints: ["commands"],
  } as const;
  const packageJSON = {
    name: packageName,
    version: manifest.version,
    type: "module",
    license: "Apache-2.0",
    files: ["src", "natalia.plugin.json"],
    exports: { ".": `./${manifest.entry}` },
    dependencies: { "@natalia/plugin": cliPackage.version },
  };

  await mkdir(resolve(directory, "src"), { recursive: true });
  await Promise.all([
    writeJSON(resolve(directory, "package.json"), packageJSON),
    writeJSON(resolve(directory, "natalia.plugin.json"), manifest),
    writeFile(
      resolve(directory, manifest.entry),
      pluginSource(manifest),
      "utf8",
    ),
  ]);
  return {
    created: true as const,
    directory,
    pluginID: input.pluginID,
    packageName,
  };
}

async function exists(path: string) {
  return await stat(path)
    .then(() => true)
    .catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    });
}

async function writeJSON(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function title(id: string) {
  return id
    .split(/[._-]/u)
    .filter(Boolean)
    .map((part) => `${part[0]!.toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function pluginSource(manifest: object) {
  return `import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: ${JSON.stringify(manifest, null, 2)},
  setup(api) {
    api.commands.register({
      name: "${(manifest as { id: string }).id}.hello",
      title: "Say hello",
      run() {
        return "Hello from ${(manifest as { id: string }).id}";
      },
    });
  },
});
`;
}
