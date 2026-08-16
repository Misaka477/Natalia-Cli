# Natalia Config Reference — v1

> This document describes the shape of `.natalia/config.json`: the type,
> optionality and default of every field. The validator is `configV2Schema`
> (`packages/contracts/src/schemas.ts`); the table below is generated from
> that schema, so it cannot drift from the code.
>
> Config is written and applied through `updateConfig` (`config.update`) —
> the write/apply semantics (a running turn may answer `applied: false`) are
> in `docs/api-reference.md` §9. The keys of `z.record(X)` fields such as
> `providers`/`models`/`agents`/`permissionProfiles` are arbitrary; the
> element type's fields live on that schema's own rows.
>
> The tables under the "Machine-derived" heading below are generated from the
> source schemas (`npm run docs:api-reference`) and are byte-identical with
> the Chinese edition; the drift guard turns the gate red on any disagreement
> with the code.

## Notation

- `?` (the Optional column) = the field is optional.
- The Default column = the schema's declared default (`{}` means an empty
  object default).
- `Record<string, X>` = an object with arbitrary keys and values of type X;
  X's fields live on X's rows.

---

<!-- config-reference:generated -->
## Config shape (source scan of the zod schemas in `packages/contracts/src/schemas.ts`)

| Schema                                | Field                                 | Type                                                                             | Optional | Default                                                                          |
| ------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `configV2Schema`                      | `version`                             | 2                                                                                |          |                                                                                  |
| `configV2Schema`                      | `runtime`                             | runtimeConfigSchema                                                              |          | {}                                                                               |
| `configV2Schema`                      | `sandbox`                             | sandboxConfigSchema                                                              |          | {}                                                                               |
| `configV2Schema`                      | `team`                                | teamConfigSchema                                                                 |          | {}                                                                               |
| `configV2Schema`                      | `context`                             | contextConfigSchema                                                              |          | {}                                                                               |
| `configV2Schema`                      | `checkpoint`                          | checkpointConfigSchema                                                           |          |                                                                                  |
| `configV2Schema`                      | `models`                              | Record<string, modelConfigSchema>                                                |          | {}                                                                               |
| `configV2Schema`                      | `defaultModel`                        | string                                                                           |          | ""                                                                               |
| `configV2Schema`                      | `providers`                           | Record<string, providerConfigSchema>                                             |          | {}                                                                               |
| `configV2Schema`                      | `permissionProfiles`                  | Record<string, permissionProfileSchema>                                          |          | { ask: { approval: "ask", description: "Ask before write, process, or shell acti |
| `configV2Schema`                      | `permissionProfiles.ask`              | { approval: "ask", description: "Ask before write, process, or shell actions", } |          |                                                                                  |
| `configV2Schema`                      | `permissionProfiles.ask.approval`     | "ask"                                                                            |          |                                                                                  |
| `configV2Schema`                      | `permissionProfiles.ask.description`  | "Ask before write                                                                |          |                                                                                  |
| `configV2Schema`                      | `permissionProfiles.auto`             | { approval: "auto", description: "Automatically approve actions" }               |          |                                                                                  |
| `configV2Schema`                      | `permissionProfiles.auto.approval`    | "auto"                                                                           |          |                                                                                  |
| `configV2Schema`                      | `permissionProfiles.auto.description` | "Automatically approve actions"                                                  |          |                                                                                  |
| `configV2Schema`                      | `defaultPermission`                   | string                                                                           |          | "ask"                                                                            |
| `configV2Schema`                      | `modes`                               | Record<string, modeConfigSchema>                                                 |          | {}                                                                               |
| `configV2Schema`                      | `defaultMode`                         | string                                                                           |          | "code"                                                                           |
| `configV2Schema`                      | `agents`                              | Record<string, agentConfigSchema>                                                |          | {}                                                                               |
| `configV2Schema`                      | `defaultAgent`                        | string                                                                           |          | ""                                                                               |
| `configV2Schema`                      | `mcpServers`                          | Record<string, mcpServerConfigSchema>                                            |          | {}                                                                               |
| `configV2Schema`                      | `skills`                              | skillsConfigSchema                                                               |          | {}                                                                               |
| `configV2Schema`                      | `plugins`                             | pluginConfigSchema                                                               |          | {}                                                                               |
| `configV2Schema`                      | `tools`                               | toolsConfigSchema                                                                |          | {}                                                                               |
| `configV2Schema`                      | `workspace`                           | workspaceConfigSchema                                                            |          | {}                                                                               |
| `configV2Schema`                      | `instructions`                        | instructionConfigSchema                                                          |          | {}                                                                               |
| `configV2Schema`                      | `webSearch`                           | webSearchConfigSchema                                                            |          | {}                                                                               |
| `configV2Schema`                      | `browser`                             | browserConfigSchema                                                              |          | {}                                                                               |
| `configV2Schema`                      | `network`                             | networkConfigSchema                                                              |          | {}                                                                               |
| `configV2Schema`                      | `security`                            | securityConfigSchema                                                             |          | {}                                                                               |
| `configV2Schema`                      | `issueTargets`                        | Record<string, issueTargetConfigSchema>                                          |          | {}                                                                               |
| `configV2Schema`                      | `dataSources`                         | Record<string, dataSourceConfigSchema>                                           |          | {}                                                                               |
| `configV2Schema`                      | `alertChannels`                       | Record<string, alertChannelConfigSchema>                                         |          | {}                                                                               |
| `configV2Schema`                      | `experimental`                        | experimentalConfigSchema                                                         |          | {}                                                                               |
| `runtimeConfigSchema`                 | `maxStepsPerTurn`                     | number                                                                           | yes      |                                                                                  |
| `runtimeConfigSchema`                 | `subagentDepth`                       | number                                                                           |          | 1                                                                                |
| `runtimeConfigSchema`                 | `timeouts`                            | timeoutSchema                                                                    |          | {}                                                                               |
| `runtimeConfigSchema`                 | `maxAttemptsPerStep`                  | number                                                                           |          | 3                                                                                |
| `runtimeConfigSchema`                 | `providerConcurrency`                 | Record<string, number>                                                           |          | {}                                                                               |
| `runtimeConfigSchema`                 | `retry`                               | object                                                                           |          | {}                                                                               |
| `runtimeConfigSchema`                 | `retry.maxAttemptsPerStep`            | number                                                                           |          | 3                                                                                |
| `runtimeConfigSchema`                 | `retry.initialBackoffMs`              | number                                                                           |          | 300                                                                              |
| `runtimeConfigSchema`                 | `retry.maxBackoffMs`                  | number                                                                           |          | 5000                                                                             |
| `runtimeConfigSchema`                 | `retry.jitterMs`                      | number                                                                           |          | 500                                                                              |
| `runtimeConfigSchema`                 | `terminal`                            | terminalWindowConfigSchema                                                       |          | {}                                                                               |
| `timeoutSchema`                       | `requestSec`                          | number                                                                           |          | 120                                                                              |
| `timeoutSchema`                       | `streamIdleSec`                       | number                                                                           |          | 120                                                                              |
| `timeoutSchema`                       | `toolSec`                             | number                                                                           | yes      |                                                                                  |
| `timeoutSchema`                       | `turnSec`                             | number                                                                           |          | null                                                                             |
| `terminalWindowConfigSchema`          | `windowMode`                          | ["auto", "windowless", "window"]                                                 |          | "auto"                                                                           |
| `sandboxConfigSchema`                 | `backend`                             | ["snapshot", "worktree"]                                                         |          | "snapshot"                                                                       |
| `teamConfigSchema`                    | `maxConcurrent`                       | number                                                                           |          | 4                                                                                |
| `contextConfigSchema`                 | `autoDetectWindow`                    | boolean                                                                          |          | true                                                                             |
| `contextConfigSchema`                 | `compactionEnabled`                   | boolean                                                                          |          | true                                                                             |
| `contextConfigSchema`                 | `compactionThresholdPercent`          | number                                                                           |          | 85                                                                               |
| `contextConfigSchema`                 | `reservedOutputTokens`                | [z.literal("auto"), z.number().int().positive()]                                 |          | "auto"                                                                           |
| `contextConfigSchema`                 | `preservedRecentMessages`             | number                                                                           |          | 2                                                                                |
| `checkpointConfigSchema`              | `enabled`                             | boolean                                                                          |          | true                                                                             |
| `checkpointConfigSchema`              | `maxFiles`                            | number                                                                           |          | 20000                                                                            |
| `checkpointConfigSchema`              | `maxBytes`                            | number                                                                           |          | 512 * 1024 * 1024                                                                |
| `checkpointConfigSchema`              | `ignore`                              | string[]                                                                         |          | []                                                                               |
| `checkpointConfigSchema`              | `additionalDirs`                      | string[]                                                                         |          | []                                                                               |
| `modelConfigSchema`                   | `provider`                            | string                                                                           |          |                                                                                  |
| `modelConfigSchema`                   | `model`                               | string                                                                           |          |                                                                                  |
| `modelConfigSchema`                   | `enabled`                             | boolean                                                                          |          | true                                                                             |
| `modelConfigSchema`                   | `capabilities`                        | object                                                                           |          | {}                                                                               |
| `modelConfigSchema`                   | `capabilities.toolCall`               | boolean                                                                          |          | true                                                                             |
| `modelConfigSchema`                   | `capabilities.reasoning`              | boolean                                                                          |          | true                                                                             |
| `modelConfigSchema`                   | `capabilities.thinking`               | boolean                                                                          |          | true                                                                             |
| `modelConfigSchema`                   | `capabilities.imageInput`             | boolean                                                                          |          | false                                                                            |
| `modelConfigSchema`                   | `capabilities.pdfInput`               | boolean                                                                          |          | false                                                                            |
| `modelConfigSchema`                   | `capabilities.videoInput`             | boolean                                                                          |          | false                                                                            |
| `modelConfigSchema`                   | `contextWindow`                       | [z.literal("auto"), z.number().int().positive()]                                 |          | "auto"                                                                           |
| `modelConfigSchema`                   | `maxOutputTokens`                     | outputTokenLimitSchema                                                           |          |                                                                                  |
| `modelConfigSchema`                   | `temperature`                         | number                                                                           |          | null                                                                             |
| `modelConfigSchema`                   | `topP`                                | number                                                                           |          | null                                                                             |
| `modelConfigSchema`                   | `reasoningEffort`                     | ["minimal", "low", "medium", "high", "xhigh"]                                    |          | null                                                                             |
| `modelConfigSchema`                   | `thinkingEnabled`                     | boolean                                                                          |          | true                                                                             |
| `modelConfigSchema`                   | `stream`                              | boolean                                                                          |          | true                                                                             |
| `modelConfigSchema`                   | `requestTimeoutSec`                   | number                                                                           |          | null                                                                             |
| `modelConfigSchema`                   | `variants`                            | Record<string, object>                                                           |          | {}                                                                               |
| `modelConfigSchema`                   | `variants.model`                      | string                                                                           | yes      |                                                                                  |
| `modelConfigSchema`                   | `variants.maxOutputTokens`            | outputTokenLimitSchema                                                           |          |                                                                                  |
| `modelConfigSchema`                   | `variants.temperature`                | number                                                                           |          | null                                                                             |
| `modelConfigSchema`                   | `variants.topP`                       | number                                                                           |          | null                                                                             |
| `modelConfigSchema`                   | `variants.reasoningEffort`            | ["minimal", "low", "medium", "high", "xhigh"]                                    |          | null                                                                             |
| `modelConfigSchema`                   | `variants.thinkingEnabled`            | boolean                                                                          | yes      |                                                                                  |
| `modelConfigSchema`                   | `variants.requestTimeoutSec`          | number                                                                           |          | null                                                                             |
| `providerConfigSchema`                | `type`                                | string                                                                           |          |                                                                                  |
| `providerConfigSchema`                | `enabled`                             | boolean                                                                          |          | true                                                                             |
| `providerConfigSchema`                | `baseURL`                             | string                                                                           | yes      |                                                                                  |
| `providerConfigSchema`                | `apiKey`                              | string                                                                           | yes      |                                                                                  |
| `providerConfigSchema`                | `authHeader`                          | string                                                                           | yes      |                                                                                  |
| `providerConfigSchema`                | `customHeaders`                       | Record<string, string>                                                           |          | {}                                                                               |
| `providerConfigSchema`                | `requireOutputLimit`                  | boolean                                                                          | yes      |                                                                                  |
| `permissionProfileSchema`             | `approval`                            | ["ask", "auto", "read_only"]                                                     |          |                                                                                  |
| `permissionProfileSchema`             | `description`                         | string                                                                           |          | ""                                                                               |
| `permissionProfileSchema`             | `permissions`                         | agentPermissionRulesSchema                                                       | yes      |                                                                                  |
| `permissionProfileSchema`             | `commandRules`                        | permissionProfileCommandRulesSchema                                              | yes      |                                                                                  |
| `permissionProfileSchema`             | `interactivePrograms`                 | interactiveProgramRulesSchema                                                    | yes      |                                                                                  |
| `permissionProfileSchema`             | `extensions`                          | extensionRulesSchema                                                             | yes      |                                                                                  |
| `agentPermissionRulesSchema`          | `tools`                               | object                                                                           | yes      |                                                                                  |
| `agentPermissionRulesSchema`          | `tools.allow`                         | string[]                                                                         |          | []                                                                               |
| `agentPermissionRulesSchema`          | `tools.exclude`                       | string[]                                                                         |          | []                                                                               |
| `agentPermissionRulesSchema`          | `files`                               | object                                                                           | yes      |                                                                                  |
| `agentPermissionRulesSchema`          | `files[].writePaths`                  | object[]                                                                         |          | []                                                                               |
| `agentPermissionRulesSchema`          | `files[].writePaths[].pattern`        | string                                                                           |          |                                                                                  |
| `agentPermissionRulesSchema`          | `files[].writePaths[].allow`          | boolean                                                                          | yes      |                                                                                  |
| `agentPermissionRulesSchema`          | `files[].writePaths[].reason`         | string                                                                           | yes      |                                                                                  |
| `agentPermissionRulesSchema`          | `commands`                            | object                                                                           | yes      |                                                                                  |
| `agentPermissionRulesSchema`          | `commands.allowPatterns`              | string[]                                                                         |          | []                                                                               |
| `agentPermissionRulesSchema`          | `commands.denyPatterns`               | string[]                                                                         |          | []                                                                               |
| `agentPermissionRulesSchema`          | `network`                             | object                                                                           | yes      |                                                                                  |
| `agentPermissionRulesSchema`          | `network.allowedHosts`                | string[]                                                                         |          | []                                                                               |
| `agentPermissionRulesSchema`          | `network.denyHosts`                   | string[]                                                                         |          | []                                                                               |
| `agentPermissionRulesSchema`          | `network.allowLocalhost`              | boolean                                                                          | yes      |                                                                                  |
| `agentPermissionRulesSchema`          | `network.allowPrivate`                | boolean                                                                          | yes      |                                                                                  |
| `agentPermissionRulesSchema`          | `env`                                 | object                                                                           | yes      |                                                                                  |
| `agentPermissionRulesSchema`          | `env.allowlist`                       | string[]                                                                         |          | []                                                                               |
| `agentPermissionRulesSchema`          | `redactOutput`                        | boolean                                                                          | yes      |                                                                                  |
| `permissionProfileCommandRulesSchema` | `mode`                                | ["blacklist", "whitelist", "none"]                                               |          |                                                                                  |
| `permissionProfileCommandRulesSchema` | `rules`                               | bashCommandRuleSchema[]                                                          |          | []                                                                               |
| `bashCommandRuleSchema`               | `command`                             | string                                                                           |          |                                                                                  |
| `bashCommandRuleSchema`               | `reason`                              | string                                                                           | yes      |                                                                                  |
| `interactiveProgramRulesSchema`       | `allowAny`                            | boolean                                                                          |          | false                                                                            |
| `interactiveProgramRulesSchema`       | `allow`                               | bashCommandRuleSchema[]                                                          |          | []                                                                               |
| `extensionRulesSchema`                | `skills`                              | boolean                                                                          | yes      |                                                                                  |
| `extensionRulesSchema`                | `mcp`                                 | boolean                                                                          | yes      |                                                                                  |
| `extensionRulesSchema`                | `plugins`                             | boolean                                                                          | yes      |                                                                                  |
| `modeConfigSchema`                    | `description`                         | string                                                                           |          | ""                                                                               |
| `modeConfigSchema`                    | `model`                               | string                                                                           | yes      |                                                                                  |
| `modeConfigSchema`                    | `permission`                          | string                                                                           | yes      |                                                                                  |
| `modeConfigSchema`                    | `systemPrompt`                        | string                                                                           |          | ""                                                                               |
| `modeConfigSchema`                    | `allowedTools`                        | string[]                                                                         |          | []                                                                               |
| `modeConfigSchema`                    | `excludedTools`                       | string[]                                                                         |          | []                                                                               |
| `modeConfigSchema`                    | `mcpServers`                          | string[]                                                                         |          | []                                                                               |
| `agentConfigSchema`                   | `description`                         | string                                                                           |          | ""                                                                               |
| `agentConfigSchema`                   | `systemPrompt`                        | string                                                                           |          | ""                                                                               |
| `agentConfigSchema`                   | `mode`                                | ["primary", "subagent", "all"]                                                   |          | "primary"                                                                        |
| `agentConfigSchema`                   | `hidden`                              | boolean                                                                          |          | false                                                                            |
| `agentConfigSchema`                   | `color`                               | string                                                                           | yes      |                                                                                  |
| `agentConfigSchema`                   | `model`                               | string                                                                           | yes      |                                                                                  |
| `agentConfigSchema`                   | `variant`                             | string                                                                           | yes      |                                                                                  |
| `agentConfigSchema`                   | `maxSteps`                            | number                                                                           | yes      |                                                                                  |
| `agentConfigSchema`                   | `allowedTools`                        | string[]                                                                         |          | []                                                                               |
| `agentConfigSchema`                   | `excludedTools`                       | string[]                                                                         |          | []                                                                               |
| `agentConfigSchema`                   | `mcpServers`                          | string[]                                                                         |          | []                                                                               |
| `agentConfigSchema`                   | `permissions`                         | agentPermissionRulesSchema                                                       | yes      |                                                                                  |
| `mcpServerConfigSchema`               | `type`                                | ["stdio", "http"]                                                                |          |                                                                                  |
| `mcpServerConfigSchema`               | `command`                             | string                                                                           | yes      |                                                                                  |
| `mcpServerConfigSchema`               | `args`                                | string[]                                                                         |          | []                                                                               |
| `mcpServerConfigSchema`               | `url`                                 | string                                                                           | yes      |                                                                                  |
| `mcpServerConfigSchema`               | `headers`                             | Record<string, string>                                                           |          | {}                                                                               |
| `mcpServerConfigSchema`               | `environment`                         | Record<string, string>                                                           |          | {}                                                                               |
| `mcpServerConfigSchema`               | `cwd`                                 | string                                                                           | yes      |                                                                                  |
| `mcpServerConfigSchema`               | `timeoutSec`                          | number                                                                           |          | 30                                                                               |
| `mcpServerConfigSchema`               | `allowedTools`                        | string[]                                                                         |          | []                                                                               |
| `mcpServerConfigSchema`               | `excludedTools`                       | string[]                                                                         |          | []                                                                               |
| `mcpServerConfigSchema`               | `readOnly`                            | boolean                                                                          |          | false                                                                            |
| `mcpServerConfigSchema`               | `enabled`                             | boolean                                                                          |          | true                                                                             |
| `mcpServerConfigSchema`               | `auth`                                | [z.literal(false), z.object({}).passthrough()]                                   | yes      |                                                                                  |
| `skillsConfigSchema`                  | `urls`                                | string[]                                                                         |          | []                                                                               |
| `pluginConfigSchema`                  | `enabled`                             | Record<string, boolean>                                                          |          | {}                                                                               |
| `pluginConfigSchema`                  | `paths`                               | string[]                                                                         |          | []                                                                               |
| `pluginConfigSchema`                  | `capabilities`                        | Record<string, ["tools", "events"][]>                                            |          | {}                                                                               |
| `pluginConfigSchema`                  | `readOnly`                            | Record<string, boolean>                                                          |          | {}                                                                               |
| `pluginConfigSchema`                  | `settings`                            | Record<string, unknown>                                                          |          | {}                                                                               |
| `toolsConfigSchema`                   | `enabled`                             | Record<string, boolean>                                                          |          | {}                                                                               |
| `toolsConfigSchema`                   | `paths`                               | string[]                                                                         |          | []                                                                               |
| `workspaceConfigSchema`               | `root`                                | string                                                                           |          | ""                                                                               |
| `workspaceConfigSchema`               | `additionalDirs`                      | string[]                                                                         |          | []                                                                               |
| `instructionConfigSchema`             | `enabled`                             | boolean                                                                          |          | true                                                                             |
| `instructionConfigSchema`             | `includeReadme`                       | boolean                                                                          |          | true                                                                             |
| `instructionConfigSchema`             | `includeDocs`                         | boolean                                                                          |          | false                                                                            |
| `instructionConfigSchema`             | `extraFiles`                          | string[]                                                                         |          | []                                                                               |
| `webSearchConfigSchema`               | `endpoint`                            | string                                                                           |          | null                                                                             |
| `webSearchConfigSchema`               | `providerPriority`                    | string[]                                                                         |          | ["configured", "duckduckgo"]                                                     |
| `browserConfigSchema`                 | `enabled`                             | boolean                                                                          |          | true                                                                             |
| `browserConfigSchema`                 | `binary`                              | string                                                                           |          | ""                                                                               |
| `browserConfigSchema`                 | `persistentProfile`                   | boolean                                                                          |          | false                                                                            |
| `browserConfigSchema`                 | `profileDir`                          | string                                                                           |          | ""                                                                               |
| `browserConfigSchema`                 | `userAgent`                           | string                                                                           |          | ""                                                                               |
| `browserConfigSchema`                 | `locale`                              | string                                                                           |          | ""                                                                               |
| `browserConfigSchema`                 | `timezone`                            | string                                                                           |          | ""                                                                               |
| `browserConfigSchema`                 | `headers`                             | Record<string, string>                                                           |          | {}                                                                               |
| `networkConfigSchema`                 | `allowedHosts`                        | string[]                                                                         |          | []                                                                               |
| `networkConfigSchema`                 | `allowedSchemes`                      | string[]                                                                         |          | ["https", "http"]                                                                |
| `networkConfigSchema`                 | `allowLocalhost`                      | boolean                                                                          |          | false                                                                            |
| `networkConfigSchema`                 | `allowPrivate`                        | boolean                                                                          |          | false                                                                            |
| `securityConfigSchema`                | `envAllowlist`                        | string[]                                                                         |          | []                                                                               |
| `securityConfigSchema`                | `redactToolOutput`                    | boolean                                                                          |          | true                                                                             |
| `issueTargetConfigSchema`             | `kind`                                | ["gitea", "github"]                                                              |          |                                                                                  |
| `issueTargetConfigSchema`             | `baseURL`                             | string                                                                           |          |                                                                                  |
| `issueTargetConfigSchema`             | `owner`                               | string                                                                           |          |                                                                                  |
| `issueTargetConfigSchema`             | `repo`                                | string                                                                           |          |                                                                                  |
| `issueTargetConfigSchema`             | `token`                               | string                                                                           |          | ""                                                                               |
| `issueTargetConfigSchema`             | `label`                               | string                                                                           |          | ""                                                                               |
| `issueTargetConfigSchema`             | `enabled`                             | boolean                                                                          |          | true                                                                             |
| `dataSourceConfigSchema`              | `path`                                | string                                                                           |          |                                                                                  |
| `dataSourceConfigSchema`              | `kind`                                | ["offset", "timestamp"]                                                          |          | "offset"                                                                         |
| `dataSourceConfigSchema`              | `timestampField`                      | string                                                                           |          | ""                                                                               |
| `dataSourceConfigSchema`              | `maxBytes`                            | number                                                                           |          | 65536                                                                            |
| `dataSourceConfigSchema`              | `enabled`                             | boolean                                                                          |          | true                                                                             |
| `alertChannelConfigSchema`            | `kind`                                | ["journal", "webhook"]                                                           |          |                                                                                  |
| `alertChannelConfigSchema`            | `url`                                 | string                                                                           |          | ""                                                                               |
| `alertChannelConfigSchema`            | `token`                               | string                                                                           |          | ""                                                                               |
| `alertChannelConfigSchema`            | `timeoutMs`                           | number                                                                           |          | 10_000                                                                           |
| `alertChannelConfigSchema`            | `enabled`                             | boolean                                                                          |          | true                                                                             |
| `experimentalConfigSchema`            | `policies`                            | policyStatementSchema[]                                                          |          | []                                                                               |
| `policyStatementSchema`               | `effect`                              | ["allow", "deny"]                                                                |          |                                                                                  |
| `policyStatementSchema`               | `action`                              | string                                                                           |          |                                                                                  |
| `policyStatementSchema`               | `resource`                            | string                                                                           |          |                                                                                  |
<!-- /config-reference:generated -->

<!-- config-reference:tui-settings -->

## Interface-preference settings (`tui.json`)

The theme, keybindings and other interface preferences live in `tui.json`,
written atomically with mode 0600:

- **Project scope**: `.natalia/tui.json`
- **Global scope**: `$HOME/.config/natalia-cli/tui.json` (POSIX) /
  `%APPDATA%\natalia-cli\tui.json` (Windows)

Resolution is defaults → global → project (project wins). The full schema is
`tuiConfigSchema` in `@natalia/config`; the fields are:

| Field | Type | Default |
|---|---|---|
| `theme` | string | `natalia-dark` |
| `themeMode` | `"dark" \| "light" \| "system"` | `dark` |
| `keybinds` | record of string / string[] / false | `{}` |
| `leaderKey` | string | `ctrl+x` |
| `leaderTimeoutMs` | number | `2000` |
| `toolDetails` | `"collapsed" \| "expanded"` | `collapsed` |
| `reasoning` | `"step" \| "hidden"` | `step` |
| `density` | `"comfortable" \| "compact"` | `comfortable` |
| `followBottom` | boolean | `true` |
| `scrollSpeed` | number | `1` |
| `scrollAcceleration` | boolean | `true` |
| `mouse` | boolean | `true` |
| `prompt.maxHeight` | number | `8` |
| `diffStyle` | `"auto" \| "stacked"` | `auto` |
| `attention.enabled` | boolean | `false` |
| `attention.notifications` | boolean | `true` |
| `attention.sound` | boolean | `false` |
| `attention.volume` | number | `0.4` |

The file is a partial: absent keys keep the lower-precedence value. Writes
accept any subset of the schema (`deepPartial`), so a consumer never needs to
read before writing.

### Reading and writing over RPC

`settingsGet()` returns the fully resolved effective config plus the source
list (`defaults` / `global` / `project` with their paths and applied state).
`settingsSet(patch, scope)` validates against the shared schema (an invalid
patch is an argument error, never a partial write), writes the scope's file
atomically, and announces the change with a `settings.updated` event
(carrying the scope), so subscribers re-read rather than cache blindly.
<!-- /config-reference:tui-settings -->
