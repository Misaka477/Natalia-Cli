import {
  createContext,
  createSignal,
  onMount,
  useContext,
  type ParentProps,
} from "solid-js";
import { createStore } from "solid-js/store";
import { useToast } from "./toast";
import {
  addPromptStash,
  loadLocalTuiState,
  saveLocalTuiState,
  type LocalTuiState,
} from "../local";

export type LocalTuiContext = {
  readonly state: LocalTuiState;
  readonly ready: boolean;
  recordModel(model: string): void;
  toggleModelFavorite(model: string): void;
  selectAgent(agent?: string): void;
  stashPrompt(input: string): boolean;
  removeStash(index: number): void;
};

const LocalContext = createContext<LocalTuiContext>();

export function LocalProvider(props: ParentProps<{ workspaceRoot?: string }>) {
  const toast = useToast();
  const [state, setState] = createStore<LocalTuiState>({
    version: 1,
    pinnedSessions: [],
    recentModels: [],
    favoriteModels: [],
    mcpEnabled: {},
    promptStash: [],
  });
  const [ready, setReady] = createSignal(false);
  let write = Promise.resolve();

  function persist() {
    if (!props.workspaceRoot || !ready()) return;
    const snapshot = structuredClone(state);
    write = write
      .then(() => saveLocalTuiState(props.workspaceRoot!, snapshot))
      .catch((error) => {
        toast.error(error);
      });
  }

  onMount(() => {
    if (!props.workspaceRoot) {
      setReady(true);
      return;
    }
    void loadLocalTuiState(props.workspaceRoot)
      .then((loaded) => setState(loaded))
      .catch((error) => toast.error(error))
      .finally(() => setReady(true));
  });

  const value: LocalTuiContext = {
    get state() {
      return state;
    },
    get ready() {
      return ready();
    },
    recordModel(model) {
      setState("recentModels", (recent) =>
        [model, ...recent.filter((item) => item !== model)].slice(0, 10),
      );
      persist();
    },
    toggleModelFavorite(model) {
      setState("favoriteModels", (favorites) =>
        favorites.includes(model)
          ? favorites.filter((item) => item !== model)
          : [model, ...favorites],
      );
      persist();
    },
    selectAgent(agent) {
      setState("activeAgent", agent);
      persist();
    },
    stashPrompt(input) {
      const next = addPromptStash(state.promptStash, input);
      if (next === state.promptStash) return false;
      setState("promptStash", next);
      persist();
      return true;
    },
    removeStash(index) {
      setState("promptStash", (entries) =>
        entries.filter((_, current) => current !== index),
      );
      persist();
    },
  };

  return (
    <LocalContext.Provider value={value}>
      {props.children}
    </LocalContext.Provider>
  );
}

export function useLocal() {
  const value = useContext(LocalContext);
  if (!value) throw new Error("useLocal must be used within a LocalProvider");
  return value;
}
