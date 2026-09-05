import { createSignal, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import type {
  RuntimeCheckpoint,
  RuntimeClient,
  RuntimeEvent,
  RuntimeGitRef,
  RuntimeNativeTerminalSession,
  RuntimeSandbox,
  RuntimeTeamPR,
} from "@natalia/contracts";
import { NeuSelect } from "./NeuSelect";

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
  requestedCheckpointID?: string;
} = {}) {
  const [tab, setTab] = createSignal<ReviewSubTab>("git");
  createEffect(() => {
    if (props.requestedTab) setTab(props.requestedTab);
    if (props.requestedCheckpointID) {
      setTab("checkpoint");
      setSelectedCheckpoint(props.requestedCheckpointID);
      void loadCheckpointPreview(props.requestedCheckpointID);
    }
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
  const [renamingCheckpointID, setRenamingCheckpointID] = createSignal<string | null>(null);
  const [checkpointNameDraft, setCheckpointNameDraft] = createSignal("");
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
        includePatch: false,
      });
      if (git && git.length) {
        const mapped = git.map(toDiffItem);
        setGitChanges(mapped);
        if (mapped.length) await selectGitFile(mapped[0]!.path);
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

  async function selectGitFile(path: string) {
    setGitSelected(path);
    try {
      const detail = await props.runtime?.workspaceGitDiff?.({
        from: gitFrom(),
        to: gitTo(),
        path,
        includePatch: true,
      });
      const file = detail?.[0];
      if (file) {
        const updated = toDiffItem(file);
        setGitChanges((prev) =>
          prev.map((change) => (change.path === path ? updated : change)),
        );
      }
    } catch {
      // keep the list-only row; patch can be loaded by clicking again
    }
  }

  async function loadSandboxDiff(id: string) {
    try {
      const changes = (await props.runtime?.sandboxDiff?.(id)) ?? [];
      const mapped = changes.map(toDiffItem);
      setSandboxChanges(mapped);
      if (mapped.length) setSandboxSelected(mapped[0]!.path);
    } catch {
      setSandboxChanges([]);
      setSandboxSelected(null);
    }
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

  async function refreshCheckpoints() {
    const checkpointList = (await props.runtime?.checkpointList?.()) ?? [];
    setCheckpoints(checkpointList);
    return checkpointList;
  }

  function checkpointLabel(checkpoint: RuntimeCheckpoint) {
    const title = checkpoint.name?.trim() || checkpoint.id;
    return `${title} · ${checkpoint.changes} changes · step ${checkpoint.step}`;
  }

  function beginRenameCheckpoint(checkpoint: RuntimeCheckpoint) {
    setRenamingCheckpointID(checkpoint.id);
    setCheckpointNameDraft(checkpoint.name ?? "");
  }

  async function commitRenameCheckpoint() {
    const id = renamingCheckpointID();
    const name = checkpointNameDraft().trim();
    setRenamingCheckpointID(null);
    if (!id || !name) return;
    const current = checkpoints().find((checkpoint) => checkpoint.id === id);
    if (current?.name === name) return;
    await props.runtime?.checkpointRename?.({ id, name });
    await refreshCheckpoints();
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

  const userCheckpoints = () =>
    checkpoints().filter((checkpoint) => checkpoint.reason !== "rollback_safety");
  const safetyCheckpoints = () =>
    checkpoints().filter((checkpoint) => checkpoint.reason === "rollback_safety");

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
        <Show when={userCheckpoints().length}>
          <div class="review-section-label">我的快照</div>
          <div class="review-entity-control">
            <NeuSelect
              value={
                userCheckpoints().some((c) => c.id === selectedCheckpoint())
                  ? selectedCheckpoint() ?? ""
                  : ""
              }
              options={userCheckpoints().map((checkpoint) => ({
                value: checkpoint.id,
                label: checkpointLabel(checkpoint),
              }))}
              onChange={(value) => void selectCheckpoint(value)}
            />
          </div>
          <Show
            when={userCheckpoints().some((checkpoint) => checkpoint.id === selectedCheckpoint())}
          >
            <div class="review-checkpoint-rename">
              <Show
                when={renamingCheckpointID() === selectedCheckpoint()}
                fallback={
                  <button
                    type="button"
                    class="review-checkpoint-rename-btn"
                    onClick={() => {
                      const selected = userCheckpoints().find(
                        (checkpoint) => checkpoint.id === selectedCheckpoint(),
                      );
                      if (selected) beginRenameCheckpoint(selected);
                    }}
                  >
                    重命名
                  </button>
                }
              >
                <input
                  class="review-checkpoint-rename-input"
                  value={checkpointNameDraft()}
                  placeholder="快照名称"
                  onInput={(event) => setCheckpointNameDraft(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void commitRenameCheckpoint();
                    if (event.key === "Escape") setRenamingCheckpointID(null);
                  }}
                />
                <button
                  type="button"
                  class="review-checkpoint-rename-btn"
                  onClick={() => void commitRenameCheckpoint()}
                >
                  保存
                </button>
              </Show>
            </div>
          </Show>
        </Show>
        <Show when={safetyCheckpoints().length}>
          <div class="review-section-label">安全点</div>
          <div class="review-entity-control">
            <NeuSelect
              value={
                safetyCheckpoints().some((c) => c.id === selectedCheckpoint())
                  ? selectedCheckpoint() ?? ""
                  : ""
              }
              options={safetyCheckpoints().map((checkpoint) => ({
                value: checkpoint.id,
                label: checkpointLabel(checkpoint),
              }))}
              onChange={(value) => void selectCheckpoint(value)}
            />
          </div>
        </Show>
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
                          ? void selectGitFile(change.path)
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
