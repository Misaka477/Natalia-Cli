import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { PLUGIN_API_VERSION } from "@natalia/plugin";
import cliPackage from "../package.json" with { type: "json" };

const pluginIDPattern = /^[a-z0-9][a-z0-9._-]*$/u;
const packageNamePattern =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const templates = ["command", "tool", "ui"] as const;
const languages = ["js", "ts"] as const;

export type PluginScaffoldTemplate = (typeof templates)[number];
export type PluginScaffoldLanguage = (typeof languages)[number];

export async function createPluginScaffold(input: {
  directory: string;
  pluginID: string;
  packageName?: string;
  template?: PluginScaffoldTemplate;
  language?: PluginScaffoldLanguage;
}) {
  if (!pluginIDPattern.test(input.pluginID))
    throw new Error("plugin id must match [a-z0-9][a-z0-9._-]*");
  const directory = resolve(input.directory);
  const packageName = input.packageName ?? basename(directory);
  if (!packageNamePattern.test(packageName))
    throw new Error(`invalid npm package name: ${packageName}`);
  if (await exists(directory))
    throw new Error(`plugin directory already exists: ${directory}`);
  const template = input.template ?? "command";
  const language = input.language ?? "js";
  if (!templates.includes(template))
    throw new Error(`plugin create --template must be ${templates.join(", ")}`);
  if (!languages.includes(language))
    throw new Error(
      `plugin create --language must be ${languages.join(" or ")}`,
    );

  const kind = adapterKind(input.pluginID);
  const commandName = `${input.pluginID}.hello`;
  const toolName = toolNameFor(input.pluginID);
  const integrationPoints =
    template === "ui"
      ? (["adapters"] as const)
      : template === "tool"
        ? (["tools"] as const)
        : (["commands"] as const);
  const dependencies: Record<string, string> = {
    "@natalia/plugin": cliPackage.version,
  };
  if (template === "ui")
    dependencies["@natalia/contracts"] = cliPackage.version;
  const manifest = {
    apiVersion: PLUGIN_API_VERSION,
    id: input.pluginID,
    version: "1.0.0",
    name: title(input.pluginID),
    description:
      template === "ui"
        ? "A Natalia UI adapter plugin."
        : template === "tool"
          ? "A Natalia tool plugin."
          : "A Natalia plugin.",
    entry: "src/index.js",
    scope: template === "ui" ? "process" : "workspace",
    provides: [],
    requires: [],
    optionalRequires: [],
    conflicts: [],
    dependencies: [],
    hooks: {},
    integrationPoints,
  } as const;
  const packageJSON = {
    name: packageName,
    version: manifest.version,
    type: "module",
    license: "Apache-2.0",
    files:
      language === "ts"
        ? ["src/index.js", "src/index.ts", "natalia.plugin.json"]
        : ["src", "natalia.plugin.json"],
    exports: { ".": `./${manifest.entry}` },
    dependencies,
  };
  const sourceInput = {
    manifest,
    template,
    commandName,
    toolName,
    kind,
  };

  await mkdir(resolve(directory, "src"), { recursive: true });
  const writes = [
    writeJSON(resolve(directory, "package.json"), packageJSON),
    writeJSON(resolve(directory, "natalia.plugin.json"), manifest),
    writeFile(
      resolve(directory, "src/index.js"),
      pluginSource(sourceInput, "js"),
      "utf8",
    ),
  ];
  if (language === "ts")
    writes.push(
      writeFile(
        resolve(directory, "src/index.ts"),
        pluginSource(sourceInput, "ts"),
        "utf8",
      ),
    );
  await Promise.all(writes);
  return {
    created: true as const,
    directory,
    pluginID: input.pluginID,
    packageName,
    template,
    language,
    entry: manifest.entry,
    ...(template === "ui" ? { kind } : {}),
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

function adapterKind(pluginID: string) {
  return pluginID.startsWith("ui.") ? pluginID : `ui.${pluginID}`;
}

function toolNameFor(pluginID: string) {
  const leaf = pluginID.split(".").at(-1) ?? pluginID;
  return leaf.replaceAll("-", "_");
}

function pluginSource(
  input: {
    manifest: object;
    template: PluginScaffoldTemplate;
    commandName: string;
    toolName: string;
    kind: string;
  },
  language: PluginScaffoldLanguage,
) {
  const manifest = JSON.stringify(input.manifest, null, 2);
  if (input.template === "ui") {
    const header =
      language === "ts"
        ? `import type { RuntimeEvent } from "@natalia/contracts";
import { definePlugin } from "@natalia/plugin";
`
        : `import { definePlugin } from "@natalia/plugin";
`;
    const unsubscribe =
      language === "ts"
        ? "let unsubscribe: (() => void) | undefined;"
        : "let unsubscribe;";
    const eventType = language === "ts" ? "(event: RuntimeEvent)" : "(event)";
    return `${header}
export default definePlugin({
  manifest: ${manifest},
  setup(api) {
    ${unsubscribe}
    api.adapters.registerUi({
      kind: ${JSON.stringify(input.kind)},
      async mount(input) {
        const commands = await input.commands.list();
        console.log("ready commands=" + commands.length);
        unsubscribe = input.events.subscribe(${eventType} => {
          console.log("event " + event.type);
        });
      },
      dispose() {
        unsubscribe?.();
        unsubscribe = undefined;
      },
    });
  },
});
`;
  }
  if (input.template === "tool") {
    const header = `import { definePlugin } from "@natalia/plugin";
`;
    const executeArg = language === "ts" ? "input: { text: string }" : "input";
    return `${header}
export default definePlugin({
  manifest: ${manifest},
  setup(api) {
    api.tools.register({
      name: ${JSON.stringify(input.toolName)},
      description: "Echo the input.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
        additionalProperties: false,
      },
      async execute(${executeArg}) {
        return input.text;
      },
    });
  },
});
`;
  }
  return `import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: ${manifest},
  setup(api) {
    api.commands.register({
      name: ${JSON.stringify(input.commandName)},
      title: "Say hello",
      run() {
        return ${JSON.stringify(`Hello from ${(input.manifest as { id: string }).id}`)};
      },
    });
  },
});
`;
}
