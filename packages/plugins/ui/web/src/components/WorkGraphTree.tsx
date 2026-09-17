import { For, Show, createMemo, createSignal } from "solid-js";
import {
  buildWorkGraphForest,
  buildWorkGraphNavigation,
  selectUnattributedWorkGraphNodes,
} from "@natalia/view-store";
import type { AppState, WorkGraphTreeNode } from "@natalia/view-store";

/**
 * One causal-tree node: a graph node plus its already-linked children (via the
 * `via` causal verb), collapsed/expanded on click. The tree is assembled by
 * `buildWorkGraphForest` from real edges only — a missing edge shows as a leaf,
 * never a fabricated branch (the graph invariant).
 */
function TreeNode(props: { node: WorkGraphTreeNode; depth: number }) {
  const [open, setOpen] = createSignal(props.depth < 2);
  const hasChildren = () => props.node.children.length > 0;
  return (
    <div class="wg-node">
      <button
        type="button"
        class="wg-node-row"
        data-depth={props.depth}
        onClick={() => hasChildren() && setOpen(!open())}
      >
        <span class="wg-twisty">
          {hasChildren() ? (open() ? "▾" : "▸") : "•"}
        </span>
        <span class="wg-kind" data-kind={props.node.node.kind}>
          {props.node.node.kind}
        </span>
        <span class="wg-summary">{props.node.node.summary}</span>
        <Show when={props.node.via}>
          <span class="wg-via">← {props.node.via}</span>
        </Show>
      </button>
      <Show when={open() && hasChildren()}>
        <div class="wg-children">
          <For each={props.node.children}>
            {(child) => <TreeNode node={child} depth={props.depth + 1} />}
          </For>
        </div>
      </Show>
    </div>
  );
}

/**
 * The Work Graph as a collapsible causal forest (EI Phase 3 / WG3): the whole
 * session graph as forward causal trees rooted at nodes with no inbound edge,
 * plus the unattributed workspace changes surfaced explicitly (never silently
 * attributed). Session-scoped: reads the active session's projection, so
 * switching sessions switches the graph.
 */
export function WorkGraphTree(props: { state: AppState }) {
  const forest = createMemo(() => buildWorkGraphForest(props.state));
  const unattributed = createMemo(() =>
    selectUnattributedWorkGraphNodes(props.state),
  );
  const [query, setQuery] = createSignal("");
  const [focusID, setFocusID] = createSignal<string | undefined>();
  const matches = createMemo(() => {
    const needle = query().trim().toLowerCase();
    if (!needle) return [];
    return Object.values(props.state.workGraphNodes)
      .filter((node) =>
        [node.nodeID, node.summary, node.target]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle)),
      )
      .slice(0, 8);
  });
  const navigation = createMemo(() => {
    const id = focusID();
    return id ? buildWorkGraphNavigation(props.state, id) : undefined;
  });
  return (
    <div class="wg-tree">
      <div class="wg-search">
        <input
          class="wg-search-input"
          type="search"
          placeholder="Search path / node / summary…"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <Show when={focusID()}>
          <button
            type="button"
            class="wg-search-clear"
            onClick={() => {
              setFocusID(undefined);
              setQuery("");
            }}
          >
            clear
          </button>
        </Show>
      </div>
      <Show when={matches().length}>
        <div class="wg-search-results">
          <For each={matches()}>
            {(node) => (
              <button
                type="button"
                class="wg-search-result"
                onClick={() => {
                  setFocusID(node.nodeID);
                  setQuery(node.target ?? node.summary);
                }}
              >
                <span class="wg-kind" data-kind={node.kind}>
                  {node.kind}
                </span>
                <span class="wg-summary">{node.summary}</span>
                <Show when={node.target}>
                  <span class="wg-via">{node.target}</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={navigation()}>
        {(nav) => (
          <div class="wg-navigation">
            <div class="wg-section-title">
              Why changed (backward) · {nav().focus?.summary}
            </div>
            <Show
              when={nav().backward.length}
              fallback={<div class="neu-gov-empty">No inbound causal edge.</div>}
            >
              <For each={nav().backward}>
                {(node) => <TreeNode node={node} depth={0} />}
              </For>
            </Show>
            <div class="wg-section-title">What changed (forward)</div>
            <Show
              when={nav().forward.length}
              fallback={<div class="neu-gov-empty">No outbound causal edge.</div>}
            >
              <For each={nav().forward}>
                {(node) => <TreeNode node={node} depth={0} />}
              </For>
            </Show>
          </div>
        )}
      </Show>
      <Show when={!navigation()}>
      <Show when={unattributed().length}>
        <div class="wg-unattributed">
          <div class="wg-section-title">
            Unattributed changes (no causal edge — needs explanation)
          </div>
          <For each={unattributed()}>
            {(node) => (
              <div class="wg-node-row" data-depth={0}>
                <span class="wg-twisty">⚠</span>
                <span class="wg-kind" data-kind={node.kind}>
                  {node.kind}
                </span>
                <span class="wg-summary">{node.summary}</span>
                <span class="wg-via">{node.target}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={!forest().length && !unattributed().length}>
        <div class="neu-gov-empty">
          No work graph yet — tool calls and workspace changes record the causal
          chain here.
        </div>
      </Show>
      <For each={forest()}>{(node) => <TreeNode node={node} depth={0} />}</For>
      </Show>
    </div>
  );
}
