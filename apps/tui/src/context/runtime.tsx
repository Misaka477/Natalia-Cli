import { createContext, useContext, type JSX } from "solid-js";

export type TuiRuntimeContext = Readonly<{
  cwd: string;
  platform: NodeJS.Platform;
  multiplexer?: "tmux" | "screen";
  displayServer?: "wayland" | "x11";
  mode: "runtime";
}>;

const RuntimeContext = createContext<TuiRuntimeContext>();

export function RuntimeProvider(props: {
  value?: Partial<TuiRuntimeContext>;
  children: JSX.Element;
}) {
  return (
    <RuntimeContext.Provider
      value={Object.freeze({
        cwd: props.value?.cwd ?? process.cwd(),
        platform: props.value?.platform ?? process.platform,
        multiplexer:
          props.value?.multiplexer ??
          (process.env.TMUX ? "tmux" : process.env.STY ? "screen" : undefined),
        displayServer:
          props.value?.displayServer ??
          (process.env.WAYLAND_DISPLAY
            ? "wayland"
            : process.env.DISPLAY
              ? "x11"
              : undefined),
        mode: "runtime",
      })}
    >
      {props.children}
    </RuntimeContext.Provider>
  );
}

export function useRuntimeContext() {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error("RuntimeProvider missing");
  return value;
}
