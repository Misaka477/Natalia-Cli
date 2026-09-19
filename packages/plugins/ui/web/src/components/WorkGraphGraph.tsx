import { For, Show, createMemo, createSignal } from "solid-js";
import {
  buildWorkGraphFileNavigation,
  type WorkGraphState,
  type WorkGraphTreeNode,
} from "@natalia/view-store";

/**
 * One node row in the graph view. Unlike the causal forest, the graph view is
 * an explicit node/edge adjacency anchored on a file: each row is a node in the
 * "why changed" or "what changed" chain, so a reader sees the graph edges, not
 * just the tree shape.
 */
function GraphNodeRow(props: { tree: WorkGraphTreeNode; depth: number }) {
  return (
    <div class="wg-node" data-depth={props.depth}>
      <div class="wg-node-row" data-depth={props.depth}>
        <span class="wg-twisty">
          {props.tree.children.length ? "├" : "•"}
        </span>
        <span class="wg-kind" data-kind={props.tree.node.kind}>
          {props.tree.node.kind}
        </span>
        <span class="wg-summary">{props.tree.node.summary}</span>
        <Show when={props.tree.via}>
          <span class="wg-via">← {props.tree.via}</span>
        </Show>
      </div>
      <Show when={props.tree.children.length}>
        <div class="wg-children">
          <For each={props.tree.children}>
            {(child) => <GraphNodeRow tree={child} depth={props.depth + 1} />}
          </For>
        </div>
      </Show>
    </div>
  );
}

/**
 * The independent Work Graph navigator (WG5): start from a file path and read
 * the graph as "why did this change" (backward causal chain) beside "what does
 * this touch" (forward chain). Complements the causal `WorkGraphTree` forest
 * with a file-anchored adjacency view; a path with no node shows an explicit
 * "unknown provenance" instead of a fabricated cause.
 */
export function WorkGraphGraph(props: { state: WorkGraphState }) {
  const [filePath, setFilePath] = createSignal("");
  const navigation = createMemo(() => {
    const path = filePath().trim();
    if (!path) return undefined;
    return buildWorkGraphFileNavigation(props.state, path);
  });
  return (
    <div class="wg-graph">
      <div class="wg-search">
        <input
          class="wg-search-input"
          type="search"
          placeholder="Navigate from a file path…"
          value={filePath()}
          onInput={(event) => setFilePath(event.currentTarget.value)}
        />
      </div>
      <Show when={navigation()}>
        {(nav) => (
          <div class="wg-navigation">
            <Show
              when={nav().matches.length}
              fallback={
                <div class="neu-gov-empty">
                  No graph node targets “{nav().filePath}” — unknown provenance.
                </div>
              }
            >
              <div class="wg-section-title">
                Why changed (backward) · {nav().filePath}
              </div>
              <Show
                when={nav().whyChanged.length}
                fallback={
                  <div class="neu-gov-empty">No inbound causal edge.</div>
                }
              >
                <For each={nav().whyChanged}>
                  {(tree) => <GraphNodeRow tree={tree} depth={0} />}
                </For>
              </Show>
              <div class="wg-section-title">What this touches (forward)</div>
              <Show
                when={nav().whatChanged.length}
                fallback={
                  <div class="neu-gov-empty">No outbound causal edge.</div>
                }
              >
                <For each={nav().whatChanged}>
                  {(tree) => <GraphNodeRow tree={tree} depth={0} />}
                </For>
              </Show>
            </Show>
          </div>
        )}
      </Show>
      <Show when={!navigation()}>
        <div class="neu-gov-empty">
          Enter a file path to navigate the causal graph from a change back to
          why it happened.
        </div>
      </Show>
    </div>
  );
}
