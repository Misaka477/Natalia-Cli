import {
  InputRenderable,
  ScrollBoxRenderable,
  TextAttributes,
  type Renderable,
} from "@opentui/core";
import {
  batch,
  createEffect,
  createMemo,
  For,
  onCleanup,
  Show,
  on,
  type JSX,
} from "solid-js";
import { createStore } from "solid-js/store";
import { useTerminalDimensions } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import { darkTheme } from "../theme/theme";
import { useDialog, type DialogContext } from "./provider";
import { useKeybinds } from "../context/keybind";

export interface DialogSelectOption<T = any> {
  title: string;
  value: T;
  description?: string;
  footer?: JSX.Element | string;
  category?: string;
  disabled?: boolean;
  onSelect?: (dialog: DialogContext) => void;
}

export type DialogSelectRef<T> = {
  filter: string;
  filtered: DialogSelectOption<T>[];
  moveTo(value: T): void;
};

export interface DialogSelectProps<T> {
  title: string;
  options: DialogSelectOption<T>[];
  placeholder?: string;
  emptyView?: JSX.Element;
  skipFilter?: boolean;
  renderFilter?: boolean;
  flat?: boolean;
  current?: T;
  preserveSelection?: boolean;
  locked?: boolean;
  actions?: Array<{
    command: string;
    title: string;
    disabled?:
      | boolean
      | ((option: DialogSelectOption<T> | undefined) => boolean);
    onTrigger(option: DialogSelectOption<T>): void;
  }>;
  onSelect?: (option: DialogSelectOption<T>) => void;
  onClose?: () => void;
  onExtraKey?: (key: string, option: DialogSelectOption<T>) => void;
  onFilter?: (query: string) => void;
  onMove?: (option: DialogSelectOption<T>) => void;
  ref?: (ref: DialogSelectRef<T>) => void;
}

export function DialogSelect<T>(props: DialogSelectProps<T>) {
  const dialog = useDialog();
  const keybinds = useKeybinds();
  const dimensions = useTerminalDimensions();
  const [store, setStore] = createStore({
    selected: 0,
    filter: "",
  });
  let input: InputRenderable | undefined;
  let scroll: ScrollBoxRenderable | undefined;

  const filtered = createMemo(() => {
    if (props.skipFilter || props.options.length === 0)
      return props.options.filter((x) => !x.disabled);
    const needle = store.filter.toLowerCase().trim();
    if (!needle) return props.options.filter((x) => !x.disabled);
    const terms = needle.split(/\s+/u);

    // Simple fuzzy scoring: sort by match quality
    const scored = props.options
      .filter((x) => !x.disabled)
      .map((option) => {
        const text =
          `${option.title} ${option.description ?? ""} ${option.category ?? ""}`.toLowerCase();
        let score = 0;
        for (const term of terms) {
          if (text.includes(term)) {
            score += term.length;
            if (option.title.toLowerCase().includes(term)) score += 5;
            if (option.title.toLowerCase().startsWith(term)) score += 10;
          } else {
            score -= 20; // penalize missing terms
          }
        }
        return { option, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.option);

    return scored;
  });

  const grouped = createMemo(() => {
    if (props.flat) return [["", filtered()] as const];
    const groups = new Map<string, DialogSelectOption<T>[]>();
    for (const option of filtered()) {
      const category = option.category ?? "";
      let group = groups.get(category);
      if (!group) {
        group = [];
        groups.set(category, group);
      }
      group.push(option);
    }
    return [...groups.entries()];
  });

  // Navigation must follow the same category-grouped order rendered on screen.
  const flat = createMemo(() => grouped().flatMap(([, options]) => options));

  const rows = createMemo(() => {
    return grouped().reduce(
      (acc, [category, options]) => acc + (category ? 2 : 0) + options.length,
      0,
    );
  });

  const height = createMemo(() =>
    Math.min(rows(), Math.floor(dimensions().height / 2) - 6),
  );

  const selected = createMemo(() => flat()[store.selected]);

  createEffect(
    on(
      () => props.options,
      () => {
        if (!props.preserveSelection) return;
        const current = selected();
        if (!current) return;
        const index = flat().findIndex(
          (option) => option.value === current.value,
        );
        if (index >= 0) setStore("selected", index);
      },
    ),
  );

  function move(direction: number) {
    if (props.locked) return;
    if (flat().length === 0) return;
    let next = store.selected + direction;
    if (next < 0) next = flat().length - 1;
    if (next >= flat().length) next = 0;
    setStore("selected", next);
    scrollToSelection();
    const option = selected();
    if (option) props.onMove?.(option);
  }

  function scrollToSelection() {
    if (!scroll) return;
    let remaining = store.selected;
    let index = 0;
    for (const [category, options] of grouped()) {
      if (category) index++;
      if (remaining < options.length) {
        index += remaining;
        break;
      }
      index += options.length;
      remaining -= options.length;
    }
    const target = scroll.getChildren()[index];
    if (!target) return;
    const y = target.y - scroll.y;
    if (y >= scroll.height) scroll.scrollBy(y - scroll.height + 1);
    if (y < 0) {
      scroll.scrollBy(y);
      if (store.selected === 0) scroll.scrollTo(0);
    }
  }

  function submit() {
    if (props.locked) return;
    const option = selected();
    if (!option) return;
    option.onSelect?.(dialog);
    props.onSelect?.(option);
  }

  createEffect(
    on([() => store.filter], () => {
      setStore("selected", 0);
      if (scroll) scroll.scrollTo(0);
      props.onFilter?.(store.filter);
    }),
  );

  createEffect(() => {
    if (store.selected >= flat().length) {
      setStore("selected", Math.max(0, flat().length - 1));
    }
  });

  useBindings(() => ({
    mode: "modal",
    priority: 1,
    commands: [
      {
        name: "dialog.select.submit",
        title: "Select dialog item",
        category: "Dialog",
        run: submit,
      },
      ...(props.actions ?? []).map((action) => ({
        name: action.command,
        title: action.title,
        category: "Dialog",
        run: () => {
          const option = selected();
          const disabled =
            typeof action.disabled === "function"
              ? action.disabled(option)
              : action.disabled;
          if (!option || disabled || props.locked) return;
          action.onTrigger(option);
        },
      })),
    ],
    bindings: [
      ...keybinds.bindings("dialog.select.submit", ["return"]).map((key) => ({
        key,
        desc: "Select item",
        group: "Dialog",
        cmd: "dialog.select.submit",
      })),
      ...keybinds.bindings("dialog.select.prev", ["up"]).map((key) => ({
        key,
        desc: "Previous item",
        group: "Dialog",
        cmd: () => move(-1),
      })),
      ...keybinds.bindings("dialog.select.next", ["down"]).map((key) => ({
        key,
        desc: "Next item",
        group: "Dialog",
        cmd: () => move(1),
      })),
      ...keybinds.bindings("dialog.select.page-up", ["pageup"]).map((key) => ({
        key,
        desc: "Page up",
        group: "Dialog",
        cmd: () => move(-10),
      })),
      ...keybinds
        .bindings("dialog.select.page-down", ["pagedown"])
        .map((key) => ({
          key,
          desc: "Page down",
          group: "Dialog",
          cmd: () => move(10),
        })),
      ...keybinds.bindings("dialog.select.first", ["home"]).map((key) => ({
        key,
        desc: "First item",
        group: "Dialog",
        cmd: () => {
          if (flat().length > 0) setStore("selected", 0);
          if (scroll) scroll.scrollTo(0);
        },
      })),
      ...keybinds.bindings("dialog.select.last", ["end"]).map((key) => ({
        key,
        desc: "Last item",
        group: "Dialog",
        cmd: () => {
          if (flat().length > 0) setStore("selected", flat().length - 1);
          if (scroll) scroll.scrollTo(scroll.scrollHeight ?? 0);
        },
      })),
      ...(props.actions ?? []).flatMap((action) =>
        keybinds.bindings(action.command, []).map((key) => ({
          key,
          desc: action.title,
          group: "Dialog",
          cmd: action.command,
        })),
      ),
      ...(props.onExtraKey
        ? [
            {
              key: "f",
              desc: "Extra action",
              group: "Dialog",
              cmd: () => {
                const option = selected();
                if (option) props.onExtraKey?.("f", option);
              },
            },
          ]
        : []),
    ],
  }));

  const ref: DialogSelectRef<T> = {
    get filter() {
      return store.filter;
    },
    get filtered() {
      return filtered();
    },
    moveTo(value: T) {
      const idx = flat().findIndex((opt) => opt.value === value);
      if (idx >= 0) {
        setStore("selected", idx);
        scrollToSelection();
      }
    },
  };
  props.ref?.(ref);

  return (
    <box gap={1} paddingBottom={1} flexGrow={1}>
      <box paddingLeft={4} paddingRight={4}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={darkTheme.text} attributes={TextAttributes.BOLD}>
            {props.title}
          </text>
          <text fg={darkTheme.muted} onMouseUp={() => dialog.pop()}>
            esc
          </text>
        </box>
        <Show when={props.renderFilter !== false}>
          <box paddingTop={1}>
            <input
              onInput={(e: string) => {
                batch(() => {
                  setStore("filter", e);
                });
              }}
              focusedBackgroundColor={darkTheme.panel}
              cursorColor={darkTheme.accent}
              focusedTextColor={darkTheme.muted}
              ref={(r: InputRenderable) => {
                input = r;
                input.traits = { status: "FILTER" } as any;
                setTimeout(() => {
                  if (!input || input.isDestroyed) return;
                  input.focus();
                }, 1);
              }}
              placeholder={props.placeholder ?? "Search"}
              placeholderColor={darkTheme.muted}
            />
          </box>
        </Show>
      </box>
      <box flexGrow={1} flexShrink={1}>
        <Show
          when={grouped().length > 0}
          fallback={
            props.emptyView ?? (
              <box paddingLeft={4} paddingRight={4} paddingTop={1}>
                <text fg={darkTheme.muted}>No results found</text>
              </box>
            )
          }
        >
          <scrollbox
            paddingLeft={1}
            paddingRight={1}
            scrollbarOptions={{ visible: false }}
            ref={(r: ScrollBoxRenderable) => (scroll = r)}
            maxHeight={height()}
          >
            <For each={grouped()}>
              {([category, options], index) => (
                <>
                  <Show when={category}>
                    <box paddingTop={index() > 0 ? 1 : 0} paddingLeft={3}>
                      <text
                        fg={darkTheme.accent}
                        attributes={TextAttributes.BOLD}
                      >
                        {category}
                      </text>
                    </box>
                  </Show>
                  <For each={options}>
                    {(option) => {
                      const active = createMemo(
                        () => flat().indexOf(option) === store.selected,
                      );
                      return (
                        <box
                          flexDirection="row"
                          paddingLeft={3}
                          paddingRight={3}
                          gap={1}
                          backgroundColor={
                            active() ? darkTheme.accent : undefined
                          }
                          onMouseUp={() => {
                            option.onSelect?.(dialog);
                            props.onSelect?.(option);
                          }}
                          onMouseDown={() => {
                            const idx = flat().indexOf(option);
                            if (idx >= 0) setStore("selected", idx);
                          }}
                        >
                          <text
                            flexGrow={1}
                            fg={
                              active() ? darkTheme.background : darkTheme.text
                            }
                            attributes={
                              active() ? TextAttributes.BOLD : undefined
                            }
                            overflow="hidden"
                            wrapMode="none"
                          >
                            {option.title}
                            <Show when={option.description}>
                              <span
                                style={{
                                  fg: active()
                                    ? darkTheme.background
                                    : darkTheme.muted,
                                }}
                              >
                                {" "}
                                {option.description}
                              </span>
                            </Show>
                          </text>
                          <Show when={option.footer}>
                            <box flexShrink={0}>
                              <text
                                fg={
                                  active()
                                    ? darkTheme.background
                                    : darkTheme.muted
                                }
                              >
                                {option.footer}
                              </text>
                            </box>
                          </Show>
                        </box>
                      );
                    }}
                  </For>
                </>
              )}
            </For>
          </scrollbox>
        </Show>
      </box>
      <box
        paddingRight={2}
        paddingLeft={4}
        flexDirection="row"
        justifyContent="space-between"
        flexShrink={0}
      >
        <text fg={darkTheme.muted}>
          {props.renderFilter === false
            ? "↑↓ select · Enter apply · Escape close"
            : "Type to filter · ↑↓ select · Enter apply · Escape close"}
        </text>
        <Show when={(props.actions?.length ?? 0) > 0}>
          <box flexDirection="row" gap={1}>
            <For each={props.actions}>
              {(action) => <text fg={darkTheme.muted}>{action.title}</text>}
            </For>
          </box>
        </Show>
      </box>
    </box>
  );
}
