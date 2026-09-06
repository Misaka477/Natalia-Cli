import { Show, createSignal, onCleanup, onMount } from "solid-js";
import type {
  RuntimeClient,
  WorkspacePermissionSettings,
  WorkspaceToolSettings,
} from "@natalia/contracts";
import { NeuSelect } from "./components/NeuSelect";

export function WorkspaceSettingsPanel(props: {
  open: boolean;
  workspaceID?: string;
  runtime?: RuntimeClient;
  onClose: () => void;
}) {
  const [permission, setPermission] = createSignal<WorkspacePermissionSettings>(
    {
      permissionProfile: "default",
      approval: "ask",
    },
  );
  const [tools, setTools] = createSignal<WorkspaceToolSettings>({
    enabledTools: [],
    disabledTools: [],
  });
  const [enabledText, setEnabledText] = createSignal("");
  const [disabledText, setDisabledText] = createSignal("");

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => window.removeEventListener("keydown", handleKeydown));

    if (!props.workspaceID) return;
    void props.runtime
      ?.workspacePermissionGet?.(props.workspaceID)
      .then((value) => {
        if (value) setPermission(value);
      });
    void props.runtime?.workspaceToolGet?.(props.workspaceID).then((value) => {
      if (value) {
        setTools(value);
        setEnabledText(value.enabledTools.join("\n"));
        setDisabledText(value.disabledTools.join("\n"));
      }
    });
  });

  function save() {
    if (!props.workspaceID || !props.runtime) return;
    void props.runtime.workspacePermissionSet?.(
      props.workspaceID,
      permission(),
    );
    void props.runtime.workspaceToolSet?.(props.workspaceID, {
      enabledTools: enabledText()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      disabledTools: disabledText()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    });
    props.onClose();
  }

  return (
    <Show when={props.open}>
      <div class="neu-settings-backdrop" onClick={props.onClose}>
        <div
          class="neu-workspace-window"
          onClick={(event) => event.stopPropagation()}
        >
          <div class="neu-settings-header">
            <span class="neu-settings-title">工作区设置</span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭工作区设置"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
          <div class="neu-workspace-body">
            <div class="neu-form-field">
              <label class="neu-form-label">Permission Profile</label>
              <input
                class="neu-form-input"
                value={permission().permissionProfile}
                onInput={(event) =>
                  setPermission({
                    ...permission(),
                    permissionProfile: event.currentTarget.value,
                  })
                }
              />
            </div>
            <div class="neu-form-field">
              <label class="neu-form-label">Approval Mode</label>
              <NeuSelect
                value={permission().approval}
                options={[
                  { value: "ask", label: "ask" },
                  { value: "auto", label: "auto" },
                  { value: "read_only", label: "read_only" },
                ]}
                onChange={(value) =>
                  setPermission({
                    ...permission(),
                    approval: value as "ask" | "auto" | "read_only",
                  })
                }
              />
            </div>
            <div class="neu-form-field">
              <label class="neu-form-label">启用工具（每行一个）</label>
              <textarea
                class="neu-form-input neu-stash-textarea"
                value={enabledText()}
                onInput={(event) => setEnabledText(event.currentTarget.value)}
              />
            </div>
            <div class="neu-form-field">
              <label class="neu-form-label">禁用工具（每行一个）</label>
              <textarea
                class="neu-form-input neu-stash-textarea"
                value={disabledText()}
                onInput={(event) => setDisabledText(event.currentTarget.value)}
              />
            </div>
            <div class="neu-form-actions">
              <button
                type="button"
                class="neu-form-btn neu-form-cancel"
                onClick={props.onClose}
              >
                取消
              </button>
              <button
                type="button"
                class="neu-form-btn neu-form-primary"
                onClick={save}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
