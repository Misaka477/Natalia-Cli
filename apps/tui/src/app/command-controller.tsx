"use client";
import { type TextareaRenderable } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { useKeymap, useKeymapSelector } from "@opentui/keymap/solid";
import type { ConfigV2, MCPResourceCatalog, RuntimeClient } from "@natalia/contracts";
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ConfigPatch extends Record<string, unknown> {}
import { getPluginCommands } from "@natalia/plugin";
import { resolveConfig, type ConfigWriteScope } from "@natalia/config";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { CommandPalette } from "../component/CommandPalette";
import { DialogSessionList, DialogDiagnostics, DialogStatus, DialogHelp } from "../dialog/DialogLayer";
import { DialogProviderSetup } from "../component/DialogProviderSetup";
import { DialogModel } from "../component/DialogModel";
import { DialogSkill } from "../component/DialogSkill";
import { DialogStash } from "../component/DialogStash";
import { DialogAttachment } from "../component/DialogAttachment";
import { DialogWorkspaceSearch } from "../component/DialogWorkspaceSearch";
import { DialogAgent } from "../component/DialogAgent";
import { DialogMcp } from "../component/DialogMcp";
import { DialogThemeList } from "../component/DialogThemeList";
import { DialogCheckpoint } from "../component/DialogCheckpoint";
import { DialogSandbox } from "../component/DialogSandbox";
import { DialogTerminal } from "../component/DialogTerminal";
import { DialogSelect } from "../dialog/DialogSelect";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { DialogConfirm } from "../dialog/DialogConfirm";
import {
  DialogConstitution,
  DialogDecision,
  DialogEvidence,
  DialogWorkGraph,
} from "../dialog/DialogLayer";
import { useDialog, type DialogContext } from "../dialog/provider";
import type { TuiConfigWriteScope } from "../config";
import { editPromptExternally, retainEditorMentions } from "../prompt/external-editor";
import { PromptHistory, shouldUseHistory } from "../prompt/history";
import type { TuiPreferences } from "../settings";
import { parseSettingsStringRecord, parseSettingsRecord } from "./settings-utils";
import { themeTokens as darkTheme } from "../theme/theme";
import { discoverProviderModels } from "@natalia/config";


export interface CommandContext {
  backend: RuntimeClient;
  workspaceRoot?: string;
  composer: () => TextareaRenderable | undefined;
  setAttachmentPaths: (fn: (current: string[]) => string[]) => void;
  setMentionAgents: (fn: (current: string[]) => string[]) => void;
  setMentionResources: (fn: (current: MCPResourceCatalog[]) => MCPResourceCatalog[]) => void;
  attachmentPaths: () => string[];
  changeSession: (sessionID?: string) => void;
  persistConfig: (next: ConfigPatch, base?: ConfigV2) => Promise<void>;
  toast: { show: (msg: any) => void; error: (err: unknown) => void };
  dialog: DialogContext;
  local: { state: { activeAgent?: string }; stashPrompt: (text: string) => boolean };
  preferences: () => TuiPreferences;
  setPreferences: (prefs: TuiPreferences) => void;
  tuiWriteScope: () => TuiConfigWriteScope;
  configWriteScope: () => ConfigWriteScope;
  setTuiWriteScope: (scope: TuiConfigWriteScope) => void;
  setConfigWriteScope: (scope: ConfigWriteScope) => void;
  setFollowMode: (value: boolean) => void;
  state: any;
  dispatch: (event: any) => void;
  route: { push: (r: any) => void; replace: (r: any) => void };
  renderer: any;
  layout: () => any;
  setSidebarMode: (fn: (current: any) => any) => void;
  setSidebarOpen: (fn: (current: boolean) => boolean) => void;
  clipboard: any;
  setComposerText: (text: string) => void;
  submit: () => Promise<void>;
  updatePreferences: (next: TuiPreferences, scope?: any) => void;
}

export function runCommand(command: string, ctx: CommandContext) {
    if (command === "palette.toggle") {
      ctx.dialog.replace(() => <CommandPalette onRun={(cmd) => runCommand(cmd, ctx)} />);
      return;
    }
    if (command === "session.new") {
      ctx.dialog.pop();
      ctx.changeSession(
        `ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}`,
      );
      return;
    }
    if (command === "session.list") {
      if (
        !ctx.backend.sessionList ||
        !ctx.backend.sessionTouch ||
        !ctx.backend.sessionRename ||
        !ctx.backend.sessionPin ||
        !ctx.backend.sessionDuplicate ||
        !ctx.backend.sessionDelete
      ) {
        ctx.toast.show({
          variant: "warning",
          message: "This runtime transport does not support session management",
        });
        return;
      }
      const sessionBackend = {
        list: ctx.backend.sessionList,
        touch: ctx.backend.sessionTouch,
        rename: ctx.backend.sessionRename,
        pin: ctx.backend.sessionPin,
        duplicate: ctx.backend.sessionDuplicate,
        delete: ctx.backend.sessionDelete,
      };
      ctx.dialog.push(() => (
        <DialogSessionList backend={sessionBackend} onSelect={ctx.changeSession} />
      ));
      return;
    }
    if (command === "provider.connect") {
      resolveConfig({
        workspaceRoot: ctx.workspaceRoot ?? process.cwd(),
      }).then(({ config: resolved }) => {
        ctx.dialog.push(() => (
          <DialogProviderSetup
            config={resolved}
            onPersist={(next) =>
              void ctx.persistConfig(next, resolved).catch(ctx.toast.error)
            }
          />
        ));
      });
      return;
    }
    if (command === "model.list") {
      ctx.dialog.push(() => (
        <DialogModel
          workspaceRoot={ctx.workspaceRoot ?? process.cwd()}
          catalog={ctx.backend.modelCatalog}
          selection={ctx.backend.modelSelection}
          selectRuntimeModel={ctx.backend.selectModel}
        />
      ));
      return;
    }
    if (command === "skill.list") {
      void ctx.backend.skills?.().then(
        (skills) =>
          ctx.dialog.push(() => (
            <DialogSkill
              skills={skills}
              select={(name) => {
                ctx.composer()?.setText(`/skill ${name}`);
                setTimeout(() => ctx.composer()?.focus(), 1);
              }}
            />
          )),
        (error) => ctx.toast.error(error),
      );
      return;
    }
    if (command === "prompt.stash.save") {
      const input = ctx.composer()?.plainText ?? "";
      if (!ctx.local.stashPrompt(input)) {
        ctx.toast.show({
          variant: "warning",
          message: "Prompt is empty or too large to stash",
        });
        return;
      }
      ctx.composer()?.clear();
      ctx.toast.show({ variant: "success", message: "Prompt stashed" });
      return;
    }
    if (command === "prompt.stash.list") {
      ctx.dialog.push(() => (
        <DialogStash
          select={(input) => {
            ctx.composer()?.setText(input);
            ctx.composer()?.gotoBufferEnd();
            setTimeout(() => ctx.composer()?.focus(), 1);
          }}
        />
      ));
      return;
    }
    if (command === "prompt.attachment.add") {
      ctx.dialog.push(() => (
        <DialogPrompt
          title="Queue attachment"
          placeholder="workspace-relative path, e.g. assets/diagram.png"
          validate={(value) => {
            const path = value.trim();
            if (!path) return "Attachment path is required";
            if (path.startsWith("/") || path.split(/[\\/]/u).includes(".."))
              return "Path must remain within the workspace";
            return undefined;
          }}
          onConfirm={(value) => {
            const path = value.trim();
            ctx.setAttachmentPaths((current) =>
              current.includes(path) ? current : [...current, path],
            );
            ctx.dialog.pop();
            setTimeout(() => ctx.composer()?.focus(), 1);
          }}
        />
      ));
      return;
    }
    if (command === "prompt.attachment.list") {
      ctx.dialog.push(() => (
        <DialogAttachment
          paths={ctx.attachmentPaths}
          remove={(path) =>
            ctx.setAttachmentPaths((current) =>
              current.filter((item) => item !== path),
            )
          }
        />
      ));
      return;
    }
    if (command === "workspace.search") {
      ctx.dialog.push(() => (
        <DialogPrompt
          title="Search workspace"
          placeholder="Regular expression"
          validate={(value) => {
            if (!value.trim()) return "Search query is required";
            try {
              new RegExp(value, "u");
              return undefined;
            } catch {
              return "Search must be a valid regular expression";
            }
          }}
          onConfirm={(query) => {
            if (!ctx.backend.workspaceSearch) {
              ctx.toast.show({
                variant: "warning",
                message:
                  "This runtime transport does not support workspace search",
              });
              return;
            }
            ctx.dialog.pop();
            void ctx.backend.workspaceSearch({ query, limit: 50 }).then(
              (matches) => {
                ctx.dialog.push(() => (
                  <DialogWorkspaceSearch
                    query={query}
                    matches={matches}
                    select={(match) => {
                      const mention = `@${match.path}:${match.line}`;
                      ctx.composer()?.insertText(`${mention} `);
                      ctx.setAttachmentPaths((current) =>
                        current.includes(match.path)
                          ? current
                          : [...current, match.path],
                      );
                      setTimeout(() => ctx.composer()?.focus(), 1);
                    }}
                  />
                ));
              },
        (error: any) => ctx.toast.error(error),
            );
          }}
        />
      ));
      return;
    }
    if (command === "agent.list") {
      if (!ctx.backend.agents) {
        ctx.toast.show({
          variant: "warning",
          message: "Runtime agent catalog unavailable",
        });
        return;
      }
      void ctx.backend.agents().then(
        (agents) =>
          ctx.dialog.push(() => (
            <DialogAgent
              agents={agents}
              current={ctx.local.state.activeAgent}
              selectAgent={(name) => ctx.backend.selectAgent?.(name)}
              workspaceRoot={ctx.workspaceRoot ?? process.cwd()}
            />
          )),
        (error) => ctx.toast.error(error),
      );
      return;
    }
    if (command === "model.edit") {
      resolveConfig({
        workspaceRoot: ctx.workspaceRoot ?? process.cwd(),
      }).then(({ config: resolved }) => {
        const mk = (mid: string, pvid: string) => {
          const v = mid.trim();
          if (!v) throw new Error("Model ID cannot be empty");
          return `${pvid}_${v.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        };
        const save = (next: ConfigV2) => {
          void ctx.persistConfig(next, resolved).catch(ctx.toast.error);
        };
        const openModelDetail = (opt: { value: string }) => {
          const m = resolved.models[opt.value];
          if (!m) return;
          const refresh = () => {
            ctx.dialog.pop();
            openModelDetail(opt);
          };
          ctx.dialog.push(() => (
            <DialogSelect
              title={`Edit ${opt.value}`}
              options={[
                { title: "Model ID", value: "mid", description: m.model },
                {
                  title: "Default",
                  value: "def",
                  description:
                    resolved.defaultModel === opt.value
                      ? "✓ current"
                      : "Set as default",
                },
                {
                  title: "Context Window",
                  value: "ctx",
                  description:
                    typeof m.contextWindow === "number"
                      ? `${m.contextWindow.toLocaleString()}`
                      : String(m.contextWindow),
                },
                {
                  title: "Max Output Tokens",
                  value: "maxout",
                  description: m.maxOutputTokens?.toString() ?? "(default)",
                },
                {
                  title: "Temperature",
                  value: "temp",
                  description: m.temperature?.toString() ?? "(default)",
                },
                {
                  title: "Top P",
                  value: "topp",
                  description: m.topP?.toString() ?? "(default)",
                },
                {
                  title: "Reasoning Effort",
                  value: "reason",
                  description: m.reasoningEffort ?? "none",
                },
                {
                  title: "Thinking",
                  value: "think",
                  description: m.thinkingEnabled ? "On" : "Off",
                },
                {
                  title: "Stream",
                  value: "stream",
                  description: m.stream ? "On" : "Off",
                },
                {
                  title: "Request Timeout",
                  value: "timeout",
                  description: m.requestTimeoutSec?.toString() ?? "(default)",
                },
                { title: "Delete", value: "del", description: "Remove model" },
              ]}
              onSelect={async (o) => {
                if (o.value === "def") {
                  resolved.defaultModel = opt.value;
                  save(resolved);
                  return;
                }
                if (o.value === "think") {
                  m.thinkingEnabled = !m.thinkingEnabled;
                  save(resolved);
                  refresh();
                  return;
                }
                if (o.value === "stream") {
                  m.stream = !m.stream;
                  save(resolved);
                  refresh();
                  return;
                }
                if (o.value === "reason") {
                  ctx.dialog.push(() => (
                    <DialogSelect
                      title="Reasoning Effort"
                      options={[
                        "minimal",
                        "low",
                        "medium",
                        "high",
                        "xhigh",
                        "none",
                      ].map((v) => ({
                        title: v,
                        value: v,
                        description:
                          v === (m.reasoningEffort ?? "none")
                            ? "current"
                            : undefined,
                      }))}
                      onSelect={(r) => {
                        m.reasoningEffort =
                          r.value === "none" ? null : (r.value as any);
                        save(resolved);
                        ctx.dialog.pop();
                      }}
                    />
                  ));
                  return;
                }
                if (o.value === "del") {
                  delete (resolved.models as Record<string, unknown>)[
                    opt.value
                  ];
                  save(resolved);
                  ctx.dialog.pop();
                  return;
                }
                const labels: Record<string, string> = {
                  ctx: "Context Window",
                  maxout: "Max Output Tokens",
                  temp: "Temperature",
                  topp: "Top P",
                  mid: "Model ID",
                  timeout: "Request Timeout (sec)",
                };
                const defaults: Record<string, string> = {
                  ctx: String(m.contextWindow),
                  maxout: String(m.maxOutputTokens ?? ""),
                  temp: String(m.temperature ?? ""),
                  topp: String(m.topP ?? ""),
                  mid: m.model,
                  timeout: String(m.requestTimeoutSec ?? ""),
                };
                const v = await DialogPrompt.show(ctx.dialog, labels[o.value], {
                  placeholder: defaults[o.value],
                });
                if (v === null) return;
                if (o.value === "ctx")
                  m.contextWindow =
                    v === "auto" ? ("auto" as any) : Number(v) || "auto";
                if (o.value === "maxout")
                  m.maxOutputTokens = v === "" ? null : Number(v) || null;
                if (o.value === "temp")
                  m.temperature = v === "" ? null : Number(v);
                if (o.value === "topp") m.topP = v === "" ? null : Number(v);
                if (o.value === "mid") {
                  if (v.trim()) m.model = v.trim();
                }
                if (o.value === "timeout")
                  m.requestTimeoutSec = v === "" ? null : Number(v) || null;
                save(resolved);
                refresh();
              }}
            />
          ));
        };
        ctx.dialog.push(() => (
          <DialogSelect
            title="Edit Models"
            options={[
              ...Object.entries(resolved.models ?? {}).map(([key, m]) => ({
                title: key,
                value: key,
                description: `${m.model} @ ${m.provider}`,
              })),
              {
                title: "+ Add model to provider",
                value: "$add",
                description: "Add a new model to an existing provider",
              },
            ]}
            onSelect={(opt) => {
              if (opt.value === "$add") {
                const providers = Object.entries(resolved.providers ?? {});
                ctx.dialog.push(() => (
                  <DialogSelect
                    title="Select Provider"
                    options={providers.map(([name, p]) => ({
                      title: name,
                      value: name,
                      description: `${p.type}${p.baseURL ? ` @ ${p.baseURL}` : ""}`,
                    }))}
                    onSelect={async (p) => {
                      const provider = resolved.providers[p.value];
                      if (!provider?.apiKey || !provider?.baseURL) {
                        const mid = await DialogPrompt.show(
                          ctx.dialog,
                          "Model ID",
                          { placeholder: "gpt-4.1" },
                        );
                        if (!mid || !mid.trim()) return;
                        resolved.models[mk(mid, p.value)] = {
                          enabled: true,
                          capabilities: {
                            toolCall: true,
                            reasoning: true,
                            thinking: true,
                            imageInput: false,
                            pdfInput: false,
                          },
                          model: mid.trim(),
                          provider: p.value,
                          contextWindow: "auto",
                          temperature: null,
                          topP: null,
                          reasoningEffort: null,
                          thinkingEnabled: true,
                          stream: true,
                          requestTimeoutSec: null,
                          variants: {},
                        };
                        save(resolved);
                        ctx.dialog.pop();
                        return;
                      }
                      try {
                        const models = await discoverProviderModels(
                          provider.type,
                          provider.baseURL,
                          provider.apiKey,
                        );
                        ctx.dialog.push(() => (
                          <DialogSelect
                            title={`Models: ${p.value}`}
                            options={models.map((model: string) => ({
                              title: model,
                              value: model,
                            }))}
                            onSelect={(sel) => {
                              resolved.models[mk(sel.value, p.value)] = {
                                enabled: true,
                                capabilities: {
                                  toolCall: true,
                                  reasoning: true,
                                  thinking: true,
                                  imageInput: false,
                                  pdfInput: false,
                                },
                                model: sel.value,
                                provider: p.value,
                                contextWindow: "auto",
                                temperature: null,
                                topP: null,
                                reasoningEffort: null,
                                thinkingEnabled: true,
                                stream: true,
                                requestTimeoutSec: null,
                                variants: {},
                              };
                              save(resolved);
                              ctx.dialog.pop();
                            }}
                          />
                        ));
                      } catch (e) {
                        const mid = await DialogPrompt.show(
                          ctx.dialog,
                          "Discovery failed, enter Model ID manually",
                          { placeholder: "gpt-4.1" },
                        );
                        if (!mid || !mid.trim()) return;
                        resolved.models[mk(mid, p.value)] = {
                          enabled: true,
                          capabilities: {
                            toolCall: true,
                            reasoning: true,
                            thinking: true,
                            imageInput: false,
                            pdfInput: false,
                          },
                          model: mid.trim(),
                          provider: p.value,
                          contextWindow: "auto",
                          temperature: null,
                          topP: null,
                          reasoningEffort: null,
                          thinkingEnabled: true,
                          stream: true,
                          requestTimeoutSec: null,
                          variants: {},
                        };
                        save(resolved);
                        ctx.dialog.pop();
                      }
                    }}
                  />
                ));
                return;
              }
              openModelDetail(opt);
            }}
          />
        ));
      });
      return;
    }
    if (command === "mcp.list") {
      resolveConfig({
        workspaceRoot: ctx.workspaceRoot ?? process.cwd(),
      }).then(({ config: resolved }) => {
        ctx.dialog.push(() => (
          <DialogMcp
            config={resolved}
            statuses={ctx.state.mcp}
            onPersist={(next) =>
              void ctx.persistConfig(next, resolved).catch(ctx.toast.error)
            }
          />
        ));
      });
      return;
    }
    if (command === "settings.open") {
      let settingsBase: ConfigV2 | undefined;
      async function saveConfig(next: ConfigPatch) {
        await ctx.persistConfig(next, settingsBase);
      }
      ctx.dialog.push(() => (
        <DialogSelect
          title="Settings"
          options={[
            {
              title: "Add Provider",
              value: "provider",
              description: "Configure a provider and model",
            },
            {
              title: "Edit Provider",
              value: "edit-provider",
              description: "Modify key, URL, type",
            },
            {
              title: "Delete Provider",
              value: "delete-provider",
              description: "Remove provider and models",
            },
            {
              title: "Theme",
              value: "theme",
              description: ctx.preferences().theme || "natalia-dark",
            },
            {
              title: "MCP Servers",
              value: "mcp",
              description: "Manage MCP servers",
            },
            {
              title: "Permission Profile",
              value: "permission",
              description: "Select permission profile",
            },
            {
              title: "Agent Mode",
              value: "mode",
              description: "Select agent mode",
            },
            {
              title: "Select Model",
              value: "model",
              description: "Select default model",
            },
            {
              title: "Models",
              value: "model.edit",
              description: "Add/edit/delete model configs",
            },
            {
              title: "Web & Network",
              value: "web",
              description: "Search, browser, network rules",
            },
            {
              title: "Workspace",
              value: "workspace",
              description: "Root, instructions, README, docs",
            },
            {
              title: "Extensions",
              value: "extensions",
              description: "Remote skills and local plugin policy",
            },
            {
              title: "Runtime Config",
              value: "runtime",
              description: "Max steps, retry, checkpoints",
            },
            {
              title: "TUI Preferences",
              value: "tui",
              description: "Density, diff style, keybinds",
            },
          ]}
          onSelect={async (option) => {
            const resolved = (
              await resolveConfig({
                workspaceRoot: ctx.workspaceRoot ?? process.cwd(),
              })
            ).config;
            // Settings editors mutate a resolved working copy. Keep the base
            // snapshot separate so configPatch writes the actual minimal delta.
            settingsBase = structuredClone(resolved);
            switch (option.value) {
              case "provider":
                ctx.dialog.push(() => (
                  <DialogProviderSetup
                    config={resolved}
                    onPersist={(next) => void saveConfig(next)}
                  />
                ));
                break;
              case "edit-provider": {
                const providers = Object.entries(resolved.providers ?? {});
                ctx.dialog.push(() => (
                  <DialogSelect
                    title="Edit Provider"
                    options={providers.map(([name, p]) => ({
                      title: name,
                      value: name,
                      description: `${p.type}${p.baseURL ? ` @ ${p.baseURL}` : ""}`,
                    }))}
                    onSelect={async (opt) => {
                      const p = resolved.providers[opt.value];
                      if (!p) return;
                      const newKey = await DialogPrompt.show(
                        ctx.dialog,
                        "API Key",
                        { placeholder: p.apiKey ?? "" },
                      );
                      if (newKey === null || newKey === undefined) return;
                      const newURL = await DialogPrompt.show(
                        ctx.dialog,
                        "Base URL",
                        { placeholder: p.baseURL ?? "" },
                      );
                      if (newURL === null || newURL === undefined) return;
                      const newHeaders = await DialogPrompt.show(
                        ctx.dialog,
                        "Custom Headers (JSON)",
                        {
                          placeholder:
                            p.customHeaders &&
                            Object.keys(p.customHeaders).length
                              ? JSON.stringify(p.customHeaders)
                              : "{}",
                        },
                      );
                      if (newHeaders === null || newHeaders === undefined)
                        return;
                      p.apiKey = newKey.trim() || p.apiKey;
                      p.baseURL = newURL.trim() || p.baseURL;
                      try {
                        p.customHeaders = JSON.parse(newHeaders.trim() || "{}");
                      } catch {
                        /* keep existing */
                      }
                      void saveConfig(resolved);
                      ctx.dialog.pop();
                    }}
                  />
                ));
                break;
              }
              case "delete-provider": {
                const providers = Object.entries(resolved.providers ?? {});
                ctx.dialog.push(() => (
                  <DialogSelect
                    title="Delete Provider"
                    options={providers.map(([name, p]) => ({
                      title: name,
                      value: name,
                      description: `${p.type} — removes provider and its models`,
                    }))}
                    onSelect={(opt) => {
                      delete (resolved.providers as Record<string, unknown>)[
                        opt.value
                      ];
                      for (const key of Object.keys(resolved.models ?? {})) {
                        if (resolved.models[key]?.provider === opt.value)
                          delete (resolved.models as Record<string, unknown>)[
                            key
                          ];
                      }
                      if (!resolved.models[resolved.defaultModel])
                        resolved.defaultModel =
                          Object.keys(resolved.models)[0] ?? "";
                      void saveConfig(resolved);
                      ctx.dialog.pop();
                    }}
                  />
                ));
                break;
              }
              case "theme":
                ctx.dialog.push(() => (
                  <DialogThemeList
                    onCommit={(name) =>
                      ctx.setPreferences({
                        ...ctx.preferences(),
                        theme: name,
                        version: 1,
                        themeMode: "dark",
                      })
                    }
                  />
                ));
                break;
              case "mcp":
                ctx.dialog.push(() => (
                  <DialogMcp
                    config={resolved}
                    statuses={ctx.state.mcp}
                    onPersist={(next) => void saveConfig(next)}
                  />
                ));
                break;
              case "model":
                ctx.dialog.push(() => (
                  <DialogModel
                    workspaceRoot={ctx.workspaceRoot ?? process.cwd()}
                    catalog={ctx.backend.modelCatalog}
                    selection={ctx.backend.modelSelection}
                    selectRuntimeModel={ctx.backend.selectModel}
                  />
                ));
                break;
              case "permission":
                ctx.dialog.push(() => (
                  <DialogSelect
                    title="Permission Profiles"
                    options={[
                      ...Object.entries(resolved.permissionProfiles ?? {}).map(
                        ([name, p]) => ({
                          title: name,
                          value: name,
                          description:
                            (p as any).description ??
                            (p as any).approval ??
                            "-",
                        }),
                      ),
                      {
                        title: "+ Create new profile",
                        value: "$new",
                        description: "Add a permission profile",
                      },
                    ]}
                    onSelect={(opt) => {
                      if (opt.value === "$new") {
                        setTimeout(() => {
                          void DialogPrompt.show(
                            ctx.dialog,
                            "Permission Profile Name",
                            {
                              description: () => (
                                <text fg={darkTheme.muted}>
                                  Create a named permission profile and select
                                  it as the default.
                                </text>
                              ),
                              placeholder: "review-only",
                            },
                          ).then((value) => {
                            const name = value?.trim();
                            if (!name || resolved.permissionProfiles[name])
                              return;
                            resolved.permissionProfiles[name] = {
                              description: "",
                              approval: "ask",
                            };
                            resolved.defaultPermission = name;
                            void saveConfig(resolved);
                          });
                        }, 0);
                        return;
                      }
                      resolved.defaultPermission = opt.value;
                      void saveConfig(resolved);
                      ctx.dialog.pop();
                    }}
                    onExtraKey={(key, opt) => {
                      if (key === "e" && opt.value !== "$new") {
                        const profile = resolved.permissionProfiles[opt.value];
                        if (!profile) return;
                        ctx.dialog.push(() => (
                          <DialogSelect
                            title={`Permission Profile: ${opt.value}`}
                            options={[
                              {
                                title: "Approval Mode",
                                value: "approval",
                                description: profile.approval,
                              },
                              {
                                title: "Description",
                                value: "description",
                                description: profile.description || "(none)",
                              },
                            ]}
                            onSelect={(field) => {
                              const next = structuredClone(resolved);
                              const target = next.permissionProfiles[opt.value];
                              if (!target) return;
                              if (field.value === "approval") {
                                ctx.dialog.push(() => (
                                  <DialogSelect
                                    title="Approval Mode"
                                    options={["ask", "auto", "read_only"].map(
                                      (value) => ({
                                        title: value,
                                        value,
                                      }),
                                    )}
                                    current={target.approval}
                                    onSelect={(choice) => {
                                      target.approval =
                                        choice.value as typeof target.approval;
                                      void saveConfig(next);
                                    }}
                                  />
                                ));
                                return;
                              }
                              ctx.dialog.push(() => (
                                <DialogPrompt
                                  title="Permission Profile Description"
                                  placeholder={target.description}
                                  onConfirm={(value) => {
                                    target.description = value.trim();
                                    void saveConfig(next);
                                  }}
                                />
                              ));
                            }}
                          />
                        ));
                        return;
                      }
                      if (key === "d" && opt.value !== "$new") {
                        delete (
                          resolved.permissionProfiles as Record<string, unknown>
                        )[opt.value];
                        void saveConfig(resolved);
                      }
                    }}
                  />
                ));
                break;
              case "mode":
                ctx.dialog.push(() => (
                  <DialogSelect
                    title="Agent Modes"
                    options={[
                      ...Object.entries(resolved.modes ?? {}).map(
                        ([name, m]) => ({
                          title: name,
                          value: name,
                          description:
                            (m as any).description ??
                            `${(m as any).allowedTools?.length ?? 0} tools`,
                        }),
                      ),
                      {
                        title: "+ Create new mode",
                        value: "$new",
                        description: "Add an agent mode",
                      },
                    ]}
                    onSelect={(opt) => {
                      if (opt.value === "$new") {
                        setTimeout(() => {
                          void DialogPrompt.show(ctx.dialog, "Agent Mode Name", {
                            description: () => (
                              <text fg={darkTheme.muted}>
                                Create a named mode and select it as the
                                default.
                              </text>
                            ),
                            placeholder: "review",
                          }).then((value) => {
                            const name = value?.trim();
                            if (!name || resolved.modes[name]) return;
                            resolved.modes[name] = {
                              description: "",
                              systemPrompt: "",
                              allowedTools: [],
                              excludedTools: [],
                              mcpServers: [],
                            };
                            resolved.defaultMode = name;
                            void saveConfig(resolved);
                          });
                        }, 0);
                        return;
                      }
                      resolved.defaultMode = opt.value;
                      void saveConfig(resolved);
                      ctx.dialog.pop();
                    }}
                    onExtraKey={(key, opt) => {
                      if (key === "e" && opt.value !== "$new") {
                        const mode = resolved.modes[opt.value];
                        if (!mode) return;
                        ctx.dialog.push(() => (
                          <DialogSelect
                            title={`Agent Mode: ${opt.value}`}
                            options={[
                              {
                                title: "System Prompt",
                                value: "system",
                                description: mode.systemPrompt || "(none)",
                              },
                              {
                                title: "Model",
                                value: "model",
                                description: mode.model || "(default)",
                              },
                              {
                                title: "Permission Profile",
                                value: "permission",
                                description: mode.permission || "(default)",
                              },
                              {
                                title: "Allowed Tools",
                                value: "allow",
                                description: `${mode.allowedTools.length} tools`,
                              },
                              {
                                title: "Excluded Tools",
                                value: "exclude",
                                description: `${mode.excludedTools.length} tools`,
                              },
                              {
                                title: "MCP Servers",
                                value: "mcp",
                                description: `${mode.mcpServers.length} servers`,
                              },
                            ]}
                            onSelect={(field) => {
                              const next = structuredClone(resolved);
                              const target = next.modes[opt.value];
                              if (!target) return;
                              if (field.value === "permission") {
                                ctx.dialog.push(() => (
                                  <DialogSelect
                                    title="Mode Permission Profile"
                                    options={[
                                      { title: "Default", value: "" },
                                      ...Object.keys(
                                        next.permissionProfiles,
                                      ).map((value) => ({
                                        title: value,
                                        value,
                                      })),
                                    ]}
                                    current={target.permission ?? ""}
                                    onSelect={(choice) => {
                                      target.permission =
                                        choice.value || undefined;
                                      void saveConfig(next);
                                    }}
                                  />
                                ));
                                return;
                              }
                              const listField =
                                field.value === "allow"
                                  ? "allowedTools"
                                  : field.value === "exclude"
                                    ? "excludedTools"
                                    : field.value === "mcp"
                                      ? "mcpServers"
                                      : undefined;
                              const textField =
                                field.value === "system"
                                  ? "systemPrompt"
                                  : "model";
                              ctx.dialog.push(() => (
                                <DialogPrompt
                                  title={`Mode ${field.title}`}
                                  description={() =>
                                    listField
                                      ? "Comma-separated values."
                                      : "Leave blank to use the default."
                                  }
                                  placeholder={
                                    listField
                                      ? target[listField].join(", ")
                                      : (target[textField] ?? "")
                                  }
                                  onConfirm={(value) => {
                                    if (listField)
                                      target[listField] = value
                                        .split(",")
                                        .map((item) => item.trim())
                                        .filter(Boolean);
                                    else if (textField === "systemPrompt")
                                      target.systemPrompt = value.trim();
                                    else
                                      target.model = value.trim() || undefined;
                                    void saveConfig(next);
                                  }}
                                />
                              ));
                            }}
                          />
                        ));
                        return;
                      }
                      if (key === "d" && opt.value !== "$new") {
                        delete (resolved.modes as Record<string, unknown>)[
                          opt.value
                        ];
                        void saveConfig(resolved);
                      }
                    }}
                  />
                ));
                break;
              case "model.edit":
                runCommand("model.edit", ctx);
                break;
              case "web":
                ctx.dialog.push(() => (
                  <DialogSelect
                    title="Web & Network"
                    options={[
                      {
                        title: "Web Search Endpoint",
                        value: "ep",
                        description:
                          resolved.webSearch?.endpoint ?? "(not set)",
                      },
                      {
                        title: "Web Search Provider Priority",
                        value: "search-priority",
                        description:
                          resolved.webSearch?.providerPriority.join(", ") ||
                          "configured, duckduckgo",
                      },
                      {
                        title: "Browser",
                        value: "browser",
                        description: resolved.browser?.enabled ? "On" : "Off",
                      },
                      {
                        title: "Allow Localhost",
                        value: "localhost",
                        description: resolved.network?.allowLocalhost
                          ? "On"
                          : "Off",
                      },
                      {
                        title: "Allow Private IPs",
                        value: "private",
                        description: resolved.network?.allowPrivate
                          ? "On"
                          : "Off",
                      },
                      {
                        title: "Redact Tool Output",
                        value: "redact",
                        description: resolved.security?.redactToolOutput
                          ? "On"
                          : "Off",
                      },
                      {
                        title: "Env Allowlist",
                        value: "env",
                        description: `${resolved.security?.envAllowlist?.length ?? 0} vars allowed`,
                      },
                      {
                        title: "Browser Binary",
                        value: "bbin",
                        description: resolved.browser?.binary || "(default)",
                      },
                      {
                        title: "Browser User Agent",
                        value: "bua",
                        description: resolved.browser?.userAgent || "(default)",
                      },
                      {
                        title: "Persistent Browser Profile",
                        value: "profile",
                        description: resolved.browser?.persistentProfile
                          ? "On"
                          : "Off",
                      },
                      {
                        title: "Browser Profile Directory",
                        value: "pdir",
                        description: resolved.browser?.profileDir || "(none)",
                      },
                      {
                        title: "Browser Locale",
                        value: "locale",
                        description: resolved.browser?.locale || "(default)",
                      },
                      {
                        title: "Browser Timezone",
                        value: "timezone",
                        description: resolved.browser?.timezone || "(default)",
                      },
                      {
                        title: "Browser Headers",
                        value: "bheaders",
                        description: `${Object.keys(resolved.browser?.headers ?? {}).length} entries`,
                      },
                      {
                        title: "Allowed Hosts",
                        value: "hosts",
                        description: `${resolved.network?.allowedHosts.length ?? 0} hosts`,
                      },
                      {
                        title: "Allowed Schemes",
                        value: "schemes",
                        description: (
                          resolved.network?.allowedSchemes ?? []
                        ).join(", "),
                      },
                    ]}
                    onSelect={(opt) => {
                      const next = structuredClone(resolved);
                      if (opt.value === "browser")
                        next.browser!.enabled = !next.browser!.enabled;
                      if (opt.value === "localhost")
                        next.network!.allowLocalhost =
                          !next.network!.allowLocalhost;
                      if (opt.value === "private")
                        next.network!.allowPrivate =
                          !next.network!.allowPrivate;
                      if (opt.value === "redact")
                        next.security!.redactToolOutput =
                          !next.security!.redactToolOutput;
                      if (opt.value === "profile") {
                        next.browser!.persistentProfile =
                          !next.browser!.persistentProfile;
                        void saveConfig(next);
                        return;
                      }
                      if (opt.value === "ep") {
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title="Web Search Endpoint"
                            placeholder={next.webSearch!.endpoint ?? ""}
                            onConfirm={(value) => {
                              next.webSearch!.endpoint = value.trim() || null;
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      if (opt.value === "search-priority") {
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title="Web Search Provider Priority"
                            description={() =>
                              "Comma-separated: configured, duckduckgo. Configured requires an endpoint."
                            }
                            placeholder={next.webSearch!.providerPriority.join(
                              ", ",
                            )}
                            onConfirm={(value) => {
                              const priority = value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(
                                  (item) =>
                                    item === "configured" ||
                                    item === "duckduckgo",
                                );
                              if (!priority.length) return;
                              next.webSearch!.providerPriority = priority;
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      if (opt.value === "env") {
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title="Env Allowlist"
                            description={() =>
                              "Comma-separated environment variable names."
                            }
                            placeholder={next.security!.envAllowlist.join(", ")}
                            onConfirm={(value) => {
                              next.security!.envAllowlist = value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean);
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      if (opt.value === "bbin" || opt.value === "bua") {
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title={
                              opt.value === "bbin"
                                ? "Browser Binary"
                                : "Browser User Agent"
                            }
                            placeholder={
                              opt.value === "bbin"
                                ? next.browser!.binary
                                : next.browser!.userAgent
                            }
                            onConfirm={(value) => {
                              if (opt.value === "bbin")
                                next.browser!.binary = value.trim();
                              else next.browser!.userAgent = value.trim();
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      if (["pdir", "locale", "timezone"].includes(opt.value)) {
                        const field =
                          opt.value === "pdir"
                            ? "profileDir"
                            : opt.value === "locale"
                              ? "locale"
                              : "timezone";
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title={`Browser ${field}`}
                            placeholder={next.browser![field]}
                            onConfirm={(value) => {
                              next.browser![field] = value.trim();
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      if (opt.value === "bheaders") {
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title="Browser Headers"
                            description={() =>
                              "JSON string record. Values are not shown in the settings list."
                            }
                            placeholder={JSON.stringify(next.browser!.headers)}
                            onConfirm={(value) => {
                              const headers = parseSettingsStringRecord(value);
                              if (!headers) return;
                              next.browser!.headers = headers;
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      if (opt.value === "hosts" || opt.value === "schemes") {
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title={
                              opt.value === "hosts"
                                ? "Allowed Hosts"
                                : "Allowed Schemes"
                            }
                            description={() => "Comma-separated values."}
                            placeholder={
                              opt.value === "hosts"
                                ? next.network!.allowedHosts.join(", ")
                                : next.network!.allowedSchemes.join(", ")
                            }
                            onConfirm={(value) => {
                              const values = value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean);
                              if (opt.value === "hosts")
                                next.network!.allowedHosts = values;
                              else next.network!.allowedSchemes = values;
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      void saveConfig(next);
                    }}
                  />
                ));
                break;
              case "workspace":
                ctx.dialog.push(() => (
                  <DialogSelect
                    title="Workspace"
                    options={[
                      {
                        title: "Root",
                        value: "root",
                        description:
                          resolved.workspace?.root || "(project root)",
                      },
                      {
                        title: "Instructions",
                        value: "instr",
                        description: resolved.instructions?.enabled
                          ? "On"
                          : "Off",
                      },
                      {
                        title: "Include README",
                        value: "readme",
                        description: resolved.instructions?.includeReadme
                          ? "On"
                          : "Off",
                      },
                      {
                        title: "Include Docs",
                        value: "docs",
                        description: resolved.instructions?.includeDocs
                          ? "On"
                          : "Off",
                      },
                      {
                        title: "Extra Files",
                        value: "extra",
                        description: `${resolved.instructions?.extraFiles?.length ?? 0} files`,
                      },
                    ]}
                    onSelect={(opt) => {
                      const next = structuredClone(resolved);
                      if (opt.value === "instr")
                        next.instructions!.enabled =
                          !next.instructions!.enabled;
                      if (opt.value === "readme")
                        next.instructions!.includeReadme =
                          !next.instructions!.includeReadme;
                      if (opt.value === "docs")
                        next.instructions!.includeDocs =
                          !next.instructions!.includeDocs;
                      if (opt.value === "root") {
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title="Workspace Root"
                            placeholder={next.workspace!.root}
                            onConfirm={(value) => {
                              next.workspace!.root = value.trim();
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      if (opt.value === "extra") {
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title="Instruction Extra Files"
                            description={() =>
                              "Comma-separated workspace-relative files."
                            }
                            placeholder={next.instructions!.extraFiles.join(
                              ", ",
                            )}
                            onConfirm={(value) => {
                              next.instructions!.extraFiles = value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean);
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      void saveConfig(next);
                    }}
                  />
                ));
                break;
              case "extensions":
                ctx.dialog.push(() => (
                  <DialogSelect
                    title="Extensions"
                    options={[
                      {
                        title: "Remote Skill URLs",
                        value: "skills",
                        description: `${resolved.skills.urls.length} sources`,
                      },
                      {
                        title: "Plugin Paths",
                        value: "plugin-paths",
                        description: `${resolved.plugins.paths.length} roots`,
                      },
                      {
                        title: "Plugin Enabled Overrides",
                        value: "plugin-enabled",
                        description: `${Object.keys(resolved.plugins.enabled).length} overrides`,
                      },
                      {
                        title: "Plugin Capabilities",
                        value: "plugin-capabilities",
                        description: `${Object.keys(resolved.plugins.capabilities).length} overrides`,
                      },
                      {
                        title: "Plugin Read-only Overrides",
                        value: "plugin-readonly",
                        description: `${Object.keys(resolved.plugins.readOnly).length} overrides`,
                      },
                      {
                        title: "Checkpoint Additional Directories",
                        value: "checkpoint-dirs",
                        description: `${resolved.checkpoint.additionalDirs.length} directories`,
                      },
                      {
                        title: "Workspace Additional Directories",
                        value: "workspace-dirs",
                        description: `${resolved.workspace.additionalDirs.length} directories`,
                      },
                    ]}
                    onSelect={(opt) => {
                      const next = structuredClone(resolved);
                      if (opt.value === "skills") {
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title="Remote Skill URLs"
                            description={() =>
                              "Comma-separated HTTP(S) skill index URLs."
                            }
                            placeholder={next.skills.urls.join(", ")}
                            onConfirm={(value) => {
                              next.skills.urls = value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean);
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      if (
                        opt.value === "plugin-paths" ||
                        opt.value.endsWith("dirs")
                      ) {
                        const target =
                          opt.value === "plugin-paths"
                            ? next.plugins.paths
                            : opt.value === "checkpoint-dirs"
                              ? next.checkpoint.additionalDirs
                              : next.workspace.additionalDirs;
                        ctx.dialog.push(() => (
                          <DialogPrompt
                            title={
                              opt.value === "plugin-paths"
                                ? "Plugin Paths"
                                : "Additional Directories"
                            }
                            description={() =>
                              "Comma-separated workspace-relative paths."
                            }
                            placeholder={target.join(", ")}
                            onConfirm={(value) => {
                              const paths = value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean);
                              if (opt.value === "plugin-paths")
                                next.plugins.paths = paths;
                              else if (opt.value === "checkpoint-dirs")
                                next.checkpoint.additionalDirs = paths;
                              else next.workspace.additionalDirs = paths;
                              void saveConfig(next);
                            }}
                          />
                        ));
                        return;
                      }
                      const current =
                        opt.value === "plugin-enabled"
                          ? next.plugins.enabled
                          : opt.value === "plugin-capabilities"
                            ? next.plugins.capabilities
                            : next.plugins.readOnly;
                      ctx.dialog.push(() => (
                        <DialogPrompt
                          title={
                            opt.value === "plugin-enabled"
                              ? "Plugin Enabled Overrides"
                              : opt.value === "plugin-capabilities"
                                ? "Plugin Capabilities"
                                : "Plugin Read-only Overrides"
                          }
                          description={() =>
                            "JSON record keyed by plugin ID. Values are not shown in this menu."
                          }
                          placeholder={JSON.stringify(current)}
                          onConfirm={(value) => {
                            const parsed = parseSettingsRecord(value);
                            if (!parsed) return;
                            if (opt.value === "plugin-enabled")
                              next.plugins.enabled = parsed as Record<
                                string,
                                boolean
                              >;
                            else if (opt.value === "plugin-capabilities")
                              next.plugins.capabilities = parsed as Record<
                                string,
                                Array<"tools" | "events">
                              >;
                            else
                              next.plugins.readOnly = parsed as Record<
                                string,
                                boolean
                              >;
                            void saveConfig(next);
                          }}
                        />
                      ));
                    }}
                  />
                ));
                break;
              case "runtime":
                ctx.dialog.push(() => (
                  <DialogSelect
                    title="Runtime Config"
                    options={[
                      {
                        title: "Max Steps",
                        value: "steps",
                        description: String(
                          resolved.runtime?.maxStepsPerTurn ?? 25,
                        ),
                      },
                      {
                        title: "Max Retry",
                        value: "retry",
                        description: String(
                          resolved.runtime?.maxAttemptsPerStep ?? 3,
                        ),
                      },
                      {
                        title: "Request Timeout",
                        value: "timeout",
                        description: `${resolved.runtime?.timeouts?.requestSec ?? 120}s`,
                      },
                      {
                        title: "Compaction",
                        value: "compact",
                        description: resolved.context?.compactionEnabled
                          ? "On"
                          : "Off",
                      },
                    ]}
                    onSelect={async (opt) => {
                      const next = structuredClone(resolved);
                      if (opt.value === "compact") {
                        next.context!.compactionEnabled =
                          !next.context!.compactionEnabled;
                        void saveConfig(next);
                        return;
                      }
                      const v = await DialogPrompt.show(
                        ctx.dialog,
                        opt.value === "steps"
                          ? "Max steps"
                          : opt.value === "retry"
                            ? "Max retry"
                            : "Timeout (sec)",
                        {
                          placeholder:
                            opt.value === "steps"
                              ? String(next.runtime!.maxStepsPerTurn)
                              : opt.value === "retry"
                                ? String(next.runtime!.maxAttemptsPerStep)
                                : String(
                                    next.runtime!.timeouts?.requestSec ?? 120,
                                  ),
                        },
                      );
                      if (v) {
                        if (opt.value === "steps")
                          next.runtime!.maxStepsPerTurn = Number(v) || 25;
                        if (opt.value === "retry")
                          next.runtime!.maxAttemptsPerStep = Number(v) || 3;
                        if (opt.value === "timeout")
                          next.runtime!.timeouts!.requestSec = Number(v) || 120;
                        void saveConfig(next);
                      }
                    }}
                  />
                ));
                break;
              case "tui":
                ctx.dialog.push(() => (
                  <DialogSelect
                    title="TUI Preferences"
                    options={[
                      {
                        title: "Tool Details",
                        value: "detail",
                        description: ctx.preferences().toolDetails ?? "expanded",
                      },
                      {
                        title: "Density",
                        value: "density",
                        description: ctx.preferences().density ?? "compact",
                      },
                      {
                        title: "Diff Style",
                        value: "diff",
                        description: ctx.preferences().diffStyle ?? "auto",
                      },
                      {
                        title: "Theme",
                        value: "theme",
                        description: ctx.preferences().theme ?? "natalia-dark",
                      },
                      {
                        title: "TUI Write Scope",
                        value: "scope",
                        description: ctx.tuiWriteScope() ?? "project",
                      },
                      {
                        title: "Config Write Scope",
                        value: "cscope",
                        description: ctx.configWriteScope(),
                      },
                      {
                        title: "Keybinds",
                        value: "keys",
                        description: `${Object.keys(ctx.preferences().keybinds ?? {}).length} overrides`,
                      },
                    ]}
                    onSelect={(opt) => {
                      if (opt.value === "detail")
                        ctx.updatePreferences({
                          ...ctx.preferences(),
                          toolDetails:
                            ctx.preferences().toolDetails === "expanded"
                              ? "collapsed"
                              : "expanded",
                        });
                      if (opt.value === "density")
                        ctx.updatePreferences({
                          ...ctx.preferences(),
                          density:
                            ctx.preferences().density === "compact"
                              ? "comfortable"
                              : "compact",
                        });
                      if (opt.value === "diff")
                        ctx.updatePreferences({
                          ...ctx.preferences(),
                          diffStyle:
                            ctx.preferences().diffStyle === "auto"
                              ? "stacked"
                              : "auto",
                        });
                      if (opt.value === "scope")
                        ctx.setTuiWriteScope(
                          ctx.tuiWriteScope() === "project" ? "global" : "project",
                        );
                      if (opt.value === "cscope")
                        ctx.setConfigWriteScope(
                          ctx.configWriteScope() === "project"
                            ? "global"
                            : "project",
                        );
                    }}
                  />
                ));
                break;
            }
          }}
        />
      ));
      return;
    }
    if (command === "status") {
      if (!ctx.backend.runtimeStatus) {
        ctx.toast.show({
          variant: "warning",
          message: "Runtime status unavailable",
        });
        return;
      }
      ctx.dialog.push(() => (
        <DialogStatus load={() => ctx.backend.runtimeStatus!()} />
      ));
      return;
    }
    if (command === "diagnostics") {
      if (!ctx.backend.diagnostics) {
        ctx.toast.show({
          variant: "warning",
          message: "Runtime diagnostics unavailable",
        });
        return;
      }
      ctx.dialog.push(() => (
        <DialogDiagnostics
          load={() => ctx.backend.diagnostics!()}
          copy={(text) => ctx.clipboard.write?.(text) ?? Promise.resolve()}
        />
      ));
      return;
    }
    if (command === "help.open") {
      ctx.dialog.push(() => <DialogHelp onClose={() => ctx.dialog.pop()} />);
      return;
    }
    if (command === "dialog.test") {
      try {
        void (async () => {
          const confirmed = await DialogConfirm.show(
            ctx.dialog,
            "Dialog Stack Test",
            "Press left/right to switch focus, Enter to confirm, Escape to cancel.",
          );
          if (confirmed === undefined) return;
          const name = await DialogPrompt.show(ctx.dialog, "Enter name", {
            placeholder: "Type something...",
          });
          if (name === null) return;
          ctx.toast.show({
            variant: "success",
            message: `Dialog test done: confirmed=${confirmed}, name="${name}"`,
          });
        })();
      } catch (error) {
        ctx.toast.show({
          variant: "error",
          message: `ctx.dialog.test failed: ${error}`,
        });
      }
      return;
    }
    if (command === "session.sidebar.toggle") {
      if (ctx.layout().wide) {
        ctx.setSidebarMode((value) => (value === "auto" ? "hide" : "auto"));
      } else {
        ctx.setSidebarOpen((value) => !value);
      }
      return;
    }
    if (command === "snapshot") {
      ctx.backend.snapshot();
      return;
    }
    if (command === "message.copy.last") {
      const block = [...ctx.state.messages]
        .reverse()
        .find((item) => ["assistant", "tool", "subagent"].includes(item.role));
      const text = block?.tool?.result?.detail || block?.text;
      if (!text || !ctx.clipboard.write) {
        ctx.toast.show({
          variant: "warning",
          message: "No message available to copy",
        });
        return;
      }
      void ctx.clipboard.write(text).then(
        () =>
          ctx.toast.show({ variant: "success", message: "Copied to clipboard" }),
        (error: any) => ctx.toast.error(error),
      );
      return;
    }
    if (command === "session.fork.last") {
      const turnID = ctx.state.lastSubmission?.id;
      if (!ctx.state.sessionID || !turnID || !ctx.backend.sessionFork) {
        ctx.toast.show({
          variant: "warning",
          message: "No submitted message or fork-capable runtime is available",
        });
        return;
      }
      void ctx.backend.sessionFork(ctx.state.sessionID, turnID).then(
        (fork) => {
          ctx.composer()?.setText(ctx.state.lastSubmission!.text);
          ctx.setComposerText(ctx.state.lastSubmission!.text);
          ctx.composer()?.gotoBufferEnd();
          ctx.toast.show({
            variant: "success",
            message: `Forked session ${fork.id}`,
          });
          ctx.changeSession(fork.id);
        },
        (error) => ctx.toast.error(error),
      );
      return;
    }
    if (command === "composer.submit") {
      void ctx.submit();
      return;
    }
    if (command === "composer.newline") {
      ctx.composer()?.insertText("\n");
      return;
    }
    if (command === "composer.buffer-home") {
      ctx.composer()?.gotoBufferHome();
      return;
    }
    if (command === "composer.buffer-end") {
      ctx.composer()?.gotoBufferEnd();
      return;
    }
    if (command === "cancel") {
      ctx.backend.cancel();
      return;
    }
    if (command === "exit") {
      if (!ctx.composer()?.plainText) ctx.renderer.destroy();
      return;
    }
    if (command === "ctx.dialog.close") {
      (ctx.route as any).back();
      return;
    }
    if (command === "terminal.focus-toggle") {
      if (ctx.state.terminalPane.selectedID)
        ctx.dispatch({
          type: "terminal.pane.focus",
          focus: ctx.state.terminalPane.focus === "chat" ? "terminal" : "chat",
        });
      return;
    }
    if (command === "terminal.manage") {
      ctx.dialog.push(() => <DialogTerminal backend={ctx.backend} />);
      return;
    }
    if (command === "checkpoint.manage") {
      ctx.dialog.push(() => <DialogCheckpoint backend={ctx.backend} />);
      return;
    }
    if (command === "sandbox.manage") {
      ctx.dialog.push(() => <DialogSandbox backend={ctx.backend} />);
      return;
    }
    if (command === "constitution.list") {
      void ctx.backend.constitutionRules?.().then(
        (rules) => ctx.dialog.push(() => <DialogConstitution rules={rules} />),
        (error: any) => ctx.toast.error(error),
      );
      return;
    }
    if (command === "decision.list") {
      void ctx.backend.decisionRecords?.().then(
        (records) => ctx.dialog.push(() => <DialogDecision records={records} />),
        (error: any) => ctx.toast.error(error),
      );
      return;
    }
    if (command === "evidence.list") {
      void ctx.backend.evidenceRecords?.().then(
        (records) => ctx.dialog.push(() => <DialogEvidence records={records} />),
        (error: any) => ctx.toast.error(error),
      );
      return;
    }
    if (command === "workgraph.list") {
      void Promise.all([
        ctx.backend.workGraphNodes?.() ?? Promise.resolve([]),
        ctx.backend.workGraphEdges?.() ?? Promise.resolve([]),
      ]).then(
        ([nodes]) => ctx.dialog.push(() => <DialogWorkGraph nodes={nodes} />),
        (error: any) => ctx.toast.error(error),
      );
      return;
    }
    // Plugin commands
    for (const pluginCmd of getPluginCommands()) {
      if (pluginCmd.name === command) {
        pluginCmd.run();
        return;
      }
    }
  }
