import { expect, test } from "bun:test";
import {
  findMigratedPluginViolations,
  type MigratedPluginRule,
} from "../src/migrated-plugin-rules";

const target = "packages/client/src/real-runtime.ts";

test("migrated plugin rules retain built-in plugin protections", () => {
  for (const [pluginID, source] of [
    ["natalia-skills", "createSkillsController()"],
    ["natalia-skills", "discoverSkills()"],
    ["natalia-skills", "createSkillLoadTool()"],
    ["natalia-tool-pdf", 'import { x } from "@natalia/tool-pdf"'],
    ["natalia-tool-pdf", "createPdfPlugin()"],
    ["natalia-tool-ask", 'import { askTools } from "@natalia/tool-ask"'],
    ["natalia-tool-todo", 'import { todoTools } from "@natalia/tool-todo"'],
    [
      "natalia-tool-search",
      'import { searchTools } from "@natalia/tool-search"',
    ],
    [
      "natalia-tool-fs-read",
      'import { readFileTools } from "@natalia/tool-fs-read"',
    ],
    [
      "natalia-tool-fs-write",
      'import { writeFileTools } from "@natalia/tool-fs-write"',
    ],
    ["natalia-tool-web", 'import { webTools } from "@natalia/tool-web"'],
    ["natalia-tool-shell", 'import { shellTools } from "@natalia/tool-shell"'],
    ["natalia-tool-agent", 'import { agentTools } from "@natalia/tool-agent"'],
    [
      "natalia-tool-terminal",
      'import { terminalTools } from "@natalia/tool-terminal"',
    ],
    [
      "natalia-tool-sandbox",
      'import { sandboxTools } from "@natalia/tool-sandbox"',
    ],
    [
      "natalia-tool-process",
      'import { managedProcessTools } from "@natalia/tool-process"',
    ],
    ["natalia-task-module", "taskModuleTools(context)"],
  ])
    expect(findMigratedPluginViolations(target, source)).toContainEqual(
      expect.objectContaining({ pluginID }),
    );
});

test("tool migrations protect the legacy static capability root", () => {
  for (const [pluginID, source] of [
    ["natalia-tool-ask", "askToolFamily()"],
    ["natalia-tool-todo", "todoToolFamily()"],
    ["natalia-tool-search", "searchToolFamily()"],
    ["natalia-tool-fs-read", "fsReadToolFamily()"],
    ["natalia-tool-fs-write", "fsWriteToolFamily()"],
    ["natalia-tool-web", "webToolFamily()"],
    ["natalia-tool-shell", "shellToolFamily()"],
    ["natalia-tool-agent", "agentToolFamily()"],
    ["natalia-tool-terminal", "terminalToolFamily()"],
    ["natalia-tool-sandbox", "sandboxToolFamily()"],
    ["natalia-tool-process", "processToolFamily()"],
  ])
    expect(
      findMigratedPluginViolations(
        "packages/client/src/capabilities/tool-family-capabilities.ts",
        source,
      ),
    ).toEqual([expect.objectContaining({ pluginID })]);
});

test("migrated plugin rules only protect declared composition roots", () => {
  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createPdfPlugin } from "@natalia/tool-pdf"',
    ),
  ).toEqual([]);
  expect(
    findMigratedPluginViolations(
      target,
      "builtinPluginCatalog(); entry.create()",
    ),
  ).toEqual([]);
  expect(
    findMigratedPluginViolations(
      "packages\\client\\src\\real-runtime.ts",
      "createPdfReadTool()",
    ),
  ).toEqual([expect.objectContaining({ pluginID: "natalia-tool-pdf" })]);
});

test("migrated plugin matcher accepts new declarative rules", () => {
  const rules: MigratedPluginRule[] = [
    {
      id: "natalia-example",
      targets: [target],
      forbidden: [
        { description: "direct construction", pattern: /createExample/u },
      ],
    },
  ];
  expect(
    findMigratedPluginViolations(target, "createExample()", rules),
  ).toEqual([
    { pluginID: "natalia-example", description: "direct construction" },
  ]);
});
