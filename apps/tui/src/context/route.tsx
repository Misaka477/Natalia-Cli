import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";

export type AppRoute = { kind: "none" } | { kind: "subagent"; id: string };

type NavigableRoute = Exclude<AppRoute, { kind: "none" }>;

export type RouteController = {
  route: Accessor<AppRoute>;
  push(next: NavigableRoute): void;
  replace(next: NavigableRoute): void;
  back(): void;
  close(): void;
};

const RouteContext = createContext<RouteController>();

export function RouteProvider(props: { children: JSX.Element }) {
  const controller = createRouteController();
  return (
    <RouteContext.Provider value={controller}>
      {props.children}
    </RouteContext.Provider>
  );
}

export function createRouteController(): RouteController {
  const [route, setRoute] = createSignal<AppRoute>({ kind: "none" });
  const stack: AppRoute[] = [];
  return {
    route,
    push(next) {
      const current = route();
      if (current.kind !== "none") stack.push(current);
      setRoute(next);
    },
    replace(next) {
      setRoute(next);
    },
    back() {
      setRoute(stack.pop() ?? { kind: "none" });
    },
    close() {
      stack.length = 0;
      setRoute({ kind: "none" });
    },
  };
}

export function useRouteController() {
  const controller = useContext(RouteContext);
  if (!controller) throw new Error("RouteProvider missing");
  return controller;
}
