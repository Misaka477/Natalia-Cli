import { createSignal, createEffect, For, Show, onMount } from "solid-js";
import type {
  RuntimeCheckpoint,
  RuntimeClient,
  RuntimeGitRef,
  RuntimeNativeTerminalSession,
  RuntimeSandbox,
  RuntimeTeamPR,
} from "@natalia/contracts";
import { NeuSelect } from "./NeuSelect";
import { WebTerminal } from "./WebTerminal";

export type RightPanelTab = "review" | "terminal" | "browser" | "file";

export interface RightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelProps["activeTab"]) => void;
  width?: number;
}

const TABS: { id: RightPanelTab; label: string; icon: string }[] = [
  { id: "review", label: "审阅", icon: "diff" },
  { id: "terminal", label: "终端", icon: "terminal" },
  { id: "browser", label: "浏览器", icon: "browser" },
  { id: "file", label: "文件", icon: "file" },
];

export function RightPanel(props: RightPanelProps) {
  return (
    <aside
      class="right-panel"
      style={{ width: props.width ? `${props.width}px` : undefined }}
    >
      <div class="right-panel-tabs">
        <For each={TABS}>
          {(tab) => (
            <button
              type="button"
              class="right-panel-tab"
              data-active={props.activeTab === tab.id}
              onClick={() => props.onTabChange(tab.id)}
            >
              <span class="right-panel-tab-icon">
                {tab.icon === "diff"
                  ? "⊞"
                  : tab.icon === "terminal"
                    ? ">_"
                    : tab.icon === "browser"
                      ? "◎"
                      : tab.icon === "file"
                        ? "☰"
                        : "💬"}
              </span>
              <span class="right-panel-tab-label">{tab.label}</span>
            </button>
          )}
        </For>
      </div>
      <div class="right-panel-content">
        <Show when={props.activeTab === "review"}>
          <ReviewPane />
        </Show>
        <Show when={props.activeTab === "terminal"}>
          <TerminalPane />
        </Show>
        <Show when={props.activeTab === "browser"}>
          <BrowserPane />
        </Show>
        <Show when={props.activeTab === "file"}>
          <FilePane />
        </Show>
      </div>
    </aside>
  );
}
type ReviewSubTab = "git" | "sandbox" | "checkpoint";

type DiffItem = {
  id: string;
  path: string;
  operation: "added" | "modified" | "deleted" | "renamed";
  additions?: number;
  deletions?: number;
  patch?: string;
  before?: string;
  after?: string;
  oldPath?: string;
};

function toDiffItem(change: {
  path: string;
  operation?: "added" | "modified" | "deleted" | "renamed";
  kind?: string;
  oldPath?: string;
  additions?: number;
  deletions?: number;
  patch?: string;
  before?: string;
  after?: string;
}): DiffItem {
  const operation =
    change.operation ??
    (change.kind === "add"
      ? "added"
      : change.kind === "delete"
        ? "deleted"
        : change.kind === "rename"
          ? "renamed"
          : "modified");
  return {
    id: change.path,
    path: change.path,
    operation,
    ...(change.oldPath ? { oldPath: change.oldPath } : {}),
    ...(change.additions !== undefined ? { additions: change.additions } : {}),
    ...(change.deletions !== undefined ? { deletions: change.deletions } : {}),
    ...(change.patch ? { patch: change.patch } : {}),
    ...(change.before ? { before: change.before } : {}),
    ...(change.after ? { after: change.after } : {}),
  };
}

function diffLines(patch?: string) {
  if (!patch) return [];
  const lines: Array<{
    type: string;
    sign: string;
    text: string;
    oldNo?: number;
    newNo?: number;
  }> = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git")) {
      inHunk = false;
      oldLine = 0;
      newLine = 0;
      lines.push({ type: "is-header", sign: "", text: line });
      continue;
    }
    if (line.startsWith("@@")) {
      const match = line.match(
        /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u,
      );
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
      }
      inHunk = true;
      lines.push({ type: "is-header", sign: "", text: line });
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) {
      lines.push({ type: "is-header", sign: "", text: line });
      continue;
    }
    if (!inHunk) {
      lines.push({ type: "", sign: "", text: line });
      continue;
    }
    if (line.startsWith("+")) {
      lines.push({
        type: "is-added",
        sign: "+",
        text: line.slice(1),
        newNo: newLine++,
      });
      continue;
    }
    if (line.startsWith("-")) {
      lines.push({
        type: "is-removed",
        sign: "-",
        text: line.slice(1),
        oldNo: oldLine++,
      });
      continue;
    }
    if (line.startsWith(" ")) {
      lines.push({
        type: "",
        sign: " ",
        text: line.slice(1),
        oldNo: oldLine++,
        newNo: newLine++,
      });
      continue;
    }
    lines.push({ type: "", sign: "", text: line });
  }
  return lines;
}

function statusFor(operation: string) {
  if (operation === "added") return "A";
  if (operation === "modified") return "M";
  if (operation === "deleted") return "D";
  if (operation === "renamed") return "R";
  return "?";
}

export function ReviewPane(props: {
  runtime?: RuntimeClient;
  requestedTab?: ReviewSubTab;
} = {}) {
  const [tab, setTab] = createSignal<ReviewSubTab>("git");
  createEffect(() => {
    if (props.requestedTab) setTab(props.requestedTab);
  });
  const [loaded, setLoaded] = createSignal(false);
  const [gitChanges, setGitChanges] = createSignal<DiffItem[]>([]);
  const [gitSelected, setGitSelected] = createSignal<string | null>(null);
  const [gitRefs, setGitRefs] = createSignal<RuntimeGitRef[]>([]);
  const [gitFrom, setGitFrom] = createSignal("HEAD");
  const [gitTo, setGitTo] = createSignal("WORKTREE");
  const [sandboxes, setSandboxes] = createSignal<RuntimeSandbox[]>([]);
  const [teamPRs, setTeamPRs] = createSignal<RuntimeTeamPR[]>([]);
  const [selectedSandbox, setSelectedSandbox] = createSignal<string | null>(null);
  const [sandboxChanges, setSandboxChanges] = createSignal<DiffItem[]>([]);
  const [sandboxSelected, setSandboxSelected] = createSignal<string | null>(null);
  const [checkpoints, setCheckpoints] = createSignal<RuntimeCheckpoint[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = createSignal<string | null>(null);
  const [checkpointChanges, setCheckpointChanges] = createSignal<DiffItem[]>([]);
  const [checkpointSelected, setCheckpointSelected] = createSignal<string | null>(null);
  const [fileWidth, setFileWidth] = createSignal(180);

  onMount(() => {
    void (async () => {
      const refs = (await props.runtime?.gitRefs?.()) ?? [];
      setGitRefs(refs);
      const currentBranch = refs.find(
        (ref) => ref.kind === "branch" && ref.current,
      )?.name;
      if (currentBranch) setGitFrom(currentBranch);
      await loadGit();
      const sandboxList = (await props.runtime?.sandboxList?.()) ?? [];
      const prList = (await props.runtime?.teamPRList?.()) ?? [];
      setSandboxes(sandboxList);
      setTeamPRs(prList);
      const firstSandboxID =
        prList[0]?.sandboxID ?? sandboxList[0]?.id ?? null;
      if (firstSandboxID) {
        setSelectedSandbox(firstSandboxID);
        await loadSandboxDiff(firstSandboxID);
      }
      const checkpointList = (await props.runtime?.checkpointList?.()) ?? [];
      setCheckpoints(checkpointList);
      if (checkpointList.length) {
        setSelectedCheckpoint(checkpointList[checkpointList.length - 1]!.id);
        await loadCheckpointPreview(checkpointList[checkpointList.length - 1]!.id);
      }
      setLoaded(true);
    })();
  });

  async function loadGit() {
    try {
      const git = await props.runtime?.workspaceGitDiff?.({
        from: gitFrom(),
        to: gitTo(),
      });
      if (git && git.length) {
        const mapped = git.map(toDiffItem);
        setGitChanges(mapped);
        if (mapped.length) setGitSelected(mapped[0]!.path);
        return;
      }
    } catch {
      // Fall through to the object-store global diff.
    }
    const workspace = (await props.runtime?.workspaceDiff?.()) ?? [];
    const mapped = workspace.map(toDiffItem);
    setGitChanges(mapped);
    if (mapped.length) setGitSelected(mapped[0]!.path);
  }

  async function loadSandboxDiff(id: string) {
    const changes = (await props.runtime?.sandboxDiff?.(id)) ?? [];
    const mapped = changes.map(toDiffItem);
    setSandboxChanges(mapped);
    if (mapped.length) setSandboxSelected(mapped[0]!.path);
  }

  async function selectSandbox(id: string) {
    setSelectedSandbox(id);
    await loadSandboxDiff(id);
  }

  async function loadCheckpointPreview(id: string) {
    const preview = await props.runtime?.checkpointPreview?.(id);
    if (!preview) return;
    const mapped = preview.changes.map(toDiffItem);
    setCheckpointChanges(mapped);
    if (mapped.length) setCheckpointSelected(mapped[0]!.path);
  }

  async function selectCheckpoint(id: string) {
    setSelectedCheckpoint(id);
    await loadCheckpointPreview(id);
  }

  const totalAdditions = () =>
    changesForTab().reduce((sum, change) => sum + (change.additions ?? 0), 0);
  const totalDeletions = () =>
    changesForTab().reduce((sum, change) => sum + (change.deletions ?? 0), 0);
  const changesForTab = () =>
    tab() === "git"
      ? gitChanges()
      : tab() === "sandbox"
        ? sandboxChanges()
        : checkpointChanges();
  const selectedForTab = () =>
    tab() === "git"
      ? gitSelected()
      : tab() === "sandbox"
        ? sandboxSelected()
        : checkpointSelected();
  const selectedFile = () =>
    changesForTab().find((change) => change.path === selectedForTab());

  const selectedTeamPR = () =>
    teamPRs().find((pr) => pr.sandboxID === selectedSandbox());

  function startFileResize(event: PointerEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = fileWidth();
    const move = (next: PointerEvent) =>
      setFileWidth(
        Math.max(140, Math.min(220, startWidth + next.clientX - startX)),
      );
    const finish = (next: PointerEvent) => {
      target.releasePointerCapture?.(next.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  }

  function selectTab(next: ReviewSubTab) {
    setTab(next);
  }

  return (
    <div class="review-pane">
      <div class="review-subtabs">
        <button
          type="button"
          class="review-subtab"
          data-active={tab() === "git"}
          onClick={() => selectTab("git")}
        >
          Git
        </button>
        <button
          type="button"
          class="review-subtab"
          data-active={tab() === "sandbox"}
          onClick={() => selectTab("sandbox")}
        >
          Sandbox / Team
        </button>
        <button
          type="button"
          class="review-subtab"
          data-active={tab() === "checkpoint"}
          onClick={() => selectTab("checkpoint")}
        >
          Checkpoint
        </button>
      </div>
      <Show when={tab() === "git"}>
        <div class="review-git-ranges">
          <NeuSelect
            value={gitFrom()}
            options={[
              { value: "HEAD", label: "HEAD" },
              ...gitRefs().map((ref) => ({
                value: ref.name,
                label: ref.kind === "worktree"
                  ? `${ref.name} (worktree)`
                  : `${ref.name} (${ref.kind})`,
              })),
            ]}
            onChange={(value) => {
              setGitFrom(value);
              void loadGit();
            }}
          />
          <span class="review-git-arrow">→</span>
          <NeuSelect
            value={gitTo()}
            options={[
              { value: "WORKTREE", label: "Working Tree" },
              ...gitRefs().map((ref) => ({
                value: ref.name,
                label: ref.kind === "worktree"
                  ? `${ref.name} (worktree)`
                  : `${ref.name} (${ref.kind})`,
              })),
            ]}
            onChange={(value) => {
              setGitTo(value);
              void loadGit();
            }}
          />
        </div>
      </Show>
      <Show when={tab() === "sandbox" && teamPRs().length}>
        <div class="review-section-label">Team PRs</div>
        <div class="review-entity-list">
          <For each={teamPRs()}>
            {(pr) => (
              <button
                type="button"
                class="review-entity-button"
                data-active={selectedSandbox() === pr.sandboxID}
                onClick={() => void selectSandbox(pr.sandboxID)}
              >
                {pr.id}
                <span class="review-entity-count">{pr.status}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={tab() === "sandbox" && sandboxes().length}>
        <div class="review-entity-list">
          <For each={sandboxes()}>
            {(sandbox) => (
              <button
                type="button"
                class="review-entity-button"
                data-active={selectedSandbox() === sandbox.id}
                onClick={() => void selectSandbox(sandbox.id)}
              >
                {sandbox.id}
                <span class="review-entity-count">{sandbox.changedFiles}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={tab() === "sandbox" && selectedTeamPR()}>
        <div class="review-pr-detail">
          <div class="review-pr-row">
            <span class="review-pr-label">Task</span>
            <span class="review-pr-text">{selectedTeamPR()!.task}</span>
          </div>
          <div class="review-pr-row">
            <span class="review-pr-label">Status</span>
            <span class="review-pr-text">{selectedTeamPR()!.status}</span>
          </div>
          <Show when={selectedTeamPR()!.result}>
            <div class="review-pr-row">
              <span class="review-pr-label">Result</span>
              <pre class="review-pr-result">{selectedTeamPR()!.result}</pre>
            </div>
          </Show>
          <Show when={selectedTeamPR()!.buildEvidence}>
            <div class="review-pr-row">
              <span class="review-pr-label">Build</span>
              <span class="review-pr-text">
                {selectedTeamPR()!.buildEvidence!.ok ? "passed" : "failed"} · exit {selectedTeamPR()!.buildEvidence!.exitCode}
              </span>
            </div>
            <Show when={selectedTeamPR()!.buildEvidence!.output}>
              <pre class="review-pr-result">{selectedTeamPR()!.buildEvidence!.output}</pre>
            </Show>
          </Show>
        </div>
      </Show>
      <Show when={tab() === "checkpoint" && checkpoints().length}>
        <div class="review-entity-control">
          <NeuSelect
            value={selectedCheckpoint() ?? ""}
            options={checkpoints().map((checkpoint) => ({
              value: checkpoint.id,
              label: `${checkpoint.id} · ${checkpoint.changes} changes · step ${checkpoint.step}`,
            }))}
            onChange={(value) => void selectCheckpoint(value)}
          />
        </div>
      </Show>
      <div class="review-header">
        <div class="review-title">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 5C2 3.89543 2.89543 3 4 3H6.5L8 4.5H10C11.1046 4.5 12 5.39543 12 6.5V10C12 11.1046 11.1046 12 10 12H4C2.89543 12 2 11.1046 2 10V5Z"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path d="M2 7H12" stroke="currentColor" stroke-width="1.2" />
          </svg>
          <span>{tab() === "git" ? "Git Changes" : tab() === "sandbox" ? "Sandbox Changes" : "Checkpoint Changes"}</span>
        </div>
        <div class="review-meta">
          <span class="review-count">{changesForTab().length} files</span>
          <span class="review-additions">+{totalAdditions()}</span>
          <span class="review-deletions">-{totalDeletions()}</span>
        </div>
      </div>
      <div class="review-body">
        <Show
          when={!loaded()}
          fallback={
            <Show
              when={changesForTab().length}
              fallback={
                <div class="review-empty">
                  <div class="review-empty-icon">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <rect x="3" y="4" width="22" height="5" rx="1.5" stroke="currentColor" stroke-width="1.6" />
                      <rect x="3" y="12" width="22" height="5" rx="1.5" stroke="currentColor" stroke-width="1.6" />
                      <circle cx="6" cy="6.5" r="1.2" fill="currentColor" />
                      <circle cx="6" cy="14.5" r="1.2" fill="currentColor" />
                      <path d="M22 6.5h3M22 14.5h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                    </svg>
                  </div>
                  <div class="review-empty-title">暂无变更</div>
                  <div class="review-empty-desc">
                    当前工作区没有待审阅的变更。
                  </div>
                </div>
              }
            >
              <div class="review-files" data-narrow={fileWidth() < 170} style={{ width: `${fileWidth()}px` }}>
                <div class="review-files-heading">Files changed</div>
                <For each={changesForTab()}>
                  {(change) => (
                    <button
                      type="button"
                      class="review-file-row"
                      data-active={selectedForTab() === change.path}
                      onClick={() =>
                        tab() === "git"
                          ? setGitSelected(change.path)
                          : tab() === "sandbox"
                            ? setSandboxSelected(change.path)
                            : setCheckpointSelected(change.path)
                      }
                    >
                      <span
                        class={`review-file-status ${change.operation === "added" ? "is-added" : change.operation === "deleted" ? "is-deleted" : "is-modified"}`}
                      >
                        {statusFor(change.operation)}
                      </span>
                      <span class="review-file-name">{change.path}</span>
                    </button>
                  )}
                </For>
              </div>
              <div
                class="review-resizer"
                role="separator"
                aria-orientation="vertical"
                onPointerDown={startFileResize}
              />
              <div class="review-diff">
                <div class="review-diff-header">
                  <span class="review-diff-path">{selectedFile()?.path ?? ""}</span>
                </div>
                <div class="review-diff-content">
                  <Show
                    when={selectedFile()?.patch || selectedFile()?.before || selectedFile()?.after}
                    fallback={
                      <div class="review-empty">
                        <div class="review-empty-title">暂无内容级 diff</div>
                        <div class="review-empty-desc">
                          当前变更只有文件级信息，没有可展示的行级差异。
                        </div>
                      </div>
                    }
                  >
                    <Show when={selectedFile()?.patch}>
                      <For each={diffLines(selectedFile()!.patch)}>
                        {(line) => (
                          <div class={`review-diff-line ${line.type}`}>
                            <span class="review-diff-pos">{line.oldNo ?? ""}</span>
                            <span class="review-diff-pos">{line.newNo ?? ""}</span>
                            <span class="review-diff-sign">{line.sign}</span>
                            <span class="review-diff-text">{line.text}</span>
                          </div>
                        )}
                      </For>
                    </Show>
                    <Show when={!selectedFile()?.patch && selectedFile()?.before}>
                      <div class="review-diff-raw">
                        <div class="review-diff-raw-title">Before</div>
                        <pre>{selectedFile()!.before}</pre>
                      </div>
                    </Show>
                    <Show when={!selectedFile()?.patch && selectedFile()?.after}>
                      <div class="review-diff-raw">
                        <div class="review-diff-raw-title">After</div>
                        <pre>{selectedFile()!.after}</pre>
                      </div>
                    </Show>
                  </Show>
                </div>
              </div>
            </Show>
          }
        >
          <div class="review-empty">
            <div class="review-empty-title">正在读取变更...</div>
          </div>
        </Show>
      </div>
    </div>
  );
}

const MAX_TERMINALS_PER_SESSION = 8;

type TerminalTab = {
  id: string;
  title: string;
  cells: string[];
  layout: "vertical" | "horizontal";
};

function newTerminalID() {
  return `terminal_${crypto.randomUUID()}`;
}

function tabTitle(index: number) {
  return `终端 ${index + 1}`;
}

export function TerminalPane(props: {
  runtime?: RuntimeClient;
  sessionID?: string;
  runtimeURL?: string;
  token?: string;
  active?: boolean;
} = {}) {
  const [tabs, setTabs] = createSignal<TerminalTab[]>([]);
  const [activeID, setActiveID] = createSignal<string>();
  const [limitError, setLimitError] = createSignal<string>();
  const [sessions, setSessions] = createSignal<RuntimeNativeTerminalSession[]>([]);
  const [shellProfile, setShellProfile] = createSignal("bash");
  let loadToken = 0;

  function retitle(next: TerminalTab[]) {
    return next.map((tab, index) => ({ ...tab, title: tabTitle(index) }));
  }

  async function loadTabs(sessionID: string) {
    const token = ++loadToken;
    const listed = (await props.runtime?.nativeTerminalList?.()) ?? [];
    if (token !== loadToken) return;
    setSessions(listed);
    const running = listed.filter(
      (item) =>
        item.status === "running" &&
        (!item.sessionID || item.sessionID === sessionID),
    );
    if (!running.length) {
      const id = newTerminalID();
      setTabs([{ id, title: tabTitle(0), cells: [id], layout: "horizontal" }]);
      setActiveID(id);
      setLimitError();
      return;
    }
    const next = retitle(
      running.map((item) => ({
        id: item.id,
        title: "",
        cells: [item.id],
        layout: "horizontal" as const,
      })),
    );
    setTabs(next);
    const current = activeID();
    setActiveID(
      current && next.some((tab) => tab.id === current)
        ? current
        : next[0]?.id,
    );
    setLimitError();
  }

  createEffect((previous?: string) => {
    const sessionID = props.sessionID;
    const runtimeURL = props.runtimeURL;
    const key = `${sessionID ?? ""}\0${runtimeURL ?? ""}`;
    if (!sessionID || !runtimeURL) {
      setTabs([]);
      setActiveID();
      setLimitError();
      return key;
    }
    if (previous === key) return key;
    void loadTabs(sessionID);
    return key;
  });

  async function refreshSessions() {
    const listed = (await props.runtime?.nativeTerminalList?.()) ?? [];
    setSessions(listed);
  }

  async function claimActiveTerminal() {
    const id = activeID();
    if (!id) return;
    try {
      await props.runtime?.nativeTerminalClaimHumanInput?.(id);
      await refreshSessions();
    } catch {
      // optional method may not exist; leave current state
    }
  }

  async function releaseActiveTerminal() {
    const id = activeID();
    if (!id) return;
    try {
      await props.runtime?.nativeTerminalReleaseHumanControl?.(id);
      await refreshSessions();
    } catch {
      // optional method may not exist; leave current state
    }
  }

  async function toggleSecureInput() {
    const id = activeID();
    if (!id) return;
    try {
      const session = sessions().find((item) => item.id === id);
      if (session?.secureInput)
        await props.runtime?.nativeTerminalEndSecureInput?.(id);
      else
        await props.runtime?.nativeTerminalBeginSecureInput?.(id);
      await refreshSessions();
    } catch {
      // optional method may not exist; leave current state
    }
  }

  async function addTab() {
    if (!props.sessionID) return;
    if (tabs().length >= MAX_TERMINALS_PER_SESSION) {
      setLimitError(`每个会话最多 ${MAX_TERMINALS_PER_SESSION} 个终端`);
      return;
    }
    const id = newTerminalID();
    const next = retitle([
      ...tabs(),
      { id, title: "", cells: [id], layout: "horizontal" },
    ]);
    setTabs(next);
    setActiveID(id);
    setLimitError();
  }

  function splitActiveTab(direction: "vertical" | "horizontal") {
    const tab = tabs().find((item) => item.id === activeID());
    if (!tab) return;
    const id = newTerminalID();
    const next = tabs().map((item) =>
      item.id === tab.id
        ? {
            ...item,
            cells: [...item.cells, id],
            layout: direction,
          }
        : item,
    );
    setTabs(next);
    setActiveID(id);
    setLimitError();
  }

  async function closeTab(id: string) {
    let remaining = tabs().filter((tab) => tab.id !== id);
    if (!remaining.length) {
      const nextID = newTerminalID();
      remaining = [
        { id: nextID, title: tabTitle(0), cells: [nextID], layout: "horizontal" },
      ];
      setTabs(remaining);
      setActiveID(nextID);
    } else {
      setTabs(retitle(remaining));
      if (activeID() === id || !remaining.some((tab) => tab.cells.includes(activeID() ?? "")))
        setActiveID(remaining[0]?.cells[0]);
    }
    setLimitError();
    try {
      await props.runtime?.nativeTerminalStop?.(id);
    } catch {
      // already exited
    }
  }

  function closeCell(tab: TerminalTab, cellID: string) {
    const remainingCells = tab.cells.filter((item) => item !== cellID);
    const next = tabs().map((item) =>
      item.id === tab.id
        ? {
            ...item,
            cells: remainingCells.length ? remainingCells : [newTerminalID()],
            layout: "horizontal" as const,
          }
        : item,
    );
    setTabs(next);
    if (activeID() === cellID) {
      const replaced = next.find((item) => item.id === tab.id)!;
      setActiveID(replaced.cells[0]);
    }
    void props.runtime?.nativeTerminalStop?.(cellID).catch(() => undefined);
  }

  return (
    <div class="terminal-pane">
      <Show
        when={props.sessionID && props.runtimeURL}
        fallback={
          <div class="terminal-output">
            <div class="terminal-line terminal-line-header">
              选择一个会话以打开交互式终端
            </div>
          </div>
        }
      >
        <div class="terminal-toolbar">
          <select
            class="terminal-profile-select"
            value={shellProfile()}
            onChange={(event) => setShellProfile(event.currentTarget.value)}
          >
            <option value="bash">bash</option>
            <option value="zsh">zsh</option>
            <option value="sh">sh</option>
            <option value="pwsh">pwsh</option>
          </select>
          <span class="terminal-owner-badge" data-owner={sessions().find((item) => item.id === activeID())?.inputOwner ?? "model"}>
            {sessions().find((item) => item.id === activeID())?.inputOwner === "human" ? "人工控制" : "模型控制"}
          </span>
          <Show when={sessions().find((item) => item.id === activeID())?.inputOwner === "model"}>
            <button
              type="button"
              class="terminal-toolbar-btn"
              onClick={() => void claimActiveTerminal()}
              title="接管终端"
            >
              接管
            </button>
          </Show>
          <Show when={sessions().find((item) => item.id === activeID())?.inputOwner === "human"}>
            <button
              type="button"
              class="terminal-toolbar-btn"
              onClick={() => void releaseActiveTerminal()}
              title="交还模型控制"
            >
              交还模型
            </button>
            <button
              type="button"
              class="terminal-toolbar-btn"
              onClick={() => void toggleSecureInput()}
              title={sessions().find((item) => item.id === activeID())?.secureInput ? "结束安全输入" : "开始安全输入"}
            >
              {sessions().find((item) => item.id === activeID())?.secureInput ? "结束安全输入" : "安全输入"}
            </button>
          </Show>
          <button
            type="button"
            class="terminal-toolbar-btn"
            onClick={() => splitActiveTab("horizontal")}
            title="纵向分屏"
          >
            分屏↕
          </button>
          <button
            type="button"
            class="terminal-toolbar-btn"
            onClick={() => splitActiveTab("vertical")}
            title="横向分屏"
          >
            分屏↔
          </button>
        </div>
        <div class="terminal-tabs">
          <For each={tabs()}>
            {(tab) => (
              <button
                type="button"
                class="terminal-tab"
                data-active={activeID() === tab.id || tab.cells.includes(activeID() ?? "")}
                onClick={() => setActiveID(tab.cells[0])}
              >
                <span class="terminal-tab-label">{tab.title}</span>
                <span
                  class="terminal-tab-close"
                  role="button"
                  aria-label={`关闭 ${tab.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void closeTab(tab.id);
                  }}
                >
                  ×
                </span>
              </button>
            )}
          </For>
          <button
            type="button"
            class="terminal-tab-add"
            title="新建终端"
            disabled={tabs().length >= MAX_TERMINALS_PER_SESSION}
            onClick={() => void addTab()}
          >
            +
          </button>
        </div>
        <Show when={limitError()}>
          <div class="terminal-limit-error">{limitError()}</div>
        </Show>
        <div class="terminal-xterm-stack">
          <For each={tabs()}>
            {(tab) => (
              <div
                class="terminal-xterm-host"
                data-active={tab.cells.includes(activeID() ?? "")}
                style={{
                  display: tab.cells.includes(activeID() ?? "") ? "flex" : "none",
                }}
              >
                <div
                  class="terminal-split-stack"
                  style={{
                    flexDirection: tab.layout === "vertical" ? "row" : "column",
                  }}
                >
                  <For each={tab.cells}>
                    {(cellID) => (
                      <div
                        class="terminal-split-cell"
                        data-active={activeID() === cellID}
                        onClick={() => setActiveID(cellID)}
                      >
                        <WebTerminal
                          sessionID={props.sessionID!}
                          terminalID={cellID}
                          runtimeURL={props.runtimeURL!}
                          token={props.token}
                          active={props.active && activeID() === cellID}
                          command={shellProfile()}
                        />
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export function BrowserPane() {
  return (
    <div class="browser-pane">
      <div class="browser-toolbar">
        <div class="browser-url-bar">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style="color: var(--text-dim); flex-shrink: 0;"
          >
            <circle
              cx="7"
              cy="7"
              r="6"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path
              d="M3 7H11M7 3C5.89543 3 5 4.89543 5 6C5 7.10457 5.89543 8 7 8C8.10457 8 9 7.10457 9 6C9 4.89543 8.10457 3 7 3Z"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          <span class="browser-url-text">输入 URL 以打开页面</span>
        </div>
      </div>
      <div class="browser-empty">
        <div class="browser-empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M16 24C16 19.5817 19.5817 16 24 16C28.4183 16 32 19.5817 32 24"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <path
              d="M8 24H40"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="browser-empty-text">开始浏览</div>
      </div>
    </div>
  );
}

export function FilePane() {
  const [expanded, setExpanded] = createSignal<Set<string>>(
    new Set(["root", "src", "packages"]),
  );
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [fileWidth, setFileWidth] = createSignal(140);
  const [preview, setPreview] = createSignal(false);

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function startFileResize(event: PointerEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = fileWidth();
    const move = (next: PointerEvent) =>
      setFileWidth(
        Math.max(120, Math.min(190, startWidth + next.clientX - startX)),
      );
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const tree = [
    {
      name: ".git",
      type: "dir",
      status: null as string | null,
      children: [] as any[],
    },
    {
      name: ".kilo",
      type: "dir",
      status: null,
      children: [
        { name: "node_modules", type: "dir", status: null, children: [] },
        {
          name: "plans",
          type: "dir",
          status: null,
          children: [
            { name: "architecture", type: "dir", status: null, children: [] },
            { name: "scratch", type: "dir", status: null, children: [] },
          ],
        },
      ],
    },
    { name: "node_modules", type: "dir", status: null, children: [] },
    {
      name: "packages",
      type: "dir",
      status: null,
      children: [
        { name: "core", type: "dir", status: null, children: [] },
        { name: "hosts", type: "dir", status: null, children: [] },
        { name: "framework", type: "dir", status: null, children: [] },
        { name: "domains", type: "dir", status: null, children: [] },
        { name: "plugins", type: "dir", status: null, children: [] },
      ],
    },
    {
      name: "apps",
      type: "dir",
      status: null,
      children: [
        {
          name: "tui",
          type: "dir",
          status: null,
          children: [
            {
              name: "src",
              type: "dir",
              status: null,
              children: [
                { name: "app.tsx", type: "file", status: "M" },
                { name: "runtime.tsx", type: "file", status: "M" },
                { name: "main.tsx", type: "file", status: null },
                { name: "README.md", type: "file", status: "A" },
              ],
            },
          ],
        },
      ],
    },
    { name: "package.json", type: "file", status: null },
    { name: "dsh.json", type: "file", status: null },
    { name: "tsconfig.json", type: "file", status: null },
    { name: "bun.lock", type: "file", status: null },
  ];

  const fileContents: Record<string, string> = {
    "app.tsx":
      'import { render } from "solid-js/web";\n\nexport function App() { return <div>Hello</div>; }\n',
    "runtime.tsx":
      'import { createWorkerRuntimeClient } from "@natalia/client";\n\ntype Runtime = ReturnType<typeof createWorkerRuntimeClient>;\n',
    "main.tsx":
      'import { createRoot } from "solid-js";\nimport { App } from "./app";\n\ncreateRoot(() => <App />);\n',
    "README.md":
      "# Natalia\n\nA local-first agent runtime.\n\n## Features\n\n- Multi-agent collaboration\n- Interactive terminal\n- Self-modification\n- Checkpoints and rollback\n",
    "package.json":
      '{\n  "name": "natalia-cli",\n  "version": "0.0.0-m13",\n  "private": true\n}\n',
  };

  function selectFile(path: string) {
    setSelectedPath(path);
    setPreview(path.endsWith(".md"));
  }

  function renderTree(items: typeof tree, depth: number) {
    return (
      <For each={items}>
        {(item) => (
          <div>
            {item.type === "dir" ? (
              <>
                <button
                  type="button"
                  class="file-tree-item"
                  style={{ "padding-left": `${depth * 16 + 8}px` }}
                  onClick={() => toggle(item.name)}
                >
                  <svg
                    class="file-tree-chevron"
                    data-expanded={expanded().has(item.name)}
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
                  <svg class="file-tree-icon" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 4C2 2.89543 2.89543 2 4 2H7.5L9.5 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z"
                      stroke="currentColor"
                      stroke-width="1.2"
                    />
                  </svg>
                  <span class="file-tree-name">{item.name}</span>
                </button>
                <Show when={expanded().has(item.name)}>
                  {renderTree(item.children ?? [], depth + 1)}
                </Show>
              </>
            ) : (
              <button
                type="button"
                class="file-tree-item file-tree-file"
                data-active={selectedPath() === item.name}
                style={{ "padding-left": `${depth * 16 + 24}px` }}
                onClick={() => selectFile(item.name)}
              >
                <svg
                  class="file-tree-icon file-tree-file-icon"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M4 2C4 1.44772 4.44772 1 5 1H10L12 3V14C12 14.5523 11.5523 15 11 15H5C4.44772 15 4 14.5523 4 14V2Z"
                    stroke="currentColor"
                    stroke-width="1.2"
                  />
                  <path
                    d="M10 1V3H12"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  />
                </svg>
                <span class="file-tree-name">{item.name}</span>
                {item.status && (
                  <span
                    class={`file-tree-status ${item.status === "M" ? "status-modified" : "status-added"}`}
                  >
                    {item.status}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </For>
    );
  }

  const selectedContent = () =>
    selectedPath() ? (fileContents[selectedPath()!] ?? "") : "";

  return (
    <div class="file-pane">
      <div class="file-pane-header">
        <span class="file-pane-title">资源管理器</span>
      </div>
      <div class="file-pane-body">
        <div class="file-tree" style={{ width: `${fileWidth()}px` }}>
          {renderTree(tree, 0)}
        </div>
        <div
          class="file-pane-resizer"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startFileResize}
        />
        <div class="file-editor">
          <div class="file-editor-tabs">
            <button
              type="button"
              class="file-editor-tab"
              data-active={!preview()}
              onClick={() => setPreview(false)}
            >
              编辑
            </button>
            <button
              type="button"
              class="file-editor-tab"
              data-active={preview()}
              onClick={() => setPreview(true)}
            >
              预览
            </button>
            <span class="file-editor-path">
              {selectedPath() ?? "未选择文件"}
            </span>
          </div>
          <div class="file-editor-content">
            {selectedPath() ? (
              preview() ? (
                <div class="markdown-preview">
                  <pre
                    style={{
                      "white-space": "pre-wrap",
                      "font-family": "var(--font-family-sans)",
                      "font-size": "13px",
                      "line-height": "1.7",
                    }}
                  >
                    {selectedContent()}
                  </pre>
                </div>
              ) : (
                <textarea
                  class="file-editor-textarea"
                  value={selectedContent()}
                  readOnly
                />
              )
            ) : (
              <div class="file-editor-empty">从左侧选择文件</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
