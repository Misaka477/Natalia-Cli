import { z } from "zod";

export const outputTokenLimitSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .optional();

export const timeoutSchema = z.object({
  requestSec: z.number().int().positive().default(120),
  streamIdleSec: z.number().int().positive().default(120),
  toolSec: z.number().int().positive().optional(),
  turnSec: z.number().int().positive().nullable().default(null),
});

export const runtimeConfigSchema = z.object({
  maxStepsPerTurn: z.number().int().positive().default(1000),
  timeouts: timeoutSchema.default({}),
  maxAttemptsPerStep: z.number().int().positive().default(3),
  retry: z
    .object({
      maxAttemptsPerStep: z.number().int().positive().default(3),
      initialBackoffMs: z.number().int().positive().default(300),
      maxBackoffMs: z.number().int().positive().default(5000),
      jitterMs: z.number().int().min(0).default(500),
    })
    .default({}),
});

export const contextConfigSchema = z.object({
  autoDetectWindow: z.boolean().default(true),
  compactionEnabled: z.boolean().default(true),
  compactionThresholdPercent: z.number().int().min(50).max(99).default(85),
  reservedOutputTokens: z
    .union([z.literal("auto"), z.number().int().positive()])
    .default("auto"),
  preservedRecentMessages: z.number().int().min(0).default(2),
});

export const modelConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  contextWindow: z
    .union([z.literal("auto"), z.number().int().positive()])
    .default("auto"),
  maxOutputTokens: outputTokenLimitSchema,
});

export const providerConfigSchema = z.object({
  type: z.string().min(1),
  baseURL: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  requireOutputLimit: z.boolean().optional(),
});

export const configV2Schema = z.object({
  version: z.literal(2),
  runtime: runtimeConfigSchema.default({}),
  context: contextConfigSchema.default({}),
  models: z.record(modelConfigSchema).default({}),
  defaultModel: z.string().default("default"),
  providers: z.record(providerConfigSchema).default({}),
});

export type ConfigV2 = z.infer<typeof configV2Schema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
