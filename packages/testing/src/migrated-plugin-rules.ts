export type MigratedPluginRule = {
  id: string;
  targets: readonly string[];
  forbidden: ReadonlyArray<{ description: string; pattern: RegExp }>;
};

export type MigratedPluginViolation = {
  pluginID: string;
  description: string;
};

export const migratedPluginRules: readonly MigratedPluginRule[] = [
  {
    id: "natalia-skills",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "legacy skills controller",
        pattern: /\bcreateSkillsController\b/u,
      },
      {
        description: "direct skills discovery",
        pattern: /\bdiscoverSkills\b/u,
      },
      {
        description: "direct skill tool construction",
        pattern: /\bcreateSkillLoadTool\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-pdf",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct PDF package import",
        pattern: /from\s+["']@natalia\/tool-pdf["']/u,
      },
      {
        description: "direct PDF factory construction",
        pattern: /\bcreatePdf(?:Plugin|ReadTool)\b/u,
      },
    ],
  },
];

export function findMigratedPluginViolations(
  path: string,
  text: string,
  rules: readonly MigratedPluginRule[] = migratedPluginRules,
): MigratedPluginViolation[] {
  const normalized = path.replaceAll("\\", "/");
  const violations: MigratedPluginViolation[] = [];
  for (const rule of rules) {
    if (!rule.targets.includes(normalized)) continue;
    for (const forbidden of rule.forbidden)
      if (forbidden.pattern.test(text))
        violations.push({
          pluginID: rule.id,
          description: forbidden.description,
        });
  }
  return violations;
}
