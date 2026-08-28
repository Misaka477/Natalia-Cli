import { For } from "solid-js";

export type NavSession = {
  id: string;
  title: string;
  state: "idle" | "running" | "error";
  active?: boolean;
};

export type NavWorkspace = {
  id: string;
  name: string;
  sessions: NavSession[];
};

export function Sidebar(props: {
  workspaces: NavWorkspace[];
  onSelect?(sessionID: string): void;
}) {
  return (
    <nav class="natalia-web__nav">
      <div class="natalia-web__brand">
        <span class="natalia-web__mark" />
        <div>
          <strong>Natalia</strong>
          <span>local workspace</span>
        </div>
      </div>
      <button type="button" class="natalia-web__new">
        New session
      </button>
      <div class="natalia-web__tree">
        <div class="natalia-web__label">Workspaces</div>
        <For each={props.workspaces}>
          {(workspace) => (
            <section>
              <button type="button" class="natalia-web__workspace">
                {workspace.name}
              </button>
              <div class="natalia-web__sessions">
                <For each={workspace.sessions}>
                  {(session) => (
                    <button
                      type="button"
                      class="natalia-web__session"
                      data-active={session.active ? "true" : "false"}
                      onClick={() => props.onSelect?.(session.id)}
                    >
                      <span
                        class="natalia-web__dot"
                        data-state={session.state}
                      />
                      <span>{session.title}</span>
                      <small>{session.state}</small>
                    </button>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
      </div>
    </nav>
  );
}
