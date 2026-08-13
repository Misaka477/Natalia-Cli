import { BoxRenderable, type BaseRenderable } from "@opentui/core";

/**
 * Tight vertical rhythm for the transcript.
 *
 * A feed reads best when a run of one-line tool rows is packed tight (one line
 * per row) while anything taller or explicitly separated keeps its gap. OpenTUI
 * applies margins in its layout pass, so the decision has to run before that
 * pass and re-run whenever the frame changes: `onLifecyclePass` is that hook.
 *
 * The previous sibling of each element is resolved once per parent per frame
 * and cached, so a parent with many children does not rewalk its children list
 * for every child.
 */

/** Rows that must always be separated from what follows them. */
export const alwaysSeparate = new WeakSet<BoxRenderable>();

const previousByParent = new WeakMap<
  BaseRenderable,
  {
    frame: number;
    previous: WeakMap<BaseRenderable, BaseRenderable | undefined>;
  }
>();

export function tightSiblingMargin(
  element: BoxRenderable,
  margin: (previous?: BaseRenderable) => number,
) {
  element.onLifecyclePass = () => {
    const parent = element.parent;
    if (!parent) return;
    const cached = previousByParent.get(parent);
    const previous =
      cached?.frame === element.ctx.frameId
        ? cached.previous
        : previousSiblings(parent, element.ctx.frameId);
    const value = margin(previous.get(element));
    if (element.marginTop !== value) element.marginTop = value;
  };
}

function previousSiblings(parent: BaseRenderable, frame: number) {
  const previous = new WeakMap<BaseRenderable, BaseRenderable | undefined>();
  parent
    .getChildren()
    .forEach((child, index, children) =>
      previous.set(child, children[index - 1]),
    );
  previousByParent.set(parent, { frame, previous });
  return previous;
}

/** Whether a row should be separated from its predecessor. */
export function separates(previous: BaseRenderable | undefined): boolean {
  if (!previous || !(previous instanceof BoxRenderable)) return false;
  if (alwaysSeparate.has(previous)) return true;
  return previous.height > 1;
}

/**
 * The margin a compact row applies: separated from the first row of a parent
 * and from anything tall or explicitly separated, tight otherwise.
 */
export function tightRowMargin(previous: BaseRenderable | undefined): number {
  return previous === undefined || separates(previous) ? 1 : 0;
}
