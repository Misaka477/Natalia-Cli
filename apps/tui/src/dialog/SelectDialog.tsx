import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { TextAttributes } from "@opentui/core";
import { darkTheme } from "../theme/theme";
import { setModalKeyHandler } from "../modal/key-handler";

export type SelectOption<T> = {
  value: T;
  label: string;
  description?: string;
  group?: string;
  disabled?: string;
};

export function SelectDialog<T>(props: {
  open: boolean;
  title: string;
  options: SelectOption<T>[];
  onClose(): void;
  onSelect(value: T): void;
  onExtraKey?: (key: string, currentValue: T) => boolean;
  hint?: string;
}) {
  const [query, setQuery] = createSignal("");
  const [selected, setSelected] = createSignal(0);
  const filtered = createMemo(() => {
    const terms = query().toLowerCase().trim().split(/\s+/u).filter(Boolean);
    return props.options.filter((option) =>
      terms.every((term) =>
        `${option.label} ${option.description ?? ""} ${option.group ?? ""}`
          .toLowerCase()
          .includes(term),
      ),
    );
  });
  createEffect(() => {
    if (!props.open) return;
    setQuery("");
    setSelected(0);
    const dispose = setModalKeyHandler((key) => {
      if (key === "escape") {
        props.onClose();
        return true;
      }
      if (key === "up") {
        setSelected((value) => Math.max(0, value - 1));
        return true;
      }
      if (key === "down") {
        setSelected((value) => Math.min(filtered().length - 1, value + 1));
        return true;
      }
      if (key === "return") {
        const option = filtered()[selected()];
        if (option && !option.disabled) props.onSelect(option.value);
        return true;
      }
      if (props.onExtraKey) {
        const option = filtered()[selected()];
        if (option && props.onExtraKey(key, option.value)) return true;
      }
      return false;
    });
    onCleanup(dispose);
  });
  return (
    <Show when={props.open}>
      <box
        position="absolute"
        top="10%"
        left="8%"
        right="8%"
        border
        borderColor={darkTheme.accent}
        backgroundColor={darkTheme.panel}
        padding={2}
        flexDirection="column"
      >
        <text fg={darkTheme.accent} attributes={TextAttributes.BOLD}>
          {props.title}
        </text>
        <input
          placeholder="Search..."
          placeholderColor={darkTheme.muted}
          textColor={darkTheme.text}
          focusedTextColor={darkTheme.text}
          onInput={(value: string) => {
            setQuery(value);
            setSelected(0);
          }}
        />
        <scrollbox height={14} border={["left"]} borderColor={darkTheme.muted}>
          <For each={filtered()}>
            {(option, index) => (
              <box flexDirection="column">
                <text
                  fg={
                    option.disabled
                      ? darkTheme.muted
                      : index() === selected()
                        ? darkTheme.accent
                        : darkTheme.text
                  }
                  attributes={
                    index() === selected() ? TextAttributes.BOLD : undefined
                  }
                >
                  {index() === selected() ? ">" : " "} {option.label}
                  {option.group ? ` · ${option.group}` : ""}
                </text>
                <Show when={option.description}>
                  <text fg={darkTheme.muted}>
                    {" "}
                    {option.description}
                    {option.disabled ? ` · disabled: ${option.disabled}` : ""}
                  </text>
                </Show>
              </box>
            )}
          </For>
        </scrollbox>
        <text fg={darkTheme.muted}>
          Type to filter · Up/Down select · Enter apply · Escape close
          {props.hint ? ` · ${props.hint}` : ""}
        </text>
      </box>
    </Show>
  );
}
