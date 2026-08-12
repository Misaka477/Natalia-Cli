"use client";
import { type TextareaRenderable } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { useKeymap, useKeymapSelector } from "@opentui/keymap/solid";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readClipboardImage } from "../clipboard";
import type {
  ConfigV2,
  MCPResourceCatalog,
  RuntimeClient,
} from "@natalia/contracts";
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ConfigPatch extends Record<string, unknown> {}
import {
  configWithoutPermissionProfile,
  deleteFlowDocument,
  deleteTaskDocument,
  configureTaskSystemd,
  flowOverview,
  installExampleDocuments,
  grantablePermissionTools,
  loadTaskDocument,
  permissionProfileRemovalProblem,
  permissionProfileUsage,
  removeTaskSystemd,
  previewSystemdCalendar,
  saveTaskDocument,
  scheduledTaskOverview,
  taskPermissionPreviewForDocument,
  type PermissionProfileUsage,
} from "@natalia/client";

/** Every editor the Settings menu can open. */
type SettingsAction =
  | "provider"
  | "edit-provider"
  | "delete-provider"
  | "theme"
  | "mcp"
  | "model"
  | "permission"
  | "mode"
  | "model.edit"
  | "web"
  | "workspace"
  | "extensions"
  | "runtime"
  | "tui";
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
import {
  DialogSessionList,
  DialogDiagnostics,
  DialogStatus,
  DialogHelp,
} from "../dialog/DialogLayer";
import { DialogProviderSetup } from "../component/DialogProviderSetup";
import { DialogModel } from "../component/DialogModel";
import { DialogFlows } from "../component/DialogFlows";
import {
  DialogScheduledTasks,
  resolveCliEntry,
  runScheduledTaskProcess,
} from "../component/DialogScheduledTasks";
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
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { DialogConfirm } from "../dialog/DialogConfirm";
import {
  DialogCapabilities,
  DialogDriftFindings,
  DialogSessionSnapshot,
  DialogRegisteredTools,
  DialogConstitution,
  DialogDecision,
  DialogEvidence,
  DialogWorkGraph,
} from "../dialog/DialogLayer";
import { useDialog, type DialogContext } from "../dialog/provider";
import type { TuiConfigWriteScope } from "../config";
import {
  editPromptExternally,
  retainEditorMentions,
} from "../prompt/external-editor";
import { PromptHistory, shouldUseHistory } from "../prompt/history";
import type { TuiPreferences } from "../settings";
import {
  parseSettingsStringRecord,
  parseSettingsRecord,
} from "./settings-utils";
import { previewCommandRuleImport } from "./permission-command-rules";
import { themeTokens as darkTheme } from "../theme/theme";
import { discoverProviderModels } from "@natalia/config";
import { DialogToolMultiSelect } from "../component/DialogToolMultiSelect";

export interface CommandContext {
  backend: RuntimeClient;
  workspaceRoot?: string;
  composer: () => TextareaRenderable | undefined;
  setAttachmentPaths: (fn: (current: string[]) => string[]) => void;
  setMentionAgents: (fn: (current: string[]) => string[]) => void;
  setMentionResources: (
    fn: (current: MCPResourceCatalog[]) => MCPResourceCatalog[],
  ) => void;
  attachmentPaths: () => string[];
  changeSession: (sessionID?: string) => void;
  persistConfig: (next: ConfigPatch, base?: ConfigV2) => Promise<void>;
  toast: { show: (msg: any) => void; error: (err: unknown) => void };
  dialog: DialogContext;
  local: {
    state: { activeAgent?: string };
    stashPrompt: (text: string) => boolean;
  };
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

export async function runCommand(command: string, ctx: CommandContext) {
  if (command === "palette.toggle") {
    ctx.dialog.replace(() => (
      <CommandPalette onRun={(cmd) => runCommand(cmd, ctx)} />
    ));
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
      <DialogSessionList
        backend={sessionBackend}
        onSelect={ctx.changeSession}
      />
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
  if (command === "prompt.attachment.paste-image") {
    const root = ctx.workspaceRoot ?? process.cwd();
    const bytes = await readClipboardImage();
    if (!bytes || bytes.length === 0) {
      ctx.toast.error(
        "no image on the system clipboard (needs wl-paste/xclip on Linux, osascript on macOS, or PowerShell on Windows)",
      );
      return;
    }
    const dir = join(root, ".natalia", "attachments");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const filename = `pasted-${Date.now()}.png`;
    await Bun.write(join(dir, filename), bytes);
    const relative = `.natalia/attachments/${filename}`;
    ctx.setAttachmentPaths((current) =>
      current.includes(relative) ? current : [...current, relative],
    );
    ctx.toast.show(`queued clipboard image: ${relative}`);
    setTimeout(() => ctx.composer()?.focus(), 1);
    return;
  }
  if (command === "prompt.attachment.remove") {
    const current = ctx.attachmentPaths();
    if (current.length === 0) return;
    const removed = current[current.length - 1]!;
    ctx.setAttachmentPaths((items) => items.filter((item) => item !== removed));
    ctx.toast.show(
      `removed attachment: ${removed.split("/").at(-1) ?? removed} (Alt+O lists all)`,
    );
    setTimeout(() => ctx.composer()?.focus(), 1);
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
                delete (resolved.models as Record<string, unknown>)[opt.value];
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
                          videoInput: false,
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
                                videoInput: false,
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
                          videoInput: false,
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
          statuses={ctx.state.facts.mcp}
          onPersist={(next) =>
            void ctx.persistConfig(next, resolved).catch(ctx.toast.error)
          }
        />
      ));
    });
    return;
  }
  if (command === "task.manage" || command === "flow.manage") {
    // runCommand stays synchronous, so the load runs detached like the other
    // dialogs that need configuration before they can be presented.
    void (async () => {
      const workspaceRoot = ctx.workspaceRoot ?? process.cwd();
      if (command === "flow.manage") {
        const [overview, resolved] = await Promise.all([
          flowOverview({ workspaceRoot }),
          resolveConfig({ workspaceRoot }),
        ]).catch((error: unknown) => {
          ctx.toast.error(
            error instanceof Error ? error.message : String(error),
          );
          return [undefined, undefined] as const;
        });
        if (!overview || !resolved) return;
        // DialogProvider only renders the top stack entry. Keep the overview in
        // this owner so returning from an editor sees the save without reopening
        // the command palette.
        const [flows, setFlows] = createSignal(overview);
        ctx.dialog.push(() => (
          <DialogFlows
            overview={flows()}
            workspaceRoot={workspaceRoot}
            config={resolved.config}
            deleteFlow={(path) => deleteFlowDocument({ workspaceRoot, path })}
            installExamples={() => installExampleDocuments({ workspaceRoot })}
            reload={async () => {
              setFlows(await flowOverview({ workspaceRoot }));
            }}
            notify={(outcome) =>
              ctx.toast.show({
                variant: outcome.ok ? "success" : "error",
                message: outcome.message,
              })
            }
          />
        ));
        return;
      }
      const resolved = (await resolveConfig({ workspaceRoot })).config;
      const loadOverview = () =>
        scheduledTaskOverview({ workspaceRoot, config: resolved });
      const [overview, initialFlows] = await Promise.all([
        loadOverview(),
        flowOverview({ workspaceRoot }),
      ]).catch((error: unknown) => {
        ctx.toast.error(error instanceof Error ? error.message : String(error));
        return [undefined, undefined] as const;
      });
      if (!overview || !initialFlows) return;
      // The provider unmounts this dialog while the detail view is open, so the
      // overview is held here and refreshed in place.
      const [tasks, setTasks] = createSignal(overview);
      const [flows, setFlows] = createSignal(initialFlows);
      ctx.dialog.push(() => (
        <DialogScheduledTasks
          overview={tasks()}
          flows={flows()}
          config={resolved}
          workspaceRoot={workspaceRoot}
          reload={async () => {
            const [nextTasks, nextFlows] = await Promise.all([
              loadOverview(),
              flowOverview({ workspaceRoot }),
            ]);
            setTasks(nextTasks);
            setFlows(nextFlows);
          }}
          runTask={(taskPath) =>
            runScheduledTaskProcess({ taskPath, workspaceRoot })
          }
          loadTask={(path) => loadTaskDocument({ workspaceRoot, path })}
          saveTask={(document, path) =>
            saveTaskDocument({ workspaceRoot, document, path }).then(
              () => undefined,
            )
          }
          deleteTask={(path) => deleteTaskDocument({ workspaceRoot, path })}
          installExamples={() =>
            installExampleDocuments({ workspaceRoot, includeTasks: true })
          }
          previewPermissions={(path) =>
            taskPermissionPreviewForDocument({
              workspaceRoot,
              path,
              config: resolved,
            })
          }
          configureSystemd={({ path, calendar, scope }) => {
            const cliEntry = resolveCliEntry();
            return configureTaskSystemd({
              workspaceRoot,
              path,
              calendar,
              scope,
              executable: cliEntry ? process.execPath : "natalia-ts",
              ...(cliEntry ? { cliEntry } : {}),
            }).then(({ commands }) => ({ commands }));
          }}
          removeSystemd={(path) =>
            removeTaskSystemd({ workspaceRoot, path }).then(({ commands }) => ({
              commands,
            }))
          }
          previewCalendar={(calendar) => previewSystemdCalendar(calendar)}
          notify={(outcome) =>
            ctx.toast.show({
              variant: outcome.ok ? "success" : "warning",
              message: outcome.message,
            })
          }
        />
      ));
    })();
    return;
  }
  if (command === "settings.open") {
    let settingsBase: ConfigV2 | undefined;
    async function saveConfig(next: ConfigPatch) {
      try {
        await ctx.persistConfig(next, settingsBase);
        return true;
      } catch (error) {
        ctx.toast.error(error);
        return false;
      }
    }
    // The option values and the switch below are the same union, so a typo on
    // either side is a compile error instead of a menu entry that does nothing.
    const settingsOptions: DialogSelectOption<SettingsAction>[] = [
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
        description: "Max steps, retry, terminal window",
      },
      {
        title: "TUI Preferences",
        value: "tui",
        description: "Density, diff style, keybinds",
      },
    ];
    ctx.dialog.push(() => (
      <DialogSelect
        title="Settings"
        options={settingsOptions}
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
                          p.customHeaders && Object.keys(p.customHeaders).length
                            ? JSON.stringify(p.customHeaders)
                            : "{}",
                      },
                    );
                    if (newHeaders === null || newHeaders === undefined) return;
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
                  statuses={ctx.state.facts.mcp}
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
            case "permission": {
              const workspaceRoot = ctx.workspaceRoot ?? process.cwd();
              const [profilesRevision, setProfilesRevision] = createSignal(0);
              const openPermissionProfileEditor = (name: string) => {
                if (!resolved.permissionProfiles[name]) return;
                ctx.dialog.push(() => {
                  const [profile, setProfile] = createSignal(
                    structuredClone(resolved.permissionProfiles[name]!),
                  );
                  const saveProfile = async (next: ConfigV2) => {
                    const target = next.permissionProfiles[name];
                    if (!target || !(await saveConfig(next))) return false;
                    const saved = structuredClone(target);
                    resolved.permissionProfiles[name] = saved;
                    setProfile(structuredClone(saved));
                    setProfilesRevision((revision) => revision + 1);
                    return true;
                  };
                  return (
                    <DialogSelect
                      title={`Permission Profile: ${name}`}
                      options={[
                        {
                          title: "Approval Mode",
                          value: "approval",
                          description: profile().approval,
                        },
                        {
                          title: "Description",
                          value: "description",
                          description: profile().description || "(none)",
                        },
                        {
                          title: "Command Rules",
                          value: "commandRules",
                          description: profile().commandRules
                            ? `${profile().commandRules!.mode}, ${profile().commandRules!.rules.length} commands`
                            : "not configured",
                        },
                        {
                          title: "Allowed Tools",
                          value: "tools",
                          description: profile().permissions?.tools?.allow
                            ?.length
                            ? profile().permissions!.tools!.allow!.join(", ")
                            : "every tool the runtime offers (no allow-list)",
                        },
                        {
                          title: "Excluded Tools",
                          value: "excludedTools",
                          description: profile().permissions?.tools?.exclude
                            ?.length
                            ? profile().permissions!.tools!.exclude!.join(", ")
                            : "none",
                        },
                        {
                          title: "Interactive Programs",
                          value: "interactivePrograms",
                          description:
                            profile().interactivePrograms?.allow.length ||
                            profile().interactivePrograms?.allowAny
                              ? profile().interactivePrograms?.allowAny
                                ? "any launch command · high risk"
                                : `${profile().interactivePrograms!.allow.length} high-risk launch commands`
                              : "disabled (no launch commands allowed)",
                        },
                        {
                          title: "Extensions",
                          value: "extensions",
                          description: ["skills", "mcp", "plugins"]
                            .map(
                              (extension) =>
                                `${extension}=${
                                  profile().extensions?.[
                                    extension as "skills" | "mcp" | "plugins"
                                  ] === false
                                    ? "off"
                                    : "on"
                                }`,
                            )
                            .join(", "),
                        },
                      ]}
                      onSelect={(field) => {
                        const next = structuredClone(resolved);
                        const target = next.permissionProfiles[name];
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
                              onSelect={async (choice) => {
                                target.approval =
                                  choice.value as typeof target.approval;
                                if (await saveProfile(next)) ctx.dialog.pop();
                              }}
                            />
                          ));
                          return;
                        }
                        if (field.value === "tools") {
                          const allowed =
                            target.permissions?.tools?.allow ??
                            ([] as string[]);
                          const writeTools = (tools: string[]) => {
                            target.permissions = {
                              ...target.permissions,
                              tools: {
                                allow: tools,
                                exclude:
                                  target.permissions?.tools?.exclude ??
                                  ([] as string[]),
                              },
                            };
                            void saveProfile(next);
                          };
                          void (async () => {
                            const registered =
                              (await ctx.backend
                                .registeredTools?.()
                                .catch(() => [])) ?? [];
                            const descriptions = new Map(
                              registered.map((tool) => [
                                tool.name,
                                `${tool.owner} · ${tool.requiresApproval ? "approval required" : "no approval"}`,
                              ]),
                            );
                            const tools = [
                              ...new Set([
                                ...registered.map((tool) => tool.name),
                                ...grantablePermissionTools(),
                                ...allowed,
                              ]),
                            ]
                              .sort((a, b) => a.localeCompare(b))
                              .map((tool) => ({
                                name: tool,
                                description:
                                  descriptions.get(tool) ?? "Capability tool",
                              }));
                            ctx.dialog.push(() => (
                              <DialogToolMultiSelect
                                title={`Allowed Tools: ${name}`}
                                tools={tools}
                                selected={allowed}
                                onSave={writeTools}
                              />
                            ));
                          })();
                          return;
                        }
                        if (field.value === "excludedTools") {
                          const excluded =
                            target.permissions?.tools?.exclude ??
                            ([] as string[]);
                          const writeExcludedTools = (tools: string[]) => {
                            target.permissions = {
                              ...target.permissions,
                              tools: {
                                allow:
                                  target.permissions?.tools?.allow ??
                                  ([] as string[]),
                                exclude: tools,
                              },
                            };
                            void saveProfile(next);
                          };
                          void (async () => {
                            const registered =
                              (await ctx.backend
                                .registeredTools?.()
                                .catch(() => [])) ?? [];
                            const descriptions = new Map(
                              registered.map((tool) => [
                                tool.name,
                                `${tool.owner} · ${tool.requiresApproval ? "approval required" : "no approval"}`,
                              ]),
                            );
                            const tools = [
                              ...new Set([
                                ...registered.map((tool) => tool.name),
                                ...grantablePermissionTools(),
                                ...excluded,
                              ]),
                            ]
                              .sort((a, b) => a.localeCompare(b))
                              .map((tool) => ({
                                name: tool,
                                description:
                                  descriptions.get(tool) ?? "Capability tool",
                              }));
                            ctx.dialog.push(() => (
                              <DialogToolMultiSelect
                                title={`Excluded Tools: ${name}`}
                                tools={tools}
                                selected={excluded}
                                onSave={writeExcludedTools}
                              />
                            ));
                          })();
                          return;
                        }
                        if (field.value === "interactivePrograms") {
                          ctx.dialog.push(() => (
                            <DialogSelect
                              title="Interactive Programs · High Risk"
                              options={[
                                {
                                  title: "Allow any interactive program",
                                  value: "$allow-any",
                                  description: target.interactivePrograms
                                    ?.allowAny
                                    ? "ON · unrestricted after foreground confirmation"
                                    : "OFF · use the explicit launch-command list below",
                                },
                                {
                                  title: "+ Add launch commands",
                                  value: "$add",
                                  description:
                                    "Explicitly allow editors, REPLs, or database clients to own terminal input.",
                                },
                                ...(
                                  target.interactivePrograms?.allow ?? []
                                ).map((rule) => ({
                                  title: rule.command,
                                  value: rule.command,
                                  description:
                                    rule.reason ?? "select to remove",
                                })),
                              ]}
                              emptyView={
                                <text fg={darkTheme.muted}>
                                  Disabled. Terminal input remains under Bash
                                  command policy.
                                </text>
                              }
                              onSelect={(choice) => {
                                if (choice.value === "$allow-any") {
                                  if (target.interactivePrograms?.allowAny) {
                                    target.interactivePrograms = {
                                      allowAny: false,
                                      allow:
                                        target.interactivePrograms.allow ?? [],
                                    };
                                    void saveProfile(next).then((saved) => {
                                      if (saved) ctx.dialog.pop();
                                    });
                                    return;
                                  }
                                  void DialogConfirm.show(
                                    ctx.dialog,
                                    "Allow any interactive program?",
                                    "High risk: any simple launch command that passes command policy may take over the terminal after OS foreground confirmation. Its later input bypasses Bash Command Rules, including shells, REPLs, editors, and database clients.",
                                  ).then((confirmed) => {
                                    if (!confirmed) return;
                                    target.interactivePrograms = {
                                      allowAny: true,
                                      allow:
                                        target.interactivePrograms?.allow ?? [],
                                    };
                                    void saveProfile(next).then((saved) => {
                                      if (saved) ctx.dialog.pop();
                                    });
                                  });
                                  return;
                                }
                                if (choice.value === "$add") {
                                  setTimeout(() => {
                                    void DialogPrompt.show(
                                      ctx.dialog,
                                      "Allow Interactive Programs",
                                      {
                                        description: () => (
                                          <text fg={darkTheme.warning}>
                                            High risk: after a listed launch
                                            command takes the foreground, its
                                            input follows that program protocol
                                            instead of Bash command rules. One
                                            simple Bash launch command per line;
                                            complex shell syntax is rejected.
                                          </text>
                                        ),
                                        placeholder: "vim\npython\npsql",
                                      },
                                    ).then(async (input) => {
                                      if (input === null) return;
                                      const preview =
                                        await previewCommandRuleImport(
                                          input,
                                          target.interactivePrograms?.allow,
                                        );
                                      ctx.dialog.push(() => (
                                        <DialogSelect
                                          title="Interactive Program Preview · High Risk"
                                          skipFilter
                                          options={[
                                            {
                                              title: preview.rejected
                                                ? "Fix rejected launch commands"
                                                : `Allow ${preview.rules.length} launch commands`,
                                              value: "$save",
                                              description: preview.rejected
                                                ? "Invalid commands are never saved."
                                                : "Foreground process confirmation is required at runtime.",
                                              disabled: preview.rejected,
                                            },
                                            ...preview.previews.map(
                                              (entry) => ({
                                                title: `${entry.line}: ${entry.command || "(blank)"}`,
                                                value: `line:${entry.line}`,
                                                description: `${entry.status}: ${entry.detail}`,
                                              }),
                                            ),
                                          ]}
                                          onSelect={(previewChoice) => {
                                            if (previewChoice.value !== "$save")
                                              return;
                                            target.interactivePrograms = {
                                              allowAny:
                                                target.interactivePrograms
                                                  ?.allowAny ?? false,
                                              allow: [
                                                ...(target.interactivePrograms
                                                  ?.allow ?? []),
                                                ...preview.rules,
                                              ],
                                            };
                                            void saveProfile(next);
                                          }}
                                        />
                                      ));
                                    });
                                  }, 0);
                                  return;
                                }
                                void DialogConfirm.show(
                                  ctx.dialog,
                                  "Remove interactive program",
                                  `Stop allowing "${choice.value}" to own terminal input?`,
                                ).then((confirmed) => {
                                  if (!confirmed) return;
                                  target.interactivePrograms = {
                                    allowAny:
                                      target.interactivePrograms?.allowAny ??
                                      false,
                                    allow: (
                                      target.interactivePrograms?.allow ?? []
                                    ).filter(
                                      (rule) => rule.command !== choice.value,
                                    ),
                                  };
                                  void saveProfile(next);
                                });
                              }}
                            />
                          ));
                          return;
                        }
                        if (field.value === "extensions") {
                          ctx.dialog.push(() => (
                            <DialogSelect
                              title="Profile Extensions"
                              options={(
                                ["skills", "mcp", "plugins"] as const
                              ).map((extension) => ({
                                title: extension,
                                value: extension,
                                description:
                                  target.extensions?.[extension] === false
                                    ? "disabled"
                                    : "enabled",
                              }))}
                              onSelect={(choice) => {
                                const extension = choice.value as
                                  | "skills"
                                  | "mcp"
                                  | "plugins";
                                target.extensions = {
                                  ...target.extensions,
                                  [extension]:
                                    target.extensions?.[extension] === false,
                                };
                                void saveProfile(next);
                              }}
                            />
                          ));
                          return;
                        }
                        if (field.value === "commandRules") {
                          ctx.dialog.push(() => (
                            <DialogSelect
                              title="Command Rules"
                              options={[
                                {
                                  title: "Mode",
                                  value: "$mode",
                                  description:
                                    target.commandRules?.mode ?? "none",
                                },
                                {
                                  title: "+ Add commands",
                                  value: "$add",
                                  description:
                                    "Paste one Bash command per line.",
                                },
                                ...(target.commandRules?.rules ?? []).map(
                                  (rule) => ({
                                    title: rule.command,
                                    value: rule.command,
                                    description:
                                      rule.reason ?? "select to remove",
                                  }),
                                ),
                              ]}
                              onSelect={(choice) => {
                                if (choice.value === "$mode") {
                                  ctx.dialog.push(() => (
                                    <DialogSelect
                                      title="Command Rule Mode"
                                      current={
                                        target.commandRules?.mode ?? "none"
                                      }
                                      options={[
                                        {
                                          title: "Blacklist",
                                          value: "blacklist",
                                          description:
                                            "Block matching commands; other commands pass this layer.",
                                        },
                                        {
                                          title: "Whitelist",
                                          value: "whitelist",
                                          description:
                                            "Only matching commands pass this layer. Recommended for unattended tasks.",
                                        },
                                        {
                                          title: "None",
                                          value: "none",
                                          description:
                                            "Do not apply profile command rules.",
                                        },
                                      ]}
                                      onSelect={(mode) => {
                                        target.commandRules = {
                                          mode: mode.value as
                                            | "blacklist"
                                            | "whitelist"
                                            | "none",
                                          rules:
                                            target.commandRules?.rules ?? [],
                                        };
                                        void saveProfile(next);
                                      }}
                                    />
                                  ));
                                  return;
                                }
                                if (choice.value === "$add")
                                  setTimeout(() => {
                                    void DialogPrompt.show(
                                      ctx.dialog,
                                      "Add Commands",
                                      {
                                        description: () => (
                                          <text fg={darkTheme.muted}>
                                            One Bash command per line. Blank
                                            lines and # comments are ignored.
                                            Complex shell syntax is rejected
                                            before saving.
                                          </text>
                                        ),
                                        placeholder: "git diff\ngit status",
                                      },
                                    ).then(async (input) => {
                                      if (input === null) return;
                                      const preview =
                                        await previewCommandRuleImport(
                                          input,
                                          target.commandRules?.rules,
                                        );
                                      ctx.dialog.push(() => (
                                        <DialogSelect
                                          title="Command Rule Preview"
                                          skipFilter
                                          options={[
                                            {
                                              title: preview.rejected
                                                ? "Fix rejected commands before saving"
                                                : `Save ${preview.rules.length} commands`,
                                              value: "$save",
                                              description: preview.rejected
                                                ? "Invalid commands are never saved."
                                                : `${target.commandRules?.mode ?? "none"} mode`,
                                              disabled: preview.rejected,
                                            },
                                            ...preview.previews.map(
                                              (entry) => ({
                                                title: `${entry.line}: ${entry.command || "(blank)"}`,
                                                value: `line:${entry.line}`,
                                                description: `${entry.status}: ${entry.detail}`,
                                              }),
                                            ),
                                          ]}
                                          onSelect={(choice) => {
                                            if (choice.value !== "$save")
                                              return;
                                            target.commandRules = {
                                              mode:
                                                target.commandRules?.mode ??
                                                "none",
                                              rules: [
                                                ...(target.commandRules
                                                  ?.rules ?? []),
                                                ...preview.rules,
                                              ],
                                            };
                                            void saveProfile(next);
                                          }}
                                        />
                                      ));
                                    });
                                  }, 0);
                                else {
                                  void DialogConfirm.show(
                                    ctx.dialog,
                                    "Remove command rule",
                                    `Remove "${choice.value}" from this profile?`,
                                  ).then((confirmed) => {
                                    if (!confirmed) return;
                                    target.commandRules = {
                                      mode: target.commandRules?.mode ?? "none",
                                      rules: (
                                        target.commandRules?.rules ?? []
                                      ).filter(
                                        (rule) => rule.command !== choice.value,
                                      ),
                                    };
                                    void saveProfile(next);
                                  });
                                }
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
                              void saveProfile(next);
                            }}
                          />
                        ));
                      }}
                    />
                  );
                });
              };
              const removePermissionProfile = async (name: string) => {
                const usage = await permissionProfileUsage({
                  workspaceRoot,
                }).catch(() => ({}) as PermissionProfileUsage);
                const problem = permissionProfileRemovalProblem({
                  config: resolved,
                  name,
                  usage,
                });
                // A profile is the outer boundary of every run that selects it,
                // so refusing is the safe answer: deleting one out from under a
                // task or the default would move runs onto a different boundary
                // without anyone choosing that.
                if (problem) {
                  ctx.toast.error(`Cannot delete ${name}: ${problem}`);
                  return;
                }
                const confirmed = await DialogConfirm.show(
                  ctx.dialog,
                  "Delete permission profile",
                  `Delete ${name}? Existing runs and tasks keep their own selected profile.`,
                );
                if (!confirmed) return;
                await saveConfig(
                  configWithoutPermissionProfile({
                    config: resolved,
                    name,
                    usage,
                  }),
                );
                ctx.dialog.pop();
              };
              ctx.dialog.push(() => (
                <DialogSelect
                  title="Permission Profiles"
                  current={resolved.defaultPermission}
                  options={[
                    ...Object.entries(
                      (() => {
                        profilesRevision();
                        return resolved.permissionProfiles ?? {};
                      })(),
                    ).map(([name, p]) => ({
                      title: name,
                      value: name,
                      description:
                        (p as any).description ?? (p as any).approval ?? "-",
                      footer:
                        name === resolved.defaultPermission
                          ? `default · ${(p as any).approval}`
                          : (p as any).approval,
                    })),
                    {
                      title: "+ Create new profile",
                      value: "$new",
                      description: "Add a permission profile",
                    },
                  ]}
                  actions={[
                    {
                      command: "permission.dialog.edit",
                      title: "edit",
                      disabled: (option) => !option || option.value === "$new",
                      onTrigger: (option) =>
                        void openPermissionProfileEditor(option.value),
                    },
                    {
                      command: "permission.dialog.delete",
                      title: "delete",
                      disabled: (option) => !option || option.value === "$new",
                      onTrigger: (option) =>
                        void removePermissionProfile(option.value),
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
                                Create a named permission profile and select it
                                as the default.
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
                          // A fresh profile only asks for approval; the boundary
                          // that makes it useful is edited next.
                          void openPermissionProfileEditor(name);
                        });
                      }, 0);
                      return;
                    }
                    resolved.defaultPermission = opt.value;
                    void saveConfig(resolved);
                    ctx.dialog.pop();
                  }}
                />
              ));
              break;
            }
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
                              Create a named mode and select it as the default.
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
                                    ...Object.keys(next.permissionProfiles).map(
                                      (value) => ({
                                        title: value,
                                        value,
                                      }),
                                    ),
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
                                  else target.model = value.trim() || undefined;
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
                      description: resolved.webSearch?.endpoint ?? "(not set)",
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
                      next.network!.allowPrivate = !next.network!.allowPrivate;
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
                      description: resolved.workspace?.root || "(project root)",
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
                      next.instructions!.enabled = !next.instructions!.enabled;
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
                          placeholder={next.instructions!.extraFiles.join(", ")}
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
                        resolved.runtime?.maxStepsPerTurn ?? "unlimited",
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
                    {
                      title: "Terminal Window",
                      value: "window-mode",
                      description: `${
                        resolved.runtime?.terminal?.windowMode ?? "auto"
                      } (auto: open window, degrade if attach fails; windowless: never open; window: always require)`,
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
                    if (opt.value === "window-mode") {
                      const order = ["auto", "windowless", "window"] as const;
                      const current =
                        next.runtime?.terminal?.windowMode ?? "auto";
                      const index = order.indexOf(
                        current as (typeof order)[number],
                      );
                      next.runtime!.terminal = {
                        windowMode: order[(index + 1) % order.length],
                      };
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
                            ? String(
                                next.runtime?.maxStepsPerTurn ?? "unlimited",
                              )
                            : opt.value === "retry"
                              ? String(next.runtime!.maxAttemptsPerStep)
                              : String(
                                  next.runtime!.timeouts?.requestSec ?? 120,
                                ),
                      },
                    );
                    if (v) {
                      if (opt.value === "steps") {
                        if (v && Number(v) > 0)
                          next.runtime!.maxStepsPerTurn = Number(v);
                        else delete next.runtime!.maxStepsPerTurn;
                      }
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
                        ctx.tuiWriteScope() === "project"
                          ? "global"
                          : "project",
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
    const turnID = ctx.state.facts.lastSubmission?.id;
    if (!ctx.state.facts.sessionID || !turnID || !ctx.backend.sessionFork) {
      ctx.toast.show({
        variant: "warning",
        message: "No submitted message or fork-capable runtime is available",
      });
      return;
    }
    void ctx.backend.sessionFork(ctx.state.facts.sessionID, turnID).then(
      (fork) => {
        ctx.composer()?.setText(ctx.state.facts.lastSubmission!.text);
        ctx.setComposerText(ctx.state.facts.lastSubmission!.text);
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
      ([nodes, edges]) =>
        ctx.dialog.push(() => <DialogWorkGraph nodes={nodes} edges={edges} />),
      (error: any) => ctx.toast.error(error),
    );
    return;
  }
  if (command === "capability.list") {
    void (ctx.backend.capabilities?.() ?? Promise.resolve([])).then(
      (caps) => ctx.dialog.push(() => <DialogCapabilities caps={caps} />),
      (error: any) => ctx.toast.error(error),
    );
    return;
  }
  if (command === "tools.registered") {
    void (ctx.backend.registeredTools?.() ?? Promise.resolve([])).then(
      (tools) => ctx.dialog.push(() => <DialogRegisteredTools tools={tools} />),
      (error: any) => ctx.toast.error(error),
    );
    return;
  }
  if (command === "drift.list") {
    void (ctx.backend.driftFindings?.() ?? Promise.resolve([])).then(
      (findings) =>
        ctx.dialog.push(() => <DialogDriftFindings findings={findings} />),
      (error: any) => ctx.toast.error(error),
    );
    return;
  }
  if (command === "session.snapshot") {
    void (ctx.backend.sessionSnapshot?.() ?? Promise.resolve(undefined)).then(
      (snapshot) =>
        ctx.dialog.push(() => <DialogSessionSnapshot snapshot={snapshot} />),
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
