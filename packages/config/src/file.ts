import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname } from "node:path";
import { configV2Schema, type ConfigV2 } from "@natalia/contracts";
import {
  migrateConfig,
  migrationSummaryText,
  type MigrationResult,
} from "./migration";
import { defaultConfigPath } from "./path";

export async function loadConfigFile(
  path = defaultConfigPath(),
): Promise<MigrationResult> {
  const raw = await readFile(path, "utf8");
  const data = parseConfigText(raw);
  return migrateConfig(data);
}

export async function saveConfigFile(
  config: ConfigV2,
  path = defaultConfigPath(),
) {
  const parsed = configV2Schema.parse(config);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, {
    mode: 0o600,
  });
}

export async function migrateConfigFile(
  path = defaultConfigPath(),
  now = new Date(),
) {
  const raw = await readFile(path, "utf8");
  const data = parseConfigText(raw);
  const result = migrateConfig(data);
  if (result.summary.fromVersion !== 2 || result.summary.changed.length) {
    const backupPath = `${path}.bak.${now.toISOString().replace(/[:.]/g, "-")}`;
    await copyFile(path, backupPath);
    result.summary.backupPath = backupPath;
    await saveConfigFile(result.config, path);
  }
  return { ...result, text: migrationSummaryText(result.summary) };
}

export function parseConfigText(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return parseLegacyYamlSubset(raw);
  }
}

function parseLegacyYamlSubset(raw: string) {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; value: Record<string, unknown> }> = [
    { indent: -1, value: root },
  ];
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.match(/^\s*/u)?.[0].length ?? 0;
    const match = line.trim().match(/^([^:]+):(.*)$/u);
    if (!match) continue;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent)
      stack.pop();
    const parent = stack[stack.length - 1].value;
    const key = match[1].trim();
    const rawValue = match[2].trim();
    if (!rawValue) {
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ indent, value: child });
      continue;
    }
    parent[key] = parseScalar(rawValue);
  }
  return root;
}

function parseScalar(value: string) {
  const unquoted = value.replace(/^['"]|['"]$/gu, "");
  if (/^-?\d+$/u.test(unquoted)) return Number(unquoted);
  if (unquoted === "true") return true;
  if (unquoted === "false") return false;
  if (unquoted === "null") return null;
  return unquoted;
}
