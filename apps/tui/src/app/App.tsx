import { TextareaRenderable, type PasteEvent } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import {
  useBindings,
  useKeymap,
  useKeymapSelector,
} from "@opentui/keymap/solid";
import { stringifyKeySequence } from "@opentui/keymap";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { usePromptRef } from "../context/prompt";
import { useRouteController } from "../context/route";
import { StateProvider, useAppState } from "../context/state";
import { useClipboard } from "../context/clipboard";
import { ToastRegion, useToast } from "../context/toast";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import type { ConfigV2 } from "@natalia/contracts";
import { getPluginCommands } from "@natalia/plugin";
import {
  buildKeybindMap,
  commands,
  composerKeyAction,
  keymapBoundary,
} from "../keymap";
import { useKeybinds } from "../context/keybind";
import {
  DialogProvider,
  useDialog,
  type DialogContext,
} from "../dialog/provider";
import { DialogConfirm } from "../dialog/DialogConfirm";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import {
  DialogHelp,
  DialogDiagnostics,
  DialogSessionList,
  DialogStatus,
} from "../dialog/DialogLayer";
import { DialogProviderSetup } from "../component/DialogProviderSetup";
import { DialogMcp } from "../component/DialogMcp";
import { DialogThemeList } from "../component/DialogThemeList";
import { DialogModel } from "../component/DialogModel";
import { DialogSkill } from "../component/DialogSkill";
import { DialogStash } from "../component/DialogStash";
import { DialogAttachment } from "../component/DialogAttachment";
import { DialogWorkspaceSearch } from "../component/DialogWorkspaceSearch";
import { PromptAutocomplete } from "../component/PromptAutocomplete";
import {
  editPromptExternally,
  retainEditorMentions,
} from "../prompt/external-editor";
import { DialogAgent } from "../component/DialogAgent";
import { resolveConfig, updateConfig } from "@natalia/config";
import { discoverProviderModels } from "@natalia/config";
import { decidePaste } from "../prompt/paste";
import { PromptHistory, shouldUseHistory } from "../prompt/history";
import {
  SessionFooter,
  SessionRoute,
  SessionSidebar,
  SubagentRoute,
} from "../routes/session/SessionRoute";
import { darkTheme } from "../theme/theme";
import { useTheme } from "../context/theme";
import { useLocal } from "../context/local";
import { sessionLayout, type SidebarMode } from "../session-layout";
import {
  defaultTuiPreferences,
  loadTuiPreferences,
  saveTuiPreferences,
  tuiPreferencePatch,
  type TuiPreferences,
} from "../settings";
import type { TuiConfigWriteScope } from "../config";

export function App(props: {
  backend: RuntimeClient;
  createBackend?: (sessionID?: string) => RuntimeClient;
  workspaceRoot?: string;
  onSessionChange?: (sessionID?: string) => void;
  onDispatch?: (event: RuntimeEvent) => void;
  initialPrompt?: string;
}) {
  const [backend, setBackend] = createSignal(props.backend);

  function changeSession(sessionID?: string) {
    if (props.createBackend) setBackend(props.createBackend(sessionID));
    props.onSessionChange?.(sessionID);
  }

  return (
    <Show when={backend()} keyed>
      {(activeBackend) => (
        <StateProvider
          onReady={(dispatch) => {
            activeBackend.start((event: RuntimeEvent) => {
              dispatch(event);
              props.onDispatch?.(event);
            });
          }}
        >
          <DialogProvider>
            <Shell
              backend={activeBackend}
              workspaceRoot={props.workspaceRoot}
              onSessionChange={changeSession}
            />
          </DialogProvider>
        </StateProvider>
      )}
    </Show>
  );
}

function Shell(props: {
  backend: RuntimeClient;
  workspaceRoot?: string;
  onSessionChange?: (sessionID?: string) => void;
}) {
  const renderer = useRenderer();
  const [terminalWidth, setTerminalWidth] = createSignal(renderer.width);
  const [terminalHeight, setTerminalHeight] = createSignal(renderer.height);
  const [sidebarMode, setSidebarMode] = createSignal<SidebarMode>("auto");
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const promptRef = usePromptRef();
  const { state, dispatch } = useAppState();
  const route = useRouteController();
  const clipboard = useClipboard();
  const toast = useToast();
  const dialog = useDialog();
  const [composer, setComposer] = createSignal<TextareaRenderable>();
  const [pastePreview, setPastePreview] = createSignal("");
  const [attachmentPaths, setAttachmentPaths] = createSignal<string[]>([]);
  const [mentionAgents, setMentionAgents] = createSignal<string[]>([]);
  const [mentionResources, setMentionResources] = createSignal<
    import("@natalia/contracts").MCPResourceCatalog[]
  >([]);
  const [composerText, setComposerText] = createSignal("");
  const [followBottom, setFollowBottom] = createSignal(true);
  const [jumpToBottomVisible, setJumpToBottomVisible] = createSignal(false);
  const [preferences, setPreferences] = createSignal<TuiPreferences>(
    defaultTuiPreferences,
  );
  const keybinds = useKeybinds();
  const theme = useTheme();
  const local = useLocal();
  const [tuiWriteScope, setTuiWriteScope] =
    createSignal<TuiConfigWriteScope>("project");
  const layout = () =>
    sessionLayout(
      terminalWidth(),
      terminalHeight(),
      sidebarMode(),
      sidebarOpen(),
    );
  const activeSubagentRoute = () => {
    const current = route.route();
    return current.kind === "subagent" ? current : undefined;
  };

  onMount(() => {
    const resize = (width: number, height: number) => {
      setTerminalWidth(width);
      setTerminalHeight(height);
    };
    renderer.on("resize", resize);
    onCleanup(() => renderer.off("resize", resize));
  });
  const history = new PromptHistory();
  const scrollRef: { current?: any } = {};
  const ptyScrollRef: { current?: any } = {};
  let submitting = false;
  let restoredAgent = false;

  createEffect(() => {
    if (restoredAgent || !local.ready) return;
    restoredAgent = true;
    if (local.state.activeAgent)
      props.backend.selectAgent?.(local.state.activeAgent);
  });

  onMount(async () => {
    if (props.workspaceRoot) {
      const loaded = await loadTuiPreferences(props.workspaceRoot);
      setPreferences(loaded);
      keybinds.set(loaded.keybinds);
      setFollowBottom(loaded.followBottom);
    }
    setTimeout(() => composer()?.focus(), 1);
  });

  onMount(() => {
    const timer = setInterval(() => {
      const scrollbox = scrollRef.current;
      if (!scrollbox || scrollbox.isDestroyed) return;
      const nearBottom = isNearBottom(scrollbox, 3);
      if (nearBottom) {
        setJumpToBottomVisible(false);
        if (!followBottom()) {
          setFollowBottom(true);
          scrollbox.stickyScroll = true;
        }
        return;
      }
      setJumpToBottomVisible(true);
      if (followBottom()) {
        setFollowBottom(false);
        scrollbox.stickyScroll = false;
      }
    }, 100);
    onCleanup(() => clearInterval(timer));
  });

  function updatePreferences(next: TuiPreferences, scope = tuiWriteScope()) {
    const patch = tuiPreferencePatch(preferences(), next);
    setPreferences(next);
    keybinds.set(next.keybinds);
    setFollowBottom(next.followBottom);
    theme.preview(next.theme);
    if (props.workspaceRoot)
      void saveTuiPreferences(props.workspaceRoot, patch, scope).then(
        () =>
          toast.show({
            variant: "success",
            message: `TUI preferences saved to ${scope} config`,
          }),
        (error) => toast.error(error),
      );
  }

  async function submit() {
    const input = composer();
    const text = (input?.plainText ?? "").replace(/\n$/, "");
    if (!text.trim()) return;
    const control = text.trim();
    if (control === "/editor" || control.startsWith("/editor ")) {
      const draft = control === "/editor" ? "" : text.slice("/editor ".length);
      try {
        const edited = await editPromptExternally({
          text: draft,
          env: process.env,
        });
        input?.setText(edited);
        setComposerText(edited);
        const mentions = retainEditorMentions({
          text: edited,
          attachments: attachmentPaths(),
          agents: mentionAgents(),
          resources: mentionResources(),
        });
        setAttachmentPaths(mentions.attachments);
        setMentionAgents(mentions.agents);
        setMentionResources(mentions.resources);
        input?.gotoBufferEnd();
      } catch (error) {
        toast.error(error);
      }
      return;
    }
    if (submitting && control !== "/pause" && control !== "/resume") return;
    if (control === "/pause") {
      input?.clear();
      props.backend.pause?.("TUI composer control");
      setTimeout(() => composer()?.focus(), 1);
      return;
    }
    if (control === "/resume") {
      input?.clear();
      props.backend.resume?.();
      setTimeout(() => composer()?.focus(), 1);
      return;
    }
    const attachments = attachmentPaths();
    if (
      (attachments.length ||
        mentionAgents().length ||
        mentionResources().length) &&
      !props.backend.submitInput
    ) {
      toast.show({
        variant: "warning",
        message: "This runtime transport does not support attachments",
      });
      return;
    }
    submitting = true;
    const shouldFollow = isNearBottom(scrollRef.current);
    setFollowMode(shouldFollow);
    if (shouldFollow) toBottom(0);
    try {
      input?.clear();
      setPastePreview("");
      history.add(text);
      if (
        attachments.length ||
        mentionAgents().length ||
        mentionResources().length
      )
        await props.backend.submitInput!({
          text,
          attachments,
          agents: mentionAgents().map((name) => ({ name })),
          resources: mentionResources().map((resource) => ({
            server: resource.server,
            uri: resource.uri,
            name: resource.name,
            mimeType: resource.mimeType,
          })),
        });
      else await props.backend.submit(text);
      setAttachmentPaths([]);
      setMentionAgents([]);
      setMentionResources([]);
    } finally {
      submitting = false;
      if (followBottom()) toBottom(50);
      setTimeout(() => composer()?.focus(), 1);
    }
  }

  function handlePaste(event: PasteEvent) {
    const decision = decidePaste(event.bytes, composer()?.plainText ?? "");
    if (!decision.ok) {
      event.preventDefault();
      setPastePreview(decision.message);
      props.backend.diagnostic(decision.message);
      return;
    }
    if (decision.preview) setPastePreview(decision.preview);
  }

  function restoreHistory(direction: -1 | 1) {
    const input = composer();
    if (!input) return false;
    if (!shouldUseHistory(input.plainText, input.cursorOffset)) return false;
    input.setText(
      direction === -1
        ? history.previous(input.plainText)
        : history.next(input.plainText),
    );
    input.gotoBufferEnd();
    return true;
  }

  function exitOrCancel() {
    if (state.activeTurn) {
      props.backend.cancel();
    } else if (composer()?.plainText) {
      composer()?.clear();
    } else {
      renderer.destroy();
    }
  }

  function changeSession(sessionID?: string) {
    if (state.activeTurn || submitting) {
      props.backend.diagnostic(
        "Finish or cancel the current turn before switching sessions.",
      );
      return;
    }
    props.onSessionChange?.(sessionID);
  }

  function runCommand(command: string) {
    if (command === "palette.toggle") {
      dialog.replace(() => <CommandPalette onRun={runCommand} />);
      return;
    }
    if (command === "session.new") {
      dialog.pop();
      changeSession(
        `ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}`,
      );
      return;
    }
    if (command === "session.list") {
      if (
        !props.backend.sessionList ||
        !props.backend.sessionTouch ||
        !props.backend.sessionRename ||
        !props.backend.sessionPin ||
        !props.backend.sessionDuplicate ||
        !props.backend.sessionDelete
      ) {
        toast.show({
          variant: "warning",
          message: "This runtime transport does not support session management",
        });
        return;
      }
      const sessionBackend = {
        list: props.backend.sessionList,
        touch: props.backend.sessionTouch,
        rename: props.backend.sessionRename,
        pin: props.backend.sessionPin,
        duplicate: props.backend.sessionDuplicate,
        delete: props.backend.sessionDelete,
      };
      dialog.push(() => (
        <DialogSessionList backend={sessionBackend} onSelect={changeSession} />
      ));
      return;
    }
    if (command === "provider.connect") {
      resolveConfig({
        workspaceRoot: props.workspaceRoot ?? process.cwd(),
      }).then(({ config: resolved }) => {
        dialog.push(() => (
          <DialogProviderSetup
            config={resolved}
            onPersist={(next) =>
              void updateConfig(props.workspaceRoot ?? process.cwd(), next)
            }
          />
        ));
      });
      return;
    }
    if (command === "model.list") {
      dialog.push(() => (
        <DialogModel
          workspaceRoot={props.workspaceRoot ?? process.cwd()}
          catalog={props.backend.modelCatalog}
          selection={props.backend.modelSelection}
          selectRuntimeModel={props.backend.selectModel}
        />
      ));
      return;
    }
    if (command === "skill.list") {
      void props.backend.skills?.().then(
        (skills) =>
          dialog.push(() => (
            <DialogSkill
              skills={skills}
              select={(name) => {
                composer()?.setText(`/skill ${name}`);
                setTimeout(() => composer()?.focus(), 1);
              }}
            />
          )),
        (error) => toast.error(error),
      );
      return;
    }
    if (command === "prompt.stash.save") {
      const input = composer()?.plainText ?? "";
      if (!local.stashPrompt(input)) {
        toast.show({
          variant: "warning",
          message: "Prompt is empty or too large to stash",
        });
        return;
      }
      composer()?.clear();
      toast.show({ variant: "success", message: "Prompt stashed" });
      return;
    }
    if (command === "prompt.stash.list") {
      dialog.push(() => (
        <DialogStash
          select={(input) => {
            composer()?.setText(input);
            composer()?.gotoBufferEnd();
            setTimeout(() => composer()?.focus(), 1);
          }}
        />
      ));
      return;
    }
    if (command === "prompt.attachment.add") {
      dialog.push(() => (
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
            setAttachmentPaths((current) =>
              current.includes(path) ? current : [...current, path],
            );
            dialog.pop();
            setTimeout(() => composer()?.focus(), 1);
          }}
        />
      ));
      return;
    }
    if (command === "prompt.attachment.list") {
      dialog.push(() => (
        <DialogAttachment
          paths={attachmentPaths}
          remove={(path) =>
            setAttachmentPaths((current) =>
              current.filter((item) => item !== path),
            )
          }
        />
      ));
      return;
    }
    if (command === "workspace.search") {
      dialog.push(() => (
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
            if (!props.backend.workspaceSearch) {
              toast.show({
                variant: "warning",
                message:
                  "This runtime transport does not support workspace search",
              });
              return;
            }
            dialog.pop();
            void props.backend.workspaceSearch({ query, limit: 50 }).then(
              (matches) => {
                dialog.push(() => (
                  <DialogWorkspaceSearch
                    query={query}
                    matches={matches}
                    select={(match) => {
                      const mention = `@${match.path}:${match.line}`;
                      composer()?.insertText(`${mention} `);
                      setAttachmentPaths((current) =>
                        current.includes(match.path)
                          ? current
                          : [...current, match.path],
                      );
                      setTimeout(() => composer()?.focus(), 1);
                    }}
                  />
                ));
              },
              (error) => toast.error(error),
            );
          }}
        />
      ));
      return;
    }
    if (command === "agent.list") {
      if (!props.backend.agents) {
        toast.show({
          variant: "warning",
          message: "Runtime agent catalog unavailable",
        });
        return;
      }
      void props.backend.agents().then(
        (agents) =>
          dialog.push(() => (
            <DialogAgent
              agents={agents}
              current={local.state.activeAgent}
              selectAgent={(name) => props.backend.selectAgent?.(name)}
              workspaceRoot={props.workspaceRoot ?? process.cwd()}
            />
          )),
        (error) => toast.error(error),
      );
      return;
    }
    if (command === "model.edit") {
      resolveConfig({
        workspaceRoot: props.workspaceRoot ?? process.cwd(),
      }).then(({ config: resolved }) => {
        const mk = (mid: string, pvid: string) => {
          const v = mid.trim();
          if (!v) throw new Error("Model ID cannot be empty");
          return `${pvid}_${v.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        };
        const save = (next: ConfigV2) => {
          void updateConfig(props.workspaceRoot ?? process.cwd(), next);
        };
        const openModelDetail = (opt: { value: string }) => {
          const m = resolved.models[opt.value];
          if (!m) return;
          const refresh = () => {
            dialog.pop();
            openModelDetail(opt);
          };
          dialog.push(() => (
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
                  dialog.push(() => (
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
                        dialog.pop();
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
                  dialog.pop();
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
                const v = await DialogPrompt.show(dialog, labels[o.value], {
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
        dialog.push(() => (
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
                dialog.push(() => (
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
                          dialog,
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
                        dialog.pop();
                        return;
                      }
                      try {
                        const models = await discoverProviderModels(
                          provider.type,
                          provider.baseURL,
                          provider.apiKey,
                        );
                        dialog.push(() => (
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
                              dialog.pop();
                            }}
                          />
                        ));
                      } catch (e) {
                        const mid = await DialogPrompt.show(
                          dialog,
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
                        dialog.pop();
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
        workspaceRoot: props.workspaceRoot ?? process.cwd(),
      }).then(({ config: resolved }) => {
        dialog.push(() => (
          <DialogMcp
            config={resolved}
            statuses={state.mcp}
            onPersist={(next) =>
              void updateConfig(props.workspaceRoot ?? process.cwd(), next)
            }
          />
        ));
      });
      return;
    }
    if (command === "settings.open") {
      async function saveConfig(next: any) {
        await updateConfig(props.workspaceRoot ?? process.cwd(), next);
      }
      dialog.push(() => (
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
              description: preferences().theme || "natalia-dark",
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
                workspaceRoot: props.workspaceRoot ?? process.cwd(),
              })
            ).config;
            switch (option.value) {
              case "provider":
                dialog.push(() => (
                  <DialogProviderSetup
                    config={resolved}
                    onPersist={(next) => void saveConfig(next)}
                  />
                ));
                break;
              case "edit-provider": {
                const providers = Object.entries(resolved.providers ?? {});
                dialog.push(() => (
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
                        dialog,
                        "API Key",
                        { placeholder: p.apiKey ?? "" },
                      );
                      if (newKey === null || newKey === undefined) return;
                      const newURL = await DialogPrompt.show(
                        dialog,
                        "Base URL",
                        { placeholder: p.baseURL ?? "" },
                      );
                      if (newURL === null || newURL === undefined) return;
                      const newHeaders = await DialogPrompt.show(
                        dialog,
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
                      dialog.pop();
                    }}
                  />
                ));
                break;
              }
              case "delete-provider": {
                const providers = Object.entries(resolved.providers ?? {});
                dialog.push(() => (
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
                      dialog.pop();
                    }}
                  />
                ));
                break;
              }
              case "theme":
                dialog.push(() => (
                  <DialogThemeList
                    onCommit={(name) =>
                      setPreferences({
                        ...preferences(),
                        theme: name,
                        version: 1,
                        themeMode: "dark",
                      })
                    }
                  />
                ));
                break;
              case "mcp":
                dialog.push(() => (
                  <DialogMcp
                    config={resolved}
                    statuses={state.mcp}
                    onPersist={(next) => void saveConfig(next)}
                  />
                ));
                break;
              case "model":
                dialog.push(() => (
                  <DialogModel
                    workspaceRoot={props.workspaceRoot ?? process.cwd()}
                  />
                ));
                break;
              case "permission":
                dialog.push(() => (
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
                        const name = prompt("Profile name") ?? "";
                        if (!name.trim()) return;
                        resolved.permissionProfiles![name.trim()] = {
                          description: "",
                          approval: "ask",
                          tools: [],
                        } as any;
                        resolved.defaultPermission = name.trim();
                        void saveConfig(resolved);
                        dialog.pop();
                        return;
                      }
                      resolved.defaultPermission = opt.value;
                      void saveConfig(resolved);
                      dialog.pop();
                    }}
                    onExtraKey={(key, opt) => {
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
                dialog.push(() => (
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
                        const name = prompt("Mode name") ?? "";
                        if (!name.trim()) return;
                        resolved.modes![name.trim()] = {
                          description: "",
                          allowedTools: [],
                        } as any;
                        resolved.defaultMode = name.trim();
                        void saveConfig(resolved);
                        dialog.pop();
                        return;
                      }
                      resolved.defaultMode = opt.value;
                      void saveConfig(resolved);
                      dialog.pop();
                    }}
                    onExtraKey={(key, opt) => {
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
                runCommand("model.edit");
                break;
              case "web":
                dialog.push(() => (
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
                      void saveConfig(next);
                    }}
                  />
                ));
                break;
              case "workspace":
                dialog.push(() => (
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
                      void saveConfig(next);
                    }}
                  />
                ));
                break;
              case "runtime":
                dialog.push(() => (
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
                        dialog,
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
                dialog.push(() => (
                  <DialogSelect
                    title="TUI Preferences"
                    options={[
                      {
                        title: "Tool Details",
                        value: "detail",
                        description: preferences().toolDetails ?? "expanded",
                      },
                      {
                        title: "Density",
                        value: "density",
                        description: preferences().density ?? "compact",
                      },
                      {
                        title: "Diff Style",
                        value: "diff",
                        description: preferences().diffStyle ?? "auto",
                      },
                      {
                        title: "Theme",
                        value: "theme",
                        description: preferences().theme ?? "natalia-dark",
                      },
                      {
                        title: "TUI Write Scope",
                        value: "scope",
                        description: tuiWriteScope() ?? "project",
                      },
                      {
                        title: "Config Write Scope",
                        value: "cscope",
                        description:
                          (state as any).configWriteScope ?? "project",
                      },
                      {
                        title: "Keybinds",
                        value: "keys",
                        description: `${Object.keys(preferences().keybinds ?? {}).length} overrides`,
                      },
                    ]}
                    onSelect={(opt) => {
                      if (opt.value === "detail")
                        updatePreferences({
                          ...preferences(),
                          toolDetails:
                            preferences().toolDetails === "expanded"
                              ? "collapsed"
                              : "expanded",
                        });
                      if (opt.value === "density")
                        updatePreferences({
                          ...preferences(),
                          density:
                            preferences().density === "compact"
                              ? "comfortable"
                              : "compact",
                        });
                      if (opt.value === "diff")
                        updatePreferences({
                          ...preferences(),
                          diffStyle:
                            preferences().diffStyle === "auto"
                              ? "stacked"
                              : "auto",
                        });
                      if (opt.value === "scope")
                        setTuiWriteScope(
                          tuiWriteScope() === "project" ? "global" : "project",
                        );
                      if (opt.value === "cscope")
                        (state as any).configWriteScope =
                          (state as any).configWriteScope === "project"
                            ? "global"
                            : "project";
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
      if (!props.backend.runtimeStatus) {
        toast.show({
          variant: "warning",
          message: "Runtime status unavailable",
        });
        return;
      }
      dialog.push(() => (
        <DialogStatus load={() => props.backend.runtimeStatus!()} />
      ));
      return;
    }
    if (command === "diagnostics") {
      if (!props.backend.diagnostics) {
        toast.show({
          variant: "warning",
          message: "Runtime diagnostics unavailable",
        });
        return;
      }
      dialog.push(() => (
        <DialogDiagnostics
          load={() => props.backend.diagnostics!()}
          copy={(text) => clipboard.write?.(text) ?? Promise.resolve()}
        />
      ));
      return;
    }
    if (command === "help.open") {
      dialog.push(() => <DialogHelp onClose={() => dialog.pop()} />);
      return;
    }
    if (command === "dialog.test") {
      try {
        void (async () => {
          const confirmed = await DialogConfirm.show(
            dialog,
            "Dialog Stack Test",
            "Press left/right to switch focus, Enter to confirm, Escape to cancel.",
          );
          if (confirmed === undefined) return;
          const name = await DialogPrompt.show(dialog, "Enter name", {
            placeholder: "Type something...",
          });
          if (name === null) return;
          toast.show({
            variant: "success",
            message: `Dialog test done: confirmed=${confirmed}, name="${name}"`,
          });
        })();
      } catch (error) {
        toast.show({
          variant: "error",
          message: `dialog.test failed: ${error}`,
        });
      }
      return;
    }
    if (command === "session.sidebar.toggle") {
      if (layout().wide) {
        setSidebarMode((value) => (value === "auto" ? "hide" : "auto"));
      } else {
        setSidebarOpen((value) => !value);
      }
      return;
    }
    if (command === "snapshot") {
      props.backend.snapshot();
      return;
    }
    if (command === "message.copy.last") {
      const block = [...state.messages]
        .reverse()
        .find((item) => ["assistant", "tool", "subagent"].includes(item.role));
      const text = block?.tool?.result?.detail || block?.text;
      if (!text || !clipboard.write) {
        toast.show({
          variant: "warning",
          message: "No message available to copy",
        });
        return;
      }
      void clipboard.write(text).then(
        () =>
          toast.show({ variant: "success", message: "Copied to clipboard" }),
        (error) => toast.error(error),
      );
      return;
    }
    if (command === "composer.submit") {
      void submit();
      return;
    }
    if (command === "composer.newline") {
      composer()?.insertText("\n");
      return;
    }
    if (command === "composer.buffer-home") {
      composer()?.gotoBufferHome();
      return;
    }
    if (command === "composer.buffer-end") {
      composer()?.gotoBufferEnd();
      return;
    }
    if (command === "cancel") {
      props.backend.cancel();
      return;
    }
    if (command === "exit") {
      if (!composer()?.plainText) renderer.destroy();
      return;
    }
    if (command === "dialog.close") {
      route.back();
      return;
    }
    if (command === "pty.focus-toggle") {
      if (state.ptyPane.selectedID)
        dispatch({
          type: "pty.pane.focus",
          focus: state.ptyPane.focus === "chat" ? "pty" : "chat",
        });
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

  useBindings(() => ({
    commands: [
      ...Object.values(commands)
        .filter((command) => command.scope !== "dialog")
        .map((command) => ({
          name: command.id,
          title: command.desc,
          category: command.id.split(".")[0],
          namespace: "palette",
          run: () => runCommand(command.id),
        })),
    ],
  }));

  useBindings(() => ({
    mode: "base",
    bindings: Object.entries(keybinds.resolved().bindings)
      .filter(([id]) => !commands[id]?.scope)
      .flatMap(([id, keys]) =>
        keys.map((key) => ({
          key,
          desc: commands[id]!.desc,
          group: "Natalia",
          cmd: () => runCommand(id),
        })),
      ),
  }));

  useBindings(() => ({
    target: composer,
    enabled: () => {
      const input = composer();
      return Boolean(
        input && shouldUseHistory(input.plainText, input.cursorOffset),
      );
    },
    bindings: [
      {
        key: "up",
        desc: "Previous prompt history",
        group: "Prompt",
        cmd: () => restoreHistory(-1),
      },
      {
        key: "down",
        desc: "Next prompt history",
        group: "Prompt",
        cmd: () => restoreHistory(1),
      },
    ],
  }));

  useBindings(() => ({
    mode: "base",
    priority: 1,
    enabled: () => state.ptyPane.focus === "pty",
    bindings: [
      {
        key: "ctrl+t",
        desc: "Return focus to chat",
        group: "PTY",
        cmd: () =>
          dispatch({
            type: "pty.pane.focus",
            focus: "chat",
          }),
      },
      {
        key: "pageup",
        desc: "Scroll PTY up",
        group: "PTY",
        cmd: () =>
          ptyScrollRef.current?.scrollBy(
            -(ptyScrollRef.current.viewport?.height ?? 8) * 0.8,
          ),
      },
      {
        key: "pagedown",
        desc: "Scroll PTY down",
        group: "PTY",
        cmd: () =>
          ptyScrollRef.current?.scrollBy(
            (ptyScrollRef.current.viewport?.height ?? 8) * 0.8,
          ),
      },
      {
        key: "home",
        desc: "Scroll PTY to start",
        group: "PTY",
        cmd: () => ptyScrollRef.current?.scrollTo(0),
      },
      {
        key: "end",
        desc: "Scroll PTY to end",
        group: "PTY",
        cmd: () =>
          ptyScrollRef.current?.scrollTo(
            ptyScrollRef.current.scrollHeight ?? 0,
          ),
      },
      {
        key: "left",
        desc: "Previous PTY session",
        group: "PTY",
        cmd: () => movePtySelection(-1),
      },
      {
        key: "right",
        desc: "Next PTY session",
        group: "PTY",
        cmd: () => movePtySelection(1),
      },
      {
        key: "tab",
        desc: "Next PTY session",
        group: "PTY",
        cmd: () => movePtySelection(1),
      },
      {
        key: "shift+tab",
        desc: "Previous PTY session",
        group: "PTY",
        cmd: () => movePtySelection(-1),
      },
    ],
  }));

  useBindings(() => ({
    mode: "base",
    enabled: () => !composer()?.plainText,
    bindings: [
      {
        key: "ctrl+d",
        desc: "Exit on empty composer",
        group: "Natalia",
        cmd: () => renderer.destroy(),
      },
    ],
  }));

  useBindings(() => ({
    mode: "base",
    bindings: [
      {
        key: "ctrl+c",
        desc: "Cancel turn or clear composer",
        group: "Natalia",
        cmd: () => {
          const selected = renderer.getSelection()?.getSelectedText();
          if (selected && clipboard.write) {
            void clipboard.write(selected).then(
              () => {
                renderer.clearSelection();
                toast.show({ variant: "info", message: "Copied selection" });
              },
              (error) => toast.error(error),
            );
            return;
          }
          exitOrCancel();
        },
      },
      {
        key: "pageup",
        desc: "Scroll up",
        group: "Natalia",
        cmd: () => {
          const scrollbox = scrollRef.current;
          if (!scrollbox) return;
          setFollowMode(false);
          scrollbox.scrollBy(-(scrollbox.viewport?.height ?? 10) * 0.8);
        },
      },
      {
        key: "pagedown",
        desc: "Scroll down",
        group: "Natalia",
        cmd: () => {
          const scrollbox = scrollRef.current;
          if (!scrollbox) return;
          scrollbox.scrollBy((scrollbox.viewport?.height ?? 10) * 0.8);
        },
      },
      {
        key: "home",
        desc: "Scroll to top",
        group: "Natalia",
        cmd: () => {
          setFollowMode(false);
          scrollRef.current?.scrollTo(0);
        },
      },
      {
        key: "end",
        desc: "Scroll to bottom",
        group: "Natalia",
        cmd: () => {
          setFollowMode(true);
          toBottom(0);
        },
      },
    ],
  }));

  createEffect(() => {
    if (route.route().kind === "none" && state.ptyPane.focus === "chat") {
      setTimeout(() => composer()?.focus(), 1);
    }
  });

  function toBottom(delay = 50) {
    setTimeout(() => scrollToBottom(scrollRef.current), delay);
  }

  function movePtySelection(direction: -1 | 1) {
    const sessions = Object.values(state.pty).filter(
      (pty) =>
        pty.ownership === "model" &&
        pty.status !== "exited" &&
        pty.status !== "failed",
    );
    if (sessions.length < 2) return;
    const current = sessions.findIndex(
      (pty) => pty.id === state.ptyPane.selectedID,
    );
    const next =
      sessions[(current + direction + sessions.length) % sessions.length];
    if (next) dispatch({ type: "pty.pane.select", id: next.id });
  }

  function setFollowMode(value: boolean) {
    setFollowBottom(value);
    setJumpToBottomVisible(!value);
    const scrollbox = scrollRef.current;
    if (!scrollbox || scrollbox.isDestroyed) return;
    scrollbox.stickyScroll = value;
  }

  function jumpToBottom() {
    setFollowMode(true);
    toBottom(0);
  }

  return (
    <box
      flexDirection="row"
      width="100%"
      height="100%"
      backgroundColor={theme.theme.background}
    >
      <box flexGrow={1} minWidth={0} height="100%" flexDirection="column">
        <Show when={activeSubagentRoute()} keyed>
          {(current) => (
            <SubagentRoute agentID={current.id} onBack={() => route.back()} />
          )}
        </Show>
        <Show when={!activeSubagentRoute()}>
          <SessionRoute
            scrollRef={scrollRef}
            ptyScrollRef={ptyScrollRef}
            followBottom={followBottom()}
            density={preferences().density}
            toolDetails={preferences().toolDetails}
            diffStyle={preferences().diffStyle}
            terminalWidth={layout().toolContentWidth}
            toolPreviewLines={layout().toolPreviewLines}
            showJumpToBottom={jumpToBottomVisible()}
            onJumpToBottom={jumpToBottom}
            backend={props.backend}
            onExit={exitOrCancel}
          />
          <box
            flexShrink={0}
            border={["top"]}
            borderColor={
              route.route().kind !== "none"
                ? theme.theme.muted
                : theme.theme.accent
            }
            paddingTop={1}
            paddingLeft={2}
            paddingRight={2}
          >
            <textarea
              ref={(value: TextareaRenderable) => {
                setComposer(value);
                promptRef.set(value);
              }}
              minHeight={1}
              maxHeight={Math.min(
                preferences().prompt.maxHeight,
                layout().promptMaxHeight,
              )}
              width="100%"
              placeholder={
                route.route().kind !== "none"
                  ? "Press Escape to return"
                  : "Ask anything..."
              }
              placeholderColor={theme.theme.muted}
              textColor={
                route.route().kind !== "none"
                  ? theme.theme.muted
                  : theme.theme.text
              }
              focusedTextColor={theme.theme.text}
              cursorColor={theme.theme.accent}
              onPaste={handlePaste}
              onContentChange={() =>
                setComposerText(composer()?.plainText ?? "")
              }
              onKeyDown={(event: {
                name?: string;
                ctrl?: boolean;
                alt?: boolean;
                meta?: boolean;
                option?: boolean;
                shift?: boolean;
                preventDefault(): void;
              }) => {
                const key = normalizeKey(event.name ?? "");
                const action = composerKeyAction(event);
                if (action === "submit") {
                  event.preventDefault();
                  void submit();
                  return;
                }
                if (action === "newline") {
                  event.preventDefault();
                  composer()?.insertText("\n");
                  return;
                }
                if (action === "buffer-home") {
                  event.preventDefault();
                  composer()?.gotoBufferHome();
                  return;
                }
                if (action === "buffer-end") {
                  event.preventDefault();
                  composer()?.gotoBufferEnd();
                  return;
                }
              }}
            />
            <PromptAutocomplete
              input={composer}
              text={composerText}
              workspaceFiles={props.backend.workspaceFiles}
              agents={props.backend.agents}
              mcpCatalog={props.backend.mcpCatalog}
              attach={(path) =>
                setAttachmentPaths((current) =>
                  current.includes(path) ? current : [...current, path],
                )
              }
              mentionAgent={(name) =>
                setMentionAgents((current) =>
                  current.includes(name) ? current : [...current, name],
                )
              }
              mentionResource={(resource) =>
                setMentionResources((current) =>
                  current.some(
                    (item) =>
                      item.server === resource.server &&
                      item.uri === resource.uri,
                  )
                    ? current
                    : [...current, resource],
                )
              }
            />
            <Show when={attachmentPaths().length > 0}>
              <text fg={theme.theme.muted}>
                Attachments:{" "}
                {attachmentPaths()
                  .map((path) => path.split("/").at(-1) ?? path)
                  .join(", ")}
                {" · Ctrl+Shift+O manage"}
              </text>
            </Show>
            <Show when={layout().showComposerHints}>
              <text
                fg={
                  pastePreview().startsWith("paste rejected")
                    ? theme.theme.danger
                    : theme.theme.muted
                }
              >
                {pastePreview() ||
                  (route.route().kind !== "none"
                    ? `View: ${route.route().kind}`
                    : layout().compact
                      ? `${keymapBoundary.palette} commands · ${keymapBoundary.sidebar} sidebar`
                      : `${keymapBoundary.newline} newline · ${keymapBoundary.palette} commands · ${keymapBoundary.sidebar} sidebar · ctrl+c cancel/exit`)}
              </text>
            </Show>
          </box>
          <SessionFooter workspaceRoot={props.workspaceRoot} />
        </Show>
      </box>
      <Show when={layout().sidebarVisible && !layout().sidebarOverlay}>
        <SessionSidebar
          workspaceRoot={props.workspaceRoot}
          width={layout().sidebarWidth}
          compact={layout().short}
        />
      </Show>
      <Show when={layout().sidebarOverlay}>
        <SessionSidebar
          workspaceRoot={props.workspaceRoot}
          width={Math.min(42, Math.max(28, terminalWidth() - 4))}
          compact={layout().short}
          overlay
        />
      </Show>
      <ToastRegion />
    </box>
  );
}

function scrollToBottom(scrollbox: any) {
  if (!scrollbox || scrollbox.isDestroyed) return;
  scrollbox.scrollTo(scrollbox.scrollHeight ?? 0);
}

function isNearBottom(scrollbox: any, threshold = 10) {
  if (!scrollbox || scrollbox.isDestroyed) return true;
  const scrollTop = scrollbox.scrollTop ?? scrollbox.y ?? 0;
  const viewportHeight = scrollbox.viewport?.height ?? scrollbox.height ?? 0;
  const scrollHeight = scrollbox.scrollHeight ?? 0;
  if (scrollHeight <= viewportHeight + 1) return true;
  return scrollHeight - viewportHeight - scrollTop <= threshold;
}

function CommandPalette(props: { onRun(command: string): void }) {
  const dialog = useDialog();
  const keymap = useKeymap();
  const definitions = commands;
  const entries = useKeymapSelector((current) => {
    const commands = current.getCommandEntries({
      namespace: "palette",
      visibility: "registered",
      filter: (command) =>
        command.name !== "palette.toggle" && !definitions[command.name]?.scope,
    });
    const bindings = current.getCommandBindings({
      commands: commands.map((entry) => entry.command.name),
      visibility: "registered",
    });
    return commands.map((entry) => ({
      entry,
      bindings: bindings.get(entry.command.name) ?? entry.bindings,
    }));
  });

  const options = createMemo(
    () =>
      [
        ...entries().map(({ entry, bindings }) => ({
          title:
            typeof entry.command.title === "string"
              ? entry.command.title
              : entry.command.name,
          description:
            typeof entry.command.desc === "string"
              ? entry.command.desc
              : undefined,
          value: entry.command.name,
          category:
            typeof entry.command.category === "string"
              ? entry.command.category
              : undefined,
          footer: bindings
            .map((binding) =>
              stringifyKeySequence(binding.sequence, { preferDisplay: true }),
            )
            .join(" / "),
          onSelect: (dialog: DialogContext) => {
            dialog.clear();
            props.onRun(entry.command.name);
          },
        })),
        {
          title: "Runtime diagnostics",
          description: "View and copy runtime diagnostics",
          value: "diagnostics",
          category: "runtime",
          onSelect: (dialog: DialogContext) => {
            dialog.clear();
            props.onRun("diagnostics");
          },
        },
        ...getPluginCommands().map((cmd) => ({
          title: cmd.title,
          description: cmd.category ? `plugin · ${cmd.category}` : "plugin",
          value: cmd.name,
          category: cmd.category ?? "plugin",
          onSelect: (dialog: DialogContext) => {
            dialog.clear();
            cmd.run();
          },
        })),
      ] as DialogSelectOption<string>[],
  );

  return <DialogSelect title="Commands" options={options()} />;
}

function normalizeKey(key: string | undefined) {
  if (key === "enter") return "return";
  return key;
}
