import { For, Show, createMemo, createSignal } from "solid-js";
import {
  buildWorkGraphForest,
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
  return (
    <div class="wg-tree">
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
    </div>
  );
}
