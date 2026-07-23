export type TimelineGroup<T> = {
  key: string;
  items: T[];
};

export type TimelineRange<T> = {
  items: Array<TimelineGroup<T>>;
  top: number;
  bottom: number;
  total: number;
};

export class TimelineVirtualizer<T> {
  private readonly sizes = new Map<string, number>();
  private groups: Array<TimelineGroup<T>> = [];
  private starts: number[] = [];
  private total = 0;

  constructor(private readonly estimateSize = 4) {}

  replace(input: Array<TimelineGroup<T>>, scrollTop: number, viewport: number) {
    const anchor = this.anchor(scrollTop);
    this.groups = input;
    this.rebuild();
    const anchorKey = anchor?.key;
    const anchorOffset = anchor?.offset;
    const next = anchorKey
      ? this.starts[this.groups.findIndex((group) => group.key === anchorKey)]
      : undefined;
    const adjustment =
      next === undefined || next < 0 || anchorOffset === undefined
        ? 0
        : Math.max(0, next - anchorOffset) - scrollTop;
    return { adjustment, range: this.range(scrollTop + adjustment, viewport) };
  }

  measure(key: string, size: number, scrollTop: number, viewport: number) {
    const index = this.groups.findIndex((group) => group.key === key);
    if (index < 0)
      return {
        changed: false,
        adjustment: 0,
        range: this.range(scrollTop, viewport),
      };
    const next = Math.max(1, Math.ceil(size));
    const previous = this.sizeAt(index);
    if (previous === next)
      return {
        changed: false,
        adjustment: 0,
        range: this.range(scrollTop, viewport),
      };
    const startsBefore = this.starts[index] ?? 0;
    this.sizes.set(key, next);
    this.rebuild();
    const adjustment = startsBefore < scrollTop ? next - previous : 0;
    return {
      changed: true,
      adjustment,
      range: this.range(scrollTop + adjustment, viewport),
    };
  }

  range(
    scrollTop: number,
    viewport: number,
    pinned: string[] = [],
  ): TimelineRange<T> {
    const visibleStart = Math.max(0, scrollTop);
    const visibleEnd = visibleStart + Math.max(1, viewport);
    const overscan = Math.max(
      6,
      Math.ceil(Math.max(1, viewport) / this.estimateSize),
    );
    let first = this.groups.findIndex(
      (_, index) => this.endAt(index) > visibleStart,
    );
    if (first < 0) first = Math.max(0, this.groups.length - 1);
    let last = this.groups.findIndex(
      (_, index) => (this.starts[index] ?? 0) >= visibleEnd,
    );
    if (last < 0) last = this.groups.length;
    const indexes = new Set<number>();
    for (
      let index = Math.max(0, first - overscan);
      index < Math.min(this.groups.length, last + overscan);
      index++
    )
      indexes.add(index);
    for (const key of pinned) {
      const index = this.groups.findIndex((group) => group.key === key);
      if (index >= 0) indexes.add(index);
    }
    const selected = [...indexes].sort((left, right) => left - right);
    const items = selected.map((index) => this.groups[index]!);
    const firstIndex = selected[0] ?? 0;
    const lastIndex = selected.at(-1);
    return {
      items,
      top: this.starts[firstIndex] ?? 0,
      bottom:
        lastIndex === undefined
          ? this.total
          : this.total - this.endAt(lastIndex),
      total: this.total,
    };
  }

  private anchor(scrollTop: number) {
    const index = this.groups.findIndex(
      (_, candidate) => this.endAt(candidate) > scrollTop,
    );
    if (index < 0) return undefined;
    return {
      key: this.groups[index]!.key,
      offset: (this.starts[index] ?? 0) - scrollTop,
    };
  }

  private rebuild() {
    let offset = 0;
    this.starts = this.groups.map((_, index) => {
      const start = offset;
      offset += this.sizeAt(index);
      return start;
    });
    this.total = offset;
  }

  private sizeAt(index: number) {
    return this.sizes.get(this.groups[index]!.key) ?? this.estimateSize;
  }

  private endAt(index: number) {
    return (this.starts[index] ?? 0) + this.sizeAt(index);
  }
}

export function groupTimelineBlocks<T extends { id: string; role: string }>(
  blocks: T[],
) {
  const groups: Array<TimelineGroup<T>> = [];
  for (const block of blocks) {
    const turnID = block.id.split(":", 1)[0] ?? block.id;
    const previous = groups.at(-1);
    const sameTurn =
      block.role !== "system" && previous?.key === `turn:${turnID}`;
    if (sameTurn) {
      previous.items.push(block);
      continue;
    }
    groups.push({
      key: block.role === "system" ? `block:${block.id}` : `turn:${turnID}`,
      items: [block],
    });
  }
  return groups;
}
