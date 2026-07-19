import { createContext, useContext, type JSX } from "solid-js";
import { readClipboardText, writeClipboard } from "../clipboard";

export type ClipboardService = {
  read?(): Promise<string | undefined>;
  write?(text: string): Promise<void>;
};

const defaultClipboard: ClipboardService = {
  read: readClipboardText,
  write: writeClipboard,
};
const ClipboardContext = createContext(defaultClipboard);

export function ClipboardProvider(props: {
  value?: ClipboardService;
  children: JSX.Element;
}) {
  return (
    <ClipboardContext.Provider value={props.value ?? defaultClipboard}>
      {props.children}
    </ClipboardContext.Provider>
  );
}

export function useClipboard() {
  return useContext(ClipboardContext);
}
