import { For, Show, createSignal } from "solid-js";
import type { NavWorkspace } from "../types";

export interface SidebarProps {
  workspaces: NavWorkspace[];
  currentSessionId?: string;
  collapsed?: boolean;
  width?: number;
  onSelectSession?: (sessionId: string) => void;
  onNewSession?: () => void;
}

export function Sidebar(props: SidebarProps) {
  const [expandedWorkspaces, setExpandedWorkspaces] = createSignal<Set<string>>(
    new Set(props.workspaces.map((w) => w.id)),
  );

  function toggleWorkspace(workspaceId: string) {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  }

  return (
    <aside
      class="natalia-sidebar"
      data-collapsed={props.collapsed}
      style={{ width: props.width ? `${props.width}px` : undefined }}
    >
      <div class="natalia-sidebar-header">
        <div class="natalia-sidebar-brand">
          <div class="natalia-sidebar-brand-mark" />
          <div class="natalia-sidebar-brand-text">
            <div class="natalia-sidebar-brand-name">Natalia</div>
            <div class="natalia-sidebar-brand-subtitle">工程智能</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="natalia-sidebar-new-btn"
        onClick={props.onNewSession}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1V13M1 7H13"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        <span>新建会话</span>
      </button>

      <div class="natalia-sidebar-section">
        <div class="natalia-sidebar-section-title">最近</div>
        <div class="natalia-sidebar-recent">
          <For each={props.workspaces}>
            {(workspace) => (
              <For each={workspace.sessions}>
                {(session) => (
                  <button
                    type="button"
                    class="natalia-sidebar-session recent-session"
                    data-active={session.id === props.currentSessionId}
                    data-state={session.state}
                    onClick={() => props.onSelectSession?.(session.id)}
                  >
                    <span class="natalia-session-dot" />
                    <span class="natalia-session-name">{session.title}</span>
                    <Show when={props.collapsed}>
                      <span class="natalia-session-dot-indicator" />
                    </Show>
                  </button>
                )}
              </For>
            )}
          </For>
        </div>
      </div>

      <div class="natalia-sidebar-section natalia-sidebar-section-grow">
        <div class="natalia-sidebar-section-title">项目</div>
        <div class="natalia-sidebar-tree">
          <For each={props.workspaces}>
            {(workspace) => (
              <div class="natalia-workspace">
                <button
                  type="button"
                  class="natalia-workspace-header"
                  onClick={() => toggleWorkspace(workspace.id)}
                >
                  <svg
                    class="natalia-workspace-chevron"
                    data-expanded={expandedWorkspaces().has(workspace.id)}
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M6 4L10 8L6 12"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <svg
                    class="natalia-workspace-icon"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M2 5C2 3.89543 2.89543 3 4 3H5.58579C6.11622 3 6.62493 3.21071 7 3.58579L7.41421 4C7.78929 4.37507 8.29799 4.58579 8.82843 4.58579H12C13.1046 4.58579 14 5.48122 14 6.58579V11C14 12.1046 13.1046 13 12 13H4C2.89543 13 2 12.1046 2 11V5Z"
                      stroke="currentColor"
                      stroke-width="1.2"
                    />
                  </svg>
                  <span class="natalia-workspace-name">{workspace.name}</span>
                </button>
                <Show when={expandedWorkspaces().has(workspace.id)}>
                  <div class="natalia-sessions">
                    <For each={workspace.sessions}>
                      {(session) => (
                        <button
                          type="button"
                          class="natalia-session-btn"
                          data-active={session.id === props.currentSessionId}
                          data-state={session.state}
                          onClick={() => props.onSelectSession?.(session.id)}
                        >
                          <span class="natalia-session-dot" />
                          <span class="natalia-session-name">
                            {session.title}
                          </span>
                          <span class="natalia-session-badge">
                            {session.state}
                          </span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="natalia-sidebar-footer">
        <button type="button" class="natalia-sidebar-footer-btn">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle
              cx="7.5"
              cy="7.5"
              r="5.5"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path
              d="M7.5 5V7.5L9.5 9.5"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          <span>历史记录</span>
        </button>
        <button type="button" class="natalia-sidebar-footer-btn">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle
              cx="7.5"
              cy="7.5"
              r="5.5"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path
              d="M7.5 9V7.5L6 6"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
