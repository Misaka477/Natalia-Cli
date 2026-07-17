import {
  TextareaRenderable,
  TextAttributes,
  type PasteEvent,
} from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { createEffect, createSignal, onMount } from "solid-js";
import { StateProvider, useAppState } from "../context/state";
import { DialogLayer } from "../dialog/DialogLayer";
import type { FakeBackend, RuntimeEvent } from "../fake/contract";
import { EditorBuffer } from "../prompt/editor";
import { SessionRoute } from "../routes/session/SessionRoute";
import { darkTheme } from "../theme/theme";

export function App(props: {
  backend: FakeBackend;
  onDispatch?: (event: RuntimeEvent) => void;
  initialPrompt?: string;
}) {
  return (
    <StateProvider
      onReady={(dispatch) => {
        props.backend.start((event) => {
          dispatch(event);
          props.onDispatch?.(event);
        });
        if (props.initialPrompt)
          setTimeout(() => void props.backend.submit(props.initialPrompt!), 20);
      }}
    >
      <Shell backend={props.backend} />
    </StateProvider>
  );
}

function Shell(props: { backend: FakeBackend }) {
  const renderer = useRenderer();
  const { state, dispatch } = useAppState();
  const [composer, setComposer] = createSignal<TextareaRenderable>();
  const [pastePreview, setPastePreview] = createSignal("");
  const scrollRef: { current?: any } = {};
  let submitting = false;

  onMount(() => setTimeout(() => composer()?.focus(), 1));

  async function submit() {
    if (submitting) return;
    const input = composer();
    const text = (input?.plainText ?? "").replace(/\n$/, "");
    if (!text.trim()) return;
    submitting = true;
    try {
      input?.clear();
      setPastePreview("");
      await props.backend.submit(text);
    } finally {
      submitting = false;
      setTimeout(() => composer()?.focus(), 1);
    }
  }

  function handlePaste(event: PasteEvent) {
    const text = new TextDecoder()
      .decode(event.bytes)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    if (new TextEncoder().encode(text).byteLength >= 100 * 1024) {
      const buffer = new EditorBuffer();
      buffer.setValue(text);
      setPastePreview(
        buffer.snapshot().foldedPreview ??
          `paste bytes=${buffer.snapshot().byteLength}`,
      );
    }
  }

  createEffect(() => {
    if (state.dialog === undefined) setTimeout(() => composer()?.focus(), 1);
  });
  createEffect(() => {
    const msgs = state.messages;
    const last = msgs[msgs.length - 1];
    const text = last?.text ?? "";
    const sb = scrollRef.current;
    if (!sb) return;
    const scrollBottom = sb.scrollHeight - sb.scrollTop;
    const threshold = (sb.viewport?.height ?? 10) * 3;
    if (scrollBottom <= threshold) sb.scrollTo(sb.scrollHeight);
  });

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={darkTheme.background}
    >
      <SessionRoute scrollRef={scrollRef} />
      <box
        flexShrink={0}
        border
        borderColor={state.dialog ? darkTheme.muted : darkTheme.accent}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        backgroundColor={darkTheme.panel}
      >
        <text
          attributes={TextAttributes.BOLD}
          fg={state.dialog ? darkTheme.muted : darkTheme.accent}
        >
          {state.dialog
            ? `Dialog: ${state.dialog} (Escape to close)`
            : "Message"}
        </text>
        <textarea
          ref={(value: TextareaRenderable) => setComposer(value)}
          minHeight={1}
          maxHeight={8}
          width="100%"
          placeholder={
            state.dialog
              ? "Dialog open – press Escape to return"
              : "Ask Natalia fake backend... (/long for long output test)"
          }
          placeholderColor={darkTheme.muted}
          textColor={state.dialog ? darkTheme.muted : darkTheme.text}
          focusedTextColor={darkTheme.text}
          cursorColor={darkTheme.accent}
          onPaste={handlePaste}
          onKeyDown={(event: {
            ctrl?: boolean;
            option?: boolean;
            shift?: boolean;
            name?: string;
            key?: string;
            preventDefault(): void;
          }) => {
            const key = event.name ?? event.key;
            if (key === "escape" && state.dialog) {
              event.preventDefault();
              dispatch({ type: "dialog.close" });
              return;
            }
            if (event.ctrl && key === "p") {
              event.preventDefault();
              if (state.dialog) {
                dispatch({ type: "dialog.close" });
              } else {
                dispatch({ type: "dialog.open", dialog: "palette" });
              }
              return;
            }
            if (state.dialog) return;
            if (key === "return" || key === "enter") {
              event.preventDefault();
              if (event.option || event.shift) {
                composer()?.insertText("\n");
              } else {
                submit();
              }
              return;
            }
            if (event.ctrl && key === "c") {
              event.preventDefault();
              if (state.activeTurn) {
                props.backend.cancel();
              } else if (composer()?.plainText) {
                composer()?.clear();
              } else {
                renderer.destroy();
              }
              return;
            }
            if (event.ctrl && key === "s") {
              event.preventDefault();
              props.backend.snapshot();
              return;
            }
            if (event.ctrl && key === "d") {
              event.preventDefault();
              if (!composer()?.plainText) renderer.destroy();
            }
            const sb = scrollRef.current;
            if (!sb) return;
            if (key === "pageup") {
              event.preventDefault();
              sb.scrollBy(-(sb.viewport?.height ?? 10) * 0.8);
              return;
            }
            if (key === "pagedown") {
              event.preventDefault();
              sb.scrollBy((sb.viewport?.height ?? 10) * 0.8);
              return;
            }
            if (key === "home") {
              event.preventDefault();
              sb.scrollTo(0);
              return;
            }
            if (key === "end") {
              event.preventDefault();
              sb.scrollTo(sb.scrollHeight);
              return;
            }
          }}
        />
        <text fg={darkTheme.muted}>{pastePreview() || state.footer}</text>
      </box>
      <DialogLayer />
    </box>
  );
}
