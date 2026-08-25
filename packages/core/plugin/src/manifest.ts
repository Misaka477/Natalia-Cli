import { z } from "zod";
import type {
  PluginPackageConfig,
  PluginPackageSource,
} from "@natalia/contracts";

export const PLUGIN_API_VERSION = 2;

export const pluginScopeSchema = z.enum(["process", "workspace", "session"]);

const pluginIDSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/u);
const versionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/iu);

export const pluginManifestV1Schema = z.object({
  apiVersion: z.literal(1),
  id: pluginIDSchema,
  version: versionSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  entry: z.string().default("index.ts"),
  capabilities: z.array(z.enum(["tools", "events", "commands"])).default([]),
  scope: pluginScopeSchema.default("session"),
  provides: z.array(z.string()).default([]),
  requires: z.array(z.string()).default([]),
});

export const pluginIntegrationPointSchema = z.enum([
  "tools",
  "commands",
  "events",
  "services",
  "resources",
  "projections",
  "workflows",
  "settingsSchema",
  "adapters",
  "schedulerJobs",
]);

export const pluginDependencySchema = z.object({
  id: pluginIDSchema,
  spec: z.string().min(1),
  optional: z.boolean().default(false),
  peer: z.boolean().default(false),
});

export const pluginLifecycleHooksSchema = z
  .object({
    preInstall: z.string().min(1).optional(),
    postInstall: z.string().min(1).optional(),
    preUninstall: z.string().min(1).optional(),
    postUninstall: z.string().min(1).optional(),
  })
  .default({});

export const pluginManifestV2Schema = z.object({
  apiVersion: z.literal(PLUGIN_API_VERSION),
  id: pluginIDSchema,
  version: versionSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  entry: z.string().default("index.ts"),
  scope: pluginScopeSchema.default("session"),
  provides: z.array(z.string()).default([]),
  requires: z.array(z.string()).default([]),
  optionalRequires: z.array(z.string()).default([]),
  conflicts: z.array(pluginIDSchema).default([]),
  dependencies: z.array(pluginDependencySchema).default([]),
  hooks: pluginLifecycleHooksSchema,
  integrationPoints: z.array(pluginIntegrationPointSchema).default([]),
});

export const pluginManifestSchema = z.discriminatedUnion("apiVersion", [
  pluginManifestV1Schema,
  pluginManifestV2Schema,
]);

export type PluginManifestV1 = z.infer<typeof pluginManifestV1Schema>;
export type PluginManifestV2 = z.infer<typeof pluginManifestV2Schema>;
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginIntegrationPoint = z.infer<
  typeof pluginIntegrationPointSchema
>;

export type { PluginPackageSource } from "@natalia/contracts";

export type PluginInstallationMetadata = {
  id: string;
  source: PluginPackageSource;
  resolvedVersion: string;
  integrity?: string;
  signature?: string;
  scope: "process" | "workspace" | "session";
  dependencies: Array<{
    id: string;
    resolvedVersion: string;
    optional?: boolean;
    peer?: boolean;
  }>;
};

export type InstalledPluginPackage = PluginPackageConfig;

export function manifestIntegrationPoints(
  manifest: PluginManifest,
): PluginIntegrationPoint[] {
  if (manifest.apiVersion === 2) return manifest.integrationPoints;
  return [
    ...manifest.capabilities,
    ...(manifest.provides.length ? (["services"] as const) : []),
  ];
}
